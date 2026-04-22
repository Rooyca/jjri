// DEV
const BASE_DIR = "192.168.0.100:8000";
const HTTPS_DIR = `http://${BASE_DIR}`;
const CDN_BASE = `${HTTPS_DIR}/static/games`;

// const BASE_DIR = [...atob(atob('V0V0YVF3UlNIeGdFWDBFPQ=='))].map(c => String.fromCharCode(c.charCodeAt() ^ 42)).join('');
// const HTTPS_DIR = `https://${BASE_DIR}`;
// const CDN_BASE = [...atob(atob('UWw1ZVdsa1FCUVZKVGtRRVFGbE9UMFpEWEZnRVJFOWVCVTFDQlZoRlJWTkpTd1ZBUUZoRGFrZExXVjVQV0FWSVMwbEJUMFJPQlZsZVMxNURTUVZOUzBkUFdRPT0='))].map(c => String.fromCharCode(c.charCodeAt() ^ 42)).join('');

const API_BASE = `${HTTPS_DIR}/api`;
const LOCALE = 'es-CO';
const BOGOTA_TIMEZONE = 'America/Bogota';

// Make these globally accessible for game modules
window.BASE_DIR = BASE_DIR;
window.API_BASE = API_BASE;
window.CDN_BASE = CDN_BASE;
window.GameModules = {};

let playerName = localStorage.getItem('playerName') || '';
window.playerName = playerName;

let activeModule = null;
let currentView = 'menu';
let currentGameId = null;
const loadedScripts = new Set();
let activeModal = null;
let lastFocusedElement = null;

// DOM Elements
const nameModal = document.getElementById('name-modal');
const playerNameInput = document.getElementById('player-name-input');
const saveNameBtn = document.getElementById('save-name-btn');
const playerNameDisplay = document.getElementById('player-name-display');
const changeNameBtn = document.getElementById('change-name-btn');

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

function clearElement(element) {
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
}

