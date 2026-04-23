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
let currentGameAttemptId = null;
let loadedScripts = new Set();
const requestCache = new Map();
const REQUEST_TIMEOUT_MS = 10000;

// DOM Elements
const playerNameDisplay = document.getElementById('player-name-display');
const authBtn = document.getElementById('change-name-btn');
const playerLabel = document.querySelector('.player-label');
const nameModal = document.getElementById('name-modal');

const gameOverModal = document.getElementById('game-over-modal');
const gameOverScore = document.getElementById('game-over-score');
const playAgainBtn = document.getElementById('play-again-btn');
const backToMenuBtn = document.getElementById('back-to-menu-btn');
const countdownOverlay = document.getElementById('countdown-overlay');
const countdownNumber = document.getElementById('countdown-number');
const anonScoreModal = document.getElementById('anon-score-modal');
const anonLoginBtn = document.getElementById('anon-login-btn');
const anonCloseBtn = document.getElementById('anon-close-btn');

const menuView = document.getElementById('menu-view');
const gameView = document.getElementById('game-view');
const leaderboardView = document.getElementById('leaderboard-view');

const gameList = document.getElementById('game-list');
const gameContainer = document.getElementById('game-container');

const tabBtns = document.querySelectorAll('.tab-btn');

function makeRequestId() {
    return `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function resolveErrorMessage(error, fallback = 'Ocurrió un error. Intenta de nuevo.') {
    if (!error) return fallback;
    if (typeof error === 'string') return error;
    if (error.detail) return error.detail;
    if (error.message) return error.message;
    return fallback;
}

async function apiRequest(url, options = {}) {
    const {
        method = 'GET',
        timeoutMs = REQUEST_TIMEOUT_MS,
        retries = method === 'GET' ? 1 : 0,
        cacheTtlMs = 0,
        body,
        headers = {}
    } = options;

    const cacheKey = `${method}:${url}`;
    if (method === 'GET' && cacheTtlMs > 0) {
        const cached = requestCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.data;
        }
    }

    const finalHeaders = { ...headers };
    if (method !== 'GET') {
        finalHeaders['X-Requested-With'] = finalHeaders['X-Requested-With'] || 'XMLHttpRequest';
        finalHeaders['X-Request-ID'] = finalHeaders['X-Request-ID'] || makeRequestId();
    }

    const requestOptions = {
        method,
        credentials: 'include',
        headers: finalHeaders
    };

    if (body !== undefined) {
        if (body instanceof FormData) {
            requestOptions.body = body;
        } else {
            requestOptions.body = JSON.stringify(body);
            requestOptions.headers['Content-Type'] = 'application/json';
        }
    }

    let attempt = 0;
    while (attempt <= retries) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, { ...requestOptions, signal: controller.signal });
            clearTimeout(timeoutId);

            const contentType = response.headers.get('content-type') || '';
            const data = contentType.includes('application/json')
                ? await response.json()
                : await response.text();

            if (!response.ok) {
                const detail = typeof data === 'object' && data ? data.detail : null;
                const error = new Error(detail || `HTTP ${response.status}`);
                error.status = response.status;
                error.detail = detail;
                throw error;
            }

            if (method === 'GET' && cacheTtlMs > 0) {
                requestCache.set(cacheKey, { data, expiresAt: Date.now() + cacheTtlMs });
            }
            return data;
        } catch (err) {
            clearTimeout(timeoutId);
            const isLastAttempt = attempt >= retries;
            if (isLastAttempt) throw err;
            attempt++;
        }
    }
}

function invalidateGetCacheByPrefix(prefix) {
    for (const key of requestCache.keys()) {
        if (key.startsWith(`GET:${prefix}`)) {
            requestCache.delete(key);
        }
    }
}

function isElementVisible(element) {
    if (!element) return false;
    return window.getComputedStyle(element).display !== 'none';
}

function isTextInputFocused() {
    const active = document.activeElement;
    if (!active) return false;
    const tagName = active.tagName;
    return tagName === 'INPUT' || tagName === 'TEXTAREA' || active.isContentEditable;
}

function handleStartRestartShortcut(e) {
    const isShortcut = e.code === 'Space' || e.key === 'Enter';
    if (!isShortcut || isTextInputFocused()) return;

    const isGameOverOpen = isElementVisible(gameOverModal);
    if (isGameOverOpen) {
        const playAgain = document.getElementById('play-again-btn');
        if (playAgain) {
            e.preventDefault();
            e.stopImmediatePropagation();
            playAgain.click();
        }
        return;
    }

    if (currentView !== 'game') return;
    if (isElementVisible(countdownOverlay)) return;

    const startBtn = document.getElementById('start-btn');
    if (isElementVisible(startBtn) && !startBtn.disabled) {
        e.preventDefault();
        e.stopImmediatePropagation();
        startBtn.click();
    }
}

document.addEventListener('keydown', handleStartRestartShortcut);

function handleEscapeModalClose(e) {
    if (e.key !== 'Escape') return;

    if (isElementVisible(gameOverModal)) {
        e.preventDefault();
        backToMenuFromGameOver();
        return;
    }

    if (isElementVisible(anonScoreModal)) {
        e.preventDefault();
        anonScoreModal.style.display = 'none';
        return;
    }

    if (isElementVisible(nameModal)) {
        e.preventDefault();
        nameModal.style.display = 'none';
    }
}

document.addEventListener('keydown', handleEscapeModalClose);

function restartCurrentGame() {
    gameOverModal.style.display = 'none';
    if (activeModule && activeModule.cleanup) activeModule.cleanup();
    activeModule = null;
    if (currentGameId) {
        launchGame(currentGameId, true);
    }
}

function backToMenuFromGameOver() {
    gameOverModal.style.display = 'none';
    showMenu();
}

playAgainBtn.addEventListener('click', restartCurrentGame);
backToMenuBtn.addEventListener('click', backToMenuFromGameOver);
anonLoginBtn.addEventListener('click', () => {
    anonScoreModal.style.display = 'none';
    window.location.href = `${HTTPS_DIR}/login`;
});
anonCloseBtn.addEventListener('click', () => {
    anonScoreModal.style.display = 'none';
});

function showAnonScoreModal() {
    if (sessionStorage.getItem('anonScoreNoticeShown') === '1') return;
    anonScoreModal.style.display = 'flex';
    sessionStorage.setItem('anonScoreNoticeShown', '1');
}

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
        const me = await apiRequest(`${API_BASE}/auth/me`, { retries: 0 });
        currentUser = me;
        playerName = derivePlayerNameFromAuth(currentUser);
        window.playerName = playerName;
        updatePlayerBadge();
    } catch (err) {
        if (err.status && err.status !== 401) {
            console.error('Auth sync error:', err);
        }
        currentUser = null;
        playerName = 'Anónimo';
        window.playerName = playerName;
        updatePlayerBadge();
    }
}

function resetLocalAuthState() {
    currentUser = null;
    playerName = 'Anónimo';
    window.playerName = playerName;
    currentGameAttemptId = null;
    updatePlayerBadge();
}

authBtn.addEventListener('click', async () => {
    if (!currentUser) {
        window.location.href = `${HTTPS_DIR}/login`;
        return;
    }
    try {
        await apiRequest(`${HTTPS_DIR}/auth/logout`, { method: 'POST', retries: 0 });
    } catch (err) {
        console.error('Logout error:', err);
    } finally {
        resetLocalAuthState();
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
        const scores = await apiRequest(url, { cacheTtlMs: 15000 });
        
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
        content.innerHTML = `<p class="error">${resolveErrorMessage(err, 'Error al cargar la tabla')}</p>`;
    }
}

document.getElementById('refresh-leaderboard').addEventListener('click', () => {
    const filter = document.getElementById('leaderboard-filter').value;
    invalidateGetCacheByPrefix(`${API_BASE}/leaderboard`);
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
    currentGameAttemptId = null;
    
    try {
        const config = await apiRequest(`${API_BASE}/games/${gameId}`);
        if (currentUser) {
            const attempt = await apiRequest(`${API_BASE}/game-attempts/start`, {
                method: 'POST',
                body: { game_id: gameId },
                retries: 0
            });
            currentGameAttemptId = attempt.attempt_id;
        } else {
            showAnonScoreModal();
        }

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
                if (currentUser) {
                    await submitScore(config.id, finalScore, durationMs, "1.0");
                }
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
        alert(resolveErrorMessage(error, 'Ocurrió un error. Por favor, intenta más tarde'));
        showMenu();
    }
}

function showGameOverModal(score, gameId) {
    gameOverScore.textContent = `Puntaje: ${score}`;
    gameOverModal.style.display = 'flex';
    
    currentGameId = gameId;
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
    if (score < 1 || !currentGameAttemptId || !currentUser) return;

    const payload = {
        game_id: gameId,
        attempt_id: currentGameAttemptId,
        score: score,
        duration_ms: durationMs,
        game_version: version
    };

    try {
        await apiRequest(`${API_BASE}/scores`, {
            method: 'POST',
            body: payload,
            retries: 0
        });
        currentGameAttemptId = null;
        invalidateGetCacheByPrefix(`${API_BASE}/leaderboard`);
    } catch (err) {
        currentGameAttemptId = null;
        console.error("Failed to send the score", err);
    }
}

function showMenu() {
    if (activeModule && activeModule.cleanup) activeModule.cleanup();
    activeModule = null;
    currentGameAttemptId = null;
    switchView('menu');
}

async function init() {
    await syncAuthState();

    try {
        const games = await apiRequest(`${API_BASE}/games`, { cacheTtlMs: 60000 });
        
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
                <div class="game-icon">${game.icon || '🎮'}</div>
                <div class="game-title">${game.title}</div>
            `;
            btn.onclick = () => launchGame(game.id);
            gameList.appendChild(btn);
        });
    } catch (err) {
        gameList.innerHTML = `<p class="error">${resolveErrorMessage(err, 'Error de conexión con el servidor')}</p>`;
    }
}

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
});

window.addEventListener('error', (event) => {
    console.error('Unhandled error:', event.error || event.message);
});

init();
