# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "qrcode[pil]>=7.4",
#   "Pillow>=10.3",
# ]
# ///
"""Generate branded BlendNBubbles QR codes for every customer-facing channel.

Each spec produces three PNG variants in `public/`:
  {slug}-qr.png          : 800x1000 web/share copy
  {slug}-qr-print.png    : 2400x3000 @300dpi for fridge magnets / leaflets
  {slug}-qr-bare.png     : 720x720 QR + logo only, for ad-hoc reuse

Run with:
  cd /Users/kumarpr/Desktop/Projects/blendnbubbles
  uv run scripts/generate_qr.py
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import qrcode
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from qrcode.constants import ERROR_CORRECT_H

# Brand palette sampled from the existing site hero + primary buttons.
BRAND_DARK_TEAL = (15, 60, 60)
BRAND_AMBER = (200, 155, 74)
BRAND_BG = (255, 255, 255)
BRAND_INK = (40, 40, 40)

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_LOGO_PATH = REPO_ROOT / "public" / "logo512.png"
PUBLIC_DIR = REPO_ROOT / "public"
ASSETS_DIR = REPO_ROOT / "scripts" / "assets"


@dataclass(frozen=True)
class QRSpec:
    """One customer-facing QR target.

    Attributes:
        slug: Filename prefix written under `public/` (e.g. "offers" → offers-qr.png).
        url: Live destination URL encoded into the QR.
        header: Large headline rendered above the QR (e.g. "OFFERS").
        subheader: Amber pill text under the header (short pitch line).
        footer: Human-readable URL rendered below the QR.
        logo_path: Optional override of the centre logo. Defaults to the
            BlendNBubbles brand mark for any channel that does not have its own
            recognisable glyph (e.g. offers).
    """

    slug: str
    url: str
    header: str
    subheader: str
    footer: str
    logo_path: Path = DEFAULT_LOGO_PATH


SPECS: tuple[QRSpec, ...] = (
    QRSpec(
        slug="offers",
        url="https://blendnbubbles.com/offers",
        header="OFFERS",
        subheader="Tap. Sip. Win.",
        footer="blendnbubbles.com/offers",
    ),
    QRSpec(
        slug="website",
        url="https://blendnbubbles.com",
        header="WEBSITE",
        subheader="Bubble tea, Kolkata.",
        footer="blendnbubbles.com",
        logo_path=ASSETS_DIR / "web.png",
    ),
    QRSpec(
        slug="instagram",
        url="https://www.instagram.com/blendnbubbles?igsh=Zmg2NW04NzJjdHdx",
        header="INSTAGRAM",
        subheader="@blendnbubbles",
        footer="instagram.com/blendnbubbles",
        logo_path=ASSETS_DIR / "instagram.png",
    ),
    QRSpec(
        slug="google",
        url="https://share.google/3HwffXhbv7QsQpvID",
        header="GOOGLE",
        subheader="Find us on Maps",
        footer="Leave a review on Google",
        logo_path=ASSETS_DIR / "google.png",
    ),
    QRSpec(
        slug="game",
        url="https://blendnbubbles.com/play/football",
        header="PLAY & WIN",
        subheader="Score big. Sip better.",
        footer="blendnbubbles.com/play/football",
    ),
    QRSpec(
        slug="zomato",
        url="https://www.zomato.com/kolkata/blend-n-bubbles-barrackpore/order",
        header="ZOMATO",
        subheader="12% OFF online orders",
        footer="Order on Zomato",
        logo_path=ASSETS_DIR / "zomato.png",
    ),
)


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


def _build_qr(url: str, size_px: int) -> Image.Image:
    """Render a QR for `url` at ~`size_px` with high error correction for logo overlay."""
    qr = qrcode.QRCode(
        version=None,
        error_correction=ERROR_CORRECT_H,
        box_size=12,
        border=2,
    )
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(
        fill_color=BRAND_DARK_TEAL,
        back_color=BRAND_BG,
    ).convert("RGBA")
    return img.resize((size_px, size_px), Image.LANCZOS)


def _overlay_logo(
    qr_img: Image.Image,
    logo_path: Path,
    *,
    logo_ratio: float = 0.22,
) -> Image.Image:
    """Composite `logo_path` onto the centre of the QR with a soft white halo."""
    if not logo_path.exists():
        raise FileNotFoundError(f"Missing logo asset: {logo_path}")

    qr_size = qr_img.size[0]
    logo_size = int(qr_size * logo_ratio)

    halo_size = int(logo_size * 1.18)
    halo = Image.new("RGBA", (halo_size, halo_size), (0, 0, 0, 0))
    halo_draw = ImageDraw.Draw(halo)
    halo_draw.ellipse([(0, 0), (halo_size, halo_size)], fill=BRAND_BG)
    halo = halo.filter(ImageFilter.GaussianBlur(radius=2))

    halo_pos = ((qr_size - halo_size) // 2, (qr_size - halo_size) // 2)
    qr_img.alpha_composite(halo, dest=halo_pos)

    logo = Image.open(logo_path).convert("RGBA")
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
    draw.text(
        (centre_x - text_w / 2 - bbox[0], centre_y - text_h / 2 - bbox[1]),
        text,
        font=font,
        fill=text_fill,
    )


def _compose_card(spec: QRSpec, qr_size: int, scale: float = 1.0) -> Image.Image:
    """Assemble the full poster for `spec`: header → QR → footer URL on a white card."""
    base_qr = _overlay_logo(
        _build_qr(spec.url, int(qr_size * scale)),
        spec.logo_path,
    )

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

    # Header
    header_font = _load_font(int(96 * scale), bold=True)
    header_bbox = draw.textbbox((0, 0), spec.header, font=header_font)
    header_w = header_bbox[2] - header_bbox[0]
    header_y = int(90 * scale)
    draw.text(
        ((card_w - header_w) / 2 - header_bbox[0], header_y - header_bbox[1]),
        spec.header,
        font=header_font,
        fill=BRAND_DARK_TEAL,
    )

    # Subheader pill
    sub_font = _load_font(int(28 * scale), bold=True)
    pill_y = header_y + int(140 * scale)
    _draw_pill(
        draw,
        centre_x=card_w // 2,
        centre_y=pill_y,
        text=spec.subheader,
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
    footer_bbox = draw.textbbox((0, 0), spec.footer, font=footer_font)
    footer_w = footer_bbox[2] - footer_bbox[0]
    footer_y = qr_y + qr_paste_size + int(40 * scale)
    draw.text(
        ((card_w - footer_w) / 2 - footer_bbox[0], footer_y - footer_bbox[1]),
        spec.footer,
        font=footer_font,
        fill=BRAND_INK,
    )

    return card.convert("RGB")


def _render_spec(spec: QRSpec) -> list[Path]:
    """Render all three PNG variants for `spec`. Returns the written paths."""
    written: list[Path] = []

    bare = _overlay_logo(_build_qr(spec.url, 720), spec.logo_path)
    bare_path = PUBLIC_DIR / f"{spec.slug}-qr-bare.png"
    bare.convert("RGB").save(bare_path, format="PNG", optimize=True)
    written.append(bare_path)

    web = _compose_card(spec, qr_size=520, scale=1.0)
    web_path = PUBLIC_DIR / f"{spec.slug}-qr.png"
    web.save(web_path, format="PNG", optimize=True)
    written.append(web_path)

    print_card = _compose_card(spec, qr_size=520, scale=3.0)
    print_path = PUBLIC_DIR / f"{spec.slug}-qr-print.png"
    print_card.save(print_path, format="PNG", optimize=True, dpi=(300, 300))
    written.append(print_path)

    return written


def main() -> None:
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    for spec in SPECS:
        for path in _render_spec(spec):
            print(f"wrote {path}")


if __name__ == "__main__":
    main()
