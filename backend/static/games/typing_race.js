// Typing Race (Multiplayer WebSocket) Game Module
(function() {
    'use strict';
    
    window.GameModules = window.GameModules || {};
    
    const TypingUtils = {
        calculateWpm(correctWords, startTime) {
            if (!startTime) return 0;
            const elapsedMinutes = (Date.now() - startTime) / 60000;
            return elapsedMinutes > 0 ? Math.round(correctWords / elapsedMinutes) : 0;
        },

        showWord(wordDisplayEl, words, currentWordIndex) {
            if (currentWordIndex < words.length) {
                wordDisplayEl.textContent = words[currentWordIndex];
            }
        },

        validateInput(typedText, currentWord) {
            const isCorrect = typedText.toLowerCase() === currentWord;
            const isPartialMatch = currentWord.startsWith(typedText.toLowerCase());
            
            return {
                isCorrect,
                isPartialMatch,
                shouldAdvance: isCorrect
            };
        },

        applyInputFeedback(inputEl, validation) {
            if (validation.isCorrect) {
                inputEl.style.border = '2px solid #4ade80';
            } else if (validation.isPartialMatch) {
                inputEl.style.border = '2px solid #90EE90';
            } else {
                inputEl.style.border = '2px solid #FFB6C6';
            }
        },

        clearInput(inputEl) {
            inputEl.value = '';
            inputEl.style.border = '';
        }
    };
    
    window.GameModules['typing_race'] = {
        state: {
            ws: null,
            words: [],
            currentWordIndex: 0,
            correctWords: 0,
            startTime: null,
            intervalId: null,
            roomId: null,
            playerName: null,
            opponentProgress: 0,
            opponentWpm: 0,
            lastProgressSent: 0,
            isRacing: false,
            currentWpm: 0
        },

        start: function(config, container, callbacks) {
            const playerName = window.playerName || "Player";
            this.state.playerName = playerName;
            this.state.currentWordIndex = 0;
            this.state.correctWords = 0;
            this.state.opponentProgress = 0;
            this.state.opponentWpm = 0;
            this.state.isRacing = false;
            
            container.innerHTML = `
                <div class="game-header">
                    <h3>${config.title}</h3>
                    <div class="timer">PPM: <span id="wpm-display">0</span></div>
                </div>
                <div class="typing-container">
                    <div id="race-status" style="text-align: center; padding: 20px; font-size: 1.2em;">
                        <div style="font-size: 2em; margin-bottom: 10px;">⏳</div>
                        <div>Buscando oponente...</div>
                    </div>
                    <div id="countdown-display" style="display: none; text-align: center; font-size: 5em; font-weight: bold; color: #4ade80; margin: 40px 0;"></div>
                    <div id="race-area" style="display: none;">
                        <div id="race-progress" style="display: none; margin: 20px 0;">
                            <div style="margin-bottom: 15px;">
                                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                                    <span>TÚ</span>
                                    <span id="your-progress-text">0%</span>
                                </div>
                                <div style="background: #333; border-radius: 10px; height: 30px; overflow: hidden;">
                                    <div id="your-progress-bar" style="background: linear-gradient(90deg, #4ade80, #22c55e); height: 100%; width: 0%; transition: width 0.3s;"></div>
                                </div>
                            </div>
                            <div>
                                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                                    <span>OPONENTE</span>
                                    <span id="opponent-progress-text">0%</span>
                                </div>
                                <div style="background: #333; border-radius: 10px; height: 30px; overflow: hidden;">
                                    <div id="opponent-progress-bar" style="background: linear-gradient(90deg, #f87171, #dc2626); height: 100%; width: 0%; transition: width 0.3s;"></div>
                                </div>
                            </div>
                        </div>
                        <div class="word-display" id="word-display" style="font-size: 3em; text-align: center; margin: 30px 0; min-height: 80px;"></div>
                        <input type="text" id="race-input" class="typing-input" placeholder="Escribe aquí..." autocomplete="off" style="font-size: 1.5em;">
                    </div>
                    <div id="result-overlay" style="display: none; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.95); padding: 40px; border-radius: 15px; text-align: center; z-index: 100;">
                        <div id="result-text" style="font-size: 2em; margin-bottom: 20px;"></div>
                        <div id="result-stats" style="font-size: 1.2em; color: #aaa;"></div>
                    </div>
                </div>
            `;

            const BASE_DIR = window.BASE_DIR || window.location.host;
            const wsUrl = `wss://${BASE_DIR}/ws/race?player_name=${encodeURIComponent(this.state.playerName)}`;
            this.state.ws = new WebSocket(wsUrl);

            this.state.ws.onopen = () => {
                console.log("WebSocket connected");
            };

            this.state.ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.handleWebSocketMessage(data, container, callbacks);
            };

            this.state.ws.onerror = (error) => {
                console.error("WebSocket error:", error);
                const statusEl = container.querySelector('#race-status');
                if (statusEl) {
                    statusEl.innerHTML = '<div style="color: #f87171;">Error de conexión. Intenta de nuevo.</div>';
                }
            };

            this.state.ws.onclose = () => {
                console.log("WebSocket closed");
            };
        },

        handleWebSocketMessage: function(data, container, callbacks) {
            const statusEl = container.querySelector('#race-status');
            const progressEl = container.querySelector('#race-progress');
            const countdownEl = container.querySelector('#countdown-display');
            const raceAreaEl = container.querySelector('#race-area');

            switch (data.type) {
                case "waiting":
                    break;

                case "start":
                    this.state.roomId = data.room_id;
                    this.state.words = data.words;
                    this.state.currentWordIndex = 0;
                    
                    statusEl.style.display = 'none';
                    progressEl.style.display = 'block';
                    countdownEl.style.display = 'block';
                    
                    let count = data.countdown || 3;
                    countdownEl.textContent = count;
                    
                    const countdownInterval = setInterval(() => {
                        count--;
                        if (count > 0) {
                            countdownEl.textContent = count;
                        } else {
                            countdownEl.textContent = "¡GO!";
                            setTimeout(() => {
                                countdownEl.style.display = 'none';
                                raceAreaEl.style.display = 'block';
                                this.startRacing(container, callbacks);
                            }, 500);
                            clearInterval(countdownInterval);
                        }
                    }, 1000);
                    break;

                case "opponent_progress":
                    this.state.opponentProgress = data.word_index;
                    this.state.opponentWpm = data.wpm;
                    this.updateProgressBars(container);
                    break;

                case "result":
                    this.showResult(data, container, callbacks);
                    break;

                case "opponent_disconnected":
                    this.showDisconnectMessage(container, callbacks);
                    break;

                case "error":
                    console.error("Server error:", data.message);
                    if (statusEl) {
                        statusEl.innerHTML = `<div style="color: #f87171;">Error: ${data.message}</div>`;
                    }
                    break;
            }
        },

        startRacing: function(container, callbacks) {
            this.state.isRacing = true;
            this.state.startTime = Date.now();
            
            const inputEl = container.querySelector('#race-input');
            const wordDisplayEl = container.querySelector('#word-display');
            
            this.showCurrentWord(container);
            inputEl.focus();

            inputEl.addEventListener('input', (e) => {
                if (!this.state.isRacing) return;
                
                const typed = e.target.value;
                const currentWord = this.state.words[this.state.currentWordIndex];
                
                const validation = TypingUtils.validateInput(typed, currentWord);
                
                if (validation.isCorrect) {
                    this.state.correctWords++;
                    this.state.currentWordIndex++;
                    TypingUtils.clearInput(inputEl);
                    
                    if (this.state.currentWordIndex >= this.state.words.length) {
                        this.finishRace(container, callbacks);
                    } else {
                        this.showCurrentWord(container);
                        this.sendProgress();
                    }
                    
                    this.updateProgressBars(container);
                } else {
                    TypingUtils.applyInputFeedback(inputEl, validation);
                }
                
                this.updateWpm(container);
            });

            this.state.intervalId = setInterval(() => {
                this.updateWpm(container);
            }, 500);
        },

        showCurrentWord: function(container) {
            const wordDisplayEl = container.querySelector('#word-display');
            TypingUtils.showWord(wordDisplayEl, this.state.words, this.state.currentWordIndex);
        },

        updateWpm: function(container) {
            if (!this.state.startTime) return;
            
            const wpm = TypingUtils.calculateWpm(this.state.correctWords, this.state.startTime);
            this.state.currentWpm = wpm;
            
            const wpmDisplayEl = container.querySelector('#wpm-display');
            if (wpmDisplayEl) {
                wpmDisplayEl.textContent = wpm;
            }
        },

        updateProgressBars: function(container) {
            const yourProgressBar = container.querySelector('#your-progress-bar');
            const yourProgressText = container.querySelector('#your-progress-text');
            const opponentProgressBar = container.querySelector('#opponent-progress-bar');
            const opponentProgressText = container.querySelector('#opponent-progress-text');
            
            const totalWords = this.state.words.length;
            
            if (yourProgressBar && totalWords > 0) {
                const yourPercent = Math.round((this.state.currentWordIndex / totalWords) * 100);
                yourProgressBar.style.width = yourPercent + '%';
                yourProgressText.textContent = yourPercent + '%';
            }
            
            if (opponentProgressBar && totalWords > 0) {
                const opponentPercent = Math.round((this.state.opponentProgress / totalWords) * 100);
                opponentProgressBar.style.width = opponentPercent + '%';
                opponentProgressText.textContent = opponentPercent + '%';
            }
        },

        sendProgress: function() {
            const now = Date.now();
            if (now - this.state.lastProgressSent > 300) {
                if (this.state.ws && this.state.ws.readyState === WebSocket.OPEN) {
                    this.state.ws.send(JSON.stringify({
                        type: "progress",
                        word_index: this.state.currentWordIndex,
                        wpm: this.state.currentWpm
                    }));
                    this.state.lastProgressSent = now;
                }
            }
        },

        finishRace: function(container, callbacks) {
            this.state.isRacing = false;
            
            if (this.state.intervalId) {
                clearInterval(this.state.intervalId);
            }
            
            if (this.state.ws && this.state.ws.readyState === WebSocket.OPEN) {
                this.state.ws.send(JSON.stringify({
                    type: "finish",
                    wpm: this.state.currentWpm
                }));
            }
            
            const inputEl = container.querySelector('#race-input');
            if (inputEl) {
                inputEl.disabled = true;
            }
        },

        showResult: function(data, container, callbacks) {
            const resultOverlay = container.querySelector('#result-overlay');
            const resultText = container.querySelector('#result-text');
            const resultStats = container.querySelector('#result-stats');
            
            if (resultOverlay && resultText && resultStats) {
                const isWinner = data.is_winner;
                
                resultText.innerHTML = isWinner 
                    ? '<div style="color: #4ade80; font-size: 1.5em;">🏆 ¡GANASTE! 🏆</div>'
                    : '<div style="color: #f87171;">Perdiste</div>';
                
                resultStats.innerHTML = `
                    <div style="margin: 10px 0;">Tu PPM: <span style="color: #4ade80; font-weight: bold;">${data.your_wpm}</span></div>
                    <div style="margin: 10px 0;">Oponente PPM: <span style="color: #f87171; font-weight: bold;">${data.opponent_wpm}</span></div>
                `;
                
                resultOverlay.style.display = 'block';
                
                const durationMs = this.state.startTime ? Date.now() - this.state.startTime : 0;
                
                setTimeout(() => {
                    callbacks.onGameEnd(data.your_wpm, durationMs);
                }, 3000);
            }
        },

        showDisconnectMessage: function(container, callbacks) {
            this.state.isRacing = false;
            
            const resultOverlay = container.querySelector('#result-overlay');
            const resultText = container.querySelector('#result-text');
            const resultStats = container.querySelector('#result-stats');
            
            if (resultOverlay && resultText && resultStats) {
                resultText.innerHTML = '<div style="color: #4ade80; font-size: 1.5em;">🏆 ¡GANASTE! 🏆</div>';
                resultStats.innerHTML = '<div style="margin: 10px 0;">Tu oponente se desconectó</div>';
                resultOverlay.style.display = 'block';
                
                const durationMs = this.state.startTime ? Date.now() - this.state.startTime : 0;
                
                setTimeout(() => {
                    callbacks.onGameEnd(this.state.currentWpm, durationMs);
                }, 3000);
            }
        },

        cleanup: function() {
            this.state.isRacing = false;
            
            if (this.state.intervalId) {
                clearInterval(this.state.intervalId);
            }
            
            if (this.state.ws) {
                this.state.ws.close();
                this.state.ws = null;
            }
        }
    };
})();
