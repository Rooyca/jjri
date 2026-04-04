// Parchis (4-Player Board Game) Module
(function() {
    'use strict';
    
    window.GameModules = window.GameModules || {};
    
    const COLORS = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3'];
    const COLOR_NAMES = ['Rojo', 'Azul', 'Amarillo', 'Verde'];
    const BOARD_SIZE = 600;
    const CELL_SIZE = 20;
    
    const ParchisUtils = {
        drawBoard(ctx, playerColor) {
            ctx.fillStyle = '#2C3E50';
            ctx.fillRect(0, 0, BOARD_SIZE, BOARD_SIZE);
            
            const center = BOARD_SIZE / 2;
            const armWidth = 120;
            const cellSize = CELL_SIZE;
            
            // Draw cross-shaped board
            ctx.fillStyle = '#ECF0F1';
            // Vertical arm
            ctx.fillRect(center - armWidth/2, 0, armWidth, BOARD_SIZE);
            // Horizontal arm
            ctx.fillRect(0, center - armWidth/2, BOARD_SIZE, armWidth);
            
            // Draw home zones (corners)
            const homeSize = (BOARD_SIZE - armWidth) / 2;
            const homes = [
                {x: 0, y: 0, color: COLORS[0]}, // Red
                {x: center + armWidth/2, y: 0, color: COLORS[1]}, // Blue
                {x: 0, y: center + armWidth/2, color: COLORS[2]}, // Yellow
                {x: center + armWidth/2, y: center + armWidth/2, color: COLORS[3]} // Green
            ];
            
            homes.forEach(home => {
                ctx.fillStyle = home.color + '40';
                ctx.fillRect(home.x, home.y, homeSize, homeSize);
                ctx.strokeStyle = home.color;
                ctx.lineWidth = 3;
                ctx.strokeRect(home.x, home.y, homeSize, homeSize);
            });
            
            // Draw path cells
            this.drawPath(ctx, center, armWidth, cellSize);
            
            // Draw center finish area
            ctx.fillStyle = '#F39C12';
            ctx.beginPath();
            ctx.arc(center, center, 40, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#E67E22';
            ctx.lineWidth = 3;
            ctx.stroke();
        },
        
        drawPath(ctx, center, armWidth, cellSize) {
            const pathPositions = this.getPathPositions(center, armWidth, cellSize);
            
            pathPositions.forEach((pos, index) => {
                const isSafe = [0, 5, 12, 17, 22, 29, 34, 39, 46, 51, 56, 63].includes(index);
                
                ctx.fillStyle = isSafe ? '#E8F5E9' : '#FFF';
                ctx.fillRect(pos.x - cellSize/2, pos.y - cellSize/2, cellSize, cellSize);
                
                ctx.strokeStyle = isSafe ? '#4CAF50' : '#BDC3C7';
                ctx.lineWidth = 1;
                ctx.strokeRect(pos.x - cellSize/2, pos.y - cellSize/2, cellSize, cellSize);
            });
        },
        
        getPathPositions(center, armWidth, cellSize) {
            const positions = [];
            const margin = 60;
            const step = cellSize;
            
            // Bottom path (red start)
            for (let i = 0; i < 5; i++) {
                positions.push({x: margin + i * step, y: center + armWidth/2 - step});
            }
            positions.push({x: margin + 4 * step, y: center - armWidth/2 + step});
            
            // Left vertical
            for (let i = 1; i < 7; i++) {
                positions.push({x: margin + 4 * step, y: center - armWidth/2 + step - i * step});
            }
            
            // Left path (yellow start)
            for (let i = 1; i < 6; i++) {
                positions.push({x: margin + 4 * step + i * step, y: margin + step});
            }
            positions.push({x: center - armWidth/2 + step, y: margin + step});
            
            // Top horizontal
            for (let i = 1; i < 7; i++) {
                positions.push({x: center - armWidth/2 + step + i * step, y: margin + step});
            }
            
            // Top path (blue start)
            for (let i = 1; i < 6; i++) {
                positions.push({x: BOARD_SIZE - margin - step, y: margin + step + i * step});
            }
            positions.push({x: BOARD_SIZE - margin - step, y: center - armWidth/2 + step});
            
            // Right vertical
            for (let i = 1; i < 7; i++) {
                positions.push({x: BOARD_SIZE - margin - step, y: center - armWidth/2 + step + i * step});
            }
            
            // Right path (green start)
            for (let i = 1; i < 6; i++) {
                positions.push({x: BOARD_SIZE - margin - step - i * step, y: BOARD_SIZE - margin - step});
            }
            positions.push({x: center + armWidth/2 - step, y: BOARD_SIZE - margin - step});
            
            // Bottom horizontal
            for (let i = 1; i < 7; i++) {
                positions.push({x: center + armWidth/2 - step - i * step, y: BOARD_SIZE - margin - step});
            }
            
            // Back to start
            for (let i = 1; i < 6; i++) {
                positions.push({x: margin + step, y: BOARD_SIZE - margin - step - i * step});
            }
            positions.push({x: margin + step, y: center + armWidth/2 - step});
            
            // Final stretch for each color (home stretch)
            for (let i = 1; i < 6; i++) {
                positions.push({x: margin + step + i * step, y: center + armWidth/2 - step});
            }
            
            return positions;
        },
        
        drawPiece(ctx, x, y, color, playerIndex) {
            const radius = 8;
            
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.strokeStyle = '#2C3E50';
            ctx.lineWidth = 2;
            ctx.stroke();
        },
        
        drawDice(ctx, value, x, y, size = 60) {
            ctx.fillStyle = '#FFF';
            ctx.strokeStyle = '#2C3E50';
            ctx.lineWidth = 2;
            
            const radius = 8;
            ctx.beginPath();
            ctx.roundRect(x, y, size, size, radius);
            ctx.fill();
            ctx.stroke();
            
            ctx.fillStyle = '#2C3E50';
            const dotRadius = 4;
            const dots = this.getDiceDots(value, x, y, size);
            
            dots.forEach(dot => {
                ctx.beginPath();
                ctx.arc(dot.x, dot.y, dotRadius, 0, Math.PI * 2);
                ctx.fill();
            });
        },
        
        getDiceDots(value, x, y, size) {
            const cx = x + size / 2;
            const cy = y + size / 2;
            const offset = size / 4;
            
            const positions = {
                1: [{x: cx, y: cy}],
                2: [{x: cx - offset, y: cy - offset}, {x: cx + offset, y: cy + offset}],
                3: [{x: cx - offset, y: cy - offset}, {x: cx, y: cy}, {x: cx + offset, y: cy + offset}],
                4: [{x: cx - offset, y: cy - offset}, {x: cx + offset, y: cy - offset}, 
                    {x: cx - offset, y: cy + offset}, {x: cx + offset, y: cy + offset}],
                5: [{x: cx - offset, y: cy - offset}, {x: cx + offset, y: cy - offset}, {x: cx, y: cy},
                    {x: cx - offset, y: cy + offset}, {x: cx + offset, y: cy + offset}],
                6: [{x: cx - offset, y: cy - offset}, {x: cx + offset, y: cy - offset},
                    {x: cx - offset, y: cy}, {x: cx + offset, y: cy},
                    {x: cx - offset, y: cy + offset}, {x: cx + offset, y: cy + offset}]
            };
            
            return positions[value] || [];
        }
    };
    
    window.GameModules['parchis'] = {
        state: {
            ws: null,
            canvas: null,
            ctx: null,
            playerIndex: -1,
            playerName: null,
            gameState: null,
            roomId: null,
            waitingForPlayers: true,
            canRollDice: false,
            diceValue: 0,
            animationId: null
        },

        start: function(config, container, callbacks) {
            const playerName = window.playerName || "Player";
            this.state.playerName = playerName;
            this.state.waitingForPlayers = true;
            this.state.canRollDice = false;
            
            container.innerHTML = `
                <div class="game-header">
                    <h3>${config.title}</h3>
                    <div class="timer">Jugadores: <span id="player-count">0/4</span></div>
                </div>
                <div class="parchis-container" style="position: relative;">
                    <div id="game-status" style="text-align: center; padding: 40px; font-size: 1.3em;">
                        <div style="font-size: 3em; margin-bottom: 20px;">🎲</div>
                        <div>Esperando jugadores...</div>
                        <div id="waiting-players" style="margin-top: 20px; font-size: 0.9em; color: #aaa;">0/4 jugadores conectados</div>
                    </div>
                    <div id="game-area" style="display: none;">
                        <div style="display: flex; gap: 20px; align-items: flex-start;">
                            <canvas id="parchis-board" width="${BOARD_SIZE}" height="${BOARD_SIZE}" 
                                    style="border: 3px solid #34495E; border-radius: 10px; background: #2C3E50;"></canvas>
                            <div id="game-controls" style="flex: 1; min-width: 200px;">
                                <div id="player-info" style="background: #34495E; padding: 15px; border-radius: 10px; margin-bottom: 15px;">
                                    <div style="font-size: 1.2em; margin-bottom: 10px;">Tu turno:</div>
                                    <div id="current-player-indicator" style="font-size: 1.1em; padding: 10px; border-radius: 5px; text-align: center; background: #2C3E50;"></div>
                                </div>
                                <div id="dice-container" style="text-align: center; margin: 20px 0;">
                                    <canvas id="dice-display" width="80" height="80"></canvas>
                                    <button id="roll-dice-btn" class="btn-primary" style="margin-top: 15px; padding: 12px 30px; font-size: 1.1em;" disabled>
                                        🎲 Lanzar Dado
                                    </button>
                                </div>
                                <div id="players-list" style="background: #34495E; padding: 15px; border-radius: 10px;">
                                    <div style="font-weight: bold; margin-bottom: 10px;">Jugadores:</div>
                                    <div id="players-container"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div id="result-overlay" style="display: none; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.95); padding: 50px; border-radius: 20px; text-align: center; z-index: 100; min-width: 300px;">
                        <div id="result-text" style="font-size: 2.5em; margin-bottom: 20px;"></div>
                        <div id="result-stats" style="font-size: 1.2em; color: #aaa;"></div>
                    </div>
                </div>
            `;

            this.state.canvas = container.querySelector('#parchis-board');
            this.state.ctx = this.state.canvas.getContext('2d');

            const BASE_DIR = window.BASE_DIR || window.location.host;
            const wsUrl = `wss://${BASE_DIR}/ws/parchis?player_name=${encodeURIComponent(this.state.playerName)}`;
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
                const statusEl = container.querySelector('#game-status');
                if (statusEl) {
                    statusEl.innerHTML = '<div style="color: #f87171;">Error de conexión. Intenta de nuevo.</div>';
                }
            };

            this.state.ws.onclose = () => {
                console.log("WebSocket closed");
            };

            const rollBtn = container.querySelector('#roll-dice-btn');
            rollBtn.onclick = () => {
                if (this.state.canRollDice && this.state.ws && this.state.ws.readyState === WebSocket.OPEN) {
                    this.state.ws.send(JSON.stringify({type: "roll_dice"}));
                    rollBtn.disabled = true;
                }
            };
        },

        handleWebSocketMessage: function(data, container, callbacks) {
            const statusEl = container.querySelector('#game-status');
            const gameAreaEl = container.querySelector('#game-area');
            const waitingPlayersEl = container.querySelector('#waiting-players');

            switch (data.type) {
                case "waiting":
                    if (waitingPlayersEl) {
                        waitingPlayersEl.textContent = `${data.player_count}/4 jugadores conectados`;
                    }
                    break;

                case "player_joined":
                    if (waitingPlayersEl) {
                        waitingPlayersEl.textContent = `${data.player_count}/4 jugadores conectados`;
                    }
                    break;

                case "game_start":
                    this.state.waitingForPlayers = false;
                    this.state.playerIndex = data.your_player_index;
                    this.state.roomId = data.room_id;
                    this.state.gameState = data.game_state;
                    
                    if (statusEl) statusEl.style.display = 'none';
                    if (gameAreaEl) gameAreaEl.style.display = 'block';
                    
                    this.updateGameDisplay(container);
                    this.startGameLoop(container);
                    break;

                case "game_state":
                    this.state.gameState = data.game_state;
                    this.updateGameDisplay(container);
                    break;

                case "dice_rolled":
                    this.state.diceValue = data.value;
                    this.state.gameState = data.game_state;
                    this.updateGameDisplay(container);
                    break;

                case "your_turn":
                    this.state.canRollDice = true;
                    const rollBtn = container.querySelector('#roll-dice-btn');
                    if (rollBtn) {
                        rollBtn.disabled = false;
                        rollBtn.style.background = '#4ade80';
                    }
                    break;

                case "not_your_turn":
                    this.state.canRollDice = false;
                    const rollBtn2 = container.querySelector('#roll-dice-btn');
                    if (rollBtn2) {
                        rollBtn2.disabled = true;
                        rollBtn2.style.background = '';
                    }
                    break;

                case "game_over":
                    this.showResult(data, container, callbacks);
                    break;

                case "player_disconnected":
                    console.log("Player disconnected:", data.message);
                    break;

                case "error":
                    console.error("Server error:", data.message);
                    break;
            }
        },

        updateGameDisplay: function(container) {
            if (!this.state.gameState) return;
            
            const currentPlayerEl = container.querySelector('#current-player-indicator');
            const playersContainer = container.querySelector('#players-container');
            const diceCanvas = container.querySelector('#dice-display');
            
            if (currentPlayerEl) {
                const currentPlayer = this.state.gameState.current_player;
                const isYourTurn = currentPlayer === this.state.playerIndex;
                const playerColor = COLORS[currentPlayer];
                const playerName = COLOR_NAMES[currentPlayer];
                
                currentPlayerEl.style.background = playerColor + '40';
                currentPlayerEl.style.border = `3px solid ${playerColor}`;
                currentPlayerEl.innerHTML = isYourTurn 
                    ? `<strong>¡TU TURNO!</strong><br>${playerName}`
                    : `${playerName}`;
            }
            
            if (playersContainer && this.state.gameState.players) {
                playersContainer.innerHTML = this.state.gameState.players.map((player, idx) => {
                    const color = COLORS[idx];
                    const finished = player.pieces.every(p => p.position === 68);
                    return `
                        <div style="padding: 8px; margin: 5px 0; border-radius: 5px; background: ${color}30; border-left: 4px solid ${color};">
                            <div style="font-weight: ${idx === this.state.playerIndex ? 'bold' : 'normal'};">
                                ${COLOR_NAMES[idx]}${idx === this.state.playerIndex ? ' (TÚ)' : ''}
                                ${finished ? ' 🏆' : ''}
                            </div>
                            <div style="font-size: 0.9em; color: #aaa;">
                                Piezas en casa: ${player.pieces.filter(p => p.position === 68).length}/4
                            </div>
                        </div>
                    `;
                }).join('');
            }
            
            if (diceCanvas && this.state.diceValue > 0) {
                const diceCtx = diceCanvas.getContext('2d');
                diceCtx.clearRect(0, 0, 80, 80);
                ParchisUtils.drawDice(diceCtx, this.state.diceValue, 10, 10);
            }
        },

        startGameLoop: function(container) {
            const render = () => {
                if (!this.state.gameState) return;
                
                ParchisUtils.drawBoard(this.state.ctx, COLORS[this.state.playerIndex]);
                
                const pathPositions = ParchisUtils.getPathPositions(BOARD_SIZE/2, 120, CELL_SIZE);
                
                this.state.gameState.players.forEach((player, playerIdx) => {
                    player.pieces.forEach((piece, pieceIdx) => {
                        if (piece.position === -1) {
                            const homePositions = [
                                [{x: 80, y: 80}, {x: 120, y: 80}, {x: 80, y: 120}, {x: 120, y: 120}],
                                [{x: 480, y: 80}, {x: 520, y: 80}, {x: 480, y: 120}, {x: 520, y: 120}],
                                [{x: 80, y: 480}, {x: 120, y: 480}, {x: 80, y: 520}, {x: 120, y: 520}],
                                [{x: 480, y: 480}, {x: 520, y: 480}, {x: 480, y: 520}, {x: 520, y: 520}]
                            ];
                            const pos = homePositions[playerIdx][pieceIdx];
                            ParchisUtils.drawPiece(this.state.ctx, pos.x, pos.y, COLORS[playerIdx], playerIdx);
                        } else if (piece.position >= 0 && piece.position < pathPositions.length) {
                            const pos = pathPositions[piece.position];
                            ParchisUtils.drawPiece(this.state.ctx, pos.x, pos.y, COLORS[playerIdx], playerIdx);
                        } else if (piece.position === 68) {
                            const finishPos = {x: BOARD_SIZE/2, y: BOARD_SIZE/2};
                            const angle = (playerIdx * Math.PI / 2) + (pieceIdx * Math.PI / 8);
                            const radius = 25;
                            const x = finishPos.x + Math.cos(angle) * radius;
                            const y = finishPos.y + Math.sin(angle) * radius;
                            ParchisUtils.drawPiece(this.state.ctx, x, y, COLORS[playerIdx], playerIdx);
                        }
                    });
                });
                
                this.state.animationId = requestAnimationFrame(render);
            };
            
            render();
        },

        showResult: function(data, container, callbacks) {
            const resultOverlay = container.querySelector('#result-overlay');
            const resultText = container.querySelector('#result-text');
            const resultStats = container.querySelector('#result-stats');
            
            if (resultOverlay && resultText && resultStats) {
                const isWinner = data.winner_index === this.state.playerIndex;
                const winnerColor = COLOR_NAMES[data.winner_index];
                
                resultText.innerHTML = isWinner 
                    ? '<div style="color: #FFD700; font-size: 1.5em;">🏆 ¡GANASTE! 🏆</div>'
                    : `<div style="color: #f87171;">Ganó: ${winnerColor}</div>`;
                
                resultStats.innerHTML = `
                    <div style="margin: 10px 0;">Ganador: <span style="color: ${COLORS[data.winner_index]}; font-weight: bold;">${data.winner_name}</span></div>
                    <div style="margin: 10px 0; font-size: 0.9em;">Duración: ${Math.floor(data.duration_ms / 1000)}s</div>
                `;
                
                resultOverlay.style.display = 'block';
                
                if (isWinner) {
                    setTimeout(() => {
                        callbacks.onGameEnd(100, data.duration_ms);
                    }, 3000);
                } else {
                    setTimeout(() => {
                        callbacks.onGameEnd(0, data.duration_ms);
                    }, 3000);
                }
            }
        },

        cleanup: function() {
            if (this.state.animationId) {
                cancelAnimationFrame(this.state.animationId);
            }
            
            if (this.state.ws) {
                this.state.ws.close();
                this.state.ws = null;
            }
        }
    };
})();
