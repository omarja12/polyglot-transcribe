from PIL import Image, ImageDraw, ImageFont
import os

OUT = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'public')
if not os.path.exists(OUT):
    os.makedirs(OUT)

sizes = [16, 32, 180, 512]
colors = {
    'bg': (14, 165, 164, 255),  # teal
    'accent': (37, 99, 235, 255),
    'white': (255,255,255,255)
}

for size in sizes:
    img = Image.new('RGBA', (size, size), colors['bg'])
    draw = ImageDraw.Draw(img)
    # draw a simple circular mark
    r = int(size * 0.36)
    cx = cy = size // 2
    bbox = [cx - r, cy - r, cx + r, cy + r]
    draw.ellipse(bbox, fill=colors['accent'])
    # draw monogram text
    # pick font size relative to image
    fs = max(10, int(size * 0.5))
    try:
        font = ImageFont.truetype('arial.ttf', fs)
    except Exception:
        font = ImageFont.load_default()
    text = 'PT' if size >= 64 else 'P'
    try:
        bbox = draw.textbbox((0,0), text, font=font)
        w = bbox[2] - bbox[0]
        h = bbox[3] - bbox[1]
    except Exception:
        w, h = draw.textsize(text, font=font) if hasattr(draw, 'textsize') else (fs, fs)
    draw.text(((size - w) / 2, (size - h) / 2), text, font=font, fill=colors['white'])
    out_path = os.path.join(OUT, f'favicon-{size}.png')
    img.save(out_path)
    print('Wrote', out_path)

# also generate an app-icon (512x512) with full wordmark mockup
size = 512
img = Image.new('RGBA', (size, size), (255,255,255,0))
draw = ImageDraw.Draw(img)
# background circle
draw.ellipse([32,32,size-32,size-32], fill=colors['accent'])
# wordmark rectangle
fw = int(size * 0.55)
fh = int(size * 0.18)
fx = (size - fw) // 2
fy = int(size * 0.62)
try:
    font_large = ImageFont.truetype('arial.ttf', int(size * 0.09))
except Exception:
    font_large = ImageFont.load_default()
draw.text((size*0.22, size*0.4), 'Polyglot', font=font_large, fill=colors['white'])
app_out = os.path.join(OUT, 'app-icon-512.png')
img.save(app_out)
print('Wrote', app_out)
