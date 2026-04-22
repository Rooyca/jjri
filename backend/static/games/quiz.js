// Speed Maths Quiz Game Module
(function() {
    'use strict';
    
    window.GameModules = window.GameModules || {};
    
    window.GameModules['quiz'] = {
        state: { 
            timer: null, 
            score: 0, 
            currentProblem: null,
            timeLeft: 0,
            intervalId: null
        },
        
        generateProblem: function(operations, maxOperand) {
            const op = operations[Math.floor(Math.random() * operations.length)];
            const easyMax = Math.min(maxOperand, 12);
            const a = Math.floor(Math.random() * easyMax) + 1;
            const b = Math.floor(Math.random() * easyMax) + 1;
            
            let question, answer;
            switch(op) {
                case '+':
                    question = `${a} + ${b}`;
                    answer = a + b;
                    break;
                case '-':
                    const larger = Math.max(a, b);
                    const smaller = Math.min(a, b);
                    question = `${larger} - ${smaller}`;
                    answer = larger - smaller;
                    break;
                case '*':
                    const smallA = Math.floor(Math.random() * 10) + 1;
                    const smallB = Math.floor(Math.random() * 10) + 1;
                    question = `${smallA} × ${smallB}`;
                    answer = smallA * smallB;
                    break;
                case '/':
                    const divisor = Math.floor(Math.random() * 9) + 2;
                    const quotient = Math.floor(Math.random() * 10) + 1;
                    question = `${divisor * quotient} ÷ ${divisor}`;
                    answer = quotient;
                    break;
            }
            
            return { question, answer };
        },
        
        start: function(config, container, callbacks) {
            this.state.score = 0;
            this.state.timeLeft = config.duration_seconds;
            this.state.started = false;
            let startTime = null;

            container.innerHTML = `
                <div class="game-header">
                    <h3>${config.title}</h3>
                    <div class="score-display">Puntos: <span id="score-display">0</span></div>
                    <div class="timer">Tiempo: <span id="time-left">${this.state.timeLeft}</span>s</div>
                </div>
                <div class="quiz-container">
                    <p class="keyboard-hint">Presiona Enter o Espacio para iniciar</p>
                    <button id="start-btn" class="btn-primary" style="font-size: 1.5em; padding: 20px 40px; display: block; margin: 0 auto;">Iniciar</button>
                    <div id="game-area" style="display: none;">
                        <div class="problem-display" id="problem-display"></div>
                        <input type="number" id="answer-input" class="answer-input" placeholder="Tu respuesta...">
                        <div class="score-feedback" id="feedback"></div>
                    </div>
                </div>
            `;

            const startBtn = container.querySelector('#start-btn');
            const gameArea = container.querySelector('#game-area');
            const problemDisplay = container.querySelector('#problem-display');
            const answerInput = container.querySelector('#answer-input');
            const feedback = container.querySelector('#feedback');
            const timeDisplay = container.querySelector('#time-left');
            const scoreDisplay = container.querySelector('#score-display');
            
            const showNextProblem = () => {
                this.state.currentProblem = this.generateProblem(
                    config.settings.operations, 
                    config.settings.max_operand
                );
                problemDisplay.innerHTML = `<h2>${this.state.currentProblem.question} = ?</h2>`;
                answerInput.value = '';
                answerInput.focus();
                feedback.textContent = '';
            };
            
            const checkAnswer = () => {
                const userAnswer = parseInt(answerInput.value);
                if (isNaN(userAnswer)) return;
                
                if (userAnswer === this.state.currentProblem.answer) {
                    this.state.score++;
                    scoreDisplay.textContent = this.state.score;
                    callbacks.onScoreUpdate(this.state.score);
                    feedback.className = 'score-feedback correct';
                    showNextProblem();
                } else {
                    feedback.className = 'score-feedback incorrect';
                    showNextProblem();
                }
            };
            
            startBtn.onclick = () => {
                if (this.state.started) return;
                this.state.started = true;
                startTime = Date.now();
                
                startBtn.style.display = 'none';
                gameArea.style.display = 'block';
                
                answerInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') checkAnswer();
                });
                
                this.state.intervalId = setInterval(() => {
                    this.state.timeLeft--;
                    timeDisplay.textContent = this.state.timeLeft;
                    
                    if (this.state.timeLeft <= 0) {
                        clearInterval(this.state.intervalId);
                        const durationMs = Date.now() - startTime;
                        callbacks.onGameEnd(this.state.score, durationMs);
                    }
                }, 1000);
                
                showNextProblem();
            };
        },
        
        cleanup: function() {
            if (this.state.timer) clearTimeout(this.state.timer);
            if (this.state.intervalId) clearInterval(this.state.intervalId);
        }
    };
})();
