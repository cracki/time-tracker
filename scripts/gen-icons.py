#!/usr/bin/env python3
"""Generate PWA icons — teal rounded square + clock glyph (brand of زمان‌سنج)."""
import math
import os
from PIL import Image, ImageDraw

TEAL = (15, 118, 110)        # #0F766E
TEAL_DARK = (13, 100, 94)
WHITE = (247, 250, 248)


def clock(size: int) -> Image.Image:
    s = size
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    r = s * 0.22
    d.rounded_rectangle((0, 0, s - 1, s - 1), radius=r, fill=TEAL)

    cx, cy = s * 0.5, s * 0.5
    R = s * 0.30
    width = max(4, int(s * 0.075))
    d.ellipse((cx - R, cy - R, cx + R, cy + R), outline=WHITE, width=width)

    def hand(angle_deg, length, w):
        a = math.radians(angle_deg)
        x2 = cx + length * math.sin(a)
        y2 = cy - length * math.cos(a)
        d.line((cx, cy, x2, y2), fill=WHITE, width=w)
        d.ellipse((x2 - w * 0.55, y2 - w * 0.55, x2 + w * 0.55, y2 + w * 0.55), fill=WHITE)

    hw = max(4, int(s * 0.062))
    hand(65, R * 0.62, hw)
    hand(-45, R * 0.45, hw)

    dot = max(3, int(s * 0.035))
    d.ellipse((cx - dot, cy - dot, cx + dot, cy + dot), fill=TEAL, outline=WHITE, width=max(2, int(s * 0.014)))
    return img


def maskable(size: int) -> Image.Image:
    s = size
    img = Image.new("RGBA", (s, s), TEAL)
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, s - 1, s - 1), outline=TEAL_DARK, width=max(2, s // 96))

    cx = cy = s / 2
    R = s * 0.24
    width = max(6, int(s * 0.06))
    d.ellipse((cx - R, cy - R, cx + R, cy + R), outline=WHITE, width=width)

    def hand(angle_deg, length, w):
        a = math.radians(angle_deg)
        x2 = cx + length * math.sin(a)
        y2 = cy - length * math.cos(a)
        d.line((cx, cy, x2, y2), fill=WHITE, width=w)
        d.ellipse((x2 - w * 0.55, y2 - w * 0.55, x2 + w * 0.55, y2 + w * 0.55), fill=WHITE)

    hw = max(5, int(s * 0.05))
    hand(65, R * 0.62, hw)
    hand(-45, R * 0.45, hw)
    dot = max(4, int(s * 0.03))
    d.ellipse((cx - dot, cy - dot, cx + dot, cy + dot), fill=TEAL, outline=WHITE, width=max(2, int(s * 0.012)))
    return img


OUT = "/home/z/my-project/public/icons"
os.makedirs(OUT, exist_ok=True)

clock(512).save(f"{OUT}/icon-512.png")
clock(512).resize((192, 192), Image.LANCZOS).save(f"{OUT}/icon-192.png")
clock(512).resize((180, 180), Image.LANCZOS).save(f"{OUT}/apple-touch-icon.png")
maskable(512).save(f"{OUT}/maskable-512.png")
clock(512).resize((64, 64), Image.LANCZOS).save(f"{OUT}/favicon-64.png")
clock(512).resize((32, 32), Image.LANCZOS).save(f"{OUT}/favicon-32.png")
print("icons written:", sorted(os.listdir(OUT)))
