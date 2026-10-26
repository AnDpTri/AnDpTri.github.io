# Profile experience — cold load

Ngày kiểm tra: 26/10/2026. Baseline: `e268e3b`. Commit cục bộ, không push. Giữ nguyên thiết kế, câu chữ, nội dung, font, màu, bố cục và hình ảnh mặc định. Không service worker, không cache asset tự tạo; localStorage vẫn chỉ lưu lựa chọn âm thanh.

## Cách đo và kết quả

Chrome 155.0.8059.85, Playwright `channel: 'chrome'`, server no-store theo brief. Context mới, HTTP cache tắt, CPU ×4 trên Fast/Slow 4G. Desktop 1440×900: median 3 run/network; mobile/touch 390×844: 1 run/network. [Lệnh tái lập và định nghĩa chỉ số](perf-profile/README.md), [raw baseline](perf-profile/baseline/), [raw after](perf-profile/after/), [summary](perf-profile/summary.json).

Mỗi ô là **trước → sau**. D = desktop (3 run), M = mobile (1 run); cả hai đều CPU ×4.

| Chỉ số | D / Fast 4G | D / Slow 4G | M / Fast 4G | M / Slow 4G |
| --- | ---: | ---: | ---: | ---: |
| INP-like: median của interaction chậm nhất mỗi run (ms) | 160 → 40 | 160 → 32 | 264 → 48 | 344 → 40 |
| INP-like: lớn nhất mọi mẫu (ms) | 168 → 40 | 176 → 32 | 264 → 48 | 344 → 40 |
| Long tasks >50 ms trong các cửa sổ tương tác | 1 → 1 | 1 → 1 | 3 → 1 | 2 → 1 |
| Tổng long-task time trong tương tác (ms) | 140 → 103 | 141 → 101 | 364 → 138 | 507 → 83 |
| Idle main-thread work / 8 s (ms) | 81.56 → 77.16 | 82.02 → 68.44 | 60.55 → 77.56 | 79.94 → 93.57 |
| Idle main-thread (% thời gian đo) | 1.02 → 0.96 | 1.03 → 0.86 | 0.76 → 0.97 | 1.00 → 1.17 |
| Idle JS / 8 s (ms) | 7.01 → 9.95 | 7.46 → 7.96 | 3.88 → 7.03 | 5.32 → 9.01 |
| CLS tại hand-over (±500 ms) | 0.00003745 → 0 | 0.00003745 → 0 | 0.00003576 → 0 | 0.00003576 → 0 |
| CLS toàn opening + profile | 0.14014 → 0.14108 | 0.13093 → 0.13002 | 0.22732 → 0.22702 | 0.22205 → 0.22489 |

Chi tiết **max Event Timing** của từng loại thao tác trong mọi mẫu, đơn vị ms; không giấu outlier bằng median. `open` là max của đủ 9 lệnh; mute gồm cả cold unlock và lần tắt lại.

| Thao tác | D / Fast 4G | D / Slow 4G | M / Fast 4G | M / Slow 4G |
| --- | ---: | ---: | ---: | ---: |
| Gõ prompt | 24 → 24 | 32 → 32 | 40 → 40 | 32 → 32 |
| help | 48 → 32 | 32 → 32 | 24 → 24 | 24 → 32 |
| projects | 24 → 16 | 24 → 24 | 16 → 16 | 24 → 24 |
| projects --all | 32 → 24 | 32 → 32 | 40 → 48 | 32 → 40 |
| open 1…9 | 88 → 40 | 80 → 32 | 88 → 40 | 56 → 40 |
| contact | 56 → 32 | 40 → 24 | 24 → 48 | 24 → 24 |
| clear | 32 → 16 | 24 → 24 | 16 → 16 | 24 → 16 |
| mute | 168 → 32 | 176 → 24 | 264 → 32 | 208 → 32 |
| logout | 32 → 40 | 48 → 32 | 32 → 24 | 24 → 16 |
| sudo | 32 → 24 | 32 → 24 | 16 → 16 | 16 → 16 |
| hack | 24 → 16 | 24 → 32 | 16 → 16 | 24 → 16 |
| thepeak | 112 → 24 | 88 → 24 | 72 → 32 | 344 → 24 |
| Unknown command | 32 → 24 | 24 → 24 | 24 → 24 | 24 → 16 |
| --all button | 40 → 32 | 32 → 32 | 32 → 32 | 32 → 32 |
| Hover 5 project rows, max paint proxy (không phải INP) | 12.5 → 7.9 | 10.9 → 8.9 | 8.4 → 9.2 | 8.3 → 7.9 |

[Đo trực tiếp bốn chip](perf-profile/chips.json) ở Fast 4G/CPU ×4: desktop help/projects/contact/logout **40/32/48/24 → 32/32/16/24 ms**; mobile touch **48/32/64/48 → 56/32/48/32 ms**. Mọi tương tác được đo của bản cuối đều <100 ms. Một số thao tác nhỏ không nhanh hơn; đổi 8–24 ms giữa các frame không được xem là cải thiện có ý nghĩa trên mọi máy. Idle mobile và idle JS tăng nhẹ; không tuyên bố tiết kiệm CPU đồng đều. JS idle sau cùng khoảng **0.09–0.12%** thời gian đo, main-thread tổng khoảng **0.86–1.17%** ở CPU ×4; khi hidden không còn repeating JS timer của profile.

INP-like dùng Event Timing có interactionId, không phải field INP. Hover dùng proxy tới paint kế tiếp vì pointer hover không phải INP interaction. Long tasks vẫn gồm chi phí tạo AudioContext sau feedback; chuyển việc đó sau paint không có nghĩa CPU của nó biến mất. Idle đo main thread bằng CDP trong 8 giây, sound off, không phải phần trăm CPU/GPU toàn hệ thống. Không tuyên bố tất cả tài nguyên hay mọi loại bộ nhớ đều giảm.

CLS của **hand-over** tách khỏi CLS toàn opening: narrative gốc có thay đổi kích thước/vị trí text ở alarm/panic. Không sửa narrative để ép tổng CLS về 0. Fonts đã loaded khi profile được tiết lộ; không render lại profile, mount lại nội dung hay tải font ở hand-over.

## Thay đổi được giữ

- Phản hồi terminal được paint trước khi tạo tab mới và trước lần unlock âm thanh lạnh đầu tiên. Giữ đúng URL, noopener/noreferrer, lời đáp và âm thanh. Kiểm tra đủ 9 lệnh `open N` bằng popup thật; không tải lab/repository trong phép đo.
- Warm một glyph `🏔️` vốn có của easter egg trong canvas 32×32 rồi bỏ, khi font/load đã xong và trước snapshot ready. Không thêm asset hay cache. Thử nghiệm trước warmup ghi `thepeak` 616 ms trên mobile Fast 4G, 112 ms ở một run desktop; [dữ liệu thử](perf-profile/experiments.json). Công việc được chuyển sang lúc opening chuẩn bị, không đổi chữ hay thời lượng narrative.
- Dừng clock, ambient tear và scramble khi tab ẩn, pagehide hoặc đang mở intro; giữ nhịp tear 23 giây gốc khi active, bỏ các tick đã lỡ lúc ẩn. Dừng cursor blink khi prompt ngoài viewport. Clock/uptime vẫn cập nhật 1 Hz khi profile visible, cập nhật ngay khi trở lại. Không có vòng rAF nền liên tục sau opening.
- Low-power khi hardwareConcurrency ≤4, deviceMemory ≤4 hoặc reduced motion: pause blink và bỏ ambient tear định kỳ. Nội dung, hiệu ứng hover ở máy thường, sound và terminal commands giữ nguyên. Reduced motion vẫn dùng đường opening có sẵn và tắt scramble; thay đổi preference trong lúc trang đang mở được áp dụng ngay.
- Bù độ rộng skip trong flex spacing của HUD khi intro đang chạy, giữ nguyên vị trí và raster nhìn thấy. HUD không còn dịch ngang khi skip bị xé đi. Hand-over focus vào heading tên bằng preventScroll để tránh tự mở keyboard hoặc kéo trang xuống prompt. Skip link bàn phím tới main có focus thật và outline nhìn thấy.
- Vùng chạm mobile ≥44 CSS px bằng padding trong suốt/pseudo-element và negative margins; giữ nguyên border/chữ/khoảng cách mặc định của chip. Tăng vùng input theo cùng cách; không đổi font 13px vì thử font 16px làm đổi raster. Link output khi chạy command có vùng chạm 44px. Có feedback khi touch chip.
- visualViewport resize/scroll giữ prompt trên keyboard và HUD, thêm khoảng cuộn chỉ khi prompt focus và keyboard thu viewport; không can thiệp pinch zoom lúc đọc. Nhánh iOS tạm đặt maximum-scale=1 lúc input focus, trả viewport gốc khi blur; iOS cho phép pinch zoom của người dùng. Chrome mô phỏng kiểm tra nhánh này, chưa chứng minh trên Safari/điện thoại thật.
- Thêm Esc xóa draft, giữ Enter và ↑/↓; không can thiệp phím lịch sử khi IME composition đang hoạt động. Giữ live log polite và accessible names của prompt/chips. Giới hạn typed history 100 mục; output vẫn giới hạn 30 mục. Chặn logout lặp trong khoảng chờ 340 ms để không xếp nhiều replay.

## Hình ảnh, kiểm tra và retention

**8/8 ảnh trùng tuyệt đối, 0 pixel RGB khác biệt**, bao gồm hai ảnh boot để kiểm tra skip/sound controls ngoài phạm vi yêu cầu profile. [Kết quả từng ảnh](perf-profile/summary.json). Profile đã có font, scrollY=0 và focus vào name khi hand-over; không console error hay fallback trong timing runs.

[46 kiểm tra profile](perf-profile/verification.json), [7 kiểm tra lifecycle](perf-profile/lifecycle.json), [chip timing](perf-profile/chips.json) và [45 regression opening/font/audio](perf-profile/opening-regressions.json) đều đạt. Skip button/Esc ở mọi phase, controls bị xé đi đúng lúc, natural/reduced completion, replay, sound mute/visibility, mỗi font một request/document, không tải lab ngoài signal-map, không rAF production chạy mãi sau opening. Test touch phát hiện `:active` không được bật lúc touchStart trên Chrome; feedback được bổ sung bằng pointer state, giữ thêm 120 ms sau tap, dọn khi cancel/ẩn trang.

Retention được đo riêng, sau GC, không dùng cùng lượt timing. Mẫu 0 đã warm sound on/off; sau đó 5 replay qua chip logout, sound off:

| Chỉ số | Trước | Sau |
| --- | ---: | ---: |
| JS heap sau replay 5 (B / MiB) | 2,515,416 / 2.399 | 2,543,488 / 2.426 |
| DOM node qua replay 1 → 5 | 426 / 426 / 426 / 426 / 426 | 479 / 479 / 479 / 479 / 479 |
| JS listener qua replay 1 → 5 | 48 / 48 / 48 / 48 / 48 | 58 / 58 / 58 / 58 / 58 |
| AudioContext được tạo qua toàn bộ test | 1 | 1 |
| Voice còn giữ ở mỗi mẫu | 0 | 0 |
| Heap tăng từ replay 4 → 5 | 1,120 B | 924 B |

Heap sau tăng khoảng 28 KB so baseline; không phải tối ưu giảm heap. Có chi phí cố định của UI/listener/warmup mới; số document/node/listener ổn định từ replay 1, không tăng theo replay. Heap còn warm-up/JIT và cue timeline có giới hạn 600 mục, nên không yêu cầu byte count giống hệt; 5 lượt không chứng minh được mọi leak dài hạn, và CDP heap không bao trùm VRAM/native audio/font memory.

Wheel trace mobile CPU ×4, 18 bước: main-thread **337.9 →349.7 ms**, Paint **45.6 →51.2 ms**, layout **39.2 →50.1 ms**. Không đo được cải thiện scroll; đây là một trace có biến thiên frame/clock/observer, không kết luận GPU nhanh hơn. Giữ overlay raster gốc thay vì quảng bá promotion như một tối ưu đã thành công.

Đã nhìn trực tiếp screenshot desktop/mobile, sửa outline không mong muốn ở heading, căn lại chữ chip và khóa cùng blink state cho phép so. [Ảnh trước](perf-profile/baseline/frames/) / [ảnh sau](perf-profile/after/frames/) bao gồm boot, profile, shell, archive; không chỉ so phần trên trang. Layout mặc định, dấu cắt góc, typography, CRT/grain/vignette giữ nguyên.

Thử promotion `will-change: transform` cho hai overlay gây rounding 1/255 trên nhiều pixel và không giúp scroll Paint trong trace (48.7 →59.9 ms ở trial). Đã bỏ; không thay tile/grain/shadow để đổi look. [Lifecycle trace summary](perf-profile/lifecycle.json) ghi cả số cuối; không coi một lần wheel scroll là benchmark GPU đầy đủ.

Headless Chrome không chuyển document.hidden khi mở tab thứ hai, vì vậy test visibility là mô phỏng có chủ đích và kiểm tra timer/audio state, không tuyên bố đã đo tab switch thật. Chrome từ chối BFCache vì `MainResourceHasCacheControlNoStore`, `JsNetworkRequestReceivedCacheControlNoStoreResource`, `BrowsingInstanceNotSwapped`; giữ nguyên server theo brief. Đã thử back/forward reload + skip recovery và dispatch persisted pagehide/pageshow để kiểm tra handler; **native BFCache restore chưa xác minh** trong môi trường này. Chưa kiểm tra với screen reader/keyboard OS trên điện thoại thật, GPU/browser khác hay mức tiêu thụ pin.

## Tương phản và những gì giữ nguyên

[Tỉ lệ trên màu CSS](perf-profile/contrast.json), trước composite CRT: ink/background **16.36:1**, muted **7.70:1**, placeholder **5.16:1**, HUD **8.91:1**. Prefix command `#737373` trên `#101010` chỉ **4.01:1**, thấp hơn 4.5:1 cho chữ nhỏ; báo lại và giữ nguyên màu theo hard rule. Không tuyên bố kiểm tra contrast của mọi pixel scanline bằng screen reader hay công cụ accessibility chuyên dụng.

Giữ nguyên hai overlay toàn màn hình, SVG noise, vignette inset shadow, shader, toàn bộ `eyecatch/`, opening.js, audio graph/MIX, nhạc/cue, font/glyph assets, wording và profile layout. Không đổi shader resolution hay tốc độ narrative. Clock visible và nhạc đang bật vẫn có chi phí thật; không tắt nội dung để làm idle đẹp hơn. Không minify, obfuscate hay thêm dependency runtime. Các thay đổi UI chỉ xuất hiện khi focus/touch/keyboard, low-power hoặc reduced-motion được kích hoạt.
