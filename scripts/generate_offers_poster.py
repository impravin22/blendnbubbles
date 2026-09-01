# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "qrcode[pil]>=7.4",
#   "Pillow>=10.3",
# ]
# ///
"""Generate the in-shop print assets for the live Buy 1 Get 1 offer.

Replaces the earlier Zomato-only "12% off" pack: that discount is no longer
configured on either dashboard, and the September line-up runs across both
apps, so a single-platform poster would send half the trade to the wrong place.

Outputs (under `public/`):
  offers-poster-a5.png   : 1748x2480 @300dpi A5 portrait, counter / window
  offers-sticker.png     : 591x591 @300dpi (50mm) round sticker for cups & bags

The poster carries one QR per app. The sticker carries a single QR to the
website offers page instead, because it outlives any one campaign: the page is
edited from `src/offersData.js`, so a printed sticker never goes stale.

Copy here must match `src/offersData.js`. If an offer changes on a partner
dashboard, update that module first, then re-run this.

Run with:
  cd /Users/kumarpr/Desktop/Projects/blendnbubbles
  uv run scripts/generate_offers_poster.py
"""

from __future__ import annotations

from pathlib import Path

import qrcode
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from qrcode.constants import ERROR_CORRECT_H

REPO_ROOT = Path(__file__).resolve().parent.parent
PUBLIC_DIR = REPO_ROOT / "public"
LOGO_PATH = PUBLIC_DIR / "logo512.png"

ZOMATO_URL = "https://www.zomato.com/kolkata/blend-n-bubbles-barrackpore/order"
SWIGGY_URL = "https://www.swiggy.com/city/kolkata/blend-n-bubbles-barrackpore-rest1401296"
OFFERS_URL = "https://blendnbubbles.com/offers"

# The seven drinks the Swiggy Buy 1 Get 1 covers, mirroring BOGO_FRUIT_TEAS in
# src/offersData.js. Printed on the poster so the counter is not asked.
FRUIT_TEAS = [
    "Taiwan Pink Guava Splash",
    "Raw Mango Mist Pop",
    "Tropical Pineapple Pop",
    "Passion Fruit Rush",
    "Orange Ginger Spark",
    "Mango Jade Splash",
    "Kiwi Island Tea",
]

SWIGGY_CODE = "BUY1GET1"

# Brand palette (site tokens).
TEAL_DARKEST = (1, 42, 42)      # #012a2a
TEAL_DEEP = (10, 82, 82)        # #0a5252
GOLD = (206, 170, 103)          # #CEAA67
ZOMATO_RED = (226, 55, 68)
SWIGGY_ORANGE = (252, 128, 25)
WHITE = (255, 255, 255)
CREAM = (249, 246, 240)         # #F9F6F0
MUTED = (170, 200, 195)


# (path, collection index). Helvetica leads because it carries U+20B9, the
# rupee sign; macOS Arial does not, and prints it as an empty box.
_FACES = [
    ("/System/Library/Fonts/Helvetica.ttc", 1, 0),
    ("/System/Library/Fonts/HelveticaNeue.ttc", 1, 0),
    ("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 0, None),
    ("/System/Library/Fonts/Supplemental/Arial.ttf", None, 0),
]


def _font(size: int, *, bold: bool = False) -> ImageFont.FreeTypeFont:
    for path, bold_index, regular_index in _FACES:
        index = bold_index if bold else regular_index
        if index is None or not Path(path).exists():
            continue
        try:
            return ImageFont.truetype(path, size=size, index=index)
        except OSError:
            continue
    return ImageFont.load_default()


def _qr(url: str, size_px: int, glyph: Path | None = None) -> Image.Image:
    """Render a QR at `size_px`, optionally with a glyph on a halo at its centre."""
    qr = qrcode.QRCode(version=None, error_correction=ERROR_CORRECT_H, box_size=12, border=2)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color=TEAL_DARKEST, back_color=WHITE).convert("RGBA")
    img = img.resize((size_px, size_px), Image.LANCZOS)

    if glyph is None:
        return img

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


