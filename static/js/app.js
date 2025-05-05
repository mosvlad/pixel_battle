// Main application initialization
document.addEventListener('DOMContentLoaded', () => {
    // Generate a unique client ID (or use one from local storage if exists)
    const clientId = localStorage.getItem('pixelBattleClientId') || generateUUID();
    localStorage.setItem('pixelBattleClientId', clientId);

    // Initialize modules
    const canvas = new PixelCanvas('pixelCanvas');
    const websocket = new PixelWebSocket(clientId);
    const ui = new PixelUI(canvas, websocket);

    // Fetch initial grid state
    fetchGridState()
        .then(grid => {
            canvas.setGrid(grid);
            canvas.render();
        })
        .catch(error => {
            console.error('Failed to fetch initial grid state:', error);
        });

    // Start the application
    ui.initialize();

    // Stats update
    let pixelsPlaced = parseInt(localStorage.getItem('pixelsPlaced') || '0');
    document.getElementById('pixelsPlaced').textContent = pixelsPlaced;

    // Export globals for debugging
    window.pixelApp = {
        canvas,
        websocket,
        ui,
        clientId
    };
});

// Fetch the current state of the grid from the server
async function fetchGridState() {
    try {
        const response = await fetch('/api/pixel');
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }
        const data = await response.json();
        return data.grid || {};
    } catch (error) {
        console.error('Error fetching grid:', error);
        return {};
    }
}

// Generate a UUID for client identification
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}