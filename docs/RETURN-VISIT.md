# Return visit và opening 13 giây

Kiểm tra ngày 27/10/2026 trên Chrome 155.0.8059.85, Playwright `channel: 'chrome'`, server no-store của brief. Review bản part 1 tại `a67cdec`; đối chiếu giao diện với bản trước tính năng tại `e190fef`. Chỉ commit cục bộ, không push.

## Thay đổi

- Lượt quay lại giữ nguyên màn hình “Link established.”, prompt Connect, skip và SND; không chạy timer. Click/tap ở bất kỳ vị trí nào trên opening, kể cả hai control, hoặc Enter/Space/Esc đều gọi đường skip. Tab, phím khác, key repeat và IME composition không kích hoạt skip ở lượt quay lại. Các listener được dọn sau mỗi lần chạy.
- `thepeak.seen=1` chỉ được ghi khi opening thực sự đến `complete`. Một lần mở dở, đang chờ tải, hoặc lỗi opening không đánh dấu đã xem. Đọc/ghi storage đều có try/catch; storage bị chặn vẫn chạy như lượt đầu.
- Sửa đường skip vốn có thể bỏ qua `mainReady`: profile luôn chờ tài nguyên thật và snapshot sẵn sàng trước khi được mở tương tác.
- Đặt `[ replay ]` ở khoảng trống giữa footer terminal bằng absolute positioning. Không đổi vị trí hai dòng chữ sẵn có. Hit area thật là **60×44 px** desktop và **48×44 px** mobile, nằm trong vùng không bị clip. Có accessible name, focus outline, Enter và tap/click. Nút dùng cùng lệnh logout; `logout`, `intro`, `lock` vẫn chạy opening đầy đủ, không dùng trạng thái return visit.
- Rút opening đầy đủ còn 13 giây theo bảng dưới. Text/log, intensity, bounce, collapse và âm thanh dùng cùng beats. STOP dài 1.8 giây, judder vào ngay; collapse 1.1 giây, đen 0.4 giây, NO SIGNAL 3.1 giây, natural tear 1.5 giây rồi settle 0.5 giây. Đường skip giữ tốc độ tear cũ: 2 giây + settle 0.5 giây.
- Không đổi shader, tốc độ phản xạ NO SIGNAL, graph/MIX âm thanh, nội dung/font/bố cục profile. Chỉ sửa API gain nhận timestamp để offline renderer lập lịch đúng; live dùng cùng timestamp như trước. Bump URL version cho các asset đã thay đổi; không thêm service worker hay cơ chế cache asset.

## Kết quả kiểm tra

**68 kiểm tra đạt:** [13 return/replay](return-visit/after/results.json), [52 timeline/skip/loading](return-visit/timing/results.json), [3 font/audio](return-visit/media-verification.json). Không có console error/page error trong các lượt test. Part 1 được kiểm tra riêng trước khi retime: [11 kết quả](return-visit/part1/results.json) và [storage bị chặn](return-visit/part1-storage/results.json).

- Context mới chạy đủ mọi phase; flag chỉ có sau completion. Reload cùng context vẫn ở màn hình đầu sau **6.5 giây**, vượt cả timeout 6 giây của lượt đầu; thao tác tiếp theo đi thẳng vào tear, không qua panic/bounce. Kiểm tra riêng click, tap, Enter, Space, Esc, skip và SND; audio context được unlock bằng gesture.
- Nút replay chạy đủ opening rồi trở về profile trên cả 1440 và 390. Desktop dùng keyboard Enter và kiểm tra riêng mouse click; mobile tap tại mép trên hit area. `logout` và `intro` cũng vào panic thay vì tự skip. Storage getItem/setItem cùng ném SecurityError không gây lỗi và reload vẫn chạy lượt đầu.
- So full-page PNG với thời gian/random/blink được cố định: **0 pixel RGB khác biệt khi ẩn nút replay**, ở cả 1440 và 390. Khi hiện nút, chỉ **204 pixel** desktop và **176 pixel** mobile thay đổi; tất cả nằm trong bounding box của nút. [Ảnh desktop](return-visit/after/1440-profile-replay.png), [ảnh mobile](return-visit/after/390-profile-replay.png); thư mục cạnh đó chứa bản old/hidden để tái đối chiếu.
- Kiểm tra skip button/Esc ở prompt và mọi phase tại desktop/mobile: **40 ca**. Trong reacquire/settle, control đã bị xé đi; dùng Esc. Không fallback ngoài ý muốn; profile được mở tương tác và flag được lưu đúng.
- Hai ca chặn một ảnh bắt buộc trong document để giữ `load/mainReady` chưa xong: natural playback vẫn ở NO SIGNAL, skip vẫn chờ, profile inert và flag chưa có dù clock đã đến **16 giây mô phỏng**. Thả resource mới được tear/completion. Kiểm tra thêm lỗi `Opening.run`, reduced motion và WebGL unavailable.

Thời gian thật đo từ `pointerdown.event.timeStamp` đến MutationObserver thấy profile được mở tương tác, gồm cả cold sound unlock; không dùng clock giả cho bảng này. Context mới, HTTP cache tắt. Mỗi cấu hình một mẫu, không phải benchmark thống kê.

| Cấu hình | Click → profile tương tác |
| --- | ---: |
| Desktop 1440×900, local nhanh | **13.154 s** |
| Mobile/touch 390×844, local nhanh | **13.053 s** |
| Mobile Slow 4G, latency 400 ms, down 500 Kibit/s, up 256 Kibit/s, CPU ×4 | **13.147 s** |

