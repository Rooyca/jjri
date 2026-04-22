// Speed Typing Game Module
(function() {
    'use strict';
    
    window.GameModules = window.GameModules || {};
    
    const TypingUtils = {
        calculateWpm(correctWords, startTime) {
            if (!startTime) return 0;
            const elapsedMinutes = (Date.now() - startTime) / 60000;
            return elapsedMinutes > 0 ? Math.round(correctWords / elapsedMinutes) : 0;
        },

        formatTime(seconds) {
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;
        },

        showWord(wordDisplayEl, words, currentWordIndex) {
            if (currentWordIndex < words.length) {
                wordDisplayEl.textContent = words[currentWordIndex];
            }
        },

        validateInput(typedText, currentWord) {
            const tt = (typedText || '').toLowerCase();
            const cw = (currentWord || '').toLowerCase();
            const isCorrect = tt === cw;
            const isPartialMatch = tt.length > 0 && cw.startsWith(tt);
            
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
    
    window.GameModules['typing'] = {
        state: {
            words: [],
            currentWordIndex: 0,
            startTime: null,
            correctWords: 0,
            totalChars: 0,
            errors: 0,
            intervalId: null,
            timeLeft: 0,
            elapsedTime: 0
        },
        
        start: async function(config, container, callbacks) {
            this.state.correctWords = 0;
            this.state.currentWordIndex = 0;
            this.state.errors = 0;
            this.state.totalChars = 0;
            this.state.timeLeft = config.duration_seconds;
            this.state.elapsedTime = 0;
            this.state.started = false;
            
            const API_BASE = window.API_BASE || `https://${window.location.host}/api`;
            const wordListUrl = config.settings.word_list_url.startsWith('http') 
                ? config.settings.word_list_url 
                : `${API_BASE}${config.settings.word_list_url.replace('/api', '')}`;
            const response = await fetch(wordListUrl);
            const data = await response.json();
            
            this.state.words = data.words.sort(() => Math.random() - 0.5).slice(0, 100);
            
            container.innerHTML = `
                <div class="game-header">
                    <h3>${config.title}</h3>
                    <div class="timer">Tiempo: <span id="time-left">${this.state.timeLeft}</span>s</div>
                </div>
                <div class="typing-container">
                    <p class="keyboard-hint">Presiona Enter o Espacio para iniciar</p>
                    <button id="start-btn" class="btn-primary" style="font-size: 1.5em; padding: 20px 40px; display: block; margin: 0 auto;">Iniciar</button>
                    <div id="game-area" style="display: none;">
                        <div class="typing-stats">
                            <div>Palabras: <span id="word-count">0</span></div>
                            <div>Precisión: <span id="accuracy">100</span>%</div>
                        </div>
                        <div class="word-display" id="word-display"></div>
                        <input type="text" id="typing-input" class="typing-input" placeholder="Escribe aquí..." autocomplete="off">
                        <div class="progress-bar">
                            <div class="progress-fill" id="progress"></div>
                        </div>
                    </div>
                </div>
            `;
            
            const startBtn = container.querySelector('#start-btn');
            const gameArea = container.querySelector('#game-area');
            const wordDisplay = container.querySelector('#word-display');
            const typingInput = container.querySelector('#typing-input');
            const elapsedTimeDisplay = container.querySelector('#word-count');
            const accuracyDisplay = container.querySelector('#accuracy');
            const timeDisplay = container.querySelector('#time-left');
            const progressBar = container.querySelector('#progress');
            
            const showWord = () => {
                if (wordDisplay && this.state.words && this.state.words.length > 0) {
                    TypingUtils.showWord(wordDisplay, this.state.words, this.state.currentWordIndex);
                }
            };
            
            const updateStats = () => {
                if (!this.state.startTime) return;
                
                const accuracy = this.state.totalChars > 0 
                    ? Math.round(((this.state.totalChars - this.state.errors) / this.state.totalChars) * 100)
                    : 100;
                
                elapsedTimeDisplay.textContent = this.state.correctWords;
                accuracyDisplay.textContent = accuracy;
            };

            const advanceWord = () => {
                const currentWord = this.state.words[this.state.currentWordIndex];
                this.state.correctWords++;
                this.state.totalChars += currentWord.length;
                callbacks.onScoreUpdate(this.state.correctWords);
                this.state.currentWordIndex++;
                TypingUtils.clearInput(typingInput);
                showWord();
                updateStats();
            };
            
            const handleInput = (e) => {
                if (!this.state.started) return;
                
                const typed = e.target.value;
                const currentWord = this.state.words[this.state.currentWordIndex];
                
                const validation = TypingUtils.validateInput(typed, currentWord);
                
                if (validation.isCorrect) {
                    advanceWord();
                } else {
                    TypingUtils.applyInputFeedback(typingInput, validation);
                    if (!validation.isPartialMatch && typed.length > 0) {
                        this.state.errors++;
                    }
                }
            };
            
            const handleKeydown = (e) => {
                if (!this.state.started) return;
                
                if (e.key === ' ') {
                    e.preventDefault();
                    const typed = typingInput.value.trim();
                    const currentWord = this.state.words[this.state.currentWordIndex];
                    
                    if (typed === currentWord) {
                        advanceWord();
                    }
                }
            };
            
            typingInput.addEventListener('input', handleInput);
            typingInput.addEventListener('keydown', handleKeydown);
            
            startBtn.onclick = () => {
                if (this.state.started) return;
                this.state.started = true;
                this.state.startTime = Date.now();
                
                startBtn.style.display = 'none';
                gameArea.style.display = 'block';
                typingInput.focus();
                
                this.state.intervalId = setInterval(() => {
                    this.state.timeLeft--;
                    this.state.elapsedTime++;
                    timeDisplay.textContent = this.state.timeLeft;
                    
                    if (progressBar) {
                        progressBar.style.width = `${(this.state.elapsedTime / config.duration_seconds) * 100}%`;
                    }
                    
                    if (this.state.timeLeft <= 0) {
                        clearInterval(this.state.intervalId);
                        const durationMs = Date.now() - this.state.startTime;
                        callbacks.onGameEnd(this.state.correctWords, durationMs);
                    }
                }, 1000);
                
                showWord();
            };
        },
        
        cleanup: function() {
            if (this.state.intervalId) clearInterval(this.state.intervalId);
        }
    };
})();
