import time
import logging


class PixelManager:
    """Manager for the pixel grid and user interactions."""

    def __init__(self, redis_client, width=1000, height=1000):
        """Initialize the pixel manager."""
        self.redis = redis_client
        self.width = width
        self.height = height
        self.cooldown_seconds = 1.0  # Time between pixel placements

    async def place_pixel(self, x, y, color, user_id):
        """Place a pixel on the grid."""
        # Validate coordinates
        if not (0 <= x < self.width and 0 <= y < self.height):
            logging.warning(f"Invalid coordinates: ({x}, {y})")
            return False

        # Validate color (hex format)
        if not (isinstance(color, str) and
                (color.startswith('#') and len(color) == 7) or
                (len(color) == 6 and all(c in '0123456789ABCDEFabcdef' for c in color))):
            logging.warning(f"Invalid color: {color}")
            return False

        # Standardize color format to #RRGGBB
        if not color.startswith('#'):
            color = f"#{color}"

        # Set the pixel
        await self.redis.set_pixel(x, y, color)

        # Set cooldown for user - ensure integer value for Redis
        await self.redis.set_user_cooldown(user_id, int(self.cooldown_seconds))

        logging.info(f"Pixel placed at ({x}, {y}) with color {color} by {user_id}")
        return True

    async def can_place_pixel(self, user_id):
        """Check if a user can place a pixel (not in cooldown)."""
        last_placement = await self.redis.get_user_cooldown(user_id)

        if last_placement is None:
            # No recent placements, user can place a pixel
            return True, 0

        current_time = time.time()
        time_elapsed = current_time - float(last_placement)
        time_left = max(0, self.cooldown_seconds - time_elapsed)

        if time_left <= 0:
            return True, 0
        else:
            return False, time_left

    async def get_pixel(self, x, y):
        """Get the color of a pixel at coordinates (x, y)."""
        color = await self.redis.get_pixel(x, y)
        return color or "#FFFFFF"  # Default to white if no color set

    async def get_full_grid(self):
        """Get the full grid state as a sparse dictionary."""
        raw_pixels = await self.redis.get_all_pixels()

        # Convert from Redis format to (x,y) -> color format
        grid = {}
        for key, value in raw_pixels.items():
            try:
                x_str, y_str = key.split(':')
                x, y = int(x_str), int(y_str)
                grid[f"{x},{y}"] = value
            except (ValueError, TypeError):
                logging.warning(f"Invalid pixel key in Redis: {key}")

        return grid