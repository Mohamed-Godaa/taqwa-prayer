"""Generate build/icon.png (512) + build/icon.ico (multi-size) for electron-builder."""
from PIL import Image, ImageDraw

S = 512
bg = (95, 79, 150, 255)        # violet-deep
ivory = (251, 247, 239, 255)
gold = (201, 168, 106, 255)

img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
# rounded-square background
d.rounded_rectangle([0, 0, S, S], radius=112, fill=bg)

cx = S // 2
base = 400
# ground bar
d.rounded_rectangle([56, base - 14, S - 56, base + 14], radius=14, fill=ivory)
# main hall
d.rounded_rectangle([cx - 120, 250, cx + 120, base - 14], radius=12, fill=ivory)
# dome (half-ellipse)
d.ellipse([cx - 120, 130, cx + 120, 290], fill=ivory)
d.rectangle([cx - 120, 210, cx + 120, 260], fill=ivory)
# doors (cut out with bg color)
for ox in (-72, -20, 32):
    d.rounded_rectangle([cx + ox, 300, cx + ox + 40, base - 14], radius=18, fill=bg)
# minaret
d.rectangle([cx - 208, 250, cx - 168, base - 14], fill=ivory)
d.ellipse([cx - 206, 214, cx - 170, 250], fill=ivory)
d.rectangle([cx - 192, 190, cx - 184, 216], fill=ivory)
# finial + gold crescent
d.rectangle([cx - 4, 96, cx + 4, 132], fill=ivory)
c = Image.new("RGBA", (80, 80), (0, 0, 0, 0))
cd = ImageDraw.Draw(c)
cd.ellipse([6, 6, 74, 74], fill=gold)
cd.ellipse([20, 0, 88, 68], fill=bg)  # bite -> crescent
img.alpha_composite(c, (cx - 40, 26))

img.save("build/icon.png")
img.save(
    "build/icon.ico",
    sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
)
print("wrote build/icon.png + build/icon.ico")
