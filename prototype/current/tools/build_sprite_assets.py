#!/usr/bin/env python3
from __future__ import annotations
from PIL import Image, ImageDraw, ImageFilter
from pathlib import Path
import json, math

ROOT = Path(__file__).resolve().parents[1] / 'public' / 'assets'
ANIM = ROOT / 'animation'
ITEMS = ROOT / 'items'
ANIM.mkdir(parents=True, exist_ok=True)
ITEMS.mkdir(parents=True, exist_ok=True)

CELL = 192
SS = 3
DIRS = ['c','n','ne','e','se','s','sw','w','nw']
ANGLES = {'c': math.pi/2, 'e':0, 'se':math.pi/4, 's':math.pi/2, 'sw':3*math.pi/4,
          'w':math.pi, 'nw':5*math.pi/4, 'n':3*math.pi/2, 'ne':7*math.pi/4}
CYAN=(57,245,235,255); CYAN2=(126,255,247,255)
ROBE=(8,54,69,255); EDGE=(33,214,204,255)
STAFF=(139,91,55,255); STAFF_HI=(226,167,91,255)

def S(v): return int(round(v*SS))
def pt(x,y): return (S(x),S(y))
def line(d, xy, fill, width):
    d.line([(S(x),S(y)) for x,y in xy], fill=fill, width=S(width), joint='curve')
def poly(d, xy, fill, outline=None, width=1):
    pts=[pt(x,y) for x,y in xy]; d.polygon(pts, fill=fill)
    if outline: d.line(pts+[pts[0]], fill=outline, width=S(width), joint='curve')
def ellipse(d, box, fill, outline=None, width=1):
    d.ellipse(tuple(S(v) for v in box), fill=fill, outline=outline, width=S(width) if outline else 1)
def glow(base, center, radius, color, strength=180):
    layer=Image.new('RGBA', base.size, (0,0,0,0)); d=ImageDraw.Draw(layer)
    cx,cy=center
    for k in range(4,0,-1):
        r=S(radius*(0.55+0.22*k)); a=int(strength*(0.11*k))
        d.ellipse((S(cx)-r,S(cy)-r,S(cx)+r,S(cy)+r), fill=(color[0],color[1],color[2],a))
    base.alpha_composite(layer.filter(ImageFilter.GaussianBlur(S(radius*0.22))))

def draw_hero(direction, frame, frames, mode):
    im=Image.new('RGBA',(CELL*SS,CELL*SS),(0,0,0,0)); d=ImageDraw.Draw(im)
    a=ANGLES[direction]; vx,vy=math.cos(a),math.sin(a); rx,ry=-vy,vx
    t=0 if frames<=1 else frame/(frames-1)
    if mode=='idle': bob=1.5*math.sin(frame/frames*math.tau); lean=0; step=0
    elif mode=='run':
        phase=frame/frames*math.tau; bob=2.8*abs(math.sin(phase)); lean=4.0; step=math.sin(phase)
    else: bob=-math.sin(t*math.pi); lean=1.0; step=0
    cx=96+vx*lean; footy=169-bob; torso_y=123-bob
    ellipse(d,(cx-30,footy-4,cx+30,footy+7),(0,0,0,72))
    if mode=='run' and abs(step)>0.15:
        backx=cx-vx*26; backy=footy-vy*8
        ellipse(d,(backx-8,backy-3,backx+3,backy+2),(150,190,201,90))
    staff_base=(cx+rx*27-vx*5,footy-6+ry*13-vy*3)
    if mode=='cast':
        reach=15+22*math.sin(t*math.pi)
        staff_top=(cx+rx*28+vx*reach,torso_y-46+ry*10+vy*reach*0.35)
    else:
        staff_top=(cx+rx*25+vx*3,torso_y-52+ry*8+vy*3)
    back=direction in {'n','ne','nw'}
    if back:
        line(d,[staff_base,staff_top],STAFF,5); line(d,[staff_base,staff_top],STAFF_HI,1.4)
        glow(im,staff_top,9,CYAN,90); ellipse(d,(staff_top[0]-7,staff_top[1]-7,staff_top[0]+7,staff_top[1]+7),(11,53,64,255),CYAN2,2)
    top=(cx-vx*2,torso_y-4); left=(cx-25+rx*3-vx*2,footy-4+ry*2); right=(cx+25+rx*3-vx*2,footy-4+ry*2)
    poly(d,[top,left,(cx-15+rx*step*5,footy+1),(cx+15-rx*step*5,footy+1),right],ROBE,EDGE,2)
    front=direction not in {'n','ne','nw'}
    if front:
        poly(d,[(cx+vx*8,torso_y+2+vy*5),(cx-11+vx*8,footy-10+vy),(cx+11+vx*8,footy-10+vy)],(6,42,58,255),(18,124,132,210),1)
    sh_y=torso_y-20; shx=cx-vx*2
    for sign in (-1,1):
        sx=shx+rx*18*sign; sy=sh_y+ry*11*sign
        ellipse(d,(sx-10,sy-8,sx+10,sy+8),(23,55,74,255),(72,125,143,255),2)
    corex=cx+vx*3; corey=torso_y-5+vy*2
    glow(im,(corex,corey),10,CYAN,100); ellipse(d,(corex-8,corey-8,corex+8,corey+8),(245,255,247,255),CYAN,2)
    ellipse(d,(corex-4.3,corey-4.3,corex+4.3,corey+4.3),(88,232,151,255))
    hx=cx+vx*4; hy=torso_y-49+vy*3
    ellipse(d,(hx-20,hy-20,hx+20,hy+20),(7,17,27,255),(25,107,120,255),3)
    if front: line(d,[(hx-(12 if direction in {'s','c'} else 9),hy+2),(hx+(12 if direction in {'s','c'} else 9),hy+2)],CYAN,3)
    else: line(d,[(hx-9,hy-10),(hx+9,hy-10)],(38,158,167,220),2)
    if not back:
        line(d,[staff_base,staff_top],STAFF,5); line(d,[staff_base,staff_top],STAFF_HI,1.4)
        glow(im,staff_top,9 if mode!='cast' else 11+8*math.sin(t*math.pi),CYAN,110)
        ellipse(d,(staff_top[0]-7,staff_top[1]-7,staff_top[0]+7,staff_top[1]+7),(11,53,64,255),CYAN2,2)
    if mode=='cast':
        rr=34+12*math.sin(t*math.pi); px=cx+vx*38; py=torso_y-22+vy*22
        glow(im,(px,py),rr*0.55,CYAN,70)
        for da in (-0.6,0,0.6):
            aa=a+da; line(d,[(px,py),(px+math.cos(aa)*rr,py+math.sin(aa)*rr*0.6)],(80,255,240,120),1.6)
    return im.resize((CELL,CELL),Image.Resampling.LANCZOS)

