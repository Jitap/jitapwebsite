"""Change only the Withdraw CTA on the existing JiTap Wallet poster."""
from pathlib import Path
import re,sys
import cv2,numpy as np,pytesseract
from PIL import Image,ImageDraw,ImageFont
from pytesseract import Output
path=Path("public/images/JiTap Wallet Launching Soon.png")
im=Image.open(path).convert("RGB")
arr=np.asarray(im)
found=[]
for psm in (11,6,3,12):
    d=pytesseract.image_to_data(im,output_type=Output.DICT,config=f"--psm {psm}")
    for i,t in enumerate(d["text"]):
        if re.search(r"withd(?:raw|rawal)?",t,re.I):
            found.append((d["left"][i],d["top"][i],d["width"][i],d["height"][i],t))
print("Withdraw candidates:",found,flush=True)
if not found: sys.exit("SAFE ABORT: Withdraw text was not detected in artwork. Original PNG remains unchanged.")
# Select largest readable matching text box. Do not replace any other content.
x,y,w,h,t=max(found,key=lambda b:b[2]*b[3])
pad=max(4,round(h*.17))
mask=np.zeros(arr.shape[:2],np.uint8)
cv2.rectangle(mask,(max(0,x-pad),max(0,y-pad)),(min(im.width-1,x+w+pad),min(im.height-1,y+h+pad)),255,-1)
clean=cv2.inpaint(arr,mask,5,cv2.INPAINT_TELEA)
out=Image.fromarray(clean)
draw=ImageDraw.Draw(out)
background=np.median(clean[max(0,y-10):min(im.height,y+h+10),max(0,x-10):min(im.width,x+w+10)].reshape(-1,3),axis=0)
color=(255,255,255) if np.mean(background)<150 else (22,45,56)
new="Use Credits"
font_path="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
font_size=max(14,round(h*.98))
font=ImageFont.truetype(font_path,font_size)
# Preserve same visual footprint by resizing typography to original button text bounds.
max_width=max(w+30,round(w*1.35))
while draw.textbbox((0,0),new,font=font)[2]>max_width and font_size>11:
    font_size-=1;font=ImageFont.truetype(font_path,font_size)
text_width=draw.textbbox((0,0),new,font=font)[2]
draw.text((x+(w-text_width)//2,y-3),new,font=font,fill=color)
out.save(path,optimize=True)
print(f"Updated Withdraw to Use Credits at {(x,y,w,h)}",flush=True)
