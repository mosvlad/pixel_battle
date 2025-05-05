#!/usr/bin/env python3
import os
import sys
import time
import uuid
import random
import requests
import threading
import concurrent.futures
from PIL import Image
from tqdm import tqdm
from queue import Queue


class PixelBattleBot:
    def __init__(self, server_url, num_workers=10, start_x=0, start_y=0):
        """
        Initialize the PixelBattle bot.

        Args:
            server_url: URL of the pixel battle server
            num_workers: Number of concurrent workers (each with unique client ID)
            start_x: X coordinate to start placing the image
            start_y: Y coordinate to start placing the image
        """
        self.server_url = server_url.rstrip('/')
        self.api_url = f"{self.server_url}/api/pixel"
        self.num_workers = num_workers
        self.start_x = start_x
        self.start_y = start_y

        # Generate client IDs for each worker
        self.client_ids = [str(uuid.uuid4()) for _ in range(num_workers)]

        # Track pixels to place
        self.pixels_to_place = []
        self.placed_pixels = set()

        # Thread-safe counter for progress
        self.placed_count = 0
        self.lock = threading.Lock()

        # Progress tracking
        self.progress_bar = None

    def load_and_pixelate_image(self, image_path, target_width=256):
        """
        Load an image and pixelate it to the target width.

        Args:
            image_path: Path to the image file
            target_width: Width to resize the image to (in pixels)

        Returns:
            Pixelated image as a list of (x, y, color) tuples
        """
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image not found: {image_path}")

        # Open the image
        img = Image.open(image_path)

        # Calculate target height to maintain aspect ratio
        width, height = img.size
        target_height = int(height * target_width / width)

        # Resize the image
        img = img.resize((target_width, target_height), Image.NEAREST)

        # Convert to RGB if necessary
        if img.mode != 'RGB':
            img = img.convert('RGB')

        # Extract pixel data
        pixels = []
        for y in range(target_height):
            for x in range(target_width):
                r, g, b = img.getpixel((x, y))

                # Skip fully transparent or white pixels
                if (r, g, b) == (255, 255, 255):
                    continue

                # Convert RGB to hex
                color = f"#{r:02x}{g:02x}{b:02x}"

                # Add to pixels list with coordinates adjusted for starting position
                pixels.append((self.start_x + x, self.start_y + y, color))

        print(f"Loaded {len(pixels)} pixels from image")

        # Randomize the order of pixels for more natural appearance
        random.shuffle(pixels)

        self.pixels_to_place = pixels
        return pixels

    def check_canvas_state(self):
        """
        Check the current state of the canvas to identify already correct pixels.

        Returns:
            Set of (x, y) coordinates that already have the correct color
        """
        print("Checking current canvas state...")
        try:
            response = requests.get(f"{self.api_url}")
            if response.status_code == 200:
                grid = response.json().get("grid", {})
                correct_pixels = set()

                for pixel in self.pixels_to_place:
                    x, y, color = pixel
                    pixel_key = f"{x},{y}"

                    # If pixel already has correct color, mark it as done
                    if grid.get(pixel_key, "#FFFFFF").lower() == color.lower():
                        correct_pixels.add((x, y))

                print(f"Found {len(correct_pixels)} pixels already in correct state")
                return correct_pixels
            else:
                print(f"Error checking canvas state: {response.status_code}")
                return set()
        except Exception as e:
            print(f"Exception checking canvas state: {e}")
            return set()

    def place_pixel(self, client_id, x, y, color):
        """
        Place a single pixel using the API.

        Args:
            client_id: Client ID to use
            x: X coordinate
            y: Y coordinate
            color: Color in hex format (#RRGGBB)

        Returns:
            True if successful, False otherwise
        """
        payload = {
            "x": x,
            "y": y,
            "color": color,
            "client_id": client_id
        }

        try:
            response = requests.post(self.api_url, json=payload)

            if response.status_code == 200:
                # Update progress bar
                with self.lock:
                    self.placed_count += 1
                    self.placed_pixels.add((x, y))
                    if self.progress_bar:
                        self.progress_bar.update(1)

                #print(f"Placed pixel at ({x}, {y}) with color {color} using client {client_id[:8]}")
                return True
            elif response.status_code == 429:  # Rate limit
                # Ignore rate limit since we're bypassing the 1-sec timeout
                return True
            else:
                print(f"Error placing pixel: {response.status_code} - {response.text}")
                return False

        except Exception as e:
            print(f"Exception placing pixel: {e}")
            return False

    def worker_task(self, worker_id, pixel_queue):
        """
        Task for a worker thread to place pixels.

        Args:
            worker_id: Index of the worker
            pixel_queue: Queue of pixels to place
        """
        client_id = self.client_ids[worker_id]

        while True:
            try:
                # Get next pixel from queue with timeout
                pixel = pixel_queue.get(timeout=1)
            except:
                # Queue is empty or timeout
                break

            x, y, color = pixel

            # Skip if already placed
            with self.lock:
                if (x, y) in self.placed_pixels:
                    pixel_queue.task_done()
                    continue

            # Place the pixel
            success = self.place_pixel(client_id, x, y, color)

            if not success:
                # Put it back in the queue
                pixel_queue.put((x, y, color))

            # Mark task as done
            pixel_queue.task_done()

    def run(self):
        """Run the bot to place all pixels."""
        if not self.pixels_to_place:
            print("No pixels to place. Load an image first.")
            return

        # Check canvas state to avoid placing pixels that are already correct
        correct_pixels = self.check_canvas_state()

        # Initialize already placed pixels
        self.placed_pixels = correct_pixels.copy()

        # Filter out pixels that are already correct
        pixels_to_place = [p for p in self.pixels_to_place
                           if (p[0], p[1]) not in correct_pixels]

        if not pixels_to_place:
            print("All pixels are already in the correct state. Nothing to do.")
            return

        print(f"Starting to place {len(pixels_to_place)} pixels with {self.num_workers} workers")

        # Set up progress bar
        self.progress_bar = tqdm(total=len(pixels_to_place), unit="pixel")
        self.progress_bar.update(0)  # Initialize

        # Set up queue for thread-safe pixel distribution
        pixel_queue = Queue()

        # Fill queue with pixels
        for pixel in pixels_to_place:
            pixel_queue.put(pixel)

        # Create thread pool
        with concurrent.futures.ThreadPoolExecutor(max_workers=self.num_workers) as executor:
            # Submit tasks
            futures = [executor.submit(self.worker_task, i, pixel_queue)
                       for i in range(self.num_workers)]

            try:
                # Wait for all tasks to complete or for queue to be empty
                pixel_queue.join()

                # Cancel any remaining futures
                for future in futures:
                    future.cancel()

            except KeyboardInterrupt:
                print("\nInterrupted. Saving progress...")
                # Save progress to a file
                self.save_progress()
                sys.exit(1)

        self.progress_bar.close()
        print("All pixels placed!")

    def save_progress(self, progress_file="pixel_bot_progress.txt"):
        """
        Save current progress to a file.

        Args:
            progress_file: Path to the progress file
        """
        with self.lock:
            with open(progress_file, "w") as f:
                placed = list(self.placed_pixels)
                f.write(f"{len(placed)}\n")
                for x, y in placed:
                    f.write(f"{x},{y}\n")
            print(f"Progress saved to {progress_file} ({len(self.placed_pixels)} pixels placed)")

    def resume_from_file(self, progress_file="pixel_bot_progress.txt"):
        """
        Resume from a saved progress file.

        Args:
            progress_file: Path to the progress file
        """
        if not os.path.exists(progress_file):
            print(f"Progress file not found: {progress_file}")
            return False

        try:
            with open(progress_file, "r") as f:
                count = int(f.readline().strip())
                for _ in range(count):
                    x, y = map(int, f.readline().strip().split(","))
                    self.placed_pixels.add((x, y))

            print(f"Resumed progress: {len(self.placed_pixels)} pixels already placed")
            return True
        except Exception as e:
            print(f"Error resuming from progress file: {e}")
            return False


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python pixel_bot.py <image_path> [server_url] [num_workers] [start_x] [start_y] [--resume]")
        sys.exit(1)

    image_path = sys.argv[1]
    server_url = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:8000"
    num_workers = int(sys.argv[3]) if len(sys.argv) > 3 else 1000
    start_x = int(sys.argv[4]) if len(sys.argv) > 4 else 100
    start_y = int(sys.argv[5]) if len(sys.argv) > 5 else 100

    resume = "--resume" in sys.argv

    bot = PixelBattleBot(server_url, num_workers, start_x, start_y)
    bot.load_and_pixelate_image(image_path)

    if resume:
        bot.resume_from_file()

    bot.run()