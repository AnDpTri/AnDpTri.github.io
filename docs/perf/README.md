# Công cụ kiểm chứng

Trang chạy trực tiếp bằng HTML/CSS/ES modules; không cần build hay các thư viện dưới đây trong production.

Các script dùng Node + `playwright`, Chrome tại `C:/Program Files/Google/Chrome/Application/chrome.exe`; Python 3 + `fonttools[woff]` và Pillow. Đặt `NODE_PATH` nếu Playwright không nằm trong module search path. Máy kiểm tra dùng:

```powershell
$env:NODE_PATH='C:/Users/andan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'
$env:PYTHONPATH='.codex-run/perf-tools'
```

Mở hai server trong hai terminal riêng. Server được brief chỉ định gửi `Cache-Control: no-store`:

```powershell
python C:/Users/andan/.local/share/serve-portfolio.py 4181 D:/Projects/Web/andptri-site
python C:/Users/andan/.local/share/serve-portfolio.py 4182 D:/Projects/Web/andptri-site/.codex-run/baseline-site
```

`baseline-site` là bản sao các file production của revision `4ee1528`, gồm `index.html`, `app.js`, `opening.js`, `audio.js`, `signal.js`, hai stylesheet, `assets/`, và duy nhất `eyecatch/assets/signal-map.png`. Có thể trích chúng từ Git vào một thư mục tạm khác rồi dùng port 4182. Không cần sao chép hay tải lab Edgerunners.

Chạy tuần tự để các phép đo không tranh CPU/GPU:

```powershell
python docs/perf/verify-fonts.py 4ee1528
node docs/perf/frames.cjs baseline 4182
node docs/perf/frames.cjs after 4181
python docs/perf/compare-frames.py baseline after
node docs/perf/verify.cjs
node docs/perf/edge-cases.cjs
node docs/perf/retention.cjs
$env:PERF_PORT='4182'
node docs/perf/measure.cjs baseline
$env:PERF_PORT='4181'
node docs/perf/measure.cjs after
python docs/perf/report.py
```

- `measure.cjs`: 3 context mới/profile, cache HTTP tắt bằng CDP, service worker bị chặn. Local không throttle; Fast 4G = 200,000 B/s down, 93,750 B/s up, RTT cấu hình 150 ms; Slow 4G = 50,000 B/s hai chiều, 150 ms. Hai profile mạng đều CPU ×4. Có thể đặt `PERF_PROFILE=local|fast4g|slow4g`. Lưu toàn bộ requests, bytes, paint, long tasks, rAF intervals, CLS, heap và CPU. CDP chèn bộ đếm vào response module cho cả hai bản, không sửa production. Các số bytes bao gồm header và phần chèn đo lường.
- `frames.cjs`: cố định Date, PRNG và đồng hồ rAF; tạm dừng CSS animation tại cùng thời điểm, đưa chuột ra ngoài nội dung. Chụp boot, panic, NO SIGNAL, mid-tear, profile ở 1440×900 và 390×844. Đây là phép so sánh cùng trạng thái, không thay thế phép đo thời gian thực. Polling dùng timer vì rAF đã được điều khiển.
- `compare-frames.py`: báo mọi pixel khác biệt; chỉ cho phép nhiễu raster tối đa 1/255 mỗi kênh tại tối đa 0.01% pixel, không mask vùng ảnh.
- `verify-fonts.py`: so cmap, toàn bộ outline, metrics, hinting và các bảng còn lại với Git. Khác biệt duy nhất được phép là WOFF2 lossless-transform flag/checksum và cách mã hóa glyf/loca.
- `verify.cjs`: skip/Esc ở mọi pha, các control biến mất đúng lúc tear, replay, reduced motion, âm thanh, visibility, idle rAF, request font không lặp, không tải lab, raster tiếng Việt NFC/NFD. Render audio offline 21 giây ở 48 kHz với cùng PRNG/cue, có render baseline lặp làm đối chứng nhiễu số thực; ngưỡng max 1e-5, RMS 1e-7. Đây không phải phép nghe trên thiết bị thật.
- `retention.cjs`: CDP GC và kiểm tra các reference sau opening; chạy riêng để GC không làm sai số thời gian của `measure.cjs`.
- `edge-cases.cjs`: skip khi font chưa tải xong, resize giữa NO SIGNAL bounce, fallback khi WebGL không khả dụng và profile/fonts khi JavaScript tắt.
- `compress-fonts.py`: chuyển font sang WOFF2 lossless; **không subset**, không bỏ glyph. Không cần chạy lại khi chỉ kiểm chứng.

Baseline ban đầu được kế thừa từ lần chạy trước và lưu ở commit `59d7eeb`; baseline trong bảng cuối được chạy lại trong cùng phiên với bản tối ưu. `fonts-only/` xác minh riêng hai file font trước khi sửa JS. [experiments.json](experiments.json) ghi số liệu các thử nghiệm trung gian: shared downloads, fetch preload cho font, async font loader, full-chain preload và dependency preload ưu tiên thấp. Có một run fetch-preload thất bại (`fallback: "Failed to fetch"`), nên bỏ cách đó. Bản cuối dùng font loader module, modulepreload cho app và signal, không fetch-preload font và không async loader tranh bandwidth với CSS. Không dùng các thử nghiệm làm số cuối. Mọi số cuối nằm trong `after/`, `verification.json`, `edge-cases.json`, `retention.json` và `frame-comparison.json`.
