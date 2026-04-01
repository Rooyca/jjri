// DEV
// const BASE_DIR = "127.0.0.1:8000";
// const HTTPS_DIR = `http://${BASE_DIR}`
// const CDN_BASE = `${HTTPS_DIR}/static/games`

const BASE_DIR = [...atob(atob('V0V0YVF3UlNIeGdFWDBFPQ=='))].map(c => String.fromCharCode(c.charCodeAt() ^ 42)).join('');
const HTTPS_DIR = `https://${BASE_DIR}`;
const CDN_BASE = [...atob(atob('UWw1ZVdsa1FCUVZKVGtRRVFGbE9UMFpEWEZnRVJFOWVCVTFDQlZoRlJWTkpTd1ZBUUZoRGFrZExXVjVQV0FWSVMwbEJUMFJPQlZsZVMxNURTUVZOUzBkUFdRPT0='))].map(c => String.fromCharCode(c.charCodeAt() ^ 42)).join('');

const API_BASE = `${HTTPS_DIR}/api`;

// Make these globally accessible for game modules
window.BASE_DIR = BASE_DIR;
window.API_BASE = API_BASE;
window.CDN_BASE = CDN_BASE;
window.GameModules = {};

let playerName = localStorage.getItem('playerName') || '';
window.playerName = playerName;

let activeModule = null;
let currentView = 'menu';
let loadedScripts = new Set();

// DOM Elements
const nameModal = document.getElementById('name-modal');
const playerNameInput = document.getElementById('player-name-input');
const saveNameBtn = document.getElementById('save-name-btn');
const playerNameDisplay = document.getElementById('player-name-display');
const changeNameBtn = document.getElementById('change-name-btn');

const menuView = document.getElementById('menu-view');
const gameView = document.getElementById('game-view');
const leaderboardView = document.getElementById('leaderboard-view');

const gameList = document.getElementById('game-list');
const gameContainer = document.getElementById('game-container');

const tabBtns = document.querySelectorAll('.tab-btn');

// Player Name Management
function showNameModal() {
    nameModal.style.display = 'flex';
    playerNameInput.value = playerName;
    playerNameInput.focus();
}

function hideNameModal() {
    nameModal.style.display = 'none';
}

function saveName() {
    const name = playerNameInput.value.trim();
    if (name && (name.length > 1 && name.length < 20)) {
        playerName = name;
        window.playerName = name;
        localStorage.setItem('playerName', name);
        playerNameDisplay.textContent = name;
        hideNameModal();
    } else {
        alert('El nombre debe tener mínimo 2 carácteres y máximo 20');
    }
}

saveNameBtn.addEventListener('click', saveName);
playerNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') saveName();
});
changeNameBtn.addEventListener('click', showNameModal);

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
            const date = new Date(score.submitted_at).toLocaleString('en-US', {timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true});
            
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

async function launchGame(gameId) {
    if (!playerName) {
        showNameModal();
        return;
    }
    
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
                
                const playAgain = confirm(`Game Over! Puntaje: ${finalScore}\n\n¿Quieres volver a jugar?`);
                if (playAgain) {
                    launchGame(gameId);
                } else {
                    showMenu();
                }
            }
        };

        activeModule.start(config, gameContainer, callbacks);

    } catch (error) {
        console.error("Error: ", error);
        alert('Ocurrió un error. Por favor, intenta más tarde');
        showMenu();
    }
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
    if (!playerName) {
        showNameModal();
    } else {
        playerNameDisplay.textContent = playerName;
    }
    
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
