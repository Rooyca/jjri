const BASE_DIR = [...atob(atob('V0VWRUJGSWZHQVJmUVE9PQ=='))].map(c => String.fromCharCode(c.charCodeAt() ^ 42)).join('');
const HTTPS_DIR = `https://${BASE_DIR}`;
const CDN_BASE = [...atob(atob('UWw1ZVdsa1FCUVZKVGtRRVFGbE9UMFpEWEZnRVJFOWVCVTFDQlZoRlJWTkpTd1ZBUUZoRGFrZExXVjVQV0FWSVMwbEJUMFJPQlZsZVMxNURTUVZOUzBkUFdRPT0='))].map(c => String.fromCharCode(c.charCodeAt() ^ 42)).join('');

const API_BASE = `${HTTPS_DIR}/api`;

// Make these globally accessible for game modules
window.BASE_DIR = BASE_DIR;
window.API_BASE = API_BASE;
window.CDN_BASE = CDN_BASE;
window.GameModules = {};

let playerName = 'Anónimo';
let currentUser = null;
window.playerName = playerName;

let activeModule = null;
let currentView = 'menu';
let currentGameId = null;
let loadedScripts = new Set();

// DOM Elements
const playerNameDisplay = document.getElementById('player-name-display');
const authBtn = document.getElementById('change-name-btn');
const playerLabel = document.querySelector('.player-label');

const gameOverModal = document.getElementById('game-over-modal');
const gameOverScore = document.getElementById('game-over-score');
const playAgainBtn = document.getElementById('play-again-btn');
const backToMenuBtn = document.getElementById('back-to-menu-btn');
const countdownOverlay = document.getElementById('countdown-overlay');
const countdownNumber = document.getElementById('countdown-number');

const menuView = document.getElementById('menu-view');
const gameView = document.getElementById('game-view');
const leaderboardView = document.getElementById('leaderboard-view');

const gameList = document.getElementById('game-list');
const gameContainer = document.getElementById('game-container');

const tabBtns = document.querySelectorAll('.tab-btn');

function derivePlayerNameFromAuth(user) {
    const fallback = 'Usuario';
    const raw = (user.full_name || (user.email ? user.email.split('@')[0] : fallback) || fallback).trim();
    return raw.slice(0, 20) || fallback;
}

function updatePlayerBadge() {
    playerLabel.textContent = '';
    playerNameDisplay.textContent = playerName;
    if (currentUser) {
        authBtn.textContent = '🚪';
        authBtn.title = 'Cerrar sesión';
    } else {
        authBtn.textContent = '🔐';
        authBtn.title = 'Iniciar sesión';
    }
}

async function syncAuthState() {
    try {
        const response = await fetch(`${API_BASE}/auth/me`, { credentials: 'include' });
        if (!response.ok) {
            currentUser = null;
            playerName = 'Anónimo';
            window.playerName = playerName;
            updatePlayerBadge();
            return;
        }
        currentUser = await response.json();
        playerName = derivePlayerNameFromAuth(currentUser);
        window.playerName = playerName;
        updatePlayerBadge();
    } catch (err) {
        currentUser = null;
        playerName = 'Anónimo';
        window.playerName = playerName;
        updatePlayerBadge();
    }
}

authBtn.addEventListener('click', async () => {
    if (!currentUser) {
        window.location.href = '/login';
        return;
    }
    try {
        await fetch('/auth/logout', {
            method: 'POST',
            credentials: 'include'
        });
    } finally {
        currentUser = null;
        playerName = 'Anónimo';
        window.playerName = playerName;
        updatePlayerBadge();
    }
});

// View Management
function switchView(viewName) {
    [menuView, gameView, leaderboardView].forEach(v => v.classList.add('hidden'));
    
    tabBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === viewName);
    });
    
    currentView = viewName;
    
    switch(viewName) {
        case 'menu':
            menuView.classList.remove('hidden');
            break;
        case 'game':
            gameView.classList.remove('hidden');
            break;
        case 'leaderboard':
            leaderboardView.classList.remove('hidden');
            loadLeaderboard();
            break;
    }
}

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        if (activeModule) {
            showMenu();
        }
        switchView(btn.dataset.view);
    });
});

// Leaderboard
async function loadLeaderboard(gameId = '') {
    const content = document.getElementById('leaderboard-content');
    content.innerHTML = '<p>Cargando...</p>';
    
    try {
        const url = gameId ? `${API_BASE}/leaderboard?game_id=${gameId}&limit=20` : `${API_BASE}/leaderboard?limit=20`;
        const response = await fetch(url);
        const scores = await response.json();
        
        if (scores.length === 0) {
            content.innerHTML = '<p style="color: #aaa;">Aún no hay puntuación</p>';
            return;
        }
        
        let html = '<table class="leaderboard-table"><thead><tr><th>Posición</th><th>Nombre</th><th>Juego</th><th>Puntaje</th><th>Fecha</th></tr></thead><tbody>';
        
        scores.forEach((score, index) => {
            const rank = index + 1;
            const rankClass = rank <= 3 ? `rank-${rank}` : 'rank-other';
            const date = new Date(score.submitted_at).toLocaleString('en-US', {timeZone: 'America/Bogota'});
            
            html += `
                <tr>
                    <td><span class="rank-badge ${rankClass}">${rank}</span></td>
                    <td>${score.player_name}</td>
                    <td>${score.game_id}</td>
                    <td><strong>${score.score}</strong></td>
                    <td>${date}</td>
                </tr>
            `;
        });
        
        html += '</tbody></table>';
        content.innerHTML = html;
    } catch (err) {
        content.innerHTML = '<p class="error">Error al cargar la tabla</p>';
    }
}

