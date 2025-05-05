import redis
import logging
import time


class RedisClient:
    """Wrapper for Redis client with pixel battle specific methods."""

    def __init__(self, host="localhost", port=6379):
        """Initialize Redis client."""
        self.redis = redis.Redis(host=host, port=port, decode_responses=True)
        self.pixel_grid_key = "pixel_battle:grid"
        self.user_cooldown_key_prefix = "pixel_battle:cooldown:"

        # Test connection
        try:
            self.redis.ping()
            logging.info("Connected to Redis successfully")
        except redis.ConnectionError:
            logging.error("Failed to connect to Redis")
            raise

    async def get_pixel(self, x, y):
        """Get the color of a pixel at coordinates (x, y)."""
        pixel_key = f"{x}:{y}"
        return self.redis.hget(self.pixel_grid_key, pixel_key)

    async def set_pixel(self, x, y, color):
        """Set the color of a pixel at coordinates (x, y)."""
        pixel_key = f"{x}:{y}"
        self.redis.hset(self.pixel_grid_key, pixel_key, color)
        return True

    async def get_all_pixels(self):
        """Get all pixels from the grid."""
        pixels = self.redis.hgetall(self.pixel_grid_key)
        return pixels

    async def set_user_cooldown(self, user_id, expiration_time=1):
        """Set cooldown for a user after placing a pixel."""
        key = f"{self.user_cooldown_key_prefix}{user_id}"
        timestamp = str(time.time())
        self.redis.set(key, timestamp, ex=expiration_time)
        return True

    async def get_user_cooldown(self, user_id):
        """Get cooldown information for a user."""
        key = f"{self.user_cooldown_key_prefix}{user_id}"
        timestamp = self.redis.get(key)

        if timestamp is None:
            return None

        return float(timestamp)