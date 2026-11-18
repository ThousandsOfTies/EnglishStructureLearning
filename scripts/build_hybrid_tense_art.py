"""Compose raster artwork with editable SVG geometry; also export a PNG preview.

The PNG preview samples the very same cubic curves used by the SVG paths.
Raster character assets originate in imagegen, not programmatic illustration.
"""
from pathlib import Path
from io import BytesIO
import base64
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/tense'
W, H, SCALE = 1600, 1060, 2
INK = '#482a20'
parts = []
canvas = Image.new('RGBA', (W*SCALE, H*SCALE), 'white')
draw = ImageDraw.Draw(canvas)
sheet = Image.open(OUT/'hybrid-assets.png').convert('RGBA')


def image(name, box, target):
    asset = sheet.crop(box)
    asset.save(OUT/(name+'.png'))
    x,y,w,h = target
    factor = min(w/asset.width, h/asset.height)
    width,height = round(asset.width*factor),round(asset.height*factor)
    x,y = x+(w-width)/2,y+(h-height)/2
    buf = BytesIO()
    asset.save(buf, format='PNG')
    data = base64.b64encode(buf.getvalue()).decode('ascii')
    parts.append(f'<image id="{name}-{len(parts)}" href="data:image/png;base64,{data}" x="{x}" y="{y}" width="{width}" height="{height}"/>')
    canvas.alpha_composite(asset.resize((width*SCALE,height*SCALE),Image.Resampling.LANCZOS),(round(x*SCALE),round(y*SCALE)))


def path(name, commands, fill='white', stroke=INK, width=4):
    data = ' '.join(command+' '+ ' '.join(map(str,values)) for command,values in commands)
    parts.append(f'<path id="{name}" d="{data}" fill="{fill}" stroke="{stroke}" stroke-width="{width}" stroke-linejoin="round" stroke-linecap="round"/>')
    points=[]
    current=(0,0)
    for command,values in commands:
        if command in {'M','L'}:
            current=tuple(values)
            points.append(current)
        elif command=='C':
            p0=current
            p1,p2,p3=tuple(values[:2]),tuple(values[2:4]),tuple(values[4:])
            for n in range(1,61):
                t=n/60
                points.append(tuple((1-t)**3*p0[j]+3*(1-t)**2*t*p1[j]+3*(1-t)*t*t*p2[j]+t**3*p3[j] for j in (0,1)))
            current=p3
        elif command=='Z':
            points.append(points[0])
    points=[(round(x*SCALE),round(y*SCALE)) for x,y in points]
    if fill!='none':draw.polygon(points,fill=fill)
    if stroke!='none':draw.line(points,fill=stroke,width=width*SCALE,joint='curve')


def axis(name,x1,y,x2):
    path(name,[('M',[x1,y]),('L',[x2-16,y])],fill='none',width=5)
    path(name+'-head',[('M',[x2,y]),('L',[x2-20,y-10]),('L',[x2-20,y+10]),('Z',[])],fill=INK,stroke='none')


for x,y in [(20,20),(820,20),(20,540),(820,540)]:
    parts.append(f'<rect x="{x}" y="{y}" width="760" height="500" rx="22" fill="white" stroke="{INK}" stroke-width="3"/>')
    draw.rounded_rectangle((x*SCALE,y*SCALE,(x+760)*SCALE,(y+500)*SCALE),radius=22*SCALE,fill='white',outline=INK,width=3*SCALE)

speaker=(230,15,510,505)
cleaning=(850,20,1370,495)
looking=(240,520,500,1010)
room=(768,600,1515,975)

# Simple present: an action concept to the narrator's right, no time axis.
image('speaker',speaker,(45,145,220,340))
path('present-bubble',[
    ('M',[300,215]),('C',[310,35,735,25,740,240]),
    ('C',[755,440,315,475,300,300]),('L',[245,265]),('L',[298,245]),('Z',[])])
image('cleaning',cleaning,(355,115,315,265))

# Past: speaker looks back toward the action on the left.
path('past-bubble',[
    ('M',[860,210]),('C',[865,25,1225,20,1240,210]),
    ('L',[1280,245]),('L',[1236,263]),
    ('C',[1200,440,860,425,860,210]),('Z',[])])
image('cleaning',cleaning,(890,100,305,260))
image('looking-back',looking,(1280,100,220,340))
axis('past-time-axis',855,475,1530)

# Progressive: one closed outline with an actual inward pointing notch.
path('progressive-inward-bubble',[
    ('M',[100,710]),('C',[140,505,705,510,730,755]),
    ('C',[775,1040,145,1050,80,805]),
    ('L',[345,750]),('L',[100,710]),('Z',[])])
image('cleaning',cleaning,(345,635,345,325))

# Present perfect result: current room dominates; past action is inset.
image('tidy-room',room,(1015,640,510,300))
image('speaker',speaker,(1315,650,150,270))
path('perfect-past-bubble',[
    ('M',[915,595]),('C',[1040,590,1060,805,943,825]),
    ('L',[925,825]),('L',[915,1000]),('L',[902,825]),
    ('C',[785,805,790,600,915,595]),('Z',[])])
image('cleaning',cleaning,(825,640,180,145))
axis('perfect-time-axis',855,1000,1530)

svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1060" viewBox="0 0 1600 1060">\n'
svg += '<title>Wordless tense scenes with raster characters and editable vector speech bubbles</title>\n'
svg += '<rect width="1600" height="1060" fill="white"/>\n' + '\n'.join(parts) + '\n</svg>\n'
(OUT/'tense-hybrid.svg').write_text(svg,encoding='utf-8')
canvas.convert('RGB').resize((W,H),Image.Resampling.LANCZOS).save(OUT/'tense-hybrid.png')
print('Created assets/tense/tense-hybrid.svg and tense-hybrid.png')
