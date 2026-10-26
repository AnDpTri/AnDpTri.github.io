"""Compare converted fonts to the pre-performance Git revision. Needs fonttools[woff]."""
import io
import json
import subprocess
import sys
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.recordingPen import RecordingPen

root = Path(__file__).resolve().parents[2]
revision = sys.argv[1] if len(sys.argv) > 1 else '4ee1528'
results = []
vietnamese = set(range(0x1EA0, 0x1EFA)) | {0x102, 0x103, 0x110, 0x111, 0x128, 0x129, 0x168, 0x169, 0x1A0, 0x1A1, 0x1AF, 0x1B0}
for name in ['font-0.woff2', 'font-3.woff2']:
    original = subprocess.check_output(['git', 'show', f'{revision}:assets/fonts/{name}'], cwd=root)
    a = TTFont(io.BytesIO(original), recalcTimestamp=False)
    b = TTFont(root / 'assets/fonts' / name, recalcTimestamp=False)
    assert a.getGlyphOrder() == b.getGlyphOrder()
    assert a.getBestCmap() == b.getBestCmap()
    assert vietnamese <= set(b.getBestCmap())
    assert a['hmtx'].metrics == b['hmtx'].metrics
    for tag in a.keys():
        if tag not in ['GlyphOrder', 'head', 'loca', 'glyf']:
            assert a.getTableData(tag) == b.getTableData(tag), (name, tag)
    for key, value in vars(a['head']).items():
        if key not in ['checkSumAdjustment', 'flags']:
            assert value == getattr(b['head'], key), (name, key)
    assert a['head'].flags ^ b['head'].flags == 0x800  # WOFF2 lossless transform bit.
    ag, bg = a.getGlyphSet(), b.getGlyphSet()
    for glyph in a.getGlyphOrder():
        ap, bp = RecordingPen(), RecordingPen()
        ag[glyph].draw(ap)
        bg[glyph].draw(bp)
        assert ap.value == bp.value, (name, glyph)
        if 'glyf' in a:
            assert getattr(a['glyf'][glyph], 'program', None) == getattr(b['glyf'][glyph], 'program', None)
    results.append(dict(font=name, originalBytes=len(original), bytes=(root / 'assets/fonts' / name).stat().st_size,
                        glyphs=len(a.getGlyphOrder()), vietnameseCodepoints=len(vietnamese), identical=True))
print(json.dumps(results, indent=2))
