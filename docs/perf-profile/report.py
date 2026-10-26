"""Rebuild summary.json and strict RGB screenshot comparison from recorded evidence."""
import json
from pathlib import Path
from statistics import median
from PIL import Image, ImageChops

root = Path(__file__).resolve().parent
summary = {'timings': {}, 'frames': []}
for label in ('baseline', 'after'):
    summary['timings'][label] = {}
    for mobile in (False, True):
        folder = root / label / ('mobile' if mobile else '.')
        for network in ('fast4g', 'slow4g'):
            runs = [json.loads(p.read_text(encoding='utf-8')) for p in sorted(folder.glob(f'{network}-*.json'))]
            if not runs:
                continue
            def eligible(action):
                return [event['duration'] for event in action['events'] if event['id']]
            maxima = [max([e for a in r['actions'] for e in eligible(a)], default=0) for r in runs]
            handover_cls = [sum(s['value'] for s in r['shifts'] if not s['input'] and abs(s['at'] - r['handover']) < 500) for r in runs]
            categories = {}
            for name in dict.fromkeys(a['name'] for r in runs for a in r['actions']):
                actions = [a for r in runs for a in r['actions'] if a['name'] == name]
                values = [max(eligible(a), default=0) for a in actions]
                categories[name] = {'medianMaxEventMs': median(values), 'maxEventMs': max(values),
                    'maxPaintProxyMs': max([e['toNextPaint'] for a in actions for e in a['paintProxies']], default=0),
                    'longTasks': [len(a['long']) for a in actions]}
            summary['timings'][label][f'{"mobile" if mobile else "desktop"}-{network}'] = {
                'runs': len(runs), 'medianMaxEventMs': median(maxima), 'maxEventMs': max(maxima),
                'medianInteractionLongTasks': median([sum(len(a['long']) for a in r['actions']) for r in runs]),
                'medianInteractionLongTaskMs': median([sum(t['duration'] for a in r['actions'] for t in a['long']) for r in runs]),
                'medianIdleTaskMs': median(r['idle']['taskMs'] for r in runs),
                'medianIdleScriptMs': median(r['idle']['scriptMs'] for r in runs),
                'medianIdleMainThreadPercent': median(r['idle']['taskMs'] / 80 for r in runs),
                'medianHandoverCLS': median(handover_cls),
                'medianWholeSequenceCLS': median(sum(s['value'] for s in r['shifts'] if not s['input']) for r in runs),
                'actions': categories,
            }
for before in sorted((root / 'baseline/frames').glob('*.png')):
    a = Image.open(before).convert('RGB')
    b = Image.open(root / 'after/frames' / before.name).convert('RGB')
    assert a.size == b.size
    diff = ImageChops.difference(a, b)
    changed = sum(pixel != (0, 0, 0) for pixel in diff.get_flattened_data())
    maximum = max(high for low, high in diff.getextrema())
    summary['frames'].append({'name': before.name, 'differentPixels': changed,
                              'maxChannelDifference': maximum, 'bounds': diff.getbbox()})
(root / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n')
print(json.dumps({label: {key: {k: v for k, v in value.items() if k != 'actions'} for key, value in configs.items()} for label, configs in summary['timings'].items()}, indent=2))
assert len(summary['frames']) == 8 and all(frame['differentPixels'] == 0 for frame in summary['frames'])
