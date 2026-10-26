# Edgerunners — bản dựng chuyển cảnh trên web

Chạy `python serve.py` trong thư mục này rồi mở http://127.0.0.1:4173/transition-lab/. Trên Windows có thể mở `start.cmd`. Không cần npm hay build. Cần trình duyệt hỗ trợ WebGL và Python để chạy máy chủ xem thử.

Nút **Phát**, thanh tua, tốc độ 0.25× / 0.5× / 1×, phím Space và ← → giúp kiểm tra từng nhịp. **Dùng ảnh / video của bạn** thay nền đầu vào; tệp được xử lý cục bộ. Ba nền mẫu được vẽ bằng Canvas. **So với nguồn** dùng bộ ảnh ở thư mục `../transition-frames`, không dùng chúng để phát bản dựng. Bản gói độc lập không kèm bộ ảnh nguồn sẽ tắt chức năng so sánh.

## Phần đã dựng

- Timeline 6.8676 giây, từ 12.832 đến trước 19.699633 trong bản ghi; dừng ở logo, không lẫn phần nhạc end.
- Biến dạng nền theo đường dịch chuyển từng hàng đo từ khung gốc; quét màu đỏ, xanh, vàng, magenta; rolling sync; static và vân màn hình.
- EDGE / RUNNERS và nền đường viền là SVG, không dùng font thay thế.
- Sáu tư thế chữ neon dạng vector. Hai hàng chuyển động theo các ma trận affine riêng; shader xử lý các lớp tín hiệu.
- Logo vector tổng hợp từ 22 khung đã căn chỉnh, chuyển động và hai thời điểm chạm cạnh được đo từ video.
- Phiên bản lai: toàn bộ hiệu ứng vẫn là bản dựng WebGL, SVG và Canvas, **trừ dải khung nguồn 20–80** dùng khung gốc đã xoá logo/giao diện (xem mục dưới).

## Khung gốc đã làm sạch (bản lai)

Dải nguồn **20–80**, 61 WebP 1920×1080, quality 88, tổng **15.05 MB**. Trong cấu hình entry 1.5 s: khung 20–36 được compositing trực tiếp ở entry slot theo `12.832 + progress*1.5`; main dùng khung 37–80 theo local time `(k−1)/24`. Một bộ `assets/source-neon/manifest.json` hỗ trợ nhiều `ranges`; không có biên bộ ảnh ở 36→37, 42→43 hay 72→73. Khung 1–19 và 81–165 vẫn dựng WebGL; exit luôn dựng để chuyển sang ảnh/video của người dùng.

Biên hybrid: 19→20 (local ≈0.79137 s trong entry), 80→81 (local 3.33333 s). Giữ nhịp 24fps, không nội suy thời gian, không chèn dissolve. Entry 19 vẫn là bản dựng nên biên đầu còn sai khác hình học/chi tiết; không khẳng định khớp từng pixel. Main tại cuối entry tiếp tục đúng khung 37.

- **Dùng khung gốc** bật/tắt toàn bộ dải 20–80. Khung nào thiếu hoặc decode lỗi thì riêng khung đó dùng reconstruction. Nếu toàn bộ bộ ảnh không có, ô bị khóa và dùng bản dựng. Nạp xong trước `window.ready`.
- Overlay AnimeVietsub, URL/subtitle, find bar và watermark đã được xoá bằng static mask + exemplar inpainting. Vùng bị che được điền bằng suy luận; có thể còn vết lặp/nhòe cục bộ, không có chi tiết thật nằm dưới overlay. PNG sạch nằm trong `work/hybrid/clean/20.png` … `80.png`.
- **Tín hiệu TV** không tác động lên các khung gốc; nhiễu đã có trong ảnh.
- `source-neon.js` và `edgerunners-player.js` giữ API `useSourceNeon` để tương thích.

## Màu tear và flicker logo

Cả hai slot dùng chi tiết ảnh incoming dưới plate, smear ngang khoảng 22px cùng vệt dài tối đa ±240px, rồi ánh xạ luminance sang palette từng vùng. Entry 13–19 dùng `tint=0`, giữ hue xanh lam→magenta và xanh lục→cyan từ hình học đã đo. Exit dùng `tint=1`, palette lấy từ cảnh kế tiếp. Source palette giữ tương phản chữ mờ hơn tint cảnh sau. Các khe phân loại bên trong envelope plate trên từng scanline được lấp theo class gần nhất; cạnh ngoài có soft edge. Vùng ngoài envelope vẫn là cảnh outgoing theo timing cũ.

`effect.js` chứa `BOUNCE_BRIGHTNESS`: bảng RGB theo 8 dải ngang cho khung 81–110, giữ giá trị từng khung 24fps để tái hiện flicker, nội suy theo chiều dọc để tránh đường nối dải. Offset cuối giảm về 0 ở 116. Bảng chỉ hoạt động khi bật tín hiệu TV. Hình học, vận tốc logo và extrapolation trong exit vẫn giữ nguyên.

Báo cáo số đo, motion audit và montage mới: `work/codex-task/`; ảnh montage cũng nằm ở `analysis/codex-*.jpg`. Video preview cũ bên ngoài thư mục này chưa được xuất lại.

## Mức độ khớp

Đây là bản tái dựng chạy được, **chưa phải bản sao chính xác từng pixel**. Với hybrid bật, sai khác rõ còn ở entry 1–19, đặc biệt 17–19 (hình học vùng màu, sync noise và chi tiết cảnh outgoing), texture inpaint, hạt nhiễu và hình/biên logo dựng. Khi tắt hybrid, bản dựng vector vẫn có khác biệt phối cảnh glyph và wire-line motion trong 20–80. Hình học bị giao diện trình duyệt che trong bản ghi được khôi phục bằng suy luận.

