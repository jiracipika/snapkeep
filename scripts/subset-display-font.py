"""Pin Bricolage Grotesque to the one weight the headings use (750) and drop
the codepoints they never will. Cuts the display face from 41 KB to 20 KB
(latin) and from 19 KB to 9 KB (latin-ext), with kerning kept.

The source files are the variable latin / latin-ext WOFF2s of
@fontsource-variable/bricolage-grotesque (SIL OFL, see public/fonts/OFL.txt):

  uv run --with fonttools --with brotli python -I scripts/subset-display-font.py <latin.woff2> <out-latin.woff2>
  uv run --with fonttools --with brotli python -I scripts/subset-display-font.py <latin-ext.woff2> <out-latin-ext.woff2> ext

Only needed again if the display weight or the copy's character set changes.
"""
import sys

from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

src, dst = sys.argv[1], sys.argv[2]

font = TTFont(src)
axes = {a.axisTag for a in font["fvar"].axes}
if "wght" in axes:
    font = instancer.instantiateVariableFont(font, {"wght": 750}, inplace=True)

# Latin text plus the punctuation headings use: curly quotes, dashes, ellipsis.
# "ext" keeps the source file's own latin-ext range instead.
if len(sys.argv) > 3 and sys.argv[3] == "ext":
    ext = [(0x100, 0x2BA), (0x2BD, 0x2C5), (0x2C7, 0x2CC), (0x2CE, 0x2D7), (0x2DD, 0x2FF), (0x304, 0x304),
           (0x308, 0x308), (0x329, 0x329), (0x1D00, 0x1DBF), (0x1E00, 0x1E9F), (0x1EF2, 0x1EFF), (0x2020, 0x2020),
           (0x20A0, 0x20AB), (0x20AD, 0x20C4), (0x2113, 0x2113), (0x2C60, 0x2C7F), (0xA720, 0xA7FF)]
    unicodes = [cp for lo, hi in ext for cp in range(lo, hi + 1)]
else:
    unicodes = list(range(0x20, 0x7F)) + list(range(0xA0, 0x100)) + list(range(0x2000, 0x2070)) + [0x20AC, 0x2122]

opts = Options()
opts.layout_features = ["*"]  # keep kerning and friends
opts.hinting = False
opts.notdef_outline = True
opts.name_IDs = ["*"]
opts.recalc_bounds = True

sub = Subsetter(options=opts)
sub.populate(unicodes=unicodes)
sub.subset(font)
font.flavor = "woff2"
font.save(dst)

out = TTFont(dst)
print("axes left:", [a.axisTag for a in out["fvar"].axes] if "fvar" in out else "static")
print("glyphs:", len(out.getGlyphOrder()), "codepoints:", len(out.getBestCmap()))
