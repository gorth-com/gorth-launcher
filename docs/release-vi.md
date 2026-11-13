# Phát hành Gorth Launcher bằng GitHub Releases

## Các lệnh build riêng

```sh
deno task build:mac:intel
deno task build:mac:arm
deno task build:windows:exe
deno task build:windows:msi
deno task build:linux:deb
deno task build:linux:rpm
```

Chạy trên hệ điều hành tương ứng; Windows/Linux mặc định x64.
Hai lệnh Windows cùng dùng maker Squirrel đã cấu hình, tạo cả EXE và MSI.
Không thay `--targets=squirrel/deb/rpm` bằng tên package: Forge sẽ bỏ qua
maker instance đang cấu hình, mất tuỳ chọn MSI/tên file/tên gói.
Đầu ra nằm trong `out/make`; các lệnh trên không tự publish GitHub Release.

Packager dùng thư mục tạm riêng cho app và PID vì Packager xoá temp root
khi bắt đầu. Hai repo có thể build độc lập nhưng không chạy nhiều build cùng
lúc trong **một repo**, vì chúng vẫn dùng chung `.vite` và `out`.

Nếu DMG báo thiếu `macos-alias/build/Release/volume.node`, dependency native của
công cụ tạo DMG chưa được build. Cho phép lifecycle script của đúng dependency:

```sh
deno install --frozen-lockfile --allow-scripts=npm:macos-alias,npm:fs-xattr
```

Workflow cho phép tường minh các lifecycle script của Electron, better-sqlite3,
electron-winstaller, esbuild, fs-xattr, fsevents, macos-alias và unrs-resolver.
Deno không đọc allowlist kiểu pnpm trong package.json. Không rebuild addon của maker
bằng Electron ABI. Cần Xcode Command Line Tools và Python cho bước compile này.

Không thể xác minh bộ cài Windows/Linux chỉ bằng build trên macOS:
dùng các runner native trong workflow release hiện có. DEB cần `dpkg`;
RPM cần `rpmbuild`. App có native addon nên cross-build còn cần toolchain
cho đúng hệ điều hành và kiến trúc.

## Trạng thái và phạm vi

Đã cấu hình Electron Forge và GitHub Actions, chưa có nghĩa là đã tạo release công khai.
Workflow cần được commit/push vào repo `gorth-io/gorth-launcher`, cài dependency mới và chạy thành công.
GitHub CLI đã xác thực thành công khi kiểm tra ngoài sandbox. Nếu công cụ báo token không hợp lệ trong sandbox,
cần kiểm tra lại quyền truy cập mạng/keychain trước khi kết luận token bị hỏng.

Không đưa GitHub token, chứng chỉ ký hay mật khẩu Apple vào renderer, website env hoặc source.
Không thay đổi phiên bản ứng dụng qua env: phiên bản lấy từ `package.json`.

## File được tạo

| Nền tảng                  | Asset tải trực tiếp                  |
| ------------------------- | ------------------------------------ |
| macOS Intel x64           | `gorth-launcher-darwin-x64.dmg`      |
| macOS Apple Silicon arm64 | `gorth-launcher-darwin-arm64.dmg`    |
| Windows x64               | `gorth-launcher-win32-x64-setup.exe` |
| Windows x64               | `gorth-launcher-win32-x64-setup.msi` |
| Linux Debian/Ubuntu x64   | `gorth-launcher-linux-x64.deb`       |
| Linux RPM x64             | `gorth-launcher-linux-x64.rpm`       |

Giữ thêm ZIP cho từng kiến trúc macOS, `RELEASES` và `*-full.nupkg` Windows để updater hoạt động.
MSI dùng bộ tạo Squirrel hiện có (`noMsi: false`): đây là bootstrapper Squirrel, không phải WiX MSI enterprise độc lập.
Chọn EXE **hoặc** MSI, không cài cả hai. Cần kiểm tra đăng ký protocol/login và gỡ cài đặt trên máy Windows sạch cho cả hai lựa chọn.
Linux dùng trình quản lý gói; không có tự cập nhật Electron trên Linux.

Tên asset cố định **trong mỗi tag**, không đổi tên package NUPKG vì manifest tham chiếu chính xác tên đó.
Bản gốc trong `out/make` không bị đổi hoặc xoá. Script stage vào `out/release/<platform>-<arch>` và tạo SHA-256.

## 1. Chuẩn bị dependency và repo

Repo phải public nếu muốn mọi người tải không cần đăng nhập. Không tự chuyển public source nếu chưa được phép.
Nếu muốn source private và binary public, cần cấu hình repo phát hành public riêng và cập nhật đồng bộ updater/URL trước.

Dependency mới đã khai báo trong `package.json`: `@electron-forge/maker-dmg@^8.0.1`.
Trong **mỗi** repo desktop, dùng Deno và commit `deno.lock` tương ứng:

```sh
deno install
deno task test tests/vitest/release-artifacts.test.ts tests/vitest/environment.test.ts
deno run -A node_modules/typescript/bin/tsc --noEmit --incremental false
```

Kiểm tra diff lockfile rồi commit cùng package.json, Forge config, scripts, workflow và tests.
Workflow dùng `deno install --frozen-lockfile`; nếu chưa cập nhật lockfile, CI sẽ dừng đúng tại bước này.
Không commit .env.local, .env.production hay chứng chỉ. Không commit toàn bộ worktree nếu đang có thay đổi không liên quan.

GitHub → Settings → Actions: bật workflow. Job build có quyền read, chỉ job upload có `contents: write`.
Nếu vẫn còn dependency GitHub private, tạo Actions secret `DESKTOP_DEPENDENCIES_TOKEN`: token read-only cho đúng các repo dependency; không dùng token ghi release cho việc này.

## 2. Ký và notarize macOS

Mặc định `GORTH_SIGN_RELEASE=0`: build phục vụ thử nghiệm, có thể bị Gatekeeper chặn; **không coi là bản phát hành tin cậy hoặc auto-update đã xác minh**.
Để phân phối thông thường, dùng Apple Developer ID Application và notarization.

Trong GitHub repo, thêm Actions **variable**:

```txt
GORTH_SIGN_RELEASE=1
```

Thêm Actions **secrets**:

- `MACOS_CERTIFICATE_P12_BASE64`: chứng chỉ Developer ID Application export P12 rồi base64.
- `MACOS_CERTIFICATE_PASSWORD`: mật khẩu file P12.
- `APPLE_ID`: Apple ID của tài khoản developer.
- `APPLE_TEAM_ID`: Team ID.
- `APPLE_APP_SPECIFIC_PASSWORD`: mật khẩu ứng dụng Apple để notarize.

Workflow tạo keychain tạm, import chứng chỉ, tạo profile `gorth-release`, ký/notarize .app bằng cấu hình có sẵn rồi dọn credential tạm.
DMG chứa .app đã ký/notarize; workflow không cấu hình chữ ký riêng cho disk image.
Kiểm tra bằng `codesign --verify --deep --strict`, `spctl --assess --type execute` với .app sau khi kéo vào Applications.

Windows hiện **chưa có Authenticode signing** trong workflow; SmartScreen có thể cảnh báo.
Không hướng dẫn người tải tắt Gatekeeper/SmartScreen. Thiết lập chứng chỉ ký Windows là bước phát hành riêng.

## 3. Tạo tag và build

Version hiện tại là `0.0.0-alpha.1`. Tag tương ứng là `v0.0.0-alpha.1`.
Các bản sau phải tăng `package.json.version` trước, rồi commit và tag đúng phiên bản.

Sau khi kiểm tra/commit các thay đổi liên quan:

```sh
git tag v0.0.0-alpha.1
git push origin HEAD
git push origin v0.0.0-alpha.1
```

Không tái sử dụng tag đã phát hành để thay binary. Push tag khởi động bốn build native:
macOS Intel, macOS arm64, Windows x64, Linux x64. Không cross-compile native addon từ một máy Mac cho cả hệ điều hành khác.

Mỗi build: kiểm tra tag/arch → frozen install → typecheck/tests → Forge make → kiểm tra đủ asset → checksum → Actions artifact.
Job release chỉ chạy khi cả bốn build thành công, xác minh checksum, tạo draft và upload.
Nếu release cùng tag đã công khai, workflow dừng, không ghi đè bản người dùng đang tải.

## 4. Công khai release

Cách khuyến nghị: Actions chạy xong → Releases → mở draft → tải và thử cài trên máy sạch → Publish release.
Có thể chạy Actions → Desktop release → Run workflow, nhập tag đã tồn tại và bật `publish` để công khai ngay sau khi bốn build qua.
Giữ `publish=false` nếu chưa kiểm tra chữ ký và cài đặt.

CLI tương đương để chạy workflow (sau khi commit workflow lên nhánh mặc định):

```sh
gh auth login -h github.com
gh workflow run release.yml --repo gorth-io/gorth-launcher -f tag=v0.0.0-alpha.1 -F publish=true
```

Không chạy `deno task publish` để làm việc này: script đó vẫn là Forge publish và không có Forge publisher; workflow upload bằng GitHub CLI.
Không dùng PAT trong website để người dùng tải file private.

Tag có `-alpha/-beta/-rc` được đánh dấu prerelease. Updater hiện chỉ chấp nhận stable.
Muốn updater tự tìm bản mới: phát hành semver stable, ví dụ `1.0.0`, giữ ZIP/Squirrel và ký đúng chứng chỉ.
Chưa có kiểm thử tải/cài/cập nhật ứng dụng thật giữa hai phiên bản.

## 5. Gắn URL vào website và Vercel

Đã cấu hình sáu URL tải cho `gorth-launcher-website` trong `.env.example`, `.env.production` và bổ sung MSI/RPM trong catalog.
URL hiện trỏ đến tag `v0.0.0-alpha.1`; **chưa dùng được cho tới khi release được công khai và có asset đúng tên**.

Đặt các biến sau trong Vercel → Project → Settings → Environment Variables → Production:

```dotenv
RELEASE_VERSION=0.0.0-alpha.1
DOWNLOAD_MACOS_ARM64_URL=https://github.com/gorth-io/gorth-launcher/releases/download/v0.0.0-alpha.1/gorth-launcher-darwin-arm64.dmg
DOWNLOAD_MACOS_X64_URL=https://github.com/gorth-io/gorth-launcher/releases/download/v0.0.0-alpha.1/gorth-launcher-darwin-x64.dmg
DOWNLOAD_WINDOWS_X64_URL=https://github.com/gorth-io/gorth-launcher/releases/download/v0.0.0-alpha.1/gorth-launcher-win32-x64-setup.exe
DOWNLOAD_WINDOWS_X64_MSI_URL=https://github.com/gorth-io/gorth-launcher/releases/download/v0.0.0-alpha.1/gorth-launcher-win32-x64-setup.msi
DOWNLOAD_LINUX_X64_URL=https://github.com/gorth-io/gorth-launcher/releases/download/v0.0.0-alpha.1/gorth-launcher-linux-x64.deb
DOWNLOAD_LINUX_X64_RPM_URL=https://github.com/gorth-io/gorth-launcher/releases/download/v0.0.0-alpha.1/gorth-launcher-linux-x64.rpm
```

.env.production là file local bị gitignore; nó không tự đồng bộ lên Vercel. Phải đặt env trong dashboard và redeploy hai website.
Các URL là công khai nhưng vẫn được đọc ở server qua `utils/environment.ts`, không đưa token vào client.
Cập nhật cả `RELEASE_VERSION` và tag trong URL khi ra bản mới.
Sau khi có stable, có thể dùng `/releases/latest/download/<asset>`; không dùng latest cho alpha vì GitHub loại prerelease khỏi latest.
Không có kiểm tra tồn tại asset từ server ở mỗi request; cần kiểm tra 6 link thực sau publish.

## 6. Build cục bộ và kiểm chứng

Trên đúng hệ điều hành/kiến trúc, sau khi cài dependency:

```sh
deno task make --platform=darwin --arch=arm64
deno run -A .github/scripts/release-artifacts.js darwin arm64
```

Mac Intel dùng darwin/x64, Windows dùng win32/x64, Linux dùng linux/x64.
Linux cần `rpm`, `fakeroot`; macOS cần Xcode Command Line Tools.
Khi build local phải cấu hình các giá trị public auth production đúng như workflow, không phát hành artifact dùng backend localhost.
Workflow dùng Deno 2.9.8 để chạy các script JavaScript trong `.github/scripts/`; Node 26 phục vụ toolchain native/Forge. Script từ chối output stage đã tồn tại; chuyển output cũ sang nơi lưu trữ rồi build sạch để không trộn phiên bản.

Checklist trước công khai: đủ 6 installer, SHA256 đúng; mở app từ bản đóng gói; đăng nhập OAuth/keychain; protocol callback; lưu profile;
Windows install/uninstall; Linux DEB/RPM install; thử hai Mac thật; thử updater giữa hai bản stable đã ký.
Kiểm thử script với dữ liệu giả không thay thế kiểm thử cài đặt thật.

## Tài liệu chính thức

- [Forge DMG](https://www.electronforge.io/config/makers/dmg)
- [Forge Squirrel.Windows](https://www.electronforge.io/config/makers/squirrel.windows)
- [Forge macOS signing](https://www.electronforge.io/guides/code-signing/code-signing-macos)
- [GitHub runner OS/architecture](https://docs.github.com/en/actions/how-tos/write-workflows/choose-where-workflows-run/choose-the-runner-for-a-job)
