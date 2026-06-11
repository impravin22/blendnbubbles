# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "qrcode[pil]>=7.4",
#   "Pillow>=10.3",
# ]
# ///
"""Generate the in-shop "Order us on Zomato, 12% off" print assets.

Outputs (under `public/`):
  zomato-poster-a5.png   : 1748x2480 @300dpi A5 portrait, counter / window
  zomato-sticker.png     : 591x591 @300dpi (50mm) round sticker for cups & bags

Run with:
  cd /Users/kumarpr/Desktop/Projects/blendnbubbles
  uv run scripts/generate_zomato_poster.py
"""

from __future__ import annotations

from pathlib import Path

import qrcode
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from qrcode.constants import ERROR_CORRECT_H

REPO_ROOT = Path(__file__).resolve().parent.parent
PUBLIC_DIR = REPO_ROOT / "public"
LOGO_PATH = PUBLIC_DIR / "logo512.png"
ZOMATO_GLYPH = REPO_ROOT / "scripts" / "assets" / "zomato.png"

ORDER_URL = "https://www.zomato.com/kolkata/blend-n-bubbles-barrackpore/order"

# Brand palette (site tokens).
TEAL_DARKEST = (1, 42, 42)      # #012a2a
TEAL_DARK = (0, 68, 68)         # #004444
TEAL_DEEP = (10, 82, 82)        # #0a5252
GOLD = (206, 170, 103)          # #CEAA67
GOLD_DARK = (187, 135, 80)      # #BB8750
ZOMATO_RED = (226, 55, 68)
WHITE = (255, 255, 255)
CREAM = (249, 246, 240)         # #F9F6F0


def _font(size: int, *, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        "/Library/Fonts/Arial Bold.ttf" if bold else "/Library/Fonts/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Helvetica.ttc",
        "/System/Library/Fonts/HelveticaNeue.ttc",
    ]
    for cand in candidates:
        if Path(cand).exists():
            try:
                return ImageFont.truetype(cand, size=size)
            except OSError:
                continue
    return ImageFont.load_default()


def _qr_with_glyph(url: str, size_px: int, glyph: Path) -> Image.Image:
    qr = qrcode.QRCode(version=None, error_correction=ERROR_CORRECT_H, box_size=12, border=2)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color=TEAL_DARKEST, back_color=WHITE).convert("RGBA")
    img = img.resize((size_px, size_px), Image.LANCZOS)

    glyph_size = int(size_px * 0.22)
    halo_size = int(glyph_size * 1.18)
    halo = Image.new("RGBA", (halo_size, halo_size), (0, 0, 0, 0))
    ImageDraw.Draw(halo).ellipse([(0, 0), (halo_size, halo_size)], fill=WHITE)
    halo = halo.filter(ImageFilter.GaussianBlur(radius=2))
    img.alpha_composite(halo, dest=((size_px - halo_size) // 2, (size_px - halo_size) // 2))

    mark = Image.open(glyph).convert("RGBA")
    mark.thumbnail((glyph_size, glyph_size), Image.LANCZOS)
    img.alpha_composite(mark, dest=((size_px - mark.size[0]) // 2, (size_px - mark.size[1]) // 2))
    return img


def _centre_text(draw: ImageDraw.ImageDraw, cx: int, y: int, text: str, font: ImageFont.FreeTypeFont, fill) -> int:
    """Draw text centred on cx with its top at y. Returns the text height."""
    bbox = draw.textbbox((0, 0), text, font=font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text((cx - w / 2 - bbox[0], y - bbox[1]), text, font=font, fill=fill)
    return h


def _gradient_v(size: tuple[int, int], top, bottom) -> Image.Image:
    w, h = size
    img = Image.new("RGB", (w, h))
    for row in range(h):
        t = row / max(1, h - 1)
        img.paste(
            tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)),
            (0, row, w, row + 1),
        )
    return img


def build_poster() -> Path:
    W, H = 1748, 2480  # A5 @300dpi
    poster = _gradient_v((W, H), TEAL_DARKEST, TEAL_DEEP).convert("RGBA")
    draw = ImageDraw.Draw(poster)
    cx = W // 2

    # Gold frame.
    inset = 56
    draw.rounded_rectangle([(inset, inset), (W - inset, H - inset)], radius=48, outline=GOLD, width=6)

    # Brand logo at the top.
    logo = Image.open(LOGO_PATH).convert("RGBA")
    logo.thumbnail((300, 300), Image.LANCZOS)
    poster.alpha_composite(logo, dest=(cx - logo.size[0] // 2, 150))

    y = 150 + logo.size[1] + 60
    y += _centre_text(draw, cx, y, "ORDER US ON", _font(120, bold=True), WHITE) + 18
    y += _centre_text(draw, cx, y, "ZOMATO", _font(190, bold=True), ZOMATO_RED) + 50

    # The hero offer.
    y += _centre_text(draw, cx, y, "12% OFF", _font(230, bold=True), GOLD) + 24
    y += _centre_text(draw, cx, y, "on every online order", _font(64), CREAM) + 70

    # QR on a white card.
    qr = _qr_with_glyph(ORDER_URL, 760, ZOMATO_GLYPH)
    card_pad = 40
    card_size = qr.size[0] + card_pad * 2
    card = Image.new("RGBA", (card_size, card_size), WHITE + (255,))
    ImageDraw.Draw(card).rounded_rectangle([(0, 0), (card_size, card_size)], radius=36, fill=WHITE + (255,))
    card.alpha_composite(qr, dest=(card_pad, card_pad))
    poster.alpha_composite(card, dest=(cx - card_size // 2, y))
    y += card_size + 56

    y += _centre_text(draw, cx, y, "SCAN  ·  ORDER  ·  SAVE", _font(72, bold=True), GOLD) + 30
    y += _centre_text(draw, cx, y, "Blend N Bubbles  ·  Barrackpore, Kolkata", _font(52), CREAM) + 16
    _centre_text(draw, cx, y, "Dine-in favourites, delivered hot & cold", _font(46), (170, 200, 195))

    out = PUBLIC_DIR / "zomato-poster-a5.png"
    poster.convert("RGB").save(out, "PNG", optimize=True, dpi=(300, 300))
    return out


def build_sticker() -> Path:
    # 50mm round sticker @300dpi.
    S = 591
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.ellipse([(0, 0), (S, S)], fill=TEAL_DARKEST + (255,))
    draw.ellipse([(10, 10), (S - 10, S - 10)], outline=GOLD, width=8)
    cx = S // 2

    y = 78
    y += _centre_text(draw, cx, y, "12% OFF", _font(96, bold=True), GOLD) + 8
    y += _centre_text(draw, cx, y, "ORDER ON ZOMATO", _font(40, bold=True), WHITE) + 22

    qr = _qr_with_glyph(ORDER_URL, 280, ZOMATO_GLYPH)
    pad = 14
    card = Image.new("RGBA", (qr.size[0] + pad * 2, qr.size[1] + pad * 2), WHITE + (255,))
    card_r = Image.new("RGBA", card.size, (0, 0, 0, 0))
    ImageDraw.Draw(card_r).rounded_rectangle([(0, 0), card.size], radius=20, fill=WHITE + (255,))
    card_r.alpha_composite(qr, dest=(pad, pad))
    img.alpha_composite(card_r, dest=(cx - card_r.size[0] // 2, y))

    out = PUBLIC_DIR / "zomato-sticker.png"
    img.save(out, "PNG", optimize=True, dpi=(300, 300))
    return out


def main() -> None:
    for path in (build_poster(), build_sticker()):
        print(f"wrote {path} ({path.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
