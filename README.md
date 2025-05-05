# Pixel Battle

A real-time collaborative pixel canvas, where users can place a pixel every second and create artwork together.

![image](https://github.com/user-attachments/assets/9f518f57-ce9b-4f5c-b9ff-541f84857022)


## Features

### Web Application
- 🎨 Place colored pixels on a shared canvas
- ⏱️ 1-second cooldown between pixel placements
- 🔄 Real-time updates via WebSockets
- 🔍 Canvas navigation with pan and zoom functionality
- 🎭 Color palette with predefined colors and custom color picker
- 📊 User statistics tracking

### Bot for Image Drawing
- 🖼️ Automatically draw images on the canvas
- 🔄 Resume interrupted drawing sessions
- 🧠 Smart pixel placement to avoid duplicates
- ⚡ Multi-threaded operation for performance
- 🖌️ Pixelation to match canvas format

## Technologies Used

### Backend
- Python with Tornado web server
- Redis for pixel grid storage and user cooldown management
- WebSockets for real-time communication

### Frontend
- Pure JavaScript with no dependencies
- HTML5 Canvas for rendering
- CSS3 for styling

### Bot
- Python with Pillow for image processing
- Concurrent execution with threading
- Progress tracking with tqdm

## Installation

### Prerequisites

- Python 3.7+
- Redis server

### Setup

1. Clone the repository:
```bash
git clone https://github.com/mosvlad/pixel_battle
cd pixel_battle
```

2. Create and activate a virtual environment:
```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# Linux/macOS
source .venv/bin/activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Start Redis server:
```bash
# If you have Redis installed locally
redis-server

# Or using Docker
docker run -p 6379:6379 redis
```

## Usage

### Running the Server

Start the Tornado server:

```bash
python main.py
```

By default, the server will run on http://localhost:8000.

### Using the Web Application

1. Open a web browser and navigate to http://localhost:8000
2. Select a color from the palette on the right
3. Click on the canvas to place a pixel
4. Wait for the 1-second cooldown before placing another pixel
5. Use Ctrl+click or right-click and drag to pan the canvas
6. Use the mouse wheel to zoom in/out

### Using the Bot

The bot allows you to automatically draw images on the canvas:

```bash
python pixel_bot.py path/to/image.jpg [server_url] [num_workers] [start_x] [start_y] [--resume]
```

Options:
- `path/to/image.jpg`: Path to the image you want to draw
- `server_url`: URL of the pixel battle server (default: http://localhost:8000)
- `num_workers`: Number of concurrent workers (default: 10)
- `start_x`, `start_y`: Starting coordinates on the canvas (default: 0, 0)
- `--resume`: Resume from a previously interrupted session

Example:
```bash
python pixel_bot.py myimage.png http://localhost:8000 10 100 100
```

![image](https://github.com/user-attachments/assets/7c2274ee-ca4e-4dd0-ac9a-b805a3f6b70f)


## Project Structure

```
pixel_battle/
├── main.py                   # Main Tornado application
├── handlers.py               # Request handlers
├── pixel_manager.py          # Pixel grid management
├── redis_client.py           # Redis client wrapper
├── requirements.txt          # Dependencies
├── pixel_bot.py              # Bot for auto-drawing images
├── static/
│   ├── index.html            # Main HTML
│   ├── css/
│   │   └── styles.css        # Styling
│   └── js/
│       ├── app.js            # Main application logic
│       ├── canvas.js         # Canvas handling
│       ├── websocket.js      # WebSocket client
│       └── ui.js             # UI components
└── docker-compose.yml        # For Docker deployment
```

## Configuration

You can configure the server by passing command-line arguments:

```bash
python main.py --port=8080 --canvas_width=2000 --canvas_height=2000 --redis_host=redis-server
```

Available options:
- `--port`: Port to run the server on (default: 8000)
- `--debug`: Run in debug mode (default: False)
- `--redis_host`: Redis host (default: localhost)
- `--redis_port`: Redis port (default: 6379)
- `--canvas_width`: Canvas width in pixels (default: 1000)
- `--canvas_height`: Canvas height in pixels (default: 1000)

## Docker Deployment

The project includes a `docker-compose.yml` for easy deployment:

```bash
docker-compose up -d
```

This will start both the Redis server and the Pixel Battle application.

## Performance Optimizations

The web application includes several optimizations for smooth performance:

- Double-buffering with offscreen canvases
- Throttled mouse movement handling
- Batched rendering operations
- Smart visibility detection
- Efficient grid line rendering

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
