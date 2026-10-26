# Performance pass — cold load

Ngày kiểm tra: 26/10/2026. Bản gốc: `4ee1528`. Không push. Trang vẫn là HTML/CSS/ES modules chạy trực tiếp, không build step, không service worker hay lưu asset vào localStorage/IndexedDB. localStorage chỉ giữ lựa chọn bật/tắt âm thanh như trước.

## Cách đo

Chrome 155.0.8059.85 headless trên Windows, viewport 1440×900; các phép kiểm tra hình ảnh và tương tác có thêm 390×844. Server đúng brief (`serve-portfolio.py`) gửi `Cache-Control: no-store`. Mỗi run dùng context mới, chặn service worker và `Network.setCacheDisabled(true)`.

Ba run cho mỗi cấu hình, lấy median từng chỉ số: Local không throttle; Fast 4G 200,000 B/s download, 93,750 B/s upload, latency 150 ms; Slow 4G 50,000 B/s hai chiều, latency 150 ms. Hai profile mạng dùng CPU ×4. Chạy tuần tự, không chạy kiểm tra ảnh/audio cạnh phép đo. Baseline được đo lại sau bản cuối trong cùng phiên để tránh trộn thời gian từ lần chạy bị ngắt; dữ liệu baseline ban đầu vẫn có trong commit `59d7eeb`.

`measure.cjs` chèn bộ đếm qua CDP cho cả hai bản; bytes là `Network.loadingFinished.encodedDataLength`, gồm header và phần đo lường chèn vào JS, không phải tổng dung lượng file trên ổ đĩa. Prompt dùng max(FCP, mốc DOM mở jack-in); đây là xấp xỉ thời điểm hiển thị, không phải INP. Profile ready gồm font, load, ảnh chụp profile và WebGL init, khác với thời điểm profile được tiết lộ sau narrative 17.8 giây. Thời gian CSS animation, nhịp phase, tốc độ bounce và tear không rút ngắn.

## Kết quả

| Chỉ số | Local trước → sau | Fast 4G trước → sau | Slow 4G trước → sau |
| --- | ---: | ---: | ---: |
| Requests | 17 → 13 | 17 → 13 | 17 → 13 |
| Tải qua mạng (B) | 607,383 → 156,282 | 607,383 → 156,282 | 607,383 → 156,282 |
| FCP (ms) | 212 → 192 | 1,240 → 1,088 | 1,784 → 1,688 |
| Prompt hiển thị, xấp xỉ (ms) | 263 → 221.3 | 2,307.7 → 1,404.3 | 3,209 → 2,150.5 |
| Profile snapshot + GPU sẵn sàng (ms) | 569.4 → 484.3 | 4,670.6 → 2,656.7 | 13,940.6 → 4,454.7 |
| Long tasks >50 ms | 3 → 3 | 13 → 12 | 14 → 12 |
| Long-task total (ms) | 443 → 433 | 2,650 → 1,976 | 2,908 → 1,937 |
| JS heap before GC (MiB) | 5.17 → 4.04 | 5.12 → 3.24 | 5.6 → 3.13 |
| WebGL init (ms) | 157.9 → 34.1 | 104.1 → 70 | 90 → 62.3 |
| renderText CPU (ms) | 352.7 → 43.6 | 1,405.6 → 202.3 | 1,532.2 → 197.1 |
| renderSignal CPU (ms) | 133.8 → 24.7 | 777.7 → 138.5 | 706.6 → 124.5 |
| Audio build CPU (ms) | 3.8 → 3.2 | 31.7 → 22.1 | 27.6 → 26.3 |
| Audio scheduler CPU (ms) | 29.4 → 27.9 | 170.1 → 132.8 | 148.3 → 129.5 |
| Panic frame p95 (ms) | 13.5 → 13.5 | 26.7 → 13.5 | 26.7 → 13.5 |
| Panic frames >20 ms (%) | 0 → 0 | 8.89 → 2.74 | 10.66 → 2.04 |
| Tear frame p95 (ms) | 26.7 → 26.7 | 26.8 → 26.7 | 40.1 → 39.8 |
| Tear frames >20 ms (%) | 17.19 → 19.01 | 18.55 → 18.11 | 19.33 → 18.33 |
| CLS | 0.13 → 0.132 | 0.134 → 0.139 | 0.132 → 0.139 |

