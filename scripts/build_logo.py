"""Builds GLAMS BY LEE logo artwork as outlined SVG paths (no font dependency) plus PNG exports.
Run: npm run brand:build   (needs: pip install fonttools cairosvg)"""
import os
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
import cairosvg

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = os.path.join(ROOT, 'node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-600-normal.woff')
OUT = os.path.join(ROOT, 'public/brand')
os.makedirs(OUT, exist_ok=True)

GOLD, SOFT, INK, IVORY = '#B9945A', '#D9B77C', '#171514', '#F6F0E8'
font = TTFont(FONT)
gs, cmap, upm = font.getGlyphSet(), font.getBestCmap(), font['head'].unitsPerEm

def text_path(text, size, tracking, x0=0, y0=0):
    """Return (svg path d, advance width). tracking is in em units."""
    scale = size / upm
    pen = SVGPathPen(gs)
    x = x0
    for ch in text:
        if ch == ' ':
            x += gs[cmap[ord(' ')]].width * scale + tracking * size
            continue
        g = cmap[ord(ch)]
        tp = TransformPen(pen, (scale, 0, 0, -scale, x, y0))
        gs[g].draw(tp)
        x += gs[g].width * scale + tracking * size
    return pen.getCommands(), x - x0 - tracking * size

def width_of(text, size, tracking):
    return text_path(text, size, tracking)[1]

def stacked(fill, rule=None):
    """GLAMS large, thin rule, BY LEE small, all centred. Returns (svg inner, w, h)."""
    big, small = 120, 30
    w_big = width_of('GLAMS', big, 0.16)
    w_small = width_of('BY LEE', small, 0.42)
    W = w_big + 40
    d1, _ = text_path('GLAMS', big, 0.16, (W - w_big) / 2, 110)
    d2, _ = text_path('BY LEE', small, 0.42, (W - w_small) / 2, 172)
    r = rule or fill
    rl = (W - w_small) / 2
    inner = (f'<path d="{d1}" fill="{fill}"/><path d="{d2}" fill="{fill}"/>'
             f'<rect x="{rl - 52}" y="161" width="38" height="1.5" fill="{r}"/>'
             f'<rect x="{W - rl + 14}" y="161" width="38" height="1.5" fill="{r}"/>')
    return inner, W, 190

def compact(fill):
    """Single-line header mark: GLAMS with small BY LEE after it."""
    big, small = 40, 13
    w1 = width_of('GLAMS', big, 0.16)
    d1, _ = text_path('GLAMS', big, 0.16, 0, 38)
    d2, w2 = text_path('BY LEE', small, 0.4, w1 + 12, 38)
    return f'<path d="{d1}" fill="{fill}"/><path d="{d2}" fill="{fill}"/>', w1 + 12 + w2, 50

def svg(inner, w, h, bg=None, pad=0, label='GLAMS BY LEE'):
    W, H = w + pad * 2, h + pad * 2
    rect = f'<rect width="{W}" height="{H}" fill="{bg}"/>' if bg else ''
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:.1f} {H:.1f}" role="img" aria-label="{label}">'
            f'<title>{label}</title>{rect}<g transform="translate({pad},{pad})">{inner}</g></svg>')

def write(name, content): open(os.path.join(OUT, name), 'w').write(content)
def png(name, svg_text, width): cairosvg.svg2png(bytestring=svg_text.encode(), write_to=os.path.join(OUT, name), output_width=width)

# Primary: gold on black
i, w, h = stacked(GOLD); primary = svg(i, w, h, bg=INK, pad=60); write('logo-primary-gold-on-black.svg', primary); png('logo-primary-gold-on-black.png', primary, 1600)
# Transparent variants
i, w, h = stacked(INK, GOLD); dark = svg(i, w, h, pad=10); write('logo-dark.svg', dark); png('logo-dark.png', dark, 1600)
i, w, h = stacked(IVORY, SOFT); light = svg(i, w, h, pad=10); write('logo-light.svg', light); png('logo-light.png', light, 1600)
i, w, h = stacked(GOLD); gold = svg(i, w, h, pad=10); write('logo-gold.svg', gold); png('logo-gold.png', gold, 1600)
# Compact header
for tone, fill in (('light', IVORY), ('dark', INK), ('gold', GOLD)):
    i, w, h = compact(fill); s = svg(i, w, h, pad=4); write(f'logo-compact-{tone}.svg', s); png(f'logo-compact-{tone}.png', s, 900)
# Favicon: G monogram from the same typeface, gold on black
dG, wG = text_path('G', 560, 0, 0, 0)
adv = width_of('G', 560, 0)
fav = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="GLAMS BY LEE"><title>GLAMS BY LEE</title>'
       f'<rect width="512" height="512" rx="96" fill="{INK}"/><g transform="translate({(512 - adv) / 2:.1f},{384})">'
       f'<path d="{text_path("G", 560, 0, 0, 0)[0]}" fill="{GOLD}"/></g></svg>')
write('favicon.svg', fav); png('favicon-512.png', fav, 512); png('favicon-192.png', fav, 192); png('apple-touch-icon.png', fav, 180); png('favicon-32.png', fav, 32)
# Social profile (square, centred stacked mark)
i, w, h = stacked(GOLD); sw = 1080; sc = (sw * 0.7) / w
social = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {sw} {sw}" role="img" aria-label="GLAMS BY LEE"><title>GLAMS BY LEE</title>'
          f'<rect width="{sw}" height="{sw}" fill="{INK}"/><g transform="translate({sw * 0.15},{(sw - h * sc) / 2}) scale({sc})">{i}</g></svg>')
write('social-profile.svg', social); png('social-profile.png', social, 1080)
print('built', len(os.listdir(OUT)), 'files')
