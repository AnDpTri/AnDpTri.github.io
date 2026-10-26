"""Decoded RGB comparison; report every difference, allow only sparse 1-level raster noise."""
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
    count = sum(pixel != (0, 0, 0) for pixel in difference.get_flattened_data())
    maximum = max(high for low, high in difference.getextrema())
    results.append(dict(frame=file.name, differentPixels=count, maxChannelDifference=maximum, bounds=difference.getbbox(),
                        withinRasterNoise=maximum <= 1 and count <= a.width * a.height / 10000))
print(json.dumps(results, indent=2))
assert len(results) == 10 and all(r['withinRasterNoise'] for r in results)
