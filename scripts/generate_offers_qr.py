# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "qrcode[pil]>=7.4",
#   "Pillow>=10.3",
# ]
# ///
"""Generate a branded QR code that points to https://blendnbubbles.com/offers.

Output:
  public/offers-qr.png          (web/share copy, 800x1000)
  public/offers-qr-print.png    (print-ready, 2400x3000 @300dpi)
  public/offers-qr-bare.png     (QR only, no chrome — for ad-hoc reuse)

Run with:
  cd /Users/kumarpr/Desktop/Projects/blendnbubbles
  uv run scripts/generate_offers_qr.py
"""

from __future__ import annotations

from pathlib import Path

import qrcode
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from qrcode.constants import ERROR_CORRECT_H

OFFERS_URL = "https://blendnbubbles.com/offers"
HEADER_TEXT = "OFFERS"
SUBHEADER_TEXT = "Tap. Sip. Win."
FOOTER_TEXT = "blendnbubbles.com/offers"

# Brand palette (sampled from existing site hero + buttons).
BRAND_DARK_TEAL = (15, 60, 60)       # primary dark for QR modules + header
BRAND_AMBER = (200, 155, 74)         # accent gold for subheader pill
BRAND_BG = (255, 255, 255)           # clean white card background
BRAND_INK = (40, 40, 40)             # body ink for footer URL

REPO_ROOT = Path(__file__).resolve().parent.parent
LOGO_PATH = REPO_ROOT / "public" / "logo512.png"
PUBLIC_DIR = REPO_ROOT / "public"


