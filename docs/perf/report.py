"""Summarize recorded runs; Python standard library only."""
import json
import math
import statistics
import sys
from pathlib import Path

root = Path(__file__).resolve().parent
sys.stdout.reconfigure(encoding='utf-8')
def runs(label, profile):
    return [json.loads(p.read_text(encoding='utf-8-sig')) for p in sorted((root / label).glob(profile + '-*.json'))]
def metric(record, name):
    return next(m['value'] for m in record['metrics'] if m['name'] == name)
def percentile(values, fraction):
    return sorted(values)[math.ceil(len(values) * fraction) - 1]
def frames(record, phase):
    return record['frames'][phase]
def gaps(record, phase):
    # These runs have a 75 Hz rAF cadence. Gaps are an estimate, not a compositor trace.
    return sum(v > 20 for v in frames(record, phase)) / len(frames(record, phase)) * 100

metrics = [
    ('Requests', lambda r: len(r['requests'])),
    ('Tải qua mạng (B)', lambda r: sum(req['bytes'] for req in r['requests'])),
    ('FCP (ms)', lambda r: r['paint'][1]['ms']),
    ('Prompt hiển thị, xấp xỉ (ms)', lambda r: max(r['interactive'], r['paint'][1]['ms'])),
    ('Profile snapshot + GPU sẵn sàng (ms)', lambda r: r['profileReady']),
    ('Long tasks >50 ms', lambda r: len(r['long'])),
    ('Long-task total (ms)', lambda r: sum(t['duration'] for t in r['long'])),
    ('JS heap before GC (MiB)', lambda r: metric(r, 'JSHeapUsedSize') / 1048576),
    ('WebGL init (ms)', lambda r: r['gpuInit']),
    ('renderText CPU (ms)', lambda r: r['cpu']['renderText']['ms']),
    ('renderSignal CPU (ms)', lambda r: r['cpu']['renderSignal']['ms']),
    ('Audio build CPU (ms)', lambda r: r['cpu']['build']['ms']),
    ('Audio scheduler CPU (ms)', lambda r: r['cpu']['schedule']['ms']),
    ('Panic frame p95 (ms)', lambda r: percentile(frames(r, 'panic'), .95)),
    ('Panic frames >20 ms (%)', lambda r: gaps(r, 'panic')),
    ('Tear frame p95 (ms)', lambda r: percentile(frames(r, 'reacquire'), .95)),
    ('Tear frames >20 ms (%)', lambda r: gaps(r, 'reacquire')),
    ('CLS', lambda r: r['cls']),
]
print('| Chỉ số | Local trước → sau | Fast 4G trước → sau | Slow 4G trước → sau |')
print('| --- | ---: | ---: | ---: |')
for name, get in metrics:
    cells = []
    for profile in ['local', 'fast4g', 'slow4g']:
        values = [statistics.median(get(r) for r in runs(label, profile)) for label in ['baseline', 'after']]
        precision = 3 if name == 'CLS' else 2
        cells.append(' → '.join(f'{value:,.{precision}f}'.rstrip('0').rstrip('.') for value in values))
    print('| ' + ' | '.join([name, *cells]) + ' |')
