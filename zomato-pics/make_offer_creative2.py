"""Classy editorial Instagram offer creative for Blend N Bubbles (product-photo hero)."""
from PIL import Image, ImageDraw, ImageFont, ImageOps, ImageFilter
import os

ROOT = "/sessions/charming-nifty-gates/mnt/zomato-pics"
S = 1080
GREEN = (18, 46, 40)
GREEN2 = (12, 33, 29)
GOLD = (200, 162, 76)
GOLD_LT = (228, 205, 147)
CREAM = (244, 236, 217)

def F(kind, size):
    p = {
        "serif": "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
        "serifr": "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
        "sans": "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
        "sansb": "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf",
    }
    return ImageFont.truetype(p[kind], size)

def spaced(d, cx, y, text, fnt, fill, ls):
    ws = [d.textlength(c, font=fnt) for c in text]
    total = sum(ws) + ls*(len(text)-1)
    x = cx - total/2
    for c, w in zip(text, ws):
        d.text((x, y), c, font=fnt, fill=fill, anchor="lm")
        x += w + ls

# canvas
img = Image.new("RGB", (S, S), GREEN)
dr = ImageDraw.Draw(img)
for y in range(S):
    t = y/S
    img.putpixel  # noop
    dr.line([(0,y),(S,y)], fill=(int(GREEN[0]+(GREEN2[0]-GREEN[0])*t),
                                  int(GREEN[1]+(GREEN2[1]-GREEN[1])*t),
                                  int(GREEN[2]+(GREEN2[2]-GREEN[2])*t)))

# --- hero product photo, cover-crop to top region ---
PH = 600
photo = Image.open(os.path.join(ROOT, "Photos/IMG_0334~3.jpeg")).convert("RGB")
scale = max(S/photo.width, PH/photo.height)
nw, nh = int(photo.width*scale), int(photo.height*scale)
photo = photo.resize((nw, nh), Image.LANCZOS)
left = (nw - S)//2
top = int((nh - PH)*0.32)
photo = photo.crop((left, top, left+S, top+PH))
# soft fade at bottom of photo into green
fade = Image.new("L", (S, PH), 0)
fd = ImageDraw.Draw(fade)
for y in range(PH):
    if y > PH-160:
        fd.line([(0,y),(S,y)], fill=int(255*(y-(PH-160))/160))
green_panel = Image.new("RGB", (S, PH), GREEN)
photo = Image.composite(green_panel, photo, fade)
img.paste(photo, (0, 0))

dr = ImageDraw.Draw(img, "RGBA")

# --- gold hairline frame ---
m = 34
dr.rectangle([m, m, S-m, S-m], outline=(200,162,76,180), width=2)
dr.rectangle([m+8, m+8, S-m-8, S-m-8], outline=(200,162,76,70), width=1)

# --- logo medallion on the seam ---
R = 96
cy = PH
# ring
dr.ellipse([S//2-R-8, cy-R-8, S//2+R+8, cy+R+8], fill=(18,46,40,255), outline=(200,162,76,255), width=3)
dr.ellipse([S//2-R, cy-R, S//2+R, cy+R], fill=(18,46,40,255))
# cream logo inside
logo = Image.open(os.path.join(ROOT, "logo for cup 2.png")).convert("L")
alpha = ImageOps.invert(logo)
cl = Image.new("RGBA", logo.size, CREAM+(0,)); cl.putalpha(alpha)
cl = cl.crop(alpha.getbbox())
lw = 150; lh = int(cl.height*lw/cl.width)
cl = cl.resize((lw, lh), Image.LANCZOS)
img.paste(cl, (S//2-lw//2, cy-lh//2), cl)
dr = ImageDraw.Draw(img, "RGBA")

# --- text block ---
spaced(dr, S//2, cy+128, "NEW ON SWIGGY & ZOMATO", F("sans", 25), (228,205,147,255), 8)

hl = F("serif", 132)
dr.text((S//2, cy+218), "50% OFF", font=hl, fill=(228,205,147,255), anchor="mm")

spaced(dr, S//2, cy+300, "ON YOUR FIRST ORDER", F("serifr", 32), (244,236,217,255), 6)

# gold rule
dr.line([(S//2-230, cy+342),(S//2+230, cy+342)], fill=(200,162,76,200), width=2)
dr.ellipse([S//2-4, cy+338, S//2+4, cy+346], fill=(200,162,76,255))

spaced(dr, S//2, cy+380, "SWIGGY 50%     ZOMATO 40%     NEW CUSTOMERS",
       F("sans", 21), (244,236,217,220), 3)

dr.text((S//2, cy+422), "Already a regular?  Enjoy up to 20% off, always.",
        font=F("serifr", 24), fill=(228,205,147,235), anchor="mm")

img.save(os.path.join(ROOT, "BNB_Offers_Instagram_v2.png"), quality=95)
print("saved v2", img.size)