[Timing log gọn](return-visit/timing/beat-log.json), [raw cues và visual events](return-visit/timing/results.json). Các mốc phase bên dưới tính từ sau connect bằng active clock; capture/thời gian tải thật có thể lùi reacquire và các mốc sau nó.

| Phase | Mục tiêu (s) | Desktop đo được (s) | Slow 4G đo được (s) |
| --- | ---: | ---: | ---: |
| calm | 0 | 0 | 0 |
| unease | 1.600 | 1.605 | 1.600 |
| alarm | 3.000 | 3.005 | 3.001 |
| panic / STOP | 4.600 | 4.605 | 4.601 |
| collapse | 6.400 | 6.406 | 6.401 |
| blackout | 7.500 | 7.513 | 7.507 |
| no-signal | 7.900 | 7.913 | 7.907 |
| reacquire | 11.000 | 11.025 | 11.075 |
| settle | 12.500 | 12.526 | 12.588 |
| complete | 13.000 | 13.032 | 13.082 |

## Tự review hình và âm thanh

Đã xem các sheet [1440](return-visit/timing/beats-1440.jpg), [768](return-visit/timing/beats-768.jpg), [390](return-visit/timing/beats-390.jpg) và [STOP → collapse](return-visit/timing/stop-contact-sheet.jpg). Ảnh từng beat và chuỗi frame cách nhau khoảng 16.7 ms ở 6.333–6.450 giây nằm trong cùng thư mục. STOP hiện ngay ở 4.600, judder/log không phải chờ tăng từ 0; phase giữ đến 6.400 rồi collapse bắt đầu ngay. Chuyển từ cuộn hình sang co đường ngang/chấm và màn đen vẫn liền mạch; bounce giữ đủ hơn 3 giây. Không tràn ngang ở cả ba viewport.

Review chỉ giới hạn component và motion theo brief, giữ nguyên art direction terminal hiện có; không draw lại thiết kế hay áp house rules làm đổi profile.

```text
ROUND 1
Seen in one second: profile terminal; replay nhỏ nằm giữa footer.
Idea (one sentence): phiên kết nối personal_file giữ lại trạng thái đã xem và cho phép phát lại có chủ đích.
Live thing: terminal commands và replay opening.
Layout words by section: profile=giữ nguyên / terminal-end=replay trong khoảng trống.
Scores: design 8 · usability 8 · creativity 8 · content 8 → overall 8.0 (phạm vi thay đổi).
Caps applied: không chấm lại toàn trang; yêu cầu bảo toàn thiết kế của chủ sở hữu.
Top three problems (most visible first), each with the screenshot it shows in and the fix:
1. Footer bị dịch khi thêm replay inline: chuyển nút ra khỏi flow; pixel diff còn đúng vùng nút.
2. Hit area dễ bị terminal clip: vùng 44px kéo lên phía trên, giữ đáy trong terminal; hit-test hai mép và tap thật đạt.
3. STOP/noise phải vào dứt khoát: judder bắt đầu ngay; phase/score cùng vào panic ở beat 4.6, frame kế tiếp đã có STOP.
```

[Audio preview WAV](return-visit/timing/audio-preview.wav) được render từ cue timeline thật bằng [renderer](return-visit/audio-preview.js); không nhân bản synthesis. Chế độ mặc định của renderer suy ra phase/tear burst từ `CONNECTION_BEATS` và `CONNECTION_TEAR`. PCM được đối chiếu với synthesis baseline tại cùng beats mới và cùng bộ lập lịch timestamp: max sai khác **2.67×10⁻⁶**, RMS **2.00×10⁻⁸**, trong sai số render native (repeat baseline cũng khác cỡ tương tự). Hai font có **0 channel khác biệt**. Audio/visual phase đi cùng frame; tear burst theo progress 0.16, trễ mục tiêu không quá một frame trong các mẫu. Không đổi âm sắc hay mix để đạt thời lượng.

Môi trường này không cung cấp nghe trực tiếp audio cho model; tự review âm thanh dựa trên PCM/cue alignment và bản preview đính kèm, không tuyên bố đã nghe bằng loa. Chưa kiểm tra thiết bị thật/Safari hoặc field timing; loading chậm hơn vẫn được phép kéo dài opening để profile sẵn sàng.

## Tái lập

Chạy server từ brief trong terminal riêng:

```powershell
python C:/Users/andan/.local/share/serve-portfolio.py 4191 D:/Projects/Web/andptri-site
```

Runtime có Playwright/pngjs đã cài sẵn; `../node_modules` của checkout hiện tại không tồn tại nên dùng dependency directory của runtime, không cài thêm package:

```powershell
$env:NODE_PATH='C:/Users/andan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'
$node='C:/Users/andan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
& $node docs/return-visit/verify.cjs
& $node docs/return-visit/timing.cjs
$env:PERF_PORT='4191'
$env:VERIFY_MEDIA_ONLY='1'
$env:VERIFY_OUT='../return-visit/media-verification.json'
& $node docs/perf/verify.cjs
```

`timing.cjs` tách real-time measurements khỏi các lượt controlled-clock dùng chụp ảnh/phase regression. Phần phase test cũ trong `docs/perf/verify.cjs` vẫn ghi timeline lịch sử; dùng `VERIFY_MEDIA_ONLY=1` cho kiểm tra font/audio hiện tại và suite return-visit cho timeline mới.
