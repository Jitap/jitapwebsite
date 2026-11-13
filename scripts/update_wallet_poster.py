"""Edit text on the existing JiTap Wallet PNG without redesigning its artwork.
Fails without saving if any expected source text is not located.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import pytesseract
from pytesseract import Output
import cv2
import numpy as np
import re
import sys

PATH=Path("public/images/JiTap Wallet Launching Soon.png")
original=Image.open(PATH).convert("RGB")
pixels=np.array(original)
data=pytesseract.image_to_data(original,output_type=Output.DICT,config="--psm 11")
lines={}
for i,text in enumerate(data["text"]):
    text=text.strip()
    if not text: continue
    key=(data["block_num"][i],data["par_num"][i],data["line_num"][i])
    lines.setdefault(key,[]).append((text, data["left"][i],data["top"][i],data["width"][i],data["height"][i]))
entries=[]
for words in lines.values():
    words.sort(key=lambda x:x[1])
    txt=" ".join(w[0] for w in words)
    l=min(w[1] for w in words);t=min(w[2] for w in words)
    r=max(w[1]+w[3] for w in words);b=max(w[2]+w[4] for w in words)
    entries.append((txt,(l,t,r,b),words))
for txt,box,_ in entries: print("OCR:",repr(txt),box,flush=True)
def find_line(pattern):
    for txt,box,words in entries:
        if re.search(pattern,txt,re.I):
            return txt,box,words
    return None
targets=[
    (r"12\s*[, .]\s*000|12000","KES 1,500"),
    (r"pending\s+payments?","Free Credit"),
    (r"pending\s+withdrawal","Balance"),
]
hits=[]
for pattern,new in targets:
    found=find_line(pattern)
    if not found: sys.exit(f"SAFE ABORT: missing original label matching {pattern}")
    hits.append((found,new))
# Replace amount values in all occurrences of the three relevant areas.
for txt,box,words in entries:
    if re.search(r"12\s*[, .]\s*000|12000",txt,re.I) and all(box!=h[0][1] for h in hits):
        hits.append(((txt,box,words),"KES 1,500"))
# Track the two summary card amounts (they may have other old values).
# Source image is a coming-soon poster: only replace text validated above.
mask=np.zeros(pixels.shape[:2],dtype=np.uint8)
for (txt,(l,t,r,b),words),new in hits:
    pad=7
    cv2.rectangle(mask,(max(0,l-pad),max(0,t-pad)),(min(pixels.shape[1]-1,r+pad),min(pixels.shape[0]-1,b+pad)),255,-1)
clean=cv2.inpaint(pixels,mask,7,cv2.INPAINT_TELEA)
result=Image.fromarray(clean)
draw=ImageDraw.Draw(result)
font_path="/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
bold_path="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
for (txt,(l,t,r,b),words),new in hits:
    sample=pixels[max(0,t):min(pixels.shape[0],b),max(0,l):min(pixels.shape[1],r)]
    gray=cv2.cvtColor(sample,cv2.COLOR_RGB2GRAY)
    # Find foreground color based on contrast to surrounding background.
    bg=np.median(clean[max(0,t-5):min(pixels.shape[0],b+5),max(0,l-5):min(pixels.shape[1],r+5)].reshape(-1,3),axis=0)
    lum=np.mean(bg)
    fg=(255,255,255) if lum<120 else (28,48,66)
    height=b-t
    font_size=max(13,round(height*1.02))
    font=ImageFont.truetype(bold_path if "KES" in new else font_path,font_size)
    while draw.textbbox((0,0),new,font=font)[2] > max(r-l+30, 190) and font_size>12:
        font_size-=1;font=ImageFont.truetype(bold_path if "KES" in new else font_path,font_size)
    draw.text((l,t-3),new,font=font,fill=fg,stroke_width=0)
result.save(PATH,optimize=True)
print("UPDATED",PATH,"with",len(hits),"text replacements")