Khoảng rAF điển hình của môi trường này là 13.3 ms (75 Hz). p95 và tỷ lệ khoảng >20 ms là chỉ báo frame bị trễ, không phải trace frame trình bày thật của compositor. WebGL init là thời gian đồng bộ tạo context/compile/link/upload texture, không phải GPU timer query. Heap trong bảng lấy một giây sau opening, trước GC nên có độ dao động.

Tổng transfer giảm **74.3%**, bớt 4 request. Profile ready giảm **4.67 → 2.66 s** trên Fast 4G, **13.94 → 4.45 s** trên Slow 4G. CPU của renderText giảm khoảng **86%** trên hai profile throttled; panic p95 từ 26.7 xuống 13.5 ms. Tear p95 gần như không đổi; tỷ lệ gap Local tăng 17.19% → 19.01%. CLS tăng nhẹ khoảng 0.01 trên các run throttled. Đây là những chỉ số chưa cải thiện, được giữ nguyên vì bố cục chuyển pha và shader phải giữ hình ảnh cũ.

WebGL init Local dao động lớn: trước 32.5–389 ms, sau 33.3–333.5 ms. Không quy mức giảm median của chỉ số này thành một tối ưu shader; shader không thay đổi.

## Những thay đổi được giữ

- Hai file trước mang đuôi `.woff2` nhưng chứa sfnt/TrueType chưa nén. Chuyển lossless sang WOFF2: font-0 **125,984 → 36,812 B**, font-3 **128,812 → 37,240 B**; tổng **254,796 → 74,052 B**, giảm 70.9%. **Không subset**, không xóa glyph; giữ font license.
- `assets/fonts/load.js` tải mỗi face một lần cho document hiện tại, đăng ký `FontFace` từ cùng buffer và tạo data URL một lần để SVG snapshot dùng chung. Không cần HTTP cache hay fetch preload. Có stylesheet trong `<noscript>` để profile và font vẫn hoạt động khi JavaScript tắt.
- Snapshot đọc `cssRules` của stylesheet đã tải, không GET lại `style.css`/`opening.css`. Nội dung vẫn là DOM thật, cùng font, HUD, skip/sound controls và canvas đang hiện; SVG foreignObject vẫn chụp các thời điểm cũ.
- Modulepreload cho app và leaf `signal.js` để giảm một bước khám phá dependency, giữ CSS được phát hiện trước. Full-chain preload và font fetch-preload đã thử rồi bỏ; kết quả trung gian ở [experiments.json](perf/experiments.json).
- Vòng text giữ DOM reference, tái dùng `Intl.DateTimeFormat`, chỉ format đồng hồ khi giây thay đổi và chỉ cập nhật text khi nội dung khác. Biến đổi jitter, shadow, chữ và nhịp vẫn giữ nguyên. Không còn tạo/reverse mảng beat mỗi frame.
- Bounce đo kích thước một lần, chỉ bỏ số đo khi font sẵn sàng hoặc viewport resize; mỗi frame chỉ cập nhật transform. Giữ nguyên vận tốc 330 CSS px/s và thuật toán phản xạ.
- Sau opening bỏ reference đến profile/panic/collapse canvas, capture closures và wrapper WebGL. GPU resource vẫn được destroy và replay vẫn tạo canvas mới.
- Dừng interval audio scheduler khi mute hoặc tab ẩn; bật lại cùng interval 25 ms/lookahead 100 ms khi tiếp tục. Không sửa MIX, waveform, node graph, nhạc, cue hay envelope.

## Bằng chứng giữ nguyên hình ảnh, glyph và hành vi

[Font verification](perf/fonts-verification.json) so toàn bộ cmap, outline, advance metrics, hinting và bảng shaping với Git: **495/495 glyph** của Be Vietnam Pro, **995/995 glyph** của IBM Plex Mono giữ nguyên; đủ U+1EA0–U+1EF9 và các chữ Ă/ă, Đ/đ, Ĩ/ĩ, Ũ/ũ, Ơ/ơ, Ư/ư. Khác biệt dữ liệu chỉ là WOFF2 transform/checksum và cách mã hóa glyf/loca. Raster Chrome của tên trên trang và dải chữ tiếng Việt cả NFC/NFD: **0 channel khác biệt** cho cả hai font.

So sánh [10 frame trước](perf/baseline/frames/) / [10 frame sau](perf/after/frames/) tại boot, panic, NO SIGNAL, mid-tear và profile, hai viewport. [Kết quả từng pixel](perf/frame-comparison.json) ghi mọi khác biệt, không mask vùng; ngưỡng chỉ cho nhiễu raster tối đa 1/255 tại ≤0.01% pixel. [Font-only frames](perf/fonts-frames.json) kiểm chứng riêng hai file font trước khi sửa mã.

Kết quả cuối: **9/10 frame trùng tuyệt đối**; desktop panic khác **6 pixel** với biên độ tối đa **1/255**. Riêng lần chỉ chuyển font: **10/10 frame trùng tuyệt đối**.

[45 kiểm tra](perf/verification.json) đạt: button/Esc ở prompt và các pha calm, unease, alarm, panic, collapse, blackout, no-signal; Esc ở reacquire/settle khi controls đã bị tear cuốn đi đúng thiết kế; tự hoàn thành; profile không inert, sound toggle trở lại; logout replay; reduced motion; mobile không tràn ngang; help/archive; mute/unmute; suspend/resume khi tab ẩn/hiện. Không còn requestAnimationFrame từ production sau khi opening hoàn tất. Mỗi font chỉ có một request trong document, kể cả replay. Chỉ `eyecatch/assets/signal-map.png` được tải, không có asset/module nào khác của lab. Không có console error ở các run hợp lệ.

Audio offline: 21 giây, 48 kHz, cùng PRNG và cue. Sai khác before/after tối đa **2.02×10⁻⁶**, RMS **4.00×10⁻⁸**, nhỏ hơn render baseline lặp (max **2.75×10⁻⁶**, RMS **4.28×10⁻⁸**). Đây là nhiễu số thực của Web Audio; không tuyên bố PCM giống từng bit.

[Edge cases](perf/edge-cases.json) bổ sung skip trước khi font tải xong, resize trong bounce, fallback khi không có WebGL và font/profile khi JavaScript tắt.

[Kiểm tra retention sau GC](perf/retention.json): 6 reference lớn của opening từ còn giữ → được bỏ; backing storage **582,045 → 244,152 B**. JS heap riêng phép đo này **2,268,776 → 2,400,944 B** (tăng khoảng 132 KB), nên không tuyên bố mọi loại bộ nhớ đều giảm. Việc bỏ reference cho phép GC thu các canvas; số backing storage/JS heap không đo đầy đủ framebuffer/VRAM.

## Những gì chủ động không đổi

`signal.js` và toàn bộ `eyecatch/` giữ nguyên. Map đã là RGB **1080×166, 6,834 B**. Recompress lossless thử được 6,686 B, chỉ tiết kiệm 148 B; không thay map, không quantize dữ liệu shader. Pipeline chỉ upload texture ở các mốc chụp/resize, dùng lại buffer/texture khi render; giữ `preserveDrawingBuffer` để skip giữa tear vẫn chụp được canvas. Không đổi shader, resolution, readback kiểm tra bảo mật hay filter.

Giữ font-display swap, toàn bộ glyph cho terminal input tùy ý, wording/content, timeline, CSS effects, DOM snapshot và audio arrangement. Không minify/obfuscate hay xóa CSS cũ chỉ để làm số file nhỏ hơn: phần giảm chính đến từ font và download trùng; nguồn production vẫn đọc trực tiếp được, không sourcemap/build step. Audio scheduler đang phát nhạc vẫn chạy; clock 1 Hz và glitch định kỳ của profile vẫn giữ vì là hành vi có sẵn.

## Giới hạn và tái lập

Renderer được kiểm tra riêng báo **ANGLE / Intel UHD Graphics / Direct3D11**; cờ cho phép SwiftShader không buộc dùng software renderer. Chưa đo trên điện thoại thật, GPU khác hoặc browser khác; không suy ra VRAM, nhiệt độ, pin hoặc tỷ lệ dropped frame trên thiết bị người dùng. Có kiểm tra audio số và state của audio engine, chưa nghe/đo latency qua loa thật. Không rút timing của sequence để làm kết quả đẹp hơn.

Lệnh và ý nghĩa từng công cụ ở [perf/README.md](perf/README.md); bảng có thể tái tạo bằng `python docs/perf/report.py`. Raw JSON cuối ở [baseline](perf/baseline/) và [after](perf/after/).
