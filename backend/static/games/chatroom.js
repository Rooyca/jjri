// Chatroom Module
(function() {
    'use strict';

    window.GameModules = window.GameModules || {};

    window.GameModules['chatroom'] = {
        state: {
            ws: null,
            messages: [],
            maxMessages: 100,
            messageInput: null,
            sendBtn: null,
            keydownHandler: null,
            clickHandler: null
        },

        start: function(config, container) {
            this.state.messages = [];
            this.state.maxMessages = 100;
            this.state.ws = null;

            container.innerHTML = `
                <div class="game-header">
                    <h3>${config.title}</h3>
                    <div class="timer">En línea: <span id="chat-online-count">0</span></div>
                </div>
                <div class="typing-container" style="display: flex; flex-direction: column; gap: 12px; max-height: 70vh;">
                    <div id="chat-status" style="color: #aaa; font-size: 0.9em;">Conectando...</div>
                    <div id="chat-messages" style="flex: 1; min-height: 320px; overflow-y: auto; background: #1f2937; border-radius: 10px; padding: 12px; border: 1px solid #334155;"></div>
                    <div style="display: flex; gap: 10px;">
                        <input type="text" id="chat-input" class="typing-input" placeholder="Escribe un mensaje..." maxlength="250" autocomplete="off">
                        <button id="chat-send" class="btn-primary" style="white-space: nowrap;">Enviar</button>
                    </div>
                </div>
            `;

            const statusEl = container.querySelector('#chat-status');
            const messagesEl = container.querySelector('#chat-messages');
            const onlineCountEl = container.querySelector('#chat-online-count');
            const inputEl = container.querySelector('#chat-input');
            const sendBtn = container.querySelector('#chat-send');

            this.state.messageInput = inputEl;
            this.state.sendBtn = sendBtn;

            const setStatus = (text, color = '#aaa') => {
                statusEl.textContent = text;
                statusEl.style.color = color;
            };

            const formatTime = (timestamp) => {
                if (!timestamp) return '';
                const date = new Date(timestamp);
                return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            };

            const addMessage = (message) => {
                this.state.messages.push(message);
                if (this.state.messages.length > this.state.maxMessages) {
                    this.state.messages = this.state.messages.slice(-this.state.maxMessages);
                }

                const item = document.createElement('div');
                item.style.marginBottom = '10px';
                item.style.paddingBottom = '8px';
                item.style.borderBottom = '1px solid rgba(255, 255, 255, 0.06)';

                const isSystem = message.type === 'system';
                const sender = message.sender || 'Anónimo';
                const text = message.text || '';
                const time = formatTime(message.timestamp);

                if (isSystem) {
                    item.style.color = '#94a3b8';
                    item.style.fontStyle = 'italic';
                    item.textContent = `${time} • ${text}`;
                } else {
                    const meta = document.createElement('div');
                    meta.style.fontSize = '0.85em';
                    meta.style.color = '#93c5fd';
                    meta.style.marginBottom = '4px';
                    meta.textContent = `${sender}${time ? ` • ${time}` : ''}`;

                    const body = document.createElement('div');
                    body.style.color = '#f8fafc';
                    body.style.wordBreak = 'break-word';
                    body.textContent = text;

                    item.appendChild(meta);
                    item.appendChild(body);
                }

                messagesEl.appendChild(item);
                messagesEl.scrollTop = messagesEl.scrollHeight;
            };

            const renderHistory = (history) => {
                messagesEl.innerHTML = '';
                this.state.messages = [];
                history.forEach(addMessage);
            };

            const sendCurrentMessage = () => {
                const text = inputEl.value.trim();
                if (!text || !this.state.ws || this.state.ws.readyState !== WebSocket.OPEN) return;

                this.state.ws.send(JSON.stringify({
                    type: 'message',
                    text
                }));
                inputEl.value = '';
            };

            const BASE_DIR = window.BASE_DIR || window.location.host;
            const wsUrl = `wss://${BASE_DIR}/ws/chatroom?player_name=${encodeURIComponent(window.playerName || 'Player')}`;
            this.state.ws = new WebSocket(wsUrl);

            this.state.ws.onopen = () => {
                setStatus('Conectado', '#4ade80');
            };

            this.state.ws.onmessage = (event) => {
                const data = JSON.parse(event.data);

                switch (data.type) {
                    case 'history':
                        renderHistory(Array.isArray(data.messages) ? data.messages : []);
                        if (typeof data.online_count === 'number') {
                            onlineCountEl.textContent = String(data.online_count);
                        }
                        break;

                    case 'message':
                    case 'system':
                        addMessage(data);
                        break;

                    case 'online':
                        if (typeof data.online_count === 'number') {
                            onlineCountEl.textContent = String(data.online_count);
                        }
                        break;

                    case 'error':
                        addMessage({
                            type: 'system',
                            sender: 'Sistema',
                            text: `Error: ${data.message || 'desconocido'}`,
                            timestamp: new Date().toISOString()
                        });
                        break;
                }
            };

            this.state.ws.onerror = () => {
                setStatus('Error de conexión', '#f87171');
            };

            this.state.ws.onclose = () => {
                setStatus('Desconectado', '#f87171');
            };

            this.state.clickHandler = sendCurrentMessage;
            this.state.keydownHandler = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    sendCurrentMessage();
                }
            };

            sendBtn.addEventListener('click', this.state.clickHandler);
            inputEl.addEventListener('keydown', this.state.keydownHandler);
            inputEl.focus();
        },

        cleanup: function() {
            if (this.state.sendBtn && this.state.clickHandler) {
                this.state.sendBtn.removeEventListener('click', this.state.clickHandler);
            }
            if (this.state.messageInput && this.state.keydownHandler) {
                this.state.messageInput.removeEventListener('keydown', this.state.keydownHandler);
            }
            if (this.state.ws) {
                this.state.ws.close();
                this.state.ws = null;
            }
        }
    };
})();
