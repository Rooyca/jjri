// Dino Runner Game Module
(function() {
    'use strict';
    
    window.GameModules = window.GameModules || {};
    
    window.GameModules['runner'] = {
        state: {
            canvas: null,
            ctx: null,
            player: { x: 50, y: 0, width: 30, height: 30, velocityY: 0, onGround: false },
            obstacles: [],
            score: 0,
            animationId: null,
            gameOver: false,
            started: false,
            speed: 7,
            gravity: 0.6,
            jumpPower: -12,
            ground: 0,
            lastSpawnTime: 0,  
            keyHandler: null
        },
 
        start: function(config, container, callbacks) {
            this.state.score        = 0;
            this.state.gameOver     = false;
            this.state.started      = false;
            this.state.obstacles    = [];
            this.state.speed        = 7;
            this.state.gravity      = 0.6; 
            this.state.lastSpawnTime = 0;
 
            container.innerHTML = `
                <div class="game-header">
                    <h3>${config.title}</h3>
                    <div class="game-instructions">Presiona ESPACIO o CLICK para saltar</div>
                </div>
                <div style="position: relative;">
                    <canvas id="gameCanvas" width="800" height="400"></canvas>
                    <button id="start-btn" class="btn-primary" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 1.5em; padding: 20px 40px; z-index: 10;">Iniciar</button>
                </div>
            `;
 
            this.state.canvas  = container.querySelector('#gameCanvas');
            this.state.ctx     = this.state.canvas.getContext('2d');
            
            const scaleCanvas = () => {
                const rect = this.state.canvas.getBoundingClientRect();
                const scale = window.devicePixelRatio || 1;
                this.state.canvas.style.width = rect.width + 'px';
                this.state.canvas.style.height = rect.height + 'px';
            };
            scaleCanvas();
            window.addEventListener('resize', scaleCanvas);
            
            this.state.ground  = this.state.canvas.height - 50;
 
            this.state.player.y         = this.state.ground - this.state.player.height;
            this.state.player.velocityY = 0;
            this.state.player.onGround  = true;
 
            const startBtn = container.querySelector('#start-btn');
 
            const jump = () => {
                if (this.state.player.onGround && !this.state.gameOver && this.state.started) {
                    this.state.player.velocityY = this.state.jumpPower;
                    this.state.player.onGround  = false;
                }
            };
 
            const handleKeyPress = (e) => {
                if (e.code === 'Space' || e.code === 'ArrowUp') {
                    e.preventDefault();
                    jump();
                }
            };
 
            document.addEventListener('keydown', handleKeyPress);
            this.state.canvas.addEventListener('click', jump);
            this.state.canvas.addEventListener('touchstart', (e) => {
                e.preventDefault();
                jump();
            }, { passive: false });
 
            this.state.keyHandler = handleKeyPress;
 
            const spawnObstacle = (timestamp) => {
                if (this.state.gameOver || !this.state.started) return;
 
                const difficultyLevel  = Math.floor(this.state.score / 10);
                const baseIntervalMs   = Math.max(900, 2200 - difficultyLevel * 150);
 
                if (timestamp - this.state.lastSpawnTime >= baseIntervalMs) {
                    const height = 30 + Math.random() * 40;
                    const width  = 20 + Math.random() * 20;
 
                    this.state.obstacles.push({
                        x:      this.state.canvas.width,
                        y:      this.state.ground - height,
                        width,
                        height,
                        scored: false 
                    });
 
                    this.state.lastSpawnTime = timestamp;
                }
            };
 
            const gameLoop = (timestamp) => {
                if (this.state.gameOver) return;
 
                const ctx    = this.state.ctx;
                const canvas = this.state.canvas;
                const player = this.state.player;
                const ground = this.state.ground;
 
                ctx.fillStyle = '#87CEEB';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
 
                ctx.fillStyle = '#8B7355';
                ctx.fillRect(0, ground, canvas.width, canvas.height - ground);
 
                player.velocityY += this.state.gravity;
                player.y         += player.velocityY;
 
                if (player.y >= ground - player.height) {
                    player.y        = ground - player.height;
                    player.velocityY = 0;
                    player.onGround  = true;
                }
 
                ctx.fillStyle = '#5D8B3A';
                ctx.fillRect(player.x, player.y, player.width, player.height);
 
                ctx.fillStyle = '#000';
                ctx.fillRect(player.x + player.width - 10, player.y + 8, 5, 5);
 
                spawnObstacle(timestamp);
 
                this.state.obstacles = this.state.obstacles.filter(obs => {
                    obs.x -= this.state.speed;
 
                    ctx.fillStyle = '#2D5016';
                    ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
 
                    if (
                        player.x                  < obs.x + obs.width  &&
                        player.x + player.width   > obs.x              &&
                        player.y                  < obs.y + obs.height &&
                        player.y + player.height  > obs.y
                    ) {
                        this.state.gameOver = true;
                        callbacks.onGameEnd(this.state.score, Date.now());
                        return false;
                    }
                    if (!obs.scored && obs.x + obs.width < player.x) {
                        obs.scored = true;
                        this.state.score++;
                        callbacks.onScoreUpdate(this.state.score);
 
                        if (this.state.score % 10 === 0 && this.state.speed < 12) {
                            this.state.speed += 0.3;
                        }
                    }
 
                    return obs.x + obs.width > 0;
                });
 
                ctx.fillStyle = '#000';
                ctx.font = 'bold 24px system-ui';
                ctx.textAlign = 'left';
                ctx.fillText(`Puntaje: ${this.state.score}`, 20, 35);
 
                this.state.animationId = requestAnimationFrame(gameLoop);
            };
 
            startBtn.onclick = () => {
                if (this.state.started) return;
                this.state.started = true;
                startBtn.style.display = 'none';
 
                this.state.animationId = requestAnimationFrame(gameLoop);
            };
        },
 
        cleanup: function() {
            if (this.state.animationId) {
                cancelAnimationFrame(this.state.animationId);
            }
            if (this.state.keyHandler) {
                document.removeEventListener('keydown', this.state.keyHandler);
            }
            this.state.gameOver = true;
        }
    };
})();
