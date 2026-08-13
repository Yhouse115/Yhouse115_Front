from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


root = Path(__file__).resolve().parents[1]
source = root / "src" / "assets" / "intro-sprite-sheet-key.png"
output = root / "src" / "assets"
names = ["fall", "land", "confused", "map", "point"]

image = Image.open(source).convert("RGBA")
pixels = np.asarray(image).copy()
rgb = pixels[:, :, :3].astype(np.float32)
key = np.array([250, 4, 245], dtype=np.float32)
distance = np.sqrt(np.sum((rgb - key) ** 2, axis=2))
alpha = np.clip((distance - 38) / 82, 0, 1)
alpha_image = Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.35))
alpha = np.asarray(alpha_image).astype(np.float32) / 255

# Undo chroma-key contamination in antialiased fur pixels:
# composited = foreground * alpha + key * (1 - alpha).
safe_alpha = np.maximum(alpha[:, :, None], 0.08)
clean_rgb = (rgb - key * (1 - alpha[:, :, None])) / safe_alpha
clean_rgb = np.clip(clean_rgb, 0, 255)
# Strong edge despill for white fur: a magenta key can survive in low-alpha
# antialiasing even after uncompositing. Neutralize only translucent pixels.
edge = alpha < 0.94
green = clean_rgb[:, :, 1]
clean_rgb[:, :, 0] = np.where(edge, np.minimum(clean_rgb[:, :, 0], green + 7), clean_rgb[:, :, 0])
clean_rgb[:, :, 2] = np.where(edge, np.minimum(clean_rgb[:, :, 2], green + 7), clean_rgb[:, :, 2])
clean_rgb[alpha < 0.04] = 0
pixels[:, :, :3] = clean_rgb.astype(np.uint8)
pixels[:, :, 3] = np.where(alpha < 0.04, 0, alpha * 255).astype(np.uint8)
sheet = Image.fromarray(pixels)

cell_width = sheet.width // 5
for index, name in enumerate(names):
    left = index * cell_width
    right = sheet.width if index == 4 else (index + 1) * cell_width
    cell = sheet.crop((left, 0, right, sheet.height))
    box = cell.getchannel("A").getbbox()
    if not box:
        raise RuntimeError(f"No subject pixels found for {name}")
    margin = 24
    box = (
        max(0, box[0] - margin), max(0, box[1] - margin),
        min(cell.width, box[2] + margin), min(cell.height, box[3] + margin),
    )
    cell.crop(box).save(output / f"intro-sprite-{name}.png", optimize=True)
