// ============================================================
// DEPTHS OF VALRATH — Network Client (WebSocket)
// ============================================================

class NetworkClient {
    constructor() {
        this.ws = null;
        this.connected = false;
        this.playerId = null;
        this.isHost = false;
        this.messageHandler = null;
        this._reconnectAttempts = 0;
    }

    connect(url) {
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(url);
            } catch (e) {
                reject(e);
                return;
            }

            this.ws.onopen = () => {
                this.connected = true;
                this._reconnectAttempts = 0;
                resolve();
            };

            this.ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    if (msg.type === 'welcome') {
                        this.playerId = msg.playerId;
                        this.isHost = msg.isHost;
                    }
                    if (this.messageHandler) {
                        this.messageHandler(msg);
                    }
                } catch (e) {
                    console.error('Failed to parse server message:', e);
                }
            };

            this.ws.onclose = () => {
                this.connected = false;
                if (this.messageHandler) {
                    this.messageHandler({ type: 'disconnected' });
                }
            };

            this.ws.onerror = (e) => {
                if (!this.connected) {
                    reject(new Error('Connection failed'));
                }
            };
        });
    }

    send(action) {
        if (!this.connected || !this.ws) return;
        this.ws.send(JSON.stringify(action));
    }

    onMessage(handler) {
        this.messageHandler = handler;
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.connected = false;
        this.playerId = null;
        this.isHost = false;
    }
}
