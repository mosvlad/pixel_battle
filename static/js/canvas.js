class PixelCanvas {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.pixelSize = 10; // Size of each pixel in actual pixels
        this.gridWidth = 1000; // Width of the grid in game pixels
        this.gridHeight = 1000; // Height of the grid in game pixels
        this.panX = 0; // Panning offset X
        this.panY = 0; // Panning offset Y
        this.zoom = 1; // Zoom level
        this.grid = {}; // Sparse grid of pixels: { "x,y": "#RRGGBB" }
        this.hoveredCell = null; // Currently hovered cell
        this.isDragging = false; // Whether the user is currently dragging the canvas
        this.lastMousePosition = { x: 0, y: 0 }; // Last mouse position for dragging
        this.selectedColor = '#000000'; // Currently selected color

        // Performance optimizations
        this.gridCanvas = document.createElement('canvas'); // Off-screen canvas for grid
        this.gridCtx = this.gridCanvas.getContext('2d');
        this.pixelsCanvas = document.createElement('canvas'); // Off-screen canvas for pixels
        this.pixelsCtx = this.pixelsCanvas.getContext('2d');
        this.needsFullRedraw = true; // Flag to indicate full redraw is needed
        this.mouseMoveThrottle = false; // Throttle flag for mouse move events
        this.renderRequestId = null; // For requestAnimationFrame
        this.zoomThreshold = 0.5; // Threshold for rendering grid lines

        this.initCanvas();
        this.setupEventListeners();
    }

    initCanvas() {
        // Set canvas size to fill its container
        this.resizeCanvas();
        window.addEventListener('resize', () => {
            this.resizeCanvas();
            this.needsFullRedraw = true;
            this.requestRender();
        });

        // Initialize off-screen canvases
        this.gridCanvas.width = this.canvas.width;
        this.gridCanvas.height = this.canvas.height;
        this.pixelsCanvas.width = this.canvas.width;
        this.pixelsCanvas.height = this.canvas.height;

        // Initial render
        this.requestRender();
    }

    resizeCanvas() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;

        // Resize offscreen canvases
        this.gridCanvas.width = this.canvas.width;
        this.gridCanvas.height = this.canvas.height;
        this.pixelsCanvas.width = this.canvas.width;
        this.pixelsCanvas.height = this.canvas.height;

        this.needsFullRedraw = true;
    }

    setupEventListeners() {
        // Mouse movement tracking with throttling
        this.canvas.addEventListener('mousemove', (e) => {
            if (this.mouseMoveThrottle) return;

            this.mouseMoveThrottle = true;
            setTimeout(() => {
                this.mouseMoveThrottle = false;
            }, 16); // Roughly 60fps

            this.handleMouseMove(e);
        });

        // Click to place pixel
        this.canvas.addEventListener('click', (e) => this.handleClick(e));

        // Pan with drag - support both right mouse button and Ctrl+left button
        this.canvas.addEventListener('mousedown', (e) => {
            // Right mouse button or Left click + Ctrl for panning
            if (e.button === 2 || (e.button === 0 && e.ctrlKey)) {
                this.isDragging = true;
                this.lastMousePosition = { x: e.clientX, y: e.clientY };
                this.canvas.style.cursor = 'grabbing';
                e.preventDefault();
            }
        });

        // Prevent context menu on right-click
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            return false;
        });

        this.canvas.addEventListener('mouseup', () => {
            this.isDragging = false;
            this.canvas.style.cursor = 'crosshair';
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.isDragging = false;
            this.hoveredCell = null;
            this.canvas.style.cursor = 'crosshair';
            this.requestRender();
        });

        // Zoom with wheel (with debouncing)
        let wheelTimeout;
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();

            // Clear previous timeout
            clearTimeout(wheelTimeout);

            // Get mouse position before zoom
            const mouseX = e.clientX - this.canvas.getBoundingClientRect().left;
            const mouseY = e.clientY - this.canvas.getBoundingClientRect().top;

            // Convert to grid coordinates
            const gridX = (mouseX - this.panX) / (this.pixelSize * this.zoom);
            const gridY = (mouseY - this.panY) / (this.pixelSize * this.zoom);

            // Adjust zoom
            const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1; // Zoom out or in
            const newZoom = Math.max(0.1, Math.min(10, this.zoom * zoomDelta));

            // Adjust pan to keep mouse position fixed on the same grid point
            const newPanX = mouseX - gridX * this.pixelSize * newZoom;
            const newPanY = mouseY - gridY * this.pixelSize * newZoom;

            this.zoom = newZoom;
            this.panX = newPanX;
            this.panY = newPanY;

            this.needsFullRedraw = true;
            this.requestRender();

            // Set timeout for performance - only update coordinates after wheel stops
            wheelTimeout = setTimeout(() => {
                this.updateCoordinates(mouseX, mouseY);
            }, 100);
        });
    }

    handleMouseMove(e) {
        // Get mouse coordinates relative to canvas
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Handle dragging (panning)
        if (this.isDragging) {
            const dx = e.clientX - this.lastMousePosition.x;
            const dy = e.clientY - this.lastMousePosition.y;

            this.panX += dx;
            this.panY += dy;

            this.lastMousePosition = { x: e.clientX, y: e.clientY };
            this.needsFullRedraw = true;
            this.requestRender();
            return;
        }

        // Update coordinates and hovered cell
        this.updateCoordinates(mouseX, mouseY);
    }

    updateCoordinates(mouseX, mouseY) {
        // Convert to grid coordinates
        const gridX = Math.floor((mouseX - this.panX) / (this.pixelSize * this.zoom));
        const gridY = Math.floor((mouseY - this.panY) / (this.pixelSize * this.zoom));

        // Update coordinates display
        document.getElementById('coordinates').textContent = `X: ${gridX}, Y: ${gridY}`;

        // Check if mouse is within grid bounds
        if (gridX >= 0 && gridX < this.gridWidth && gridY >= 0 && gridY < this.gridHeight) {
            const newHoveredCell = { x: gridX, y: gridY };

            // Only re-render if the hovered cell changed
            if (!this.hoveredCell ||
                this.hoveredCell.x !== newHoveredCell.x ||
                this.hoveredCell.y !== newHoveredCell.y) {
                this.hoveredCell = newHoveredCell;
                this.requestRender();
            }
        } else if (this.hoveredCell) {
            // Mouse moved out of grid
            this.hoveredCell = null;
            this.requestRender();
        }
    }

    handleClick(e) {
        // Ignore if dragging or using Ctrl
        if (this.isDragging || e.ctrlKey) return;

        // Get mouse coordinates relative to canvas
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Convert to grid coordinates
        const gridX = Math.floor((mouseX - this.panX) / (this.pixelSize * this.zoom));
        const gridY = Math.floor((mouseY - this.panY) / (this.pixelSize * this.zoom));

        // Check if coordinates are valid
        if (gridX >= 0 && gridX < this.gridWidth && gridY >= 0 && gridY < this.gridHeight) {
            // Emit pixel placement event
            const event = new CustomEvent('pixelPlace', {
                detail: { x: gridX, y: gridY, color: this.selectedColor }
            });
            window.dispatchEvent(event);
        }
    }

    setGrid(grid) {
        this.grid = grid;
        this.needsFullRedraw = true;
        this.requestRender();
    }

    setPixel(x, y, color) {
        this.grid[`${x},${y}`] = color;

        // Calculate position and size
        const scaledPixelSize = this.pixelSize * this.zoom;
        const pixelX = this.panX + x * scaledPixelSize;
        const pixelY = this.panY + y * scaledPixelSize;

        // Always draw the pixel to the pixels canvas
        this.pixelsCtx.fillStyle = color;
        this.pixelsCtx.fillRect(pixelX, pixelY, scaledPixelSize, scaledPixelSize);

        // Force a render to update the main canvas
        this.requestRender();
    }

    getPixel(x, y) {
        return this.grid[`${x},${y}`] || '#FFFFFF'; // Default to white
    }

    setSelectedColor(color) {
        this.selectedColor = color;
    }

    resetView() {
        this.panX = 0;
        this.panY = 0;
        this.zoom = 1;
        this.needsFullRedraw = true;
        this.requestRender();
    }

    requestRender() {
        // Only request a new frame if we don't already have one pending
        if (!this.renderRequestId) {
            this.renderRequestId = window.requestAnimationFrame(() => {
                this.render();
                this.renderRequestId = null;
            });
        }
    }

    render() {
        // Calculate visible grid area
        const visibleStartX = Math.floor(-this.panX / (this.pixelSize * this.zoom));
        const visibleStartY = Math.floor(-this.panY / (this.pixelSize * this.zoom));
        const visibleEndX = Math.ceil((this.canvas.width - this.panX) / (this.pixelSize * this.zoom));
        const visibleEndY = Math.ceil((this.canvas.height - this.panY) / (this.pixelSize * this.zoom));

        // Clamp to grid bounds
        const startX = Math.max(0, visibleStartX);
        const startY = Math.max(0, visibleStartY);
        const endX = Math.min(this.gridWidth, visibleEndX);
        const endY = Math.min(this.gridHeight, visibleEndY);

        // Calculate pixel size with zoom
        const scaledPixelSize = this.pixelSize * this.zoom;

        // Full redraw of grid and pixels if needed
        if (this.needsFullRedraw) {
            // Clear offscreen canvases
            this.gridCtx.clearRect(0, 0, this.gridCanvas.width, this.gridCanvas.height);
            this.pixelsCtx.clearRect(0, 0, this.pixelsCanvas.width, this.pixelsCanvas.height);

            // Draw all pixels to the pixels canvas
            for (let y = startY; y < endY; y++) {
                for (let x = startX; x < endX; x++) {
                    const pixelX = this.panX + x * scaledPixelSize;
                    const pixelY = this.panY + y * scaledPixelSize;

                    // Get pixel color from grid
                    const color = this.getPixel(x, y);

                    // Draw pixel
                    this.pixelsCtx.fillStyle = color;
                    this.pixelsCtx.fillRect(pixelX, pixelY, scaledPixelSize, scaledPixelSize);
                }
            }

            // Draw grid lines to the grid canvas only if zoom is high enough
            if (this.zoom >= this.zoomThreshold) {
                this.gridCtx.strokeStyle = '#DDDDDD';
                this.gridCtx.lineWidth = 0.5;

                // Use a batch approach for grid lines
                this.gridCtx.beginPath();

                // Vertical lines
                for (let x = startX; x <= endX; x++) {
                    const pixelX = this.panX + x * scaledPixelSize;
                    this.gridCtx.moveTo(pixelX, this.panX + startY * scaledPixelSize);
                    this.gridCtx.lineTo(pixelX, this.panX + endY * scaledPixelSize);
                }

                // Horizontal lines
                for (let y = startY; y <= endY; y++) {
                    const pixelY = this.panY + y * scaledPixelSize;
                    this.gridCtx.moveTo(this.panX + startX * scaledPixelSize, pixelY);
                    this.gridCtx.lineTo(this.panX + endX * scaledPixelSize, pixelY);
                }

                this.gridCtx.stroke();
            }

            this.needsFullRedraw = false;
        }

        // Clear main canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw the pixel canvas onto the main canvas
        this.ctx.drawImage(this.pixelsCanvas, 0, 0);

        // Draw the grid canvas onto the main canvas
        if (this.zoom >= this.zoomThreshold) {
            this.ctx.drawImage(this.gridCanvas, 0, 0);
        }

        // Draw hovered cell highlight
        if (this.hoveredCell) {
            const x = this.hoveredCell.x;
            const y = this.hoveredCell.y;

            // Only draw if within visible area
            if (x >= startX && x < endX && y >= startY && y < endY) {
                const pixelX = this.panX + x * scaledPixelSize;
                const pixelY = this.panY + y * scaledPixelSize;

                // Draw highlight
                this.ctx.strokeStyle = '#000000';
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(pixelX, pixelY, scaledPixelSize, scaledPixelSize);

                // Draw preview of selected color with transparency
                this.ctx.globalAlpha = 0.5;
                this.ctx.fillStyle = this.selectedColor;
                this.ctx.fillRect(pixelX, pixelY, scaledPixelSize, scaledPixelSize);
                this.ctx.globalAlpha = 1.0;
            }
        }
    }
}