Bản ghi chỉ có khoảng 24 khung thực mỗi giây ở đoạn nhanh. Đã giải mã đủ khung bản ghi, không dùng chèn khung giả để tuyên bố có thêm chi tiết. Phần phân tích, số đo và giới hạn nằm trong `analysis/` và các ghi chú ở `assets/`.

## Tách module và cấu hình chuỗi cảnh

Hiệu ứng xé hình và chuỗi cảnh được tách thành các module tái sử dụng:
- `signal-transition.js`: Shader WebGL chuyển cảnh xé hình (`SignalTransition`), độc lập với nội dung cảnh; hỗ trợ biến dạng quét, nhiễu TV và nhuộm màu palette (`tint`).
- `sequence.js`: Quản lý timeline (`SceneSequence`, `createSequenceLayout`), tổ chức hai slot chuyển cảnh và điều phối các cảnh theo thời gian.
- `scenes.js`: Chứa các cảnh nền Canvas độc lập (`BackgroundScene`, `drawPreset`).
- `edgerunners-player.js`: Bộ phát tích hợp hiệu ứng chữ/logo Edgerunners (`TransitionEffect`) vào chuỗi cảnh `SceneSequence`.
- `sequence-config.js`: Nơi duy nhất cấu hình hai slot chuyển cảnh (`entry` ở đầu và `exit` ở cuối).

### Cấu hình hai slot trong `sequence-config.js`

```js
export const sequenceConfig = {
  entry: { enabled: true, duration: 1.5, strength: 1, seed: 0, direction: 1 },
  exit:  { enabled: true, duration: 1.5, strength: 1, seed: 1, direction: -1, tint: 1 },
  tailHold: .35,
};
```

Cách tùy chỉnh từng thuộc tính:
- `enabled`: Bật (`true`) hoặc tắt (`false`) slot chuyển cảnh.
- `duration`: Thời lượng xé hình tính bằng giây (số dương; `entry` không vượt quá thời lượng cảnh chính).
- `strength`: Biên độ nhiễu sóng và dịch chuyển hàng (mặc định `1`, không âm).
- `seed`: Giá trị hạt giống ngẫu nhiên tạo biến thể nhiễu (số hữu hạn).
- `direction`: Hướng trượt xé hình (`1`: quét từ trái qua phải, `-1`: từ phải qua trái).
- `tint`: Mức độ hòa sắc theo màu trung bình của cảnh đích (`0`: giữ màu gốc, `1`: nhuộm toàn bộ).
- `from` / `to`: Tên định danh cảnh xuất phát và cảnh đích đăng ký trong chuỗi (`before`, `main`, `after`).
- `tailHold`: Thời gian dừng giữ cảnh sau (tính bằng giây) trước khi kết thúc chuỗi hoặc lặp lại.

## Đưa vào portfolio

Sao chép `effect.js`, `takeover.js`, và các tài nguyên được nạp trong `assets/`. Module không phụ thuộc framework. Dùng trong React/Vue hay JavaScript thường đều được:

```js
import { TransitionEffect, DURATION } from './effect.js';
const effect = new TransitionEffect(canvas, { assetRoot: './assets/' });
await effect.ready;
effect.setBackground(imageElement); // ảnh, video hoặc canvas khác
const start = performance.now();
function tick(now) {
  const t = (now - start) / 1000; // có thể vượt DURATION: logo vẫn tiếp tục nảy (phản xạ suy luận) sau khung nguồn 165
  effect.render(t);
  if (t < DURATION) requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
// Khi tháo component: effect.destroy();
```

Nền luôn được cover vào bố cục 16:9 để giữ hình chữ đúng tỷ lệ. Với nội dung DOM, cần cung cấp ảnh/canvas của nội dung làm texture; module không tự chụp DOM. Ảnh/video từ URL bên ngoài cần quyền CORS phù hợp. File chọn từ máy không cần tải lên mạng.

`render(t)` xác định hoàn toàn bởi thời gian đối với nền tĩnh, nên có thể nối với timeline/scroll của portfolio. Màu nền kết thúc và vị trí logo nằm trong `lastScene()`; các mốc quét màu ở `takeover.js`. `signal=false` giúp xem hình chữ không có lớp nhiễu TV.

## Kiểm tra

Đã chạy trong Chrome thật: tải tài nguyên, compile shader, tua ngược/tiến cho cùng ảnh, đổi nền, upload ảnh, so với khung nguồn và màn hình 390px. Kết quả đo hiệu năng cục bộ nằm trong `analysis/browser-checks.json`; đây không phải bảo đảm FPS cho mọi thiết bị. Không phát âm thanh.

Video `../transition-preview.mp4` là bản xuất từ renderer WebGL ở 1280×720, 60fps để xem nhanh. Video này không được dùng làm nền hay phát trong hiệu ứng.

## Mảng màu xé hình (takeover) dạng vector

`assets/takeover-plates.json` thay cho atlas PNG: hình học dải hàng (90 dải, tối đa 5 đoạn [x0,x1] mỗi lớp màu đỏ/vàng/lục/tím, kèm độ sáng và sắc độ) cho 33 khung nguồn đầu, nội suy cạnh giữa các khung. Tạo bằng `work/sonnet/fit_plates.py`; nếu không nạp được thì shader quay về bản viết tay trong `takeover.js`.


Tái dựng phi lợi nhuận phục vụ học tập. Cyberpunk: Edgerunners © CD PROJEKT RED / Studio Trigger. Một số khung hình gốc được dùng ở đoạn giữa.
