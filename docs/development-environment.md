# Biến môi trường desktop

`deno task dev` và `deno task start` chạy Electron Forge. Hook `preStart` nạp toàn bộ biến từ
`.env.local` trong thư mục gốc của đúng app, trước các hook Vite và trước khi spawn Electron.
Main process kế thừa các biến này qua `process.env`.

- Biến đã có trong shell/CI được ưu tiên, kể cả chuỗi rỗng.
- Không có `.env.local` vẫn chạy bình thường với môi trường shell/CI.
- File không đọc được sẽ báo lỗi chung; không log nội dung hay giá trị.
- Parser Node không mở rộng `$VARIABLE`; API key chứa `$` giữ nguyên.
- Thay đổi env cần tắt hẳn Forge rồi chạy lại, không chỉ reload renderer.

Khai báo biến private như `CURSEFORGE_API_KEY` không có tiền tố `VITE_`.
Vite chỉ công khai biến có tiền tố `VITE_` trong renderer; việc nạp file này không thêm
`define: process.env` hoặc bridge chuyển toàn bộ env sang giao diện.
Module ứng dụng vẫn đọc các biến qua `utils/environment.ts`.

Đây là cơ chế cho phát triển. Không copy, commit hay đóng gói `.env.local` vào DMG/EXE.
Ứng dụng đã cài đặt không tự đọc file env của repo. Môi trường runtime của bản cài đặt
phải được cấp riêng; bí mật phân phối cho mọi người không thể giữ kín bằng cách nhúng
vào bundle Electron.

Kiểm thử dùng file env giả trong thư mục tạm và profile Electron riêng, không dùng file env
hoặc profile thật. Không gọi CurseForge bằng key thật trong kiểm thử.

## Deno và dependency renderer

Deno cài dependency theo cây cô lập trong `node_modules/.deno`. Cấu hình renderer
phải đặt `resolve.preserveSymlinks: false` để ghi đè mặc định `true` của plugin Vite
trong Forge; nếu không, CSS và các import gián tiếp của Primitive không resolve được.
React và React DOM dùng `dedupe` để component trong thư viện và app dùng chung runtime.
Cache Vite nằm ở `.vite/cache`.

Các component portal tùy biến import trực tiếp `@base-ui/react/alert-dialog` và
`@base-ui/react/tooltip`, vì vậy app khai báo Base UI là dependency trực tiếp.
Tương tự, cấu hình Forge khai báo `@electron-forge/shared-types` là dev dependency.
Không dựa vào dependency được hoist từ package khác.

Kiểm tra renderer dev/production trong Electron thật, với profile tạm, và API Nitro:

```sh
deno task test --configLoader runner tests/vitest/deno-runtime.test.ts tests/vitest/desktop-routes.test.ts
```