def _load_font(size: int, *, bold: bool = False) -> ImageFont.FreeTypeFont:
    """Best-effort load of a system sans-serif font; fall back to Pillow default."""
    candidates = [
        # macOS
        "/System/Library/Fonts/Supplemental/Helvetica.ttc",
        "/System/Library/Fonts/HelveticaNeue.ttc",
        "/Library/Fonts/Arial Bold.ttf" if bold else "/Library/Fonts/Arial.ttf",
        "/System/Library/Fonts/SFNS.ttf",
        # Linux
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
        if bold
        else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for candidate in candidates:
        path = Path(candidate)
        if path.exists():
            try:
                return ImageFont.truetype(str(path), size=size)
            except OSError:
                continue
    return ImageFont.load_default()


def _build_qr(size_px: int) -> Image.Image:
    """Render the QR at ~`size_px` with high error correction for logo overlay."""
    qr = qrcode.QRCode(
        version=None,
        error_correction=ERROR_CORRECT_H,
        box_size=12,
        border=2,
    )
    qr.add_data(OFFERS_URL)
    qr.make(fit=True)
    img = qr.make_image(
        fill_color=BRAND_DARK_TEAL,
        back_color=BRAND_BG,
    ).convert("RGBA")
    return img.resize((size_px, size_px), Image.LANCZOS)


def _overlay_logo(qr_img: Image.Image, *, logo_ratio: float = 0.22) -> Image.Image:
    """Composite the BlendNBubbles logo onto the centre of the QR with a soft halo."""
    if not LOGO_PATH.exists():
        raise FileNotFoundError(f"Missing logo asset: {LOGO_PATH}")

    qr_size = qr_img.size[0]
    logo_size = int(qr_size * logo_ratio)

    halo_size = int(logo_size * 1.18)
    halo = Image.new("RGBA", (halo_size, halo_size), (0, 0, 0, 0))
    halo_draw = ImageDraw.Draw(halo)
    halo_draw.ellipse([(0, 0), (halo_size, halo_size)], fill=BRAND_BG)
    halo = halo.filter(ImageFilter.GaussianBlur(radius=2))

    halo_pos = ((qr_size - halo_size) // 2, (qr_size - halo_size) // 2)
    qr_img.alpha_composite(halo, dest=halo_pos)

    logo = Image.open(LOGO_PATH).convert("RGBA")
    logo.thumbnail((logo_size, logo_size), Image.LANCZOS)
    logo_pos = ((qr_size - logo.size[0]) // 2, (qr_size - logo.size[1]) // 2)
    qr_img.alpha_composite(logo, dest=logo_pos)

    return qr_img


def _draw_pill(
    draw: ImageDraw.ImageDraw,
    *,
    centre_x: int,
    centre_y: int,
    text: str,
    font: ImageFont.FreeTypeFont,
    pad_x: int,
    pad_y: int,
    fill: tuple[int, int, int],
    text_fill: tuple[int, int, int] = BRAND_BG,
) -> None:
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    pill_w = text_w + pad_x * 2
    pill_h = text_h + pad_y * 2
    left = centre_x - pill_w // 2
    top = centre_y - pill_h // 2
    radius = pill_h // 2
    draw.rounded_rectangle(
        [(left, top), (left + pill_w, top + pill_h)],
        radius=radius,
        fill=fill,
    )
    # Pillow's textbbox anchors at the glyph bbox top-left including descender padding;
    # offset by the bbox origin so visual centring stays clean.
    draw.text(
        (centre_x - text_w / 2 - bbox[0], centre_y - text_h / 2 - bbox[1]),
        text,
        font=font,
        fill=text_fill,
    )


def _compose_card(qr_size: int, scale: float = 1.0) -> Image.Image:
    """Assemble the full poster: header → QR → footer URL on a clean white card."""
    base_qr = _overlay_logo(_build_qr(int(qr_size * scale)))

    card_w = int(800 * scale)
    card_h = int(1000 * scale)
    card = Image.new("RGBA", (card_w, card_h), BRAND_BG + (255,))
    draw = ImageDraw.Draw(card)

    # Outer subtle border for printed copy framing.
    border_inset = int(24 * scale)
    draw.rounded_rectangle(
        [(border_inset, border_inset), (card_w - border_inset, card_h - border_inset)],
        radius=int(36 * scale),
        outline=BRAND_DARK_TEAL,
        width=max(2, int(3 * scale)),
    )

    # Header — "OFFERS"
    header_font = _load_font(int(96 * scale), bold=True)
    header_bbox = draw.textbbox((0, 0), HEADER_TEXT, font=header_font)
    header_w = header_bbox[2] - header_bbox[0]
    header_y = int(90 * scale)
    draw.text(
        ((card_w - header_w) / 2 - header_bbox[0], header_y - header_bbox[1]),
        HEADER_TEXT,
        font=header_font,
        fill=BRAND_DARK_TEAL,
    )

    # Subheader pill — "Tap. Sip. Win."
    sub_font = _load_font(int(28 * scale), bold=True)
    pill_y = header_y + int(140 * scale)
    _draw_pill(
        draw,
        centre_x=card_w // 2,
        centre_y=pill_y,
        text=SUBHEADER_TEXT,
        font=sub_font,
        pad_x=int(28 * scale),
        pad_y=int(12 * scale),
        fill=BRAND_AMBER,
    )

    # QR
    qr_paste_size = base_qr.size[0]
    qr_x = (card_w - qr_paste_size) // 2
    qr_y = pill_y + int(70 * scale)
    card.alpha_composite(base_qr, dest=(qr_x, qr_y))

    # Footer URL
    footer_font = _load_font(int(28 * scale), bold=False)
    footer_bbox = draw.textbbox((0, 0), FOOTER_TEXT, font=footer_font)
    footer_w = footer_bbox[2] - footer_bbox[0]
    footer_y = qr_y + qr_paste_size + int(40 * scale)
    draw.text(
        ((card_w - footer_w) / 2 - footer_bbox[0], footer_y - footer_bbox[1]),
        FOOTER_TEXT,
        font=footer_font,
        fill=BRAND_INK,
    )

    return card.convert("RGB")


def main() -> None:
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)

    bare = _overlay_logo(_build_qr(720))
    bare_path = PUBLIC_DIR / "offers-qr-bare.png"
    bare.convert("RGB").save(bare_path, format="PNG", optimize=True)

    web = _compose_card(qr_size=520, scale=1.0)
    web_path = PUBLIC_DIR / "offers-qr.png"
    web.save(web_path, format="PNG", optimize=True)

    print_card = _compose_card(qr_size=520, scale=3.0)
    print_path = PUBLIC_DIR / "offers-qr-print.png"
    print_card.save(print_path, format="PNG", optimize=True, dpi=(300, 300))

    print(f"wrote {bare_path}")
    print(f"wrote {web_path}")
    print(f"wrote {print_path}")


if __name__ == "__main__":
    main()
