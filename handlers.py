import json
import logging
import time
import tornado.web
import tornado.websocket

# Dict to store active WebSocket connections
# Key: client_id, Value: WebSocketHandler instance
connections = {}


class MainHandler(tornado.web.RequestHandler):
    """Handler for the main page."""

    def get(self):
        """Serve the index.html file."""
        self.render("static/index.html")


class PixelAPIHandler(tornado.web.RequestHandler):
    """Handler for pixel-related API requests."""

    async def get(self):
        """Get the current state of the canvas."""
        grid = await self.application.pixel_manager.get_full_grid()
        self.set_header("Content-Type", "application/json")
        self.write(json.dumps({"grid": grid}))

    async def post(self):
        """Place a pixel on the canvas."""
        try:
            data = json.loads(self.request.body)
            x = int(data.get("x"))
            y = int(data.get("y"))
            color = data.get("color")
            client_id = data.get("client_id")

            if not all([x is not None, y is not None, color, client_id]):
                self.set_status(400)
                self.write({"error": "Missing required fields"})
                return

            # Check if user can place a pixel (1 second cooldown)
            can_place, time_left = await self.application.pixel_manager.can_place_pixel(client_id)

            if not can_place:
                self.set_status(429)  # Too Many Requests
                self.write({"error": f"Too soon. Wait {time_left:.1f} seconds"})
                return

            # Place the pixel
            success = await self.application.pixel_manager.place_pixel(x, y, color, client_id)

            if not success:
                self.set_status(400)
                self.write({"error": "Failed to place pixel. Invalid coordinates or color."})
                return

            # Success response
            self.write({"success": True})

            # Broadcast the update to all connected clients
            for conn in connections.values():
                if conn.ws_connection:
                    conn.write_message(json.dumps({
                        "type": "pixel_update",
                        "data": {"x": x, "y": y, "color": color}
                    }))

        except json.JSONDecodeError:
            self.set_status(400)
            self.write({"error": "Invalid JSON"})
        except Exception as e:
            logging.error(f"Error placing pixel: {str(e)}")
            self.set_status(500)
            self.write({"error": "Internal server error"})


class PixelSocketHandler(tornado.websocket.WebSocketHandler):
    """WebSocket handler for real-time updates."""

    def check_origin(self, origin):
        """Allow connections from any origin."""
        return True

    def open(self):
        """Handle new WebSocket connection."""
        self.client_id = None
        logging.info("New WebSocket connection")

    def on_message(self, message):
        """Handle incoming WebSocket messages."""
        try:
            data = json.loads(message)
            msg_type = data.get("type")

            if msg_type == "register":
                self.client_id = data.get("client_id")
                connections[self.client_id] = self
                logging.info(f"Client registered: {self.client_id}")

                # Send confirmation
                self.write_message(json.dumps({
                    "type": "register_confirm",
                    "data": {"client_id": self.client_id}
                }))

            elif msg_type == "place_pixel":
                # This is handled by the REST API now, but could be implemented here too
                pass

        except json.JSONDecodeError:
            logging.error("Invalid JSON received via WebSocket")
        except Exception as e:
            logging.error(f"WebSocket error: {str(e)}")

    def on_close(self):
        """Handle WebSocket connection close."""
        if self.client_id and self.client_id in connections:
            del connections[self.client_id]
            logging.info(f"WebSocket closed for client: {self.client_id}")