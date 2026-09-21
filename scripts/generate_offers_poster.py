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

# The seven drinks the Swiggy Buy 1 Get 1 covers, mirroring
# BOGO_FRUIT_TEAS in src/offersData.js. Swiggy only since 16 September, when
# the Zomato copy was stopped. Printed so the counter is not asked.
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


# ── Fruit colours ────────────────────────────────────────────────
# One per tea, pulled towards the fruit rather than the brand palette: the
# teal ground is the brand, and the drinks are what the poster is selling.
TEA_COLOURS = {
    "Taiwan Pink Guava Splash": (242, 120, 159),
    "Raw Mango Mist Pop": (198, 214, 60),
    "Tropical Pineapple Pop": (245, 197, 66),
    "Passion Fruit Rush": (242, 139, 48),
    "Orange Ginger Spark": (242, 109, 61),
    "Mango Jade Splash": (255, 182, 39),
    "Kiwi Island Tea": (127, 181, 57),
}

SS = 2  # supersample factor for the illustration, downsampled for clean edges


def _serif(size: int, *, bold: bool = False, italic: bool = False) -> ImageFont.FreeTypeFont:
    """Georgia. Carries U+20B9, and its warmth offsets the grotesque headlines."""
    name = "Georgia"
    if bold and italic:
        name += " Bold Italic"
    elif bold:
        name += " Bold"
    elif italic:
        name += " Italic"
    path = Path(f"/System/Library/Fonts/Supplemental/{name}.ttf")
    if path.exists():
        try:
            return ImageFont.truetype(str(path), size=size)
        except OSError:
            pass
    return _font(size, bold=bold)


def _text(draw, x: int, y: int, s: str, font, fill, *, anchor: str = "lt") -> tuple[int, int]:
    """Draw `s` and return its (width, height). `anchor` follows Pillow's."""
    draw.text((x, y), s, font=font, fill=fill, anchor=anchor)
    bbox = draw.textbbox((0, 0), s, font=font)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]


def _halftone(size: tuple[int, int], *, spacing: int, radius: int, colour) -> Image.Image:
    """A dot grid, so the flat ground has some tooth rather than reading as vinyl."""
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    for y in range(0, size[1], spacing):
        offset = (spacing // 2) if (y // spacing) % 2 else 0
        for x in range(-spacing, size[0] + spacing, spacing):
            draw.ellipse([(x + offset, y), (x + offset + radius, y + radius)], fill=colour)
    return layer


def _draw_cup(layer: Image.Image, cx: int, top: int, h: int, tea, *, lean: float = 0.0) -> None:
    """A boba cup: tapered body, domed lid, straw, pearls settled at the base.

    Drawn at SS scale on `layer` and downsampled by the caller. `lean` shears
    the cup off vertical so a pair of them can overlap without looking stacked.

    Translucent fills go on their own layer and are alpha-composited: Pillow's
    ImageDraw replaces pixels rather than blending them, so drawing the sheen
    straight onto the cup punched a flat grey slab through it.
    """
    draw = ImageDraw.Draw(layer)
    top_w, bot_w = int(h * 0.60), int(h * 0.40)

    def shear(y_frac: float) -> int:
        return int(lean * h * (1 - y_frac))

    def edge(y_frac: float) -> tuple[int, int]:
        """Half-width and centre offset at a given height down the cup."""
        return int((top_w + (bot_w - top_w) * y_frac) / 2), shear(y_frac)

    half_t, off_t = edge(0.0)
    half_b, off_b = edge(1.0)
    tl, tr = (cx - half_t + off_t, top), (cx + half_t + off_t, top)
    br, bl = (cx + half_b + off_b, top + h), (cx - half_b + off_b, top + h)

    # Straw first, so the lid closes over its base.
    straw_w = int(h * 0.045)
    sx = cx + off_t + int(top_w * 0.20)
    draw.line([(sx - int(h * 0.07), top - int(h * 0.28)), (sx, top + int(h * 0.04))],
              fill=GOLD + (255,), width=straw_w)

    draw.polygon([tl, tr, br, bl], fill=tea + (255,))

    # A lighter band down the left third reads as a curved surface.
    sheen = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    ImageDraw.Draw(sheen).polygon([
        tl,
        (cx - half_t * 0.34 + off_t, top),
        (cx - half_b * 0.34 + off_b, top + h),
        bl,
    ], fill=tuple(min(255, c + 58) for c in tea) + (76,))
    layer.alpha_composite(sheen)

    # Pearls: three settled rows, tucked inside the taper.
    pearl_r = int(h * 0.032)
    for y_frac, count in ((0.90, 4), (0.845, 5), (0.79, 4)):
        y = top + int(h * y_frac)
        half, off = edge(y_frac)
        span = half - pearl_r * 1.7
        for i in range(count):
            t = 0.5 if count == 1 else i / (count - 1)
            x = cx + off + int((t * 2 - 1) * span)
            draw.ellipse([(x - pearl_r, y - pearl_r), (x + pearl_r, y + pearl_r)],
                         fill=(38, 24, 20, 255))

    # Lid, sitting a touch proud of the body on both sides.
    lid_h = int(h * 0.085)
    lid_over = int(top_w * 0.08)
    draw.rounded_rectangle(
        [(tl[0] - lid_over, top - lid_h), (tr[0] + lid_over, top + int(lid_h * 0.30))],
        radius=lid_h // 2, fill=CREAM + (255,))


def _cup_pair(width: int, height: int, front: tuple, back: tuple) -> Image.Image:
    """Two overlapping cups — the free one behind, the bought one in front."""
    layer = Image.new("RGBA", (width * SS, height * SS), (0, 0, 0, 0))

    # Drop shadow first, so both cups sit on the ground rather than float.
    shadow = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).ellipse(
        [(int(width * SS * 0.10), int(height * SS * 0.86)),
         (int(width * SS * 0.92), int(height * SS * 0.99))],
        fill=(0, 20, 20, 120))
    layer.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(radius=18 * SS)))

    _draw_cup(layer, int(width * SS * 0.66), int(height * SS * 0.22),
              int(height * SS * 0.62), back, lean=0.06)
    _draw_cup(layer, int(width * SS * 0.34), int(height * SS * 0.28),
              int(height * SS * 0.66), front, lean=-0.04)

    return layer.resize((width, height), Image.LANCZOS)


def _ribbon(draw: ImageDraw.ImageDraw, box, label: str, font) -> None:
    """An angled tab in the corner — the one element that breaks the grid."""
    x0, y0, x1, y1 = box
    skew = (y1 - y0) // 2
    draw.polygon([(x0, y0), (x1, y0), (x1 - skew, y1), (x0 - skew, y1)], fill=GOLD + (255,))
    _text(draw, (x0 + x1) // 2 - skew // 2, (y0 + y1) // 2, label, font,
          TEAL_DARKEST, anchor="mm")


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


def build_poster() -> Path:
    W, H = 1748, 2480  # A5 @300dpi
    poster = _gradient_v((W, H), TEAL_DARKEST, TEAL_DEEP).convert("RGBA")
    poster.alpha_composite(_halftone((W, H), spacing=26, radius=4, colour=(255, 255, 255, 9)))
    draw = ImageDraw.Draw(poster)

    inset = 56
    draw.rounded_rectangle([(inset, inset), (W - inset, H - inset)],
                           radius=48, outline=GOLD, width=5)

    margin = 128

    # ── Masthead ────────────────────────────────────────────────
    logo = Image.open(LOGO_PATH).convert("RGBA")
    logo.thumbnail((150, 150), Image.LANCZOS)
    poster.alpha_composite(logo, dest=(margin, 132))
    _text(draw, margin + logo.size[0] + 26, 132 + logo.size[1] // 2 - 4,
          "BLEND N BUBBLES", _font(40, bold=True), CREAM, anchor="lm")
    _text(draw, margin + logo.size[0] + 26, 132 + logo.size[1] // 2 + 40,
          "Barrackpore, Kolkata", _serif(32, italic=True), MUTED, anchor="lm")

    _ribbon(draw, (W - margin - 470, 150, W - margin, 226),
            "ON NOW", _font(34, bold=True))

    # ── Hero: numerals left, illustration right ─────────────────
    hero_top = 380
    plus_font, num_font = _font(300, bold=True), _font(300, bold=True)

    x = margin
    w, _h = _text(draw, x, hero_top, "1", num_font, CREAM)
    x += w + 14
    w, _h = _text(draw, x, hero_top + 24, "+", plus_font, GOLD)
    x += w + 14
    _text(draw, x, hero_top, "1", num_font, GOLD)

    y = hero_top + 330
    y += _text(draw, margin, y, "BUY ONE", _font(96, bold=True), CREAM)[1] + 36
    y += _text(draw, margin, y, "GET ONE FREE", _font(96, bold=True), GOLD)[1] + 44
    _text(draw, margin, y, "on Swiggy \u00b7 all seven Fruit Teas", _serif(56, italic=True), CREAM)

    art = _cup_pair(700, 900, TEA_COLOURS["Taiwan Pink Guava Splash"],
                    TEA_COLOURS["Tropical Pineapple Pop"])
    poster.alpha_composite(art, dest=(W - margin - art.size[0] + 40, hero_top - 120))

    # ── The seven drinks, each under its own colour ─────────────
    y = 1290
    draw.line([(margin, y), (W - margin, y)], fill=GOLD, width=3)
    y += 30
    _text(draw, margin, y, "THE SEVEN FRUIT TEAS", _font(38, bold=True), GOLD)
    _text(draw, W - margin, y + 6, "Swiggy only  \u00b7  no minimum order  \u00b7  from \u20B9210",
          _serif(34, italic=True), MUTED, anchor="rt")
    y += 84

    tea_font = _serif(40)
    dot_r, line_h, col_w = 13, 68, (W - margin * 2) // 2
    for i, tea in enumerate(FRUIT_TEAS):
        col, row = divmod(i, 4)
        tx = margin + col * col_w
        ty = y + row * line_h
        draw.ellipse([(tx, ty + 12), (tx + dot_r * 2, ty + 12 + dot_r * 2)],
                     fill=TEA_COLOURS[tea] + (255,))
        _text(draw, tx + dot_r * 2 + 22, ty, tea, tea_font, CREAM)

    y += line_h * 4 + 26
    draw.line([(margin, y), (W - margin, y)], fill=GOLD, width=3)

    # ── Order strip ─────────────────────────────────────────────
    y += 62
    qr_px, pad = 300, 20
    card = qr_px + pad * 2
    label_font, note_font = _font(46, bold=True), _serif(32)

    order_col = (W - margin * 2) // 2
    for x0, url, name, colour, offer, note in (
        (margin, ZOMATO_URL, "ZOMATO", ZOMATO_RED,
         "30% off passionfruit", "No code needed"),
        (margin + order_col, SWIGGY_URL, "SWIGGY", SWIGGY_ORANGE,
         "Buy 1 Get 1", f"Code {SWIGGY_CODE}"),
    ):
        poster.alpha_composite(_qr_card(url, qr_px, pad), dest=(x0, y))
        tx = x0 + card + 34
        _text(draw, tx, y + 74, name, label_font, colour)
        _text(draw, tx, y + 140, offer, _font(36, bold=True), CREAM)
        _text(draw, tx, y + 194, note, note_font, MUTED)
        _text(draw, tx, y + 240, "Scan to order", _serif(30), MUTED)

    y += card + 74

    # ── Foot ────────────────────────────────────────────────────
    draw.rounded_rectangle([(margin, y), (W - margin, y + 92)], radius=46, fill=GOLD + (255,))
    _text(draw, W // 2, y + 46, "SCAN  ·  ORDER  ·  SIP", _font(46, bold=True),
          TEAL_DARKEST, anchor="mm")
    y += 92 + 34
    _text(draw, W // 2, y, "New here? Up to 40% off your first order",
          _serif(36, italic=True), MUTED, anchor="mt")

    print(f"  poster content ends at y={y + 46}, frame inner bottom={H - inset}")

    out = PUBLIC_DIR / "offers-poster-a5.png"
    poster.convert("RGB").save(out, "PNG", optimize=True, dpi=(300, 300))
    return out


def build_sticker() -> Path:
    """50mm round sticker. Points at the website, so it survives the campaign."""
    S = 591
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.ellipse([(0, 0), (S, S)], fill=TEAL_DARKEST + (255,))

    ring = _halftone((S, S), spacing=18, radius=3, colour=(255, 255, 255, 12))
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).ellipse([(0, 0), (S, S)], fill=255)
    img.alpha_composite(Image.composite(ring, Image.new("RGBA", (S, S), (0, 0, 0, 0)), mask))

    draw.ellipse([(9, 9), (S - 9, S - 9)], outline=GOLD, width=7)
    cx = S // 2

    y = 74
    font = _fit_font(draw, "1+1", _chord_width(S, y, margin=40), 120, bold=True)
    y += _text(draw, cx, y, "1+1", font, GOLD, anchor="mt")[1] + 16

    font = _fit_font(draw, "FRUIT TEAS \u00b7 SWIGGY", _chord_width(S, y, margin=40), 34, bold=True)
    y += _text(draw, cx, y, "FRUIT TEAS \u00b7 SWIGGY", font, CREAM, anchor="mt")[1] + 20

    card = _qr_card(OFFERS_URL, 224, 11)
    img.alpha_composite(card, dest=(cx - card.size[0] // 2, y))
    y += card.size[1] + 16

    font = _fit_font(draw, "blendnbubbles.com/offers", _chord_width(S, y, margin=40), 26)
    _text(draw, cx, y, "blendnbubbles.com/offers", font, MUTED, anchor="mt")

    out = PUBLIC_DIR / "offers-sticker.png"
    img.save(out, "PNG", optimize=True, dpi=(300, 300))
    return out


def main() -> None:
    for path in (build_poster(), build_sticker()):
        print(f"wrote {path} ({path.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
