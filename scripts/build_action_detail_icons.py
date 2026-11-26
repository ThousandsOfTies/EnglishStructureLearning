"""Render the compact action and location cue diagrams (optional artwork task)."""
from pathlib import Path

import pymupdf


ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'assets/construction/action-details'
INK = '#554536'
BLUE = '#4e86a6'
TEAL = '#347d78'


def path(d, fill='none', stroke=INK, width=4):
    return (f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{width}" '
            'stroke-linejoin="round" stroke-linecap="round"/>')


def ellipse(x, y, rx, ry, fill, stroke='none', width=1):
    return (f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" '
            f'fill="{fill}" stroke="{stroke}" stroke-width="{width}"/>')


def group(transform, content):
    return f'<g transform="{transform}">{content}</g>'


def book(opened):
    if not opened:
        return ''.join([
            path('M-76 -37 L33 -65 L78 24 L-36 61 Z', '#396785'),
            path('M-72 -33 L31 -58 L72 19 L-34 54 Q-43 52 -45 45 Z', '#fff0cc'),
            path('M-74 -39 L33 -67 L74 12 L-39 46 Z', BLUE),
            path('M-59 -42 L-26 40', 'none', '#2d526b', 5),
        ])
    return ''.join([
        path('M-88 -39 Q-44 -53 0 -27 Q42 -53 86 -39 L88 37 Q44 27 0 56 Q-43 27 -88 37 Z', BLUE),
        path('M-82 -45 Q-43 -57 0 -30 Q41 -57 81 -45 L81 29 Q39 21 0 48 Q-41 21 -81 29 Z', '#fff2d4'),
        path('M0 -29 L0 47', 'none', '#82654d'),
        path('M-66 -17 Q-40 -23 -15 -9 M15 -9 Q39 -24 67 -17', 'none', '#c9af84', 3),
    ])


def box(opened):
    pieces = [
        path('M-62 -29 L0 -51 L62 -29 L0 -4 Z', '#a16c40'),
        path('M-61 -29 L0 -4 L0 60 L-61 33 Z', '#e2b275'),
        path('M0 -4 L61 -29 L61 33 L0 60 Z', '#c58a56')
    ]
    if opened:
        pieces += [
            path('M-62 -29 L-82 -52 L-21 -74 L0 -51 Z', '#eed0a0'),
            path('M0 -51 L20 -72 L82 -51 L62 -29 Z', '#e6bc80'),
            path('M-62 -29 L-82 -7 L-19 19 L0 -4 Z', '#edc792'),
            path('M0 -4 L21 18 L84 -9 L62 -29 Z', '#f6d6a2'),
        ]
    else:
        pieces += [
            path('M-62 -29 L0 -53 L62 -29 L0 -4 Z', '#efc993'),
            path('M-30 -42 L32 -17', 'none', '#9a6a42', 3),
        ]
    return ''.join(pieces)


def change(before, after):
    arrow = path('M198 60 Q255 59 263 122 L279 117 L261 150 L233 126 L249 124 Q245 80 198 77 Z', TEAL, '#31675c', 2)
    return group('translate(113 103)', before) + arrow + group('translate(229 257)', after)


def standing_girl():
    return ''.join([
        path('M-20 57 L-19 93 Q-16 100 -6 96 L-4 58 M7 58 L11 94 Q17 100 25 93 L20 55', '#f4c59e'),
        path('M-21 90 Q-12 89 -5 92 L-5 101 Q-17 105 -34 102 Q-34 94 -21 90 Z M10 90 Q17 91 24 87 Q34 90 34 98 Q20 104 9 100 Z', '#805941'),
        path('M-19 -1 Q-31 3 -35 15 L-57 22 Q-67 21 -68 15 L-70 12 Q-76 10 -75 17 Q-83 15 -79 22 Q-76 35 -57 34 L-29 29 L-13 10 Z', '#f5c6a1'),
        path('M15 0 Q31 4 34 16 L46 35 Q50 43 44 48 Q37 51 32 43 L17 25 Z', '#f5c6a1'),
        path('M-19 -7 Q0 -11 18 -6 Q26 -3 32 9 L23 19 L21 38 L-21 38 L-23 19 L-34 17 L-31 4 Z', '#cd6856'),
        path('M-20 31 Q0 37 21 31 L30 61 Q4 69 -28 60 Z', '#559b92'),
        path('M-22 -44 Q-24 -67 0 -68 Q32 -69 30 -44 L33 -15 Q31 -6 17 -8 L-23 -8 Q-31 -11 -29 -18 Z', '#76533e'),
        ellipse(1,-39,23,25,'#ffd6af',INK,3),
        path('M-22 -42 Q-26 -64 -2 -66 Q24 -70 29 -47 Q16 -48 8 -57 Q2 -47 -14 -44 L-17 -37 Z', '#77523b'),
        path('M-18 -55 L-15 -61 L-12 -55 L-6 -54 L-11 -50 L-10 -44 L-16 -47 L-21 -44 L-20 -50 L-25 -53 Z', '#e8b34e', '#946b32',1.5),
        ellipse(-9,-39,2.2,3,'#4f3d35'), ellipse(9,-39,2.2,3,'#4f3d35'),
        path('M-4 -28 Q1 -24 6 -29', 'none', '#965f4c', 2.4)
    ])


def footprint(x, y, angle):
    return group(f'translate({x} {y}) rotate({angle})',
                 path('M-6 -6 Q-13 -13 -5 -23 Q3 -29 8 -20 Q14 -10 6 0 Q1 5 -4 1 Z', '#ba895b','none',0)
                 + ellipse(-1,9,6,7,'#ba895b'))


def waiting_place():
    ground = ellipse(181,270,82,20,'#cce3d7','#71a08e',3)
    target = ellipse(178,270,54,10,'none','#3a8379',5)
    pin = path('M181 267 C172 252 145 228 145 205 A36 36 0 1 1 217 205 C217 226 193 254 181 267 Z', '#c65a43','#794b37',5)
    return ground + target + group('translate(219 148) scale(1.14)', standing_girl()) + pin + ellipse(181,202,12,12,'#fff4d9')


def first_step():
    start = path('M95 266 L148 200', 'none', '#bb9b73', 9)
    pole = path('M119 217 L119 67', 'none', '#675346', 9)
    flag = path('M121 68 Q152 47 189 66 Q218 78 239 61 L234 133 Q210 146 181 132 Q149 119 121 140 Z', '#488b73','#3d6657',4)
    seam = path('M130 69 L130 131', 'none', '#a9c8a3',3)
    return start + pole + flag + seam + footprint(160,239,68) + footprint(203,230,70) + footprint(246,241,74)


def main():
    diagrams = {
        'open-book': change(book(False),book(True)), 'close-book': change(book(True),book(False)),
        'close-box': change(box(True),box(False)),
        'wait-here': group('translate(-49 -52) scale(1.26)', waiting_place()),
        'first-step': group('translate(-46 -19) scale(1.26)', first_step())
    }
    DEST.mkdir(parents=True,exist_ok=True)
    for name, content in diagrams.items():
        svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="360" height="360" viewBox="0 0 360 360"><rect width="360" height="360" fill="#fcf9f2"/>{content}</svg>'
        with pymupdf.open('svg',svg.encode()) as doc:
            doc[0].get_pixmap(alpha=False).save(DEST/f'{name}.png')


if __name__ == '__main__':
    main()
