class PixelWebSocket {
    constructor(clientId) {
        this.clientId = clientId;
        this.socket = null;
        this.backoffTime = 1000; // Start with 1 second backoff
        this.maxBackoff = 30000; // Maximum 30 seconds backoff
        this.reconnectTimer = null;
        this.isConnected = false;
        this.pixelPlacementQueue = []; // Queue for pixel placements during reconnections

        this.connect();

        // Handle pixel placement events
        window.addEventListener('pixelPlace', (e) => this.placePixel(e.detail));
    }

    connect() {
        // Clear any existing reconnect timer
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        // Update UI to connecting state
        this.updateConnectionStatus('connecting');

        // Determine WebSocket URL
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;

        // Create new WebSocket connection
        this.socket = new WebSocket(wsUrl);

        // Setup event handlers
        this.socket.onopen = () => this.handleOpen();
        this.socket.onclose = () => this.handleClose();
        this.socket.onerror = (error) => this.handleError(error);
        this.socket.onmessage = (message) => this.handleMessage(message);
    }

    handleOpen() {
        console.log('WebSocket connection established');
        this.isConnected = true;
        this.backoffTime = 1000; // Reset backoff time
        this.updateConnectionStatus('connected');

        // Register client
        this.sendMessage({
            type: 'register',
            client_id: this.clientId
        });

        // Process any queued pixel placements
        while (this.pixelPlacementQueue.length > 0) {
            this.placePixel(this.pixelPlacementQueue.shift());
        }
    }

    handleClose() {
        console.log('WebSocket connection closed');
        this.isConnected = false;
        this.updateConnectionStatus('disconnected');

        // Schedule reconnect with exponential backoff
        this.reconnectTimer = setTimeout(() => {
            this.connect();
        }, this.backoffTime);

        // Increase backoff time for next attempt (with max limit)
        this.backoffTime = Math.min(this.backoffTime * 1.5, this.maxBackoff);
    }

    handleError(error) {
        console.error('WebSocket error:', error);
    }

    handleMessage(message) {
        try {
            const data = JSON.parse(message.data);

            switch (data.type) {
                case 'register_confirm':
                    console.log('Registration confirmed:', data.data.client_id);
                    break;

                case 'pixel_update':
                    // Broadcast the pixel update to other components
                    window.dispatchEvent(new CustomEvent('pixelUpdate', {
                        detail: data.data
                    }));
                    break;

                case 'user_count':
                    document.getElementById('onlineUsers').textContent = data.data.count;
                    break;

                default:
                    console.log('Unknown message type:', data.type);
            }
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
        }
    }

    sendMessage(data) {
        if (this.isConnected && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(data));
            return true;
        }
        return false;
    }

    placePixel({ x, y, color }) {
        // If not connected, queue the pixel placement for later
        if (!this.isConnected) {
            this.pixelPlacementQueue.push({ x, y, color });
            return;
        }

        // Send pixel placement via API (more reliable than WebSocket for important operations)
        fetch('/api/pixel', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                x,
                y,
                color,
                client_id: this.clientId
            })
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(data => {
                    throw new Error(data.error || `HTTP error ${response.status}`);
                });
            }
            return response.json();
        })
        .then(data => {
            // Update local pixel count
            let pixelsPlaced = parseInt(localStorage.getItem('pixelsPlaced') || '0');
            pixelsPlaced++;
            localStorage.setItem('pixelsPlaced', pixelsPlaced);
            document.getElementById('pixelsPlaced').textContent = pixelsPlaced;

            // Update local canvas with the placed pixel
            window.dispatchEvent(new CustomEvent('pixelUpdate', {
                detail: { x, y, color }
            }));

            // Show success (e.g. could show a small animation)
            console.log('Pixel placed successfully');
        })
        .catch(error => {
            console.error('Error placing pixel:', error);

            // Check if error is about cooldown
            if (error.message.includes('Wait')) {
                const match = error.message.match(/Wait (\d+\.\d+) seconds/);
                if (match) {
                    showCooldownMessage(parseFloat(match[1]));
                } else {
                    showCooldownMessage(1.0);
                }
            }
        });
    }

    updateConnectionStatus(status) {
        const element = document.getElementById('connectionStatus');
        const indicator = element.querySelector('.status-indicator');
        const text = element.querySelector('.status-text');

        indicator.className = 'status-indicator';

        switch (status) {
            case 'connecting':
                indicator.classList.add('connecting');
                text.textContent = 'Connecting...';
                break;

            case 'connected':
                indicator.classList.add('connected');
                text.textContent = 'Connected';
                break;

            case 'disconnected':
                indicator.classList.add('disconnected');
                text.textContent = 'Disconnected (reconnecting...)';
                break;
        }
    }
}

function showCooldownMessage(seconds) {
    const cooldown = document.getElementById('cooldown');
    const timeElement = document.getElementById('cooldownTime');

    timeElement.textContent = seconds.toFixed(1);
    cooldown.classList.remove('hidden');

    // Start countdown
    let timeLeft = seconds;
    const interval = setInterval(() => {
        timeLeft -= 0.1;
        if (timeLeft <= 0) {
            clearInterval(interval);
            cooldown.classList.add('hidden');
        } else {
            timeElement.textContent = timeLeft.toFixed(1);
        }
    }, 100);
}