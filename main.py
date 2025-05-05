import os
import logging
import tornado.web
from tornado.web import Application
from tornado.ioloop import IOLoop
from tornado.options import define, options, parse_command_line

from handlers import MainHandler, PixelSocketHandler, PixelAPIHandler
from redis_client import RedisClient
from pixel_manager import PixelManager

# Define command line parameters
define("port", default=8000, help="run on the given port", type=int)
define("debug", default=False, help="run in debug mode", type=bool)
define("redis_host", default="localhost", help="Redis host")
define("redis_port", default=6379, help="Redis port", type=int)
define("canvas_width", default=1000, help="Canvas width in pixels", type=int)
define("canvas_height", default=1000, help="Canvas height in pixels", type=int)


def make_app():
    """Create and return a Tornado application instance."""
    # Parse command line options
    parse_command_line()

    # Setup logging
    logging.basicConfig(
        level=logging.DEBUG if options.debug else logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    # Initialize Redis client
    redis_client = RedisClient(options.redis_host, options.redis_port)

    # Initialize pixel manager
    pixel_manager = PixelManager(
        redis_client,
        options.canvas_width,
        options.canvas_height
    )

    # Setup static path - look for static folder in same directory as main.py
    static_path = os.path.join(os.path.dirname(__file__), "static")

    # Define application settings
    settings = {
        "debug": options.debug,
        "static_path": static_path,
    }

    # Define application routes
    handlers = [
        (r"/", MainHandler),
        (r"/api/pixel", PixelAPIHandler),
        (r"/ws", PixelSocketHandler),
        (r"/static/(.*)", tornado.web.StaticFileHandler, {"path": static_path}),
        (r"/(css|js)/(.*)", tornado.web.StaticFileHandler, {"path": static_path}),
    ]

    # Create application instance
    app = Application(handlers, **settings)

    # Add services to application
    app.pixel_manager = pixel_manager
    app.redis_client = redis_client

    return app


if __name__ == "__main__":
    # Create application
    app = make_app()

    # Start server
    app.listen(options.port)
    logging.info(f"Server started on port {options.port}")

    # Start event loop
    IOLoop.current().start()