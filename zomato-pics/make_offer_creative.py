"""Build a 1080x1080 Instagram offer creative for Blend N Bubbles."""
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps
import os

ROOT = "/sessions/charming-nifty-gates/mnt/zomato-pics"
S = 1080

# Brand palette
GREEN_TOP = (21, 54, 47)      # #15362F
GREEN_BOT = (30, 77, 68)      # #1E4D44
GOLD = (200, 162, 76)         # #C8A24C
GOLD_LT = (228, 205, 147)     # #E4CD93
CREAM = (244, 236, 217)       # #F4ECD9
SWIGGY = (252, 128, 25)       # #FC8019
ZOMATO = (226, 55, 68)        # #E23744
INK = (34, 28, 21)            # #221C15

def font(name, size):
    paths = {
        "bold": "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf",
        "reg": "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
    }
    return ImageFont.truetype(paths[name], size)

def ctext(d, cx, y, text, fnt, fill, anchor="mm", ls=0):
    if ls:
        # letter-spaced draw
        widths = [d.textlength(ch, font=fnt) for ch in text]
        total = sum(widths) + ls * (len(text) - 1)
        x = cx - total / 2
        for ch, w in zip(text, widths):
            d.text((x, y), ch, font=fnt, fill=fill, anchor="lm")
            x += w + ls
    else:
        d.text((cx, y), text, font=fnt, fill=fill, anchor=anchor)

# --- background gradient ---
bg = Image.new("RGB", (S, S), GREEN_TOP)
top, bot = GREEN_TOP, GREEN_BOT
for y in range(S):
    t = y / S
    r = int(top[0] + (bot[0] - top[0]) * t)
    g = int(top[1] + (bot[1] - top[1]) * t)
    b = int(top[2] + (bot[2] - top[2]) * t)
    for x0 in range(0, S, S):
        pass
    ImageDraw.Draw(bg).line([(0, y), (S, y)], fill=(r, g, b))

draw = ImageDraw.Draw(bg, "RGBA")

# subtle decorative bubbles
for (cx, cy, rad, a) in [(120,880,150,18),(980,220,180,16),(920,940,90,20),(150,240,70,16),(540,540,470,8)]:
    draw.ellipse([cx-rad, cy-rad, cx+rad, cy+rad], outline=(200,162,76,a), width=6)

# --- logo: recolour black lineart to cream on transparent ---
logo = Image.open(os.path.join(ROOT, "logo for cup 2.png")).convert("L")
lum = logo
alpha = ImageOps.invert(lum)  # black->255 opaque, white->0 transparent
cream_layer = Image.new("RGBA", logo.size, CREAM + (0,))
cream_layer.putalpha(alpha)
# trim to bounding box of alpha
bbox = alpha.getbbox()
cream_layer = cream_layer.crop(bbox)
lw = 300
lh = int(cream_layer.height * lw / cream_layer.width)
cream_layer = cream_layer.resize((lw, lh), Image.LANCZOS)
bg.paste(cream_layer, (S//2 - lw//2, 60), cream_layer)

# --- banner pill ---
by = 430
btxt = "NOW LIVE ON SWIGGY & ZOMATO"
bf = font("bold", 30)
bw = draw.textlength(btxt, font=bf) + 34*2 + 20*len("")  # padding
# compute with letterspacing
ls = 4
bw = sum(draw.textlength(c, font=bf) for c in btxt) + ls*(len(btxt)-1) + 68
draw.rounded_rectangle([S//2-bw/2, by-32, S//2+bw/2, by+32], radius=32,
                       fill=(200,162,76,255))
ctext(draw, S//2, by, btxt, bf, INK, ls=ls)

# --- big offer ---
ctext(draw, S//2, 520, "UP TO", font("bold", 44), CREAM, ls=10)
big = font("bold", 210)
ctext(draw, S//2, 650, "50% OFF", big, GOLD_LT)

# --- platform badges ---
pf_t = font("bold", 46)
pf_s = font("reg", 30)
pill_w, pill_h, gap = 470, 150, 30
py = 800
lx = S//2 - gap//2 - pill_w
rx = S//2 + gap//2
# Swiggy
draw.rounded_rectangle([lx, py, lx+pill_w, py+pill_h], radius=28, fill=SWIGGY+(255,))
ctext(draw, lx+pill_w//2, py+50, "SWIGGY", pf_t, (255,255,255))
ctext(draw, lx+pill_w//2, py+105, "50% OFF  •  new users", pf_s, (255,255,255))
# Zomato
draw.rounded_rectangle([rx, py, rx+pill_w, py+pill_h], radius=28, fill=ZOMATO+(255,))
ctext(draw, rx+pill_w//2, py+50, "ZOMATO", pf_t, (255,255,255))
ctext(draw, rx+pill_w//2, py+105, "40% OFF  •  new users", pf_s, (255,255,255))

# --- subline ---
ctext(draw, S//2, 1005, "Already ordered? Repeat customers get up to 20% OFF too",
      font("reg", 30), GOLD_LT)

bg.save(os.path.join(ROOT, "BNB_Offers_Instagram.png"), quality=95)
print("saved BNB_Offers_Instagram.png", bg.size)
