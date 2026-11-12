from PIL import Image, ImageEnhance
import sys
foot=2215
def get(f,sc,dark):
  im=Image.open(f).convert('RGBA')
  if dark<1:
    r,g,b,a=im.split();rgb=ImageEnhance.Brightness(Image.merge('RGB',(r,g,b))).enhance(dark);im=Image.merge('RGBA',(*rgb.split(),a))
  return im.resize((int(im.width*sc),int(im.height*sc)),Image.LANCZOS),sc
C=Image.new('RGBA',(4200,2400),(0,0,0,0))
lay=[('f1.png',.8,.7,0),('f2.png',.9,.84,400),('f3.png',1.0,1.0,820)]
for f,sc,dk,x in lay:
  im,s=get(f,sc,dk);y=int(2300-foot*s);C.alpha_composite(im,(x,y))
C=C.crop(C.getbbox());print(C.size)
H=900;C=C.resize((round(C.width*H/C.height),H),Image.LANCZOS);C.save('lineup.webp',quality=86,method=6);C.save('lineup.png',optimize=True);print(C.size)
bg=Image.new('RGBA',C.size,(30,36,26,255));bg.alpha_composite(C);bg.save('lineup-view.png')
