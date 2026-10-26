"""Exact decoded RGB comparison; needs Pillow. No perceptual threshold hides differences."""
import json
import sys
from pathlib import Path
from PIL import Image, ImageChops

root = Path(__file__).resolve().parent
before, after = [root / label / 'frames' for label in sys.argv[1:3]]
results = []
for file in sorted(before.glob('*.png')):
    a, b = Image.open(file).convert('RGB'), Image.open(after / file.name).convert('RGB')
    assert a.size == b.size
    difference = ImageChops.difference(a, b)
    count = sum(pixel != (0, 0, 0) for pixel in difference.getdata())
    results.append(dict(frame=file.name, differentPixels=count, bounds=difference.getbbox()))
print(json.dumps(results, indent=2))
assert len(results) == 10 and all(r['differentPixels'] == 0 for r in results)