def _qr_card(url: str, qr_px: int, pad: int) -> Image.Image:
    """A QR on a rounded white card, so it stays scannable on the dark ground."""
    qr = _qr(url, qr_px)
    size = qr_px + pad * 2
    card = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(card).rounded_rectangle([(0, 0), (size, size)], radius=28, fill=WHITE + (255,))
    card.alpha_composite(qr, dest=(pad, pad))
    return card


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
    logo.thumbnail((260, 260), Image.LANCZOS)
    poster.alpha_composite(logo, dest=(cx - logo.size[0] // 2, 150))

    y = 150 + logo.size[1] + 44

    # The hero offer.
    y += _centre_text(draw, cx, y, "BUY 1", _font(200, bold=True), WHITE) + 10
    y += _centre_text(draw, cx, y, "GET 1 FREE", _font(200, bold=True), GOLD) + 38
    y += _centre_text(draw, cx, y, "on selected drinks  ·  from ₹210", _font(62), CREAM) + 26
    y += _centre_text(draw, cx, y, "NO MINIMUM ORDER", _font(50, bold=True), MUTED) + 48

    # The seven qualifying drinks, two columns so the block stays compact.
    rule_w = 640
    draw.line([(cx - rule_w // 2, y), (cx + rule_w // 2, y)], fill=GOLD, width=2)
    y += 26
    y += _centre_text(draw, cx, y, "THE SEVEN FRUIT TEAS ON SWIGGY", _font(36, bold=True), GOLD) + 26

    tea_font = _font(46)
    col_gap = 60
    half = (len(FRUIT_TEAS) + 1) // 2
    columns = (FRUIT_TEAS[:half], FRUIT_TEAS[half:])
    col_w = max(
        draw.textbbox((0, 0), tea, font=tea_font)[2] for tea in FRUIT_TEAS
    )
    left_cx = cx - (col_w + col_gap) // 2
    right_cx = cx + (col_w + col_gap) // 2
    line_h = 66
    for col_cx, names in zip((left_cx, right_cx), columns):
        for row, name in enumerate(names):
            _centre_text(draw, col_cx, y + row * line_h, name, tea_font, CREAM)
    y += line_h * half + 22

    draw.line([(cx - rule_w // 2, y), (cx + rule_w // 2, y)], fill=GOLD, width=2)
    y += 52

    # One QR per app, so a customer lands in the right store.
    qr_px, pad = 510, 26
    card_size = qr_px + pad * 2
    gap = 96
    left_x = cx - gap // 2 - card_size
    right_x = cx + gap // 2
    label_font = _font(56, bold=True)
    note_font = _font(38)

    y += _centre_text(draw, left_x + card_size // 2, y, "ZOMATO", label_font, ZOMATO_RED)
    _centre_text(draw, right_x + card_size // 2, y - label_font.size, "SWIGGY", label_font, SWIGGY_ORANGE)
    y += 22

    poster.alpha_composite(_qr_card(ZOMATO_URL, qr_px, pad), dest=(left_x, y))
    poster.alpha_composite(_qr_card(SWIGGY_URL, qr_px, pad), dest=(right_x, y))
    y += card_size + 32

    note_line_h = 50
    for col_cx, lines in (
        (left_x + card_size // 2, ("Drinks in Great Offers", "Applied at checkout")),
        (right_x + card_size // 2, ("All seven Fruit Teas", f"Code {SWIGGY_CODE}")),
    ):
        for row, line in enumerate(lines):
            _centre_text(draw, col_cx, y + row * note_line_h, line, note_font, MUTED)
    y += note_line_h * 2 + 42

    y += _centre_text(draw, cx, y, "SCAN  ·  ORDER  ·  SIP", _font(72, bold=True), GOLD) + 28
    y += _centre_text(draw, cx, y, "Blend N Bubbles  ·  Barrackpore, Kolkata", _font(52), CREAM) + 20
    _centre_text(draw, cx, y, "New here? Up to 50% off your first order", _font(46), MUTED)

    print(f"  poster content ends at y={y}, frame inner bottom={H - inset}")

    out = PUBLIC_DIR / "offers-poster-a5.png"
    poster.convert("RGB").save(out, "PNG", optimize=True, dpi=(300, 300))
    return out


def _chord_width(diameter: int, y: int, *, margin: int) -> int:
    """Usable width of a circle at height `y`, inset by `margin` each side.

    A round sticker narrows towards the top and bottom, so text sized against
    the full diameter overruns the edge — which is how the first cut clipped
    its headline against the gold ring.
    """
    r = diameter / 2
    dy = abs(y - r)
    if dy >= r:
        return 0
    return max(0, int(2 * (r ** 2 - dy ** 2) ** 0.5) - margin * 2)


def _fit_font(draw: ImageDraw.ImageDraw, text: str, max_w: int, start: int, *, bold: bool = False) -> ImageFont.FreeTypeFont:
    """Largest font at or below `start` whose `text` fits inside `max_w`."""
    size = start
    while size > 10:
        font = _font(size, bold=bold)
        if draw.textbbox((0, 0), text, font=font)[2] <= max_w:
            return font
        size -= 2
    return _font(10, bold=bold)


def build_sticker() -> Path:
    """50mm round sticker. Points at the website, so it survives the campaign."""
    S = 591
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.ellipse([(0, 0), (S, S)], fill=TEAL_DARKEST + (255,))
    draw.ellipse([(10, 10), (S - 10, S - 10)], outline=GOLD, width=8)
    cx = S // 2

    headline, subline, url_label = "BUY 1 GET 1", "ON FRUIT TEAS", "blendnbubbles.com/offers"

    y = 92
    font = _fit_font(draw, headline, _chord_width(S, y, margin=34), 62, bold=True)
    y += _centre_text(draw, cx, y, headline, font, GOLD) + 14

    font = _fit_font(draw, subline, _chord_width(S, y, margin=34), 36, bold=True)
    y += _centre_text(draw, cx, y, subline, font, WHITE) + 18

    card = _qr_card(OFFERS_URL, 250, 12)
    img.alpha_composite(card, dest=(cx - card.size[0] // 2, y))
    y += card.size[1] + 16

    font = _fit_font(draw, url_label, _chord_width(S, y, margin=34), 26)
    _centre_text(draw, cx, y, url_label, font, MUTED)

    out = PUBLIC_DIR / "offers-sticker.png"
    img.save(out, "PNG", optimize=True, dpi=(300, 300))
    return out


def main() -> None:
    for path in (build_poster(), build_sticker()):
        print(f"wrote {path} ({path.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
