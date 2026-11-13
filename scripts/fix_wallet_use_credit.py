"""Replace only the button text inside the ORIGINAL JiTap wallet PNG."""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import numpy as np
import cv2
import sys

path=Path("public/images/JiTap Wallet Launching Soon.png")
image=Image.open(path).convert("RGB")
arr=np.asarray(image).copy()
h,w=arr.shape[:2]
hsv=cv2.cvtColor(arr,cv2.COLOR_RGB2HSV)
# Find the bright JiTap-green horizontal CTA, beneath the KES 1,500 balance.
green=cv2.inRange(hsv,np.array([35,115,105]),np.array([95,255,255]))
n,labels,stats,centers=cv2.connectedComponentsWithStats(green,8)
candidates=[]
for x,y,cw,ch,area in stats[1:]:
    if 0.12*w<cw<0.95*w and 0.025*h<ch<0.14*h and 0.37*h<y<0.70*h and area>cw*ch*0.35:
        candidates.append((x,y,cw,ch,area))
print("CTA candidates:",candidates,flush=True)
if len(candidates)!=1:
    sys.exit("SAFE ABORT: could not uniquely locate original green Withdraw button; source unchanged")
x,y,bw,bh,_=candidates[0]
# Restore ONLY the middle lettering region using a smooth interpolation of the same
# button green from immediately above and below the white letters. Preserve rounded edges.
x0=x+int(bw*.17);x1=x+int(bw*.83)
y0=y+int(bh*.25);y1=y+int(bh*.76)
top=arr[y+int(bh*.12):y+int(bh*.18),x0:x1,:].astype(float).mean(axis=0)
bottom=arr[y+int(bh*.85):y+int(bh*.91),x0:x1,:].astype(float).mean(axis=0)
for iy,yy in enumerate(range(y0,y1)):
    mix=(yy-y0)/max(1,y1-y0-1)
    arr[yy,x0:x1,:]=((1-mix)*top+mix*bottom).astype(np.uint8)
out=Image.fromarray(arr)
draw=ImageDraw.Draw(out)
fontfile="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
label="Use Credit"
fontsize=int(bh*.43)
font=ImageFont.truetype(fontfile,fontsize)
while draw.textbbox((0,0),label,font=font)[2]>bw*.72 and fontsize>12:
    fontsize-=1
    font=ImageFont.truetype(fontfile,fontsize)
bounds=draw.textbbox((0,0),label,font=font)
tw,th=bounds[2]-bounds[0],bounds[3]-bounds[1]
tx=x+(bw-tw)//2-bounds[0]
ty=y+(bh-th)//2-bounds[1]
draw.text((tx,ty),label,font=font,fill=(255,255,255))
out.save(path,optimize=True)
print(f"SUCCESS: Original wallet poster CTA updated to '{label}' at {(x,y,bw,bh)}",flush=True)
