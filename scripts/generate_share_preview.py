from PIL import Image, ImageDraw, ImageFont
import os

OUT = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'public')
if not os.path.exists(OUT):
    os.makedirs(OUT)

W, H = 1200, 630
bg1 = (14,165,164)
bg2 = (37,99,235)
img = Image.new('RGB', (W, H), color=0)
# simple vertical gradient
for y in range(H):
    t = y / (H-1)
    r = int(bg1[0]*(1-t) + bg2[0]*t)
    g = int(bg1[1]*(1-t) + bg2[1]*t)
    b = int(bg1[2]*(1-t) + bg2[2]*t)
    for x in range(W):
        img.putpixel((x,y), (r,g,b))

draw = ImageDraw.Draw(img)
# big title
try:
    font_title = ImageFont.truetype('arial.ttf', 64)
    font_sub = ImageFont.truetype('arial.ttf', 28)
except Exception:
    font_title = ImageFont.load_default()
    font_sub = ImageFont.load_default()

text = "Polyglot Transcribe"
sub = "Near real-time transcription and AI-generated reports"

try:
    bbox = draw.textbbox((0,0), text, font=font_title)
    w = bbox[2] - bbox[0]
    h = bbox[3] - bbox[1]
except Exception:
    try:
        w, h = draw.textsize(text, font=font_title)
    except Exception:
        w, h = (600, 80)

draw.text(((W-w)/2, int(H*0.28)), text, font=font_title, fill=(255,255,255))

try:
    bbox2 = draw.textbbox((0,0), sub, font=font_sub)
    w2 = bbox2[2] - bbox2[0]
    h2 = bbox2[3] - bbox2[1]
except Exception:
    try:
        w2, h2 = draw.textsize(sub, font=font_sub)
    except Exception:
        w2, h2 = (500, 28)

draw.text(((W-w2)/2, int(H*0.28 + 90)), sub, font=font_sub, fill=(230,240,250))

# small monogram in bottom-left
mono = Image.open(os.path.join(OUT, 'logo-monogram.svg')) if os.path.exists(os.path.join(OUT, 'logo-monogram.svg')) else None
if mono is None:
    # draw circle
    draw.ellipse((60, H-120, 140, H-40), fill=(255,255,255,200))
    draw.text((90, H-95), 'PT', fill=(14,165,164))

out_path = os.path.join(OUT, 'share-preview.png')
img.save(out_path)
print('Wrote', out_path)
