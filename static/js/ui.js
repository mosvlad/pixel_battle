class PixelUI {
    constructor(canvas, websocket) {
        this.canvas = canvas;
        this.websocket = websocket;
        this.predefinedColors = [
            '#000000', '#FFFFFF', '#FF0000', '#00FF00',
            '#0000FF', '#FFFF00', '#00FFFF', '#FF00FF',
            '#FFA500', '#800080', '#008000', '#800000',
            '#808080', '#C0C0C0', '#FFC0CB', '#A52A2A'
        ];
    }

    initialize() {
        // Initialize color grid
        this.initializeColorGrid();

        // Setup canvas controls
        document.getElementById('zoomIn').addEventListener('click', () => this.zoomIn());
        document.getElementById('zoomOut').addEventListener('click', () => this.zoomOut());
        document.getElementById('resetView').addEventListener('click', () => this.resetView());

        // Listen for custom color changes
        document.getElementById('colorInput').addEventListener('input', (e) => {
            this.selectColor(e.target.value);
        });

        // Listen for pixel updates from other users
        window.addEventListener('pixelUpdate', (e) => this.handlePixelUpdate(e.detail));
    }

    initializeColorGrid() {
        const grid = document.getElementById('colorsGrid');

        // Clear existing content
        grid.innerHTML = '';

        // Add color swatches
        this.predefinedColors.forEach(color => {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.style.backgroundColor = color;
            swatch.dataset.color = color;
            swatch.title = color;

            swatch.addEventListener('click', () => {
                this.selectColor(color);
            });

            grid.appendChild(swatch);
        });

        // Select the first color by default
        this.selectColor(this.predefinedColors[0]);
    }

    selectColor(color) {
        // Update the canvas selected color
        this.canvas.setSelectedColor(color);

        // Update the custom color input
        document.getElementById('colorInput').value = color;

        // Update selected state in color grid
        const swatches = document.querySelectorAll('.color-swatch');
        swatches.forEach(swatch => {
            if (swatch.dataset.color === color) {
                swatch.classList.add('selected');
            } else {
                swatch.classList.remove('selected');
            }
        });
    }

    handlePixelUpdate({ x, y, color }) {
        // Update the canvas
        this.canvas.setPixel(x, y, color);
    }

    zoomIn() {
        const newZoom = Math.min(10, this.canvas.zoom * 1.5);

        // Get canvas center
        const centerX = this.canvas.canvas.width / 2;
        const centerY = this.canvas.canvas.height / 2;

        // Convert to grid coordinates
        const gridX = (centerX - this.canvas.panX) / (this.canvas.pixelSize * this.canvas.zoom);
        const gridY = (centerY - this.canvas.panY) / (this.canvas.pixelSize * this.canvas.zoom);

        // Calculate new pan to keep center point
        const newPanX = centerX - gridX * this.canvas.pixelSize * newZoom;
        const newPanY = centerY - gridY * this.canvas.pixelSize * newZoom;

        // Apply new values
        this.canvas.zoom = newZoom;
        this.canvas.panX = newPanX;
        this.canvas.panY = newPanY;

        // Render the canvas
        this.canvas.render();
    }

    zoomOut() {
        const newZoom = Math.max(0.1, this.canvas.zoom / 1.5);

        // Get canvas center
        const centerX = this.canvas.canvas.width / 2;
        const centerY = this.canvas.canvas.height / 2;

        // Convert to grid coordinates
        const gridX = (centerX - this.canvas.panX) / (this.canvas.pixelSize * this.canvas.zoom);
        const gridY = (centerY - this.canvas.panY) / (this.canvas.pixelSize * this.canvas.zoom);

        // Calculate new pan to keep center point
        const newPanX = centerX - gridX * this.canvas.pixelSize * newZoom;
        const newPanY = centerY - gridY * this.canvas.pixelSize * newZoom;

        // Apply new values
        this.canvas.zoom = newZoom;
        this.canvas.panX = newPanX;
        this.canvas.panY = newPanY;

        // Render the canvas
        this.canvas.render();
    }

    resetView() {
        this.canvas.resetView();
    }
}