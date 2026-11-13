# Backend desktop dùng Nitro

Backend HTTP đã chuyển từ Hono sang Nitro 3. Renderer vẫn là React + Vite, main/preload vẫn được Electron Forge và plugin Vite build; không thêm TanStack Start hay SSR.

## Endpoint giữ nguyên

| URL                     | Trách nhiệm                                                  |
| ----------------------- | ------------------------------------------------------------ |
| GET/HEAD /health        | Kiểm tra server                                              |
| GET/HEAD /auth/callback | Nhận callback qua registry trong main                        |
| GET/HEAD /user/profile  | Profile cache, yêu cầu capability và identity đang hoạt động |
| GET/HEAD /              | Redirect /public/index.html trong production                 |
| GET/HEAD /public/*      | Tài nguyên renderer production                               |
| GET/HEAD /assets/*      | JS/CSS/assets production                                     |

Middleware dùng chung nằm trong middlewares/http.ts, đăng ký tường minh qua handlers trong nitro.config.ts; middlewares/desktop.ts giữ factory bảo vệ route profile. Không có thư mục middleware/ riêng.

Các handler nằm trong routes/ theo filesystem routing Nitro. Có handler HEAD tường minh để giữ hành vi của bản Hono cũ với phiên bản Nitro đang cài. Không thêm /api.

## Runtime và build

- nitro.config.ts dùng preset node-middleware và entry không tự mở listener.
- Plugin nhỏ trong rollup.config.ts biên dịch Nitro trước main, tự chạy khi pnpm dev, pnpm package hoặc các lệnh make hiện có. File backend được theo dõi để build lại khi đổi source.
- Output backend nằm trong .vite/server; Forge đã đóng gói .vite nên không cần server hay tiến trình riêng. .nitro là cache build, không được đưa vào artifact.
- Main nạp handler ESM tại app.getAppPath()/.vite/server/index.mjs và truyền context nội bộ cho từng request.
- Capability, identity, profile database và callback registry vẫn do main sở hữu. Nitro không tạo bản sao vault/session hay đọc credentials từ renderer.
- Dev giữ Vite trên cổng public và proxy domain endpoint qua Unix socket hoặc Windows named pipe. Production giữ HTTP loopback và đường dẫn renderer cũ.
- IPC dành cho chức năng hệ điều hành, Java/Minecraft và cửa sổ không đổi.

## Kiểm soát HTTP

Giữ kiểm tra Host/Origin, capability so sánh timing-safe, giới hạn body 1 MiB, no-store, no-referrer, nosniff và lỗi 500 không lộ chi tiết. Renderer không nhận capability qua profile bridge. Static file dùng serveStatic của Nitro/H3 và giới hạn trong thư mục renderer.

Route /auth/callback được giữ theo contract cũ; luồng Better Auth Electron hiện tại vẫn nhận deep link trong main. Không thay đổi client ID, scheme, PKCE, endpoint SSO hay vault.

## Kiểm tra

- Vitest: tests/desktop-server.test.ts và tests/vitest/desktop-routes.test.ts kiểm tra backend đã biên dịch, cache/profile database, Host/Origin/capability, callback dùng một lần, HEAD và giới hạn body.
- pnpm test:server:native chạy Electron thật với userData tạm, kiểm tra HTML/assets, API, sandboxed preload bridge, profile khi logout, Vite proxy và callback replay.
- tests/vitest/dev-startup.test.ts kiểm tra Electron startup và socket trong fixture riêng.
- tests/vitest/nitro-packaged.test.ts nạp backend và renderer từ app.asar của Forge bằng Electron thật. Mặc định dùng artifact trong out/; có thể đặt GORTH_TEST_PACKAGE_ASAR tới app.asar cần kiểm tra.
- Đã chạy Forge package macOS x64 thành công cho cả hai app và chạy test ASAR tương ứng. Lượt này không tạo DMG, EXE/MSI hay gói Linux.
- Native test không tự cài Electron. Có thể đặt ELECTRON_OVERRIDE_DIST_PATH tới distribution cùng phiên bản đã giải nén; nếu thiếu binary thì kiểm tra phải báo lỗi.

Không chỉnh lockfile hoặc cài lại dependencies trong migration này. Hono có thể còn là dependency bắc cầu của package khác; source backend ứng dụng không import Hono.

## Giới hạn của lượt kiểm tra

Test quy tắc UI `shared-packages.test.ts` hiện không đồng ý với các import `@gorth/primitive/default/button` có sẵn trong giao diện. Đây không phải lỗi HTTP/Nitro; migration không thay đổi các component UI đó.