document.getElementById('refresh-leaderboard').addEventListener('click', () => {
    const filter = document.getElementById('leaderboard-filter').value;
    loadLeaderboard(filter);
});

document.getElementById('leaderboard-filter').addEventListener('change', (e) => {
    loadLeaderboard(e.target.value);
});

// Dynamic Script Loading
function loadGameScript(gameType) {
    return new Promise((resolve, reject) => {
        if (loadedScripts.has(gameType)) {
            resolve();
            return;
        }
        
        const scriptUrl = `${CDN_BASE}/${gameType}.js`;
        const script = document.createElement('script');
        script.src = scriptUrl;
        script.async = true;
        
        script.onload = () => {
            loadedScripts.add(gameType);
            console.log(`Loaded script: ${gameType}`);
            resolve();
        };
        
        script.onerror = () => {
            reject(new Error(`Error al cargar el script: ${scriptUrl}`));
        };
        
        document.head.appendChild(script);
    });
}

async function launchGame(gameId, skipStartButton = false) {
    currentGameId = gameId;
    
    try {
        const response = await fetch(`${API_BASE}/games/${gameId}`);
        const config = await response.json();

        await loadGameScript(config.type);
        
        switchView('game');
        gameContainer.innerHTML = '';

        activeModule = window.GameModules[config.type];
        
        if (!activeModule) {
            throw new Error(`No existe lógica definida para el tipo de juego: ${config.type}`);
        }

        const callbacks = {
            onScoreUpdate: (score) => { },
            onGameEnd: async (finalScore, durationMs) => {
                await submitScore(config.id, finalScore, durationMs, "1.0");
                showGameOverModal(finalScore, gameId);
            }
        };

        // If skipStartButton is true, show countdown and start automatically
        if (skipStartButton) {
            activeModule.start(config, gameContainer, callbacks);
            showCountdownAndStart(3);
        } else {
            activeModule.start(config, gameContainer, callbacks);
        }

    } catch (error) {
        console.error("Error: ", error);
        alert('Ocurrió un error. Por favor, intenta más tarde');
        showMenu();
    }
}

function showGameOverModal(score, gameId) {
    gameOverScore.textContent = `Puntaje: ${score}`;
    gameOverModal.style.display = 'flex';
    
    currentGameId = gameId;
    
    // Remove any previous event listeners
    const newPlayAgainBtn = playAgainBtn.cloneNode(true);
    playAgainBtn.parentNode.replaceChild(newPlayAgainBtn, playAgainBtn);
    const newBackToMenuBtn = backToMenuBtn.cloneNode(true);
    backToMenuBtn.parentNode.replaceChild(newBackToMenuBtn, backToMenuBtn);
    
    // Add new event listeners
    document.getElementById('play-again-btn').onclick = () => {
        gameOverModal.style.display = 'none';
        if (activeModule && activeModule.cleanup) activeModule.cleanup();
        activeModule = null;
        launchGame(currentGameId, true);
    };
    
    document.getElementById('back-to-menu-btn').onclick = () => {
        gameOverModal.style.display = 'none';
        showMenu();
    };
}

function showCountdownAndStart(seconds) {
    countdownOverlay.style.display = 'flex';
    countdownNumber.textContent = seconds;
    
    let count = seconds;
    const countdownInterval = setInterval(() => {
        count--;
        if (count > 0) {
            countdownNumber.textContent = count;
            // Reset animation
            countdownNumber.style.animation = 'none';
            setTimeout(() => {
                countdownNumber.style.animation = 'countdownPulse 1s ease-in-out';
            }, 10);
        } else {
            countdownNumber.textContent = '¡GO!';
            setTimeout(() => {
                countdownOverlay.style.display = 'none';
                // Click the start button programmatically
                const startBtn = document.getElementById('start-btn');
                if (startBtn) {
                    startBtn.click();
                }
            }, 500);
            clearInterval(countdownInterval);
        }
    }, 1000);
}

async function submitScore(gameId, score, durationMs, version) {
    if (score < 1) return;

    const payload = {
        game_id: gameId,
        player_name: playerName,
        score: score,
        duration_ms: durationMs,
        game_version: version
    };

    try {
        await fetch(`${API_BASE}/scores`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (err) {
        console.error("Failed to send the score", err);
    }
}

function showMenu() {
    if (activeModule && activeModule.cleanup) activeModule.cleanup();
    activeModule = null;
    switchView('menu');
}

async function init() {
    await syncAuthState();

    try {
        const response = await fetch(`${API_BASE}/games`);
        const games = await response.json();
        
        gameList.innerHTML = '';
        
        const filterSelect = document.getElementById('leaderboard-filter');
        games.forEach(game => {
            const option = document.createElement('option');
            option.value = game.id;
            option.textContent = game.title;
            filterSelect.appendChild(option);
        });
        
        games.forEach(game => {
            const btn = document.createElement('button');
            btn.className = 'game-card';
            
            btn.innerHTML = `
                <div id="game-icon">${game.icon || '🎮'}</div>
                <div id="game-title">${game.title}</div>
            `;
            btn.onclick = () => launchGame(game.id);
            gameList.appendChild(btn);
        });
    } catch (err) {
        gameList.innerHTML = `<p class="error">Error de conexión con el servidor</p>`;
    }
}

init();
