"""Builds the app's logo and icon files from the designer's PNGs (white background).

Usage: python3 tools/brand/make_assets.py <Logo_Notelisa_horizontal.png> <N logo.png>
Writes public/brand/*.png and public/favicon.ico.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[2] / 'public'


def transparent(path: str) -> Image.Image:
    """Turns the white paper around the drawing transparent, keeping white inside it (the note shines)."""
    im = Image.open(path).convert('RGB')
    rgb = np.asarray(im).astype(np.float32)
    dist = (255 - rgb).max(axis=2)  # 0 = pure white
    near_white = Image.fromarray(((dist < 70) * 255).astype(np.uint8))
    padded = Image.new('L', (im.width + 2, im.height + 2), 255)
    padded.paste(near_white, (1, 1))
    ImageDraw.floodfill(padded, (0, 0), 128)
    outside = np.asarray(padded)[1:-1, 1:-1] == 128
    alpha = np.where(outside, np.clip((dist - 6) / (70 - 6), 0, 1), 1.0)
    # Un-mix the white from anti-aliased edge pixels so they don't leave a pale halo.
    a = np.maximum(alpha, 1e-3)[..., None]
    color = np.where(outside[..., None], np.clip((rgb - 255 * (1 - a)) / a, 0, 255), rgb)
    rgba = np.dstack([color, alpha * 255]).astype(np.uint8)
    out = Image.fromarray(rgba, 'RGBA')
    return out.crop(out.getbbox())


def fit(im: Image.Image, size: int, padding: float, background=None) -> Image.Image:
    """Centres the drawing in a square canvas with the given padding (fraction of the side)."""
    canvas = Image.new('RGBA', (size, size), background or (0, 0, 0, 0))
    inner = round(size * (1 - 2 * padding))
    copy = im.copy()
    copy.thumbnail((inner, inner), Image.LANCZOS)
    canvas.alpha_composite(copy, ((size - copy.width) // 2, (size - copy.height) // 2))
    return canvas


def main(horizontal: str, square: str) -> None:
    (OUT / 'brand').mkdir(exist_ok=True)
    logo = transparent(horizontal)
    logo.thumbnail((900, 900), Image.LANCZOS)
    logo.save(OUT / 'brand' / 'logo-notelisa.png', optimize=True)

    n = transparent(square)
    white = (255, 255, 255, 255)
    fit(n, 512, 0.08).save(OUT / 'brand' / 'logo-n.png', optimize=True)
    fit(n, 192, 0.1, white).save(OUT / 'brand' / 'icon-192.png', optimize=True)
    fit(n, 512, 0.1, white).save(OUT / 'brand' / 'icon-512.png', optimize=True)
    # Maskable icons get cropped to a circle: keep the drawing inside the central 80 %.
    fit(n, 512, 0.2, white).save(OUT / 'brand' / 'icon-maskable-512.png', optimize=True)
    fit(n, 180, 0.12, white).save(OUT / 'brand' / 'apple-touch-icon.png', optimize=True)
    fit(n, 64, 0.04).save(OUT / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