def make_sheet(mode, frames):
    sheet=Image.new('RGBA',(CELL*frames,CELL*len(DIRS)),(0,0,0,0))
    for r,dn in enumerate(DIRS):
        for f in range(frames): sheet.alpha_composite(draw_hero(dn,f,frames,mode),(f*CELL,r*CELL))
    sheet.save(ANIM/f'hero_v2_{mode}.png')

def draw_cleaver(direction, frame):
    im=Image.new('RGBA',(CELL*SS,CELL*SS),(0,0,0,0)); d=ImageDraw.Draw(im)
    a=ANGLES[direction]; phases=[-1.30,-0.95,-0.45,0.15,0.68,0.92]; ang=a+phases[frame]
    cx,cy=96,146; active=frame in (2,3,4); trail=(82,245,231,145 if active else 72)
    for j in range(5):
        q=ang-(0.38+0.10*j); rr=60+j*2
        line(d,[(cx+math.cos(q)*rr,cy+math.sin(q)*rr*0.58),(cx+math.cos(q+0.28)*rr,cy+math.sin(q+0.28)*rr*0.58)],trail,5-j*0.6)
    hx=cx+math.cos(ang)*61; hy=cy+math.sin(ang)*36; bx=cx-math.cos(ang)*20; by=cy-math.sin(ang)*12
    line(d,[(bx,by),(hx,hy)],(126,78,46,255),6); line(d,[(bx,by),(hx,hy)],(225,156,86,255),1.5)
    px,py=-math.sin(ang),math.cos(ang)
    blade=[(hx+px*4,hy+py*3),(hx+px*19-math.cos(ang)*4,hy+py*12-math.sin(ang)*3),
           (hx+px*27+math.cos(ang)*8,hy+py*9+math.sin(ang)*5),(hx+px*20+math.cos(ang)*15,hy+py*2+math.sin(ang)*8),
           (hx+px*4+math.cos(ang)*6,hy+py+math.sin(ang)*3)]
    poly(d,blade,(195,218,229,255),CYAN if active else (108,157,174,255),2)
    if active: glow(im,(hx,hy),18,CYAN,100)
    return im.resize((CELL,CELL),Image.Resampling.LANCZOS)

def make_cleaver():
    sheet=Image.new('RGBA',(CELL*6,CELL*len(DIRS)),(0,0,0,0))
    for r,dn in enumerate(DIRS):
        for f in range(6): sheet.alpha_composite(draw_cleaver(dn,f),(f*CELL,r*CELL))
    sheet.save(ANIM/'cleaver_v2.png')

CATS={
 'guard':((50,172,222,255),(14,42,63,255)),
 'edge':((244,112,83,255),(66,28,24,255)),
 'pace':((93,222,176,255),(20,55,47,255)),
 'finding':((179,129,239,255),(47,31,65,255)),
 'elite':((244,197,82,255),(67,51,20,255))}
ORDER=[
 ('plating','guard'),('vitality','guard'),('aegis_core','guard'),('ablation','guard'),
 ('keen_edge','edge'),('hollow_point','edge'),('siphon','edge'),('bane','edge'),
 ('light_step','pace'),('quickened','pace'),('short_cord','pace'),('afterimage','pace'),
 ('lodestone','finding'),('keen_eye','finding'),('scavenger','finding'),('beacon','finding'),
 ('spoils','elite'),('unravel','elite'),('tribute','elite'),('reprisal','elite')]

