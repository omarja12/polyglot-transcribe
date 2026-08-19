from PIL import Image, ImageDraw, ImageFont
import os
OUT = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'public')
if not os.path.exists(OUT): os.makedirs(OUT)
W,H = 1200,630
img = Image.new('RGB',(W,H),(14,165,164))
draw = ImageDraw.Draw(img)
# gradient overlay
for y in range(H):
    t = y/(H-1)
    r = int(14*(1-t) + 37*t)
    g = int(165*(1-t) + 99*t)
    b = int(164*(1-t) + 235*t)
    draw.line([(0,y),(W,y)], fill=(r,g,b))
try:
    font_title = ImageFont.truetype('arial.ttf', 64)
    font_sub = ImageFont.truetype('arial.ttf', 28)
except Exception:
    font_title = ImageFont.load_default()
    font_sub = ImageFont.load_default()
text = 'Polyglot Transcribe'
sub = 'Near real-time transcription and AI-generated reports in French, Arabic, and English.'
# center text
bbox = draw.textbbox((0,0), text, font=font_title)
w = bbox[2]-bbox[0]; h = bbox[3]-bbox[1]
draw.text(((W-w)/2, H*0.25), text, font=font_title, fill=(255,255,255))
# subtitle
bbox2 = draw.textbbox((0,0), sub, font=font_sub)
w2 = bbox2[2]-bbox2[0]
draw.text(((W-w2)/2, H*0.25 + h + 20), sub, font=font_sub, fill=(235,245,250))
# draw simple monogram box bottom-left
mx, my = 60, H-140
draw.rounded_rectangle([mx,my,mx+100,my+100], radius=20, fill=(255,255,255))
draw.text((mx+20,my+28), 'PT', font=font_sub, fill=(6,166,164))
out=os.path.join(OUT,'share-preview.png')
img.save(out)
print('Wrote', out)
