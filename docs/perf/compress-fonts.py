"""Lossless WOFF2 conversion. Requires fonttools[woff] (fonttools + brotli).

No subsetting: preserve arbitrary terminal input, all glyphs and hinting.
"""
from pathlib import Path
from fontTools.ttLib import TTFont

root = Path(__file__).resolve().parents[2]
for source in (root / 'assets/fonts').glob('*.woff2'):
    font = TTFont(source, recalcTimestamp=False)
    before = source.stat().st_size
    font.flavor = 'woff2'
    font.save(source)
    print(source.name, before, '->', source.stat().st_size)
