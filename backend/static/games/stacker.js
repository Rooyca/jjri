// Block Stacker Game Module
(function() {
    'use strict';
    
    window.GameModules = window.GameModules || {};
    
    window.GameModules['stacker'] = {
        playSound: function(type) {
            if (!this.state.audioContext) {
                this.state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            const ctx = this.state.audioContext;
            const now = ctx.currentTime;
            
            if (type === 'drop') {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                
                osc.connect(gain);
                gain.connect(ctx.destination);
                
                osc.frequency.setValueAtTime(200, now);
                osc.frequency.exponentialRampToValueAtTime(100, now + 0.2);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
                
                osc.start(now);
                osc.stop(now + 0.2);
            } else if (type === 'success') {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                
                osc.connect(gain);
                gain.connect(ctx.destination);
                
                osc.frequency.setValueAtTime(500, now);
                osc.frequency.exponentialRampToValueAtTime(800, now + 0.15);
                gain.gain.setValueAtTime(0.3, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
                
                osc.start(now);
                osc.stop(now + 0.15);
            } else if (type === 'fail') {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                
                osc.connect(gain);
                gain.connect(ctx.destination);
                
                osc.frequency.setValueAtTime(300, now);
                osc.frequency.exponentialRampToValueAtTime(80, now + 0.4);
                gain.gain.setValueAtTime(0.4, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
                
                osc.start(now);
                osc.stop(now + 0.4);
            }
        },

        state: {
            canvas: null,
            ctx: null,
            tower: [],
            movingBlock: { x: 0, width: 0, direction: 1, speed: 3 },
            fallingBlock: null,
            cutPiece: null,
            score: 0,
            animationId: null,
            gameOver: false,
            started: false,
            waiting: false,
            cameraOffset: 0,
            targetCameraOffset: 0,
            keyHandler: null,
            blockHeight: 30,
            audioContext: null,
            colors: ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c', '#3498db', '#9b59b6', '#e91e63']
        },
 
        getColor: function(index) {
            return this.state.colors[index % this.state.colors.length];
        },
 
        start: function(config, container, callbacks) {
            const s = this.state;
 
            s.score              = 0;
            s.gameOver           = false;
            s.started            = false;
            s.waiting            = false;
            s.tower              = [];
            s.fallingBlock       = null;
            s.cutPiece           = null;
            s.cameraOffset       = 0;
            s.targetCameraOffset = 0;
            s.movingBlock.speed  = 3;
 
            container.innerHTML = `
                <div class="game-header">
                    <h3>${config.title}</h3>
                    <div class="game-instructions">Presiona Espacio o Click para soltar el bloque.</div>
                </div>
                <div style="position: relative;">
                    <p class="keyboard-hint game-start-hint">Presiona Enter o Espacio para iniciar</p>
                    <canvas id="gameCanvas" width="800" height="400"></canvas>
                    <button id="start-btn" class="btn-primary" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 1.5em; padding: 20px 40px; z-index: 10;">Iniciar</button>
                </div>
            `;
 
            s.canvas = container.querySelector('#gameCanvas');
            s.ctx    = s.canvas.getContext('2d');
            
            const scaleCanvas = () => {
                const rect = s.canvas.getBoundingClientRect();
                const scale = window.devicePixelRatio || 1;
                s.canvas.style.width = rect.width + 'px';
                s.canvas.style.height = rect.height + 'px';
            };
            scaleCanvas();
            window.addEventListener('resize', scaleCanvas);
 
            const W  = s.canvas.width;
            const H  = s.canvas.height;
            const BH = s.blockHeight;
 
            const baseWidth = 200;
            const baseWorldY = H - BH - 20;
 
            s.tower.push({
                x:      (W - baseWidth) / 2,
                y:      baseWorldY,
                width:  baseWidth,
                height: BH,
                color:  this.getColor(0)
            });
 
            s.movingBlock.x     = 0;
            s.movingBlock.width = baseWidth;
            s.movingBlock.direction = 1;
 
            const startBtn = container.querySelector('#start-btn');
 
            const drop = () => {
                if (!s.started || s.gameOver || s.waiting) return;
                s.waiting = true;
                this.playSound('drop');

                const worldY = 30 + s.cameraOffset;

                s.fallingBlock = {
                    x:         s.movingBlock.x,
                    y:         worldY,
                    width:     s.movingBlock.width,
                    height:    BH,
                    velocityY: 0,
                    color:     this.getColor(s.score + 1)
                };
            };
 
            const handleKeyPress = (e) => {
                if (e.code === 'Space' || e.code === 'ArrowDown') {
                    e.preventDefault();
                    drop();
                }
            };
 
            document.addEventListener('keydown', handleKeyPress);
            s.canvas.addEventListener('click', drop);
            s.canvas.addEventListener('touchstart', (e) => {
                e.preventDefault();
                drop();
            }, { passive: false });
 
            s.keyHandler = handleKeyPress;
 
            const land = () => {
                const fb  = s.fallingBlock;
                const top = s.tower[s.tower.length - 1];

                const overlapLeft  = Math.max(fb.x, top.x);
                const overlapRight = Math.min(fb.x + fb.width, top.x + top.width);
                const overlap      = overlapRight - overlapLeft;

                if (overlap <= 0) {
                    s.gameOver = true;
                    s.fallingBlock = null;
                    this.playSound('fail');
                    callbacks.onGameEnd(s.score, Date.now());
                    return;
                }

                if (overlap < fb.width) {
                    const cutX    = fb.x < top.x ? fb.x : overlapRight;
                    const cutW    = fb.width - overlap;
                    s.cutPiece = {
                        x:         cutX,
                        y:         fb.y,
                        width:     cutW,
                        height:    BH,
                        velocityY: 0,
                        color:     fb.color
                    };
                }

                s.tower.push({
                    x:      overlapLeft,
                    y:      top.y - BH,
                    width:  overlap,
                    height: BH,
                    color:  fb.color
                });

                s.fallingBlock = null;
                s.score++;
                this.playSound('success');
                callbacks.onScoreUpdate(s.score);

                s.movingBlock.speed = Math.min(12, 3 + Math.floor(s.score / 5) * 0.5);

                const newTop = s.tower[s.tower.length - 1];
                s.targetCameraOffset = newTop.y - 100;

                s.movingBlock.width     = overlap;
                s.movingBlock.x         = 0;
                s.movingBlock.direction = 1;

                s.waiting = false;
            };
 
            const gameLoop = () => {
                const ctx = s.ctx;
 
                s.cameraOffset += (s.targetCameraOffset - s.cameraOffset) * 0.08;
 
                ctx.fillStyle = '#1a1a2e';
                ctx.fillRect(0, 0, W, H);
 
                s.tower.forEach(block => {
                    const screenY = block.y - s.cameraOffset;
                    if (screenY > H || screenY + block.height < 0) return;
 
                    ctx.fillStyle = block.color;
                    ctx.fillRect(block.x, screenY, block.width, block.height);
 
                    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
                    ctx.lineWidth   = 2;
                    ctx.strokeRect(block.x, screenY, block.width, block.height);
                });
 
                if (s.fallingBlock) {
                    const fb  = s.fallingBlock;
                    const top = s.tower[s.tower.length - 1];
 
                    fb.velocityY += 0.5;
                    fb.y         += fb.velocityY;
 
                    if (fb.y + fb.height >= top.y) {
                        fb.y = top.y - BH;
                        land();
                    } else {
                        const screenY = fb.y - s.cameraOffset;
                        ctx.fillStyle   = fb.color;
                        ctx.fillRect(fb.x, screenY, fb.width, fb.height);
                        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
                        ctx.lineWidth   = 2;
                        ctx.strokeRect(fb.x, screenY, fb.width, fb.height);
                    }
                }
 
                if (s.cutPiece) {
                    const cp = s.cutPiece;
                    cp.velocityY += 0.6;
                    cp.y         += cp.velocityY;
 
                    const screenY = cp.y - s.cameraOffset;
                    if (screenY < H) {
                        ctx.globalAlpha = 0.65;
                        ctx.fillStyle   = cp.color;
                        ctx.fillRect(cp.x, screenY, cp.width, cp.height);
                        ctx.globalAlpha = 1;
                    } else {
                        s.cutPiece = null;
                    }
                }
 
                if (!s.waiting && !s.gameOver) {
                    s.movingBlock.x += s.movingBlock.speed * s.movingBlock.direction;
 
                    if (s.movingBlock.x + s.movingBlock.width >= W) {
                        s.movingBlock.x         = W - s.movingBlock.width;
                        s.movingBlock.direction = -1;
                    }
                    if (s.movingBlock.x <= 0) {
                        s.movingBlock.x         = 0;
                        s.movingBlock.direction = 1;
                    }
 
                    const mc = s.movingBlock;
                    ctx.fillStyle   = this.getColor(s.score + 1);
                    ctx.fillRect(mc.x, 30, mc.width, BH);
                    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
                    ctx.lineWidth   = 2;
                    ctx.strokeRect(mc.x, 30, mc.width, BH);
                }
 
                ctx.fillStyle = '#fff';
                ctx.font      = 'bold 24px system-ui';
                ctx.textAlign = 'left';
                ctx.fillText(`Score: ${s.score}`, 20, 25);
 
                if (s.gameOver) {
                    ctx.fillStyle = 'rgba(0,0,0,0.6)';
                    ctx.fillRect(0, 0, W, H);
                    ctx.fillStyle = '#fff';
                    ctx.font      = 'bold 36px system-ui';
                    ctx.textAlign = 'center';
                    ctx.fillText('Game Over!', W / 2, H / 2 - 20);
                    ctx.font = '22px system-ui';
                    ctx.fillText(`Score: ${s.score}`, W / 2, H / 2 + 20);
                    return;
                }
 
                s.animationId = requestAnimationFrame(gameLoop);
            };
 
            startBtn.onclick = () => {
                if (s.started) return;
                s.started = true;
                startBtn.style.display = 'none';
                s.animationId = requestAnimationFrame(gameLoop);
            };
        },
 
        cleanup: function() {
            if (this.state.animationId) cancelAnimationFrame(this.state.animationId);
            if (this.state.keyHandler)  document.removeEventListener('keydown', this.state.keyHandler);
            this.state.gameOver = true;
        }
    };
})();