def item_tile(iid,cat,index):
    C=128; sc=2; im=Image.new('RGBA',(C*sc,C*sc),(0,0,0,0)); d=ImageDraw.Draw(im); q=lambda v:int(v*sc)
    accent,bg=CATS[cat]
    d.rounded_rectangle((q(10),q(10),q(118),q(118)),radius=q(24),fill=bg,outline=accent,width=q(4))
    d.rounded_rectangle((q(18),q(18),q(110),q(110)),radius=q(18),outline=(accent[0],accent[1],accent[2],90),width=q(2))
    # Compact unique silhouettes. Category colour is secondary; geometry carries identity.
    shapes=[
      [(36,46),(64,34),(92,46),(86,84),(64,99),(42,84)],
      [(64,98),(35,64),(39,43),(54,38),(64,51),(74,38),(89,43),(93,64)],
      [(64,31),(91,46),(89,76),(64,99),(39,76),(37,46)],
      [(37,42),(81,48),(76,89),(31,82)],
      [(38,92),(79,34),(91,28),(83,48),(48,99)],
      [(54,31),(74,31),(84,78),(64,99),(44,78)],
      [(34,48),(59,48),(76,64),(76,84),(61,98)],
      [(64,28),(75,48),(98,51),(81,66),(86,91),(64,79),(42,91),(47,66),(30,51),(53,48)],
      [(36,77),(55,77),(68,45),(79,54),(70,77),(93,77),(85,94),(48,97)],
      [(64,31),(87,43),(96,64),(87,85),(64,97),(41,85),(32,64),(41,43)],
      [(64,29),(64,48),(82,62),(82,88),(64,101),(46,88),(46,62)],
      [(50,88),(57,50),(64,38),(71,50),(78,88)],
      [(42,39),(42,73),(51,90),(64,97),(77,90),(86,73),(86,39)],
      [(28,64),(45,46),(64,39),(83,46),(100,64),(83,82),(64,89),(45,82)],
      [(36,49),(92,49),(92,94),(36,94)],
      [(54,92),(61,45),(67,45),(74,92)],
      [(36,50),(92,50),(92,94),(36,94),(44,35),(84,35)],
      [(38,63),(50,45),(64,63),(78,45),(90,63),(78,81),(64,63),(50,81)],
      [(64,34),(91,64),(64,94),(37,64)],
      [(42,91),(86,39),(81,33),(96,35),(89,49),(47,33),(32,35),(39,49),(86,91)]]
    pts=shapes[index]
    pts=[(q(x),q(y)) for x,y in pts]
    d.polygon(pts,fill=(accent[0],accent[1],accent[2],210))
    d.line(pts+[pts[0]],fill=(240,250,250,210),width=q(2),joint='curve')
    return im.resize((C,C),Image.Resampling.LANCZOS)

def make_items():
    C=128; sheet=Image.new('RGBA',(5*C,4*C),(0,0,0,0)); mapping={}
    for i,(iid,cat) in enumerate(ORDER):
        x=(i%5)*C; y=(i//5)*C; sheet.alpha_composite(item_tile(iid,cat,i),(x,y))
        mapping[iid]={'index':i,'col':i%5,'row':i//5,'category':cat}
    sheet.save(ITEMS/'item_icons_v2.png')
    (ITEMS/'item_icons_v2.json').write_text(json.dumps({'cell':C,'cols':5,'rows':4,'items':mapping},indent=2),encoding='utf-8')

make_sheet('idle',4); make_sheet('run',8); make_sheet('cast',6); make_cleaver(); make_items()
(ANIM/'hero_v2_manifest.json').write_text(json.dumps({
 'version':2,'cellWidth':CELL,'cellHeight':CELL,'rows':DIRS,'pivot':[96,169],
 'clips':{
  'idle':{'image':'/assets/animation/hero_v2_idle.png','frames':4,'fps':5,'loop':True},
  'run':{'image':'/assets/animation/hero_v2_run.png','frames':8,'fps':12,'loop':True},
  'cast':{'image':'/assets/animation/hero_v2_cast.png','frames':6,'fps':16,'loop':False}},
 'notes':'C is neutral fallback only; real facing uses eight directional rows.'
},ensure_ascii=False,indent=2),encoding='utf-8')
(ANIM/'cleaver_v2_manifest.json').write_text(json.dumps({
 'version':2,'cellWidth':CELL,'cellHeight':CELL,'rows':DIRS,'pivot':[96,146],
 'clip':{'image':'/assets/animation/cleaver_v2.png','frames':6,'fps':18,'loop':False,'activeFrames':[2,3,4]},
 'notes':'Physical axe silhouette + motion arc; hit geometry stays simulation-authoritative.'
},ensure_ascii=False,indent=2),encoding='utf-8')
print('generated animation/item v2 assets')
