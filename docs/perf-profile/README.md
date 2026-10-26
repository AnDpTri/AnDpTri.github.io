# Tái lập profile experience pass

Production vẫn là static HTML/CSS/ES modules, không thêm dependency hay build step.

## Chuẩn bị

Baseline là revision `e268e3b`, không phải baseline `4ee1528` của performance pass trước. Trích đúng các file production vào thư mục tạm, chỉ lấy signal-map của lab:

```powershell
python -c "import subprocess,tarfile,io,pathlib; p=pathlib.Path('.codex-run/profile-start'); p.mkdir(parents=True,exist_ok=True); tarfile.open(fileobj=io.BytesIO(subprocess.check_output(['git','archive','e268e3b','index.html','app.js','opening.js','audio.js','signal.js','style.css','opening.css','assets','eyecatch/assets/signal-map.png']))).extractall(p)"
```

Chạy hai server đúng brief trong hai terminal:

```powershell
python C:/Users/andan/.local/share/serve-portfolio.py 4191 D:/Projects/Web/andptri-site
python C:/Users/andan/.local/share/serve-portfolio.py 4192 D:/Projects/Web/andptri-site/.codex-run/profile-start
```

Cả hai gửi `Cache-Control: no-store`. Dùng Node và Playwright đã có sẵn:

```powershell
$env:NODE_PATH='C:/Users/andan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'
$env:PYTHONPATH='.codex-run/perf-tools'
$env:PYTHONUTF8='1'
$node='C:/Users/andan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
```

Python cần Pillow; máy kiểm tra đã có ở `.codex-run/perf-tools`. Chrome được chọn bằng `channel: 'chrome'`. Trên máy có sandbox chặn child process, cần cho phép chạy Chrome bên ngoài sandbox.

## Chạy tuần tự

Không chạy nhiều browser hoặc render ảnh bên cạnh phép đo:

```powershell
& $node docs/perf-profile/run-measurements.cjs
& $node docs/perf-profile/verify.cjs
& $node docs/perf-profile/chips.cjs
& $node docs/perf-profile/lifecycle.cjs
& $node docs/perf-profile/frames.cjs baseline 4192
& $node docs/perf-profile/frames.cjs after 4191
$env:PERF_PORT='4191'
$env:VERIFY_OUT='../perf-profile/opening-regressions.json'
& $node docs/perf/verify.cjs
python docs/perf-profile/report.py
```

- `measure.cjs`: context mới, service worker bị chặn, `Network.setCacheDisabled(true)`, CPU ×4. Fast 4G: 200,000 B/s down, 93,750 B/s up, latency 150 ms; Slow 4G: 50,000 B/s hai chiều, latency 150 ms. Desktop 1440×900: 3 run/network; touch/mobile 390×844: 1 run/network. Có thể chọn `PROFILE_MOBILE=1`, `PROFILE_NETWORK=fast4g|slow4g`, `PROFILE_RUN=1|2|3`. Sound tắt lúc bắt đầu để tách idle UI khỏi nhạc; hai lệnh mute sau đó thử cả cold unlock và tắt lại.
- Event Timing API có ngưỡng thấp nhất 16 ms, duration lượng tử hóa 8 ms. Summary chỉ dùng event có interactionId khác 0. Lấy max event/interaction trong mỗi cửa sổ thao tác, rồi median giữa các run; đây là INP-like trong lab, không phải field INP. Hover không có interactionId: giữ riêng event/paint proxy và long tasks. Proxy là capture listener → rAF → timer, không phải timestamp trình bày pixel của compositor.
- Popup đo timing được đóng ngay; việc điều hướng thật của đủ `open 1`–`open 9` được kiểm tra riêng trong `verify.cjs`, intercept nội dung đích bằng trang HTML cục bộ. Không tải repository hoặc lab để làm phép đo chậm thêm.
- `idle.taskMs` là chênh lệch CDP TaskDuration trong 8 giây sau hand-over + 500 ms; phần trăm = taskMs / 8000 × 100. Không phải CPU toàn bộ Chrome/GPU/OS. Giữ cả glitch đầu tiên theo nhịp 23 giây gốc. Long tasks trong summary chỉ tính cửa sổ tương tác; raw JSON giữ cả startup/opening để phân tích độc lập.
- `verify.cjs`: đồng hồ rAF điều khiển chỉ cho kiểm tra hành vi và retention, không dùng làm timing. Một warm-up có sound on/off, rồi 5 logout bằng chip (cùng execute path). GC trước mỗi mẫu; tránh tính native input undo nodes của automation thành leak DOM. Kiểm tra DOM/listener, AudioContext, lịch sử, Esc, live region, tên control, skip/focus, vùng chạm, viewport bàn phím mô phỏng, touch feedback, low-power và reduced motion. UA iPhone trên Chromium chỉ kiểm tra nhánh viewport, không thay thế Safari thật.
- `chips.cjs`: đo trực tiếp cả bốn chip, gồm logout, với đồng hồ thật, CPU ×4, Fast 4G, cache tắt; desktop click và mobile touch. Trước đo dùng skip để đến cùng profile; ghi Event Timing và long tasks, assert mọi chip của bản sau <100 ms. Tách khỏi replay/GC để không làm sai timing.
- `lifecycle.cjs`: đồng hồ thật, CPU ×4, resize/orientation lúc NO SIGNAL và sau mở, wheel scroll có trace Paint, thử tab switch và back/forward. Headless Chrome giữ cả hai tab visible; visibilitychange được kiểm tra có chủ đích trong `verify.cjs`. CDP ghi lý do BFCache bị từ chối. Chỉ riêng phép thử BFCache bật lại HTTP cache trước điều hướng để tránh tạo thêm lý do loại; cold-load/timing luôn cache-disabled. Không thay header no-store hay thêm custom caching.
- `frames.cjs`: cố định Date, PRNG và rAF; đợi font/snapshot sẵn sàng; pause animation và khóa cursor ở cùng trạng thái sáng cho cả hai bản. Chụp boot, profile đầu tiên, shell và archive. Không mask vùng nào. `report.py` so mọi pixel RGB, yêu cầu **0 pixel khác** ở cả 8 ảnh.
- `report.py`: tái tạo `summary.json`; `contrast.json` lưu các tỉ lệ luminance danh định của màu CSS. `experiments.json` giữ kết quả thử promotion overlay và trước warmup glyph, không dùng trộn vào bảng cuối.

Baseline được đo xen kẽ với bản thử; sau khi phát hiện cold emoji stall, toàn bộ số `after` được đo lại với bản cuối. Dùng `run-measurements.cjs` để tái đo hai revision xen kẽ trên cùng máy. Giữ timestamp/raw sample và cả outlier; không thay mẫu chỉ vì kết quả xấu.