function getFocusableElements(container) {
    return [...container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
        .filter(el => !el.disabled && el.offsetParent !== null);
}

function isEditableTarget(target) {
    if (!(target instanceof HTMLElement)) return false;

    const tagName = target.tagName;
    return target.isContentEditable || tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
}

function openModal(modal, initialFocusElement = null) {
    lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    activeModal = modal;

    const focusables = getFocusableElements(modal);
    const firstFocus = initialFocusElement || focusables[0];
    if (firstFocus) {
        firstFocus.focus();
    }
}

function closeModal(modal, restoreFocus = true) {
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');

    if (activeModal === modal) {
        activeModal = null;
    }

    if (restoreFocus && lastFocusedElement) {
        lastFocusedElement.focus();
        lastFocusedElement = null;
    }
}

document.addEventListener('keydown', (event) => {
    if (activeModal) {
        if (event.key === 'Escape') {
            if (activeModal === nameModal && !playerName) return;

            if (activeModal === nameModal) {
                hideNameModal();
            } else if (activeModal === gameOverModal) {
                hideGameOverModal();
            }
            return;
        }

        if (activeModal === gameOverModal && event.key === 'Enter') {
            event.preventDefault();
            playAgainBtn.click();
            return;
        }

        if (event.key !== 'Tab') return;

        const focusables = getFocusableElements(activeModal);
        if (focusables.length === 0) return;

        const firstElement = focusables[0];
        const lastElement = focusables[focusables.length - 1];

        if (event.shiftKey && document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
            return;
        }

        if (!event.shiftKey && document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
        }
        return;
    }

    if (currentView !== 'game') return;
    if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;
    if (isEditableTarget(event.target)) return;

    const startBtn = document.getElementById('start-btn');
    if (!startBtn || startBtn.offsetParent === null) return;
    if (startBtn.disabled) return;

    event.preventDefault();
    startBtn.click();
});

async function apiRequest(path, options = {}) {
    const {
        method = 'GET',
        query = null,
        body = null,
        headers = {}
    } = options;

    const url = new URL(`${API_BASE}${path}`);

    if (query) {
        Object.entries(query).forEach(([key, value]) => {
            if (value !== '' && value !== null && value !== undefined) {
                url.searchParams.set(key, value);
            }
        });
    }

    const requestOptions = {
        method,
        headers: { ...headers }
    };

    if (body !== null) {
        requestOptions.headers['Content-Type'] = 'application/json';
        requestOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url.toString(), requestOptions);

    if (!response.ok) {
        throw new Error(`La solicitud falló (${response.status})`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        return response.json();
    }

    return response.text();
}

// Player Name Management
function showNameModal() {
    playerNameInput.value = playerName;
    openModal(nameModal, playerNameInput);
}

function hideNameModal() {
    closeModal(nameModal);
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
        alert('El nombre debe tener mínimo 2 caracteres y máximo 20.');
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
    content.textContent = 'Cargando...';
    
    try {
        const scores = await apiRequest('/leaderboard', {
            query: {
                game_id: gameId,
                limit: 20
            }
        });

        clearElement(content);
        
        if (scores.length === 0) {
            const emptyMessage = document.createElement('p');
            emptyMessage.style.color = '#aaa';
            emptyMessage.textContent = 'Aún no hay puntuaciones.';
            content.appendChild(emptyMessage);
            return;
        }

        const table = document.createElement('table');
        table.className = 'leaderboard-table';

        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        ['Posición', 'Nombre', 'Juego', 'Puntaje', 'Fecha'].forEach((text) => {
            const th = document.createElement('th');
            th.textContent = text;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        scores.forEach((score, index) => {
            const rank = index + 1;
            const rankClass = rank <= 3 ? `rank-${rank}` : 'rank-other';
            const date = new Date(score.submitted_at).toLocaleString(LOCALE, { timeZone: BOGOTA_TIMEZONE });

            const row = document.createElement('tr');

            const rankCell = document.createElement('td');
            const badge = document.createElement('span');
            badge.className = `rank-badge ${rankClass}`;
            badge.textContent = String(rank);
            rankCell.appendChild(badge);

            const nameCell = document.createElement('td');
            nameCell.textContent = score.player_name;

            const gameCell = document.createElement('td');
            gameCell.textContent = score.game_id;

            const scoreCell = document.createElement('td');
            const strong = document.createElement('strong');
            strong.textContent = String(score.score);
            scoreCell.appendChild(strong);

            const dateCell = document.createElement('td');
            dateCell.textContent = date;

            row.appendChild(rankCell);
            row.appendChild(nameCell);
            row.appendChild(gameCell);
            row.appendChild(scoreCell);
            row.appendChild(dateCell);
            tbody.appendChild(row);
        });

        table.appendChild(tbody);
        content.appendChild(table);
    } catch (err) {
        content.textContent = 'Error al cargar la tabla.';
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
    if (!playerName) {
        showNameModal();
        return;
    }
    
    currentGameId = gameId;
    
    try {
        const config = await apiRequest(`/games/${gameId}`);

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
                await submitScore(config.id, finalScore, durationMs, '1.0');
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
        console.error('Error:', error);
        alert('Ocurrió un error. Por favor, inténtalo más tarde.');
        showMenu();
    }
}

function showGameOverModal(score, gameId) {
    gameOverScore.textContent = `Puntaje: ${score}`;
    currentGameId = gameId;
    openModal(gameOverModal, playAgainBtn);
}

function hideGameOverModal() {
    closeModal(gameOverModal);
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
        await apiRequest('/scores', {
            method: 'POST',
            body: payload
        });
    } catch (err) {
        console.error('No se pudo enviar el puntaje:', err);
    }
}

function showMenu() {
    if (activeModule && activeModule.cleanup) activeModule.cleanup();
    activeModule = null;
    switchView('menu');
}

async function init() {
    nameModal.setAttribute('aria-hidden', 'true');
    gameOverModal.setAttribute('aria-hidden', 'true');

    if (!playerName) {
        showNameModal();
    } else {
        playerNameDisplay.textContent = playerName;
    }
    
    try {
        const games = await apiRequest('/games');
        
        clearElement(gameList);
        
        const filterSelect = document.getElementById('leaderboard-filter');
        filterSelect.innerHTML = '';

        const allGamesOption = document.createElement('option');
        allGamesOption.value = '';
        allGamesOption.textContent = 'Todos';
        filterSelect.appendChild(allGamesOption);

        games.forEach(game => {
            const option = document.createElement('option');
            option.value = game.id;
            option.textContent = game.title;
            filterSelect.appendChild(option);
        });
        
        games.forEach(game => {
            const btn = document.createElement('button');
            btn.className = 'game-card';
            btn.type = 'button';
            btn.setAttribute('aria-label', `Iniciar ${game.title}`);
            
            const icon = document.createElement('div');
            icon.className = 'game-icon';
            icon.textContent = game.icon || '🎮';

            const title = document.createElement('div');
            title.className = 'game-title';
            title.textContent = game.title;

            btn.appendChild(icon);
            btn.appendChild(title);
            btn.onclick = () => launchGame(game.id);
            gameList.appendChild(btn);
        });
    } catch (err) {
        gameList.textContent = 'Error de conexión con el servidor.';
    }
}

playAgainBtn.addEventListener('click', () => {
    hideGameOverModal();
    if (activeModule && activeModule.cleanup) activeModule.cleanup();
    activeModule = null;
    launchGame(currentGameId, true);
});

backToMenuBtn.addEventListener('click', () => {
    hideGameOverModal();
    showMenu();
});

init();
