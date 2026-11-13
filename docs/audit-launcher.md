# Audit Gorth Launcher so với Dawn và nhóm Prism

Ngày đánh giá: **07/10/2026**, múi giờ Asia/Ho_Chi_Minh.

## 1. Phạm vi và cách đọc kết quả

Đánh giá mã nguồn đang có trong workspace, không lấy báo cáo cũ làm bằng chứng triển khai:

- Gorth: repo hiện tại, HEAD `5e8f158`, có thay đổi chưa commit; `package.json` đang là `0.0.1`.
- Dawn: `packages/dawn-launcher`, package version `0.1.0`.
- Prism: `packages/PrismLauncher`, CMake khai báo `12.0.0`.
- ElyPrism/Pinecone: `packages/elyprism-pinecone`, CMake khai báo `12.0.0`.
- Freesm: `packages/FreesmLauncher`, CMake khai báo `2.3.0`, codename Maple; README mô tả nền Prism 11.0.3.

Các version trên là khai báo của checkout, **không phải xác nhận phiên bản đã phát hành mới nhất**. Các thư mục mẫu không có Git repository độc lập trong workspace để xác nhận commit upstream. Không đồng nhất mọi tính năng giữa ba fork chỉ vì chúng cùng nền Prism; đặc biệt auth, updater và giao diện có khác biệt.

Quy ước:

- **Có mã xử lý**: lần được đường đi từ UI/API đến xử lý thực tế.
- **Một phần**: có chức năng nhưng thiếu độ sâu, độ bền hoặc khả năng tương thích.
- **Chưa thấy**: chưa tìm thấy implementation tương ứng trong phạm vi source đã kiểm tra; không khẳng định upstream không bao giờ có.
- **Chủ đích**: giới hạn đã được chọn cho Gorth, không tính vào backlog thiếu tính năng.

Đây là source audit và một số kiểm thử hiện có, không phải benchmark hiệu năng, pentest, chứng nhận chơi game hay chứng nhận phát hành đa nền tảng. Lần này không đăng nhập tài khoản thật, không tải/chạy modpack, không đọc `.env.local`, không thay đổi profile người dùng. Chỉ bổ sung tài liệu này; không sửa các lỗi code phát hiện trong quá trình audit.

## 2. Kết luận tổng quan

**Gorth đã là một launcher Java Edition có backend quản lý instance thực sự, không còn chỉ là bộ trang mẫu.** Có tải/repair Minecraft, runtime Temurin, loader curated, offline account, SQLite, quản lý nội dung, world và hàng đợi/process manager.

So với Dawn trong checkout này:

- Gorth có cấu trúc lưu trữ giao dịch và bảo vệ filesystem rõ hơn, Trash bền, kiểm tra dependency theo metadata provider, cập nhật modpack giữ file người dùng sửa, data pack và quản lý world/server/log riêng.
- Dawn có lợi thế ở trải nghiệm dashboard, Java discovery rộng, cấu hình số download song song, screenshot watcher, logger xoay file và thống kê playtime tích lũy theo instance. Microsoft auth của Dawn có đường xử lý thật, nhưng không thuộc định hướng Gorth.
- Không thể dùng số nút/trang của Dawn để đánh giá mức hoàn thiện. Một số phần là schema/UI/khung mở rộng, chưa có runtime integration đầy đủ.

So với nhóm Prism:

- Gorth đã có nhiều chức năng tương ứng ở mức cơ bản, nhưng chưa ngang về hệ sinh thái pack, metadata/component editor, công cụ quản trị, updater, bản địa hóa và độ rộng tương thích.
- Pinecone/Freesm có online game auth Ely và cơ chế patch skin mà Gorth chưa bật.
- Gorth có khác biệt sản phẩm hữu ích: SSO Gorth riêng cho launcher, webview trang nội dung chính thức ngay trong ứng dụng, UI shadcn và TypeScript-first.

**Ưu tiên hiện tại nên là độ bền, kiểm thử tích hợp và phát hành, không phải tiếp tục thêm các trang giống launcher mẫu.** Không gán phần trăm hoàn thiện: chưa có bộ tiêu chí nghiệm thu và ma trận kiểm thử đủ để đưa ra tỷ lệ đáng tin cậy.

## 3. Ma trận tính năng chính

| Hạng mục                  | Gorth hiện tại                                                           | Dawn checkout                                                             | Nhóm Prism/fork                                                                    |
| ------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Nền tảng                  | Electron Forge, Vite, React, TypeScript, shadcn                          | Electron-vite, electron-builder, React, Zustand, UI custom                | C++/Qt/CMake, hệ task/model native                                                 |
| Dữ liệu chính             | SQLite/Drizzle; một số dữ liệu vẫn JSON/vault                            | JSON DB tự viết                                                           | Cấu hình INI/JSON và thư mục instance                                              |
| Download/play/repair      | Có engine riêng, xác minh hash/cache                                     | Có engine, cache/download song song                                       | Có engine/task/component sâu hơn                                                   |
| Minecraft                 | Release từ 1.7.10, không snapshot                                        | Có release/snapshot catalog                                               | Catalog/component rộng; khác nhau theo checkout                                    |
| Fabric/Forge/NeoForge     | Có, chỉ cặp version được pin                                             | Có, thêm Quilt, giải version linh hoạt                                    | Có workflow chọn/install component rộng                                            |
| Java                      | Temurin đúng major/arch/vendor; tự tải                                   | Quét PATH/common roots, chọn Java tương thích, tự tải                     | Discovery/check/auto-install và settings phong phú                                 |
| Game account              | **Offline hoạt động; Ely/Gorth online bị tắt**                           | Offline + Microsoft                                                       | Prism Microsoft/offline có điều kiện; Pinecone/Freesm thêm Ely, Freesm custom auth |
| Launcher account          | Gorth SSO nhúng, profile cache SQLite                                    | Chưa thấy Gorth SSO/tách identity launcher tương đương                    | Không phải mô hình SSO Gorth                                                       |
| Instance lifecycle        | Create/rename/copy/Trash/restore/purge/icon/group/shortcut/orphan        | Create/update/duplicate/delete/export/import, favorite/tag                | Quản lý instance/group/component sâu, shortcut/copy/import/export                  |
| Settings riêng            | RAM min/max, JVM, Java, window, env, account, join, commands, native/GPU | RAM/Java/JVM/window và metadata instance; ít trường nâng cao hơn          | Overrides, commands/wrapper, native workarounds, performance và công cụ            |
| Modrinth/CurseForge       | Search/version/install/inventory/update/dependency guards                | Search/install/toggle/remove; update quản lý hạn chế                      | Search/install/update/export và resource models chuyên dụng                        |
| Modpack update            | Có giữ modified/untracked files; cùng runtime                            | Chưa thấy merge-update giữ thay đổi tương đương                           | Có managed-pack/update workflows; không mặc định mọi workflow đều cùng ngữ nghĩa   |
| Shader/resource/data pack | Có; Iris tự cài cho loader được hỗ trợ                                   | Shader/resource; chưa thấy data pack và Iris auto-install tương đương     | Có resource/shader/data pack models/parser                                         |
| World/server/notes/log    | Có UI + xử lý backup/restore, NBT servers.dat, notes, log/crash          | Gallery/console; chưa thấy bộ quản lý world/server/notes tương đương      | Có các trang/model/task chuyên dụng                                                |
| Import/export             | mrpack, CF ZIP; instance ZIP; Prism/FTB local một phần                   | ZIP Dawn; mrpack; CF modpack chưa đầy đủ manifest                         | Instance ZIP, mrpack/CF export, nhiều nền tảng pack                                |
| Nhiều game                | Có cho nhiều instance khác nhau                                          | Có session Map theo instance                                              | Có launch tasks/instance/process controls                                          |
| Queue/pause/resume        | FIFO install queue, pause/resume, không bền qua restart                  | Worker queue tải file; chưa thấy IPC pause/resume hoàn chỉnh              | NetJob/task, concurrency/retry; không suy ra mọi loại resume từ tên lớp            |
| Console/history           | 1.000 dòng/job; 1.000 phiên lưu SQLite; search/filter/export             | 400 console events; 500 history; playtime instance tích lũy               | Console/log pages, diagnostics/tools phong phú                                     |
| Gallery/notification      | Preview/reveal/manual refresh; notification phiên chạy                   | Screenshot watcher; notification UI/store                                 | Screenshots UI; Freesm thêm clipboard conveniences                                 |
| Updater/phát hành         | Có makers/fuses, chưa thấy updater/signing pipeline                      | Có builder và dependency updater, chưa thấy integration updater chạy thật | Có updater subsystem; cấu hình/phân phối khác nhau                                 |

Các kết luận trong bảng được giải thích và dẫn nguồn ở các phần sau; “có” không đồng nghĩa đã chạy thử trên Windows, Linux và mọi kiến trúc CPU.

## 4. Kiến trúc và lưu trữ

### 4.1. Gorth

Luồng thực tế là renderer → preload → IPC/tRPC → main/service. Hono giữ các route callback/profile/health; không thay thế toàn bộ IPC. Dev dùng Vite port 5502 công khai và socket/named pipe riêng tới Hono trong main; production Hono phục vụ app và route trên loopback. tRPC dùng adapter IPC, URL `desktop.invalid` là endpoint logic, không phải server Internet.

tRPC mới bao phủ library snapshot/settings; game/content/auth/dialogs/events còn dùng IPC cũ. Vì vậy chưa thể gọi đây là migration toàn bộ app sang RPC. TanStack Router dùng memory history; back/forward không điều hướng URL của Electron shell. Query/Form đã được dùng; Launch History có Table/Virtual, RAM slider dùng Ranger.

Nguồn: [app/main.ts](../app/main.ts), [RPC client](../lib/rpc/client.ts), [RPC router](../main/rpc/router.ts), [Hono server](../services/desktop-server.ts), [Vite proxy](../lib/server/vite.ts), [navigation](../lib/navigation.ts), [desktop packages](desktop-packages.md).

Điểm cần cải thiện là ownership và độ lớn module: `app/index.tsx`, `services/library-store.ts`, `lib/game/service.ts`, `lib/content/service.ts`, `lib/instance/service.ts` vẫn gánh nhiều trách nhiệm. Không nên đổi stack chỉ để giống Dawn/Prism; nên tách các domain operations/test seams khi thực sự sửa tính năng.

### 4.2. Gorth không lưu tất cả dữ liệu vào SQLite

SQLite hiện dùng **Node `DatabaseSync` + Drizzle**, không phải `better-sqlite3` ở đường mở DB chính, dù dependency này vẫn được khai báo. Có WAL, busy timeout, transaction và runtime migration tới `user_version = 4`.

- `instances`: metadata instance.
- `settings`: key/value, chứa JSON cho launcher settings, per-instance settings, Trash, operation journal và play history.
- `user_profile`: public identity cache, khóa là SSO user ID, cập nhật sau login/refresh.
- `game_account`/`launcher_session`: có trong schema nhưng auth service hiện vẫn đọc/ghi vault `auth.v1.enc`; không được tính là auth đã chuyển hoàn toàn vào hai bảng này.
- Theme/UI preferences và `window-state.json` vẫn ngoài DB; receipts nội dung/game vẫn là JSON cạnh instance.

Nguồn: [database/client.ts](../database/client.ts), [schema](../database/schema.ts), [library store](../services/library-store.ts), [user profile](../services/user-profile.ts), [vault](../lib/auth/vault.ts), [window state](../main/windows/state.ts).

Thư mục mặc định:

```text
macOS:   ~/Library/Application Support/Gorth/Launcher
Windows: %APPDATA%\Gorth\Launcher
Linux:   ${XDG_CONFIG_HOME:-~/.config}/Gorth/Launcher

<userData>/
  gorth-launcher.db                 # có thể có -wal/-shm khi DB mở
  auth.v1.enc
  window-state.json
  minecraft/
    versions/, libraries/, assets/  # cache chung
    runtime/, loaders/, authlib/
    content-staging/
    .trash/<instance-id>/
    instances/<instance-id>/
      installed.json
      content.json
      .gorth-modpack.json           # với pack có receipt
      natives/
      notes.md, backups/            # khi đã tạo
      game/
        mods/, resourcepacks/, shaderpacks/
        saves/<world>/datapacks/
        screenshots/, logs/, crash-reports/, servers.dat
```

`--user-data-dir` có thể đổi root. Instance settings nằm DB, không nằm hoàn toàn trong thư mục instance; copy thư mục đơn thuần không phải backup đầy đủ metadata. Xem [data-directory](../utils/data-directory.ts), [instance service](../lib/instance/service.ts), [content receipts](../lib/content/install.ts), [modpack receipts](../lib/content/packs.ts).

### 4.3. Dawn và Prism

Dawn dùng lớp `JsonDatabase` riêng, không phải lowdb/json-server: đọc toàn bộ `dawn-data.json`, clone dữ liệu, ghi file `.tmp` rồi rename. Atomic rename tốt hơn ghi đè trực tiếp, nhưng không có transaction DB hay hàng đợi serialize `mutate` rõ ràng. Nhiều mutation bất đồng bộ có nguy cơ lost update; catch toàn bộ lỗi đọc rồi tạo default cũng cần phân biệt file chưa tồn tại với JSON hỏng/lỗi quyền. Đây là rủi ro từ source, chưa tái hiện bằng stress test.

Dawn có root `userData/dawn-data`, cho đổi `minecraftRoot`; game directory nằm trực tiếp ở instance UUID hoặc path tùy chọn. Gorth cố định cấu trúc có lớp `game/` và cache chung. Prism có `instance.cfg`, `mmc-pack.json`, thư mục `.minecraft` và metadata/component theo instance; không dùng SQLite làm chuẩn trao đổi chung.

Nguồn: [Dawn JsonDatabase](../packages/dawn-launcher/src/launcher/JsonDatabase.ts), [Dawn paths](../packages/dawn-launcher/src/launcher/LauncherPaths.ts), [Dawn instances](../packages/dawn-launcher/src/launcher/InstanceService.ts), [Prism PackProfile](../packages/PrismLauncher/launcher/minecraft/PackProfile.cpp), [Prism InstanceList](../packages/PrismLauncher/launcher/InstanceList.cpp).

SQLite là lợi thế về giao dịch/query của Gorth, nhưng không tự bảo đảm tính bền của các file nằm ngoài DB hoặc transaction filesystem + DB. Journal hiện chỉ bao phủ một số operation, cần kiểm thử crash recovery riêng cho các thao tác khác.

## 5. Download, loader và Java

Gorth xác minh hash khi tải và kiểm tra cache, repair file hỏng, cleanup file dở, retry; giới hạn host/protocol ở downloader. Có một slot cài game giữa các instance để bảo vệ cache, **nhưng bên trong cài game vẫn có 8 worker tải file**, không phải mọi file tải tuần tự.

Pause abort transfer hiện tại; resume dùng lại file đã xác minh và tải lại file chưa xong. Chưa có HTTP Range để tiếp tục từ byte dở, queue state chưa được persist. Tốc độ/ETA là ước lượng, không phải dự báo thời gian đáng tin cậy khi file có kích thước chênh lệch hoặc đang chạy processor Java.

Nguồn: [files](../lib/game/files.ts), [install](../lib/game/install.ts), [service](../lib/game/service.ts), [transfer](../lib/game/transfer.ts). Dawn có số worker cấu hình qua settings; Prism có `NetJob` concurrency/retry. Đây là nơi Gorth có thể học về cấu hình tốc độ/concurrency, không cần đổi sang C++: [Dawn DownloadManager](../packages/dawn-launcher/src/launcher/DownloadManager.ts), [Prism NetJob](../packages/PrismLauncher/launcher/net/NetJob.cpp).

### Catalog Gorth đang cho phép

| Loader          | Minecraft | Loader version      |
| --------------- | --------- | ------------------- |
| Forge           | 1.20.1    | 47.4.10             |
| Forge           | 1.19.2    | 43.5.0              |
| NeoForge legacy | 1.20.1    | 47.1.106            |
| NeoForge        | 1.21.1    | 21.1.217            |
| Fabric          | 1.20.1    | 0.16.14             |
| Fabric          | 1.21.1    | 0.19.3 hoặc 0.16.14 |

Nguồn duy nhất cho chính sách này là [catalog.ts](../lib/game/catalog.ts). Không kiểm tra lại promotions/live release trong lần audit này; “pin” không có nghĩa mọi tổ hợp mod đều ổn định.

Fabric ghép profile Mojang; Forge/NeoForge dùng installer và processors, không chỉ đổi tên loader trong metadata. Dawn cũng có đường install thật, nhưng version resolution linh hoạt và fallback latest khác Gorth. Prism có model component/patch/profile cho phép chỉnh sâu hơn; Gorth chưa có trình editor và dependency graph component tương đương.

Nguồn: [Gorth loaders](../lib/game/loaders.ts), [Dawn LoaderService](../packages/dawn-launcher/src/minecraft/LoaderService.ts), [Prism ComponentUpdateTask](../packages/PrismLauncher/launcher/minecraft/ComponentUpdateTask.cpp).

### Runtime

Gorth ưu tiên Java path riêng, rồi discovery từ `JAVA_HOME`/macOS `java_home`, rồi runtime quản lý; nếu không khớp thì tải Temurin JRE và kiểm tra SHA-256. Custom path phải tuyệt đối và qua kiểm tra major/vendor/arch. Java được chọn theo metadata; default 1.20.1 là 17, không hardcode Java 17 cho mọi bản. Khi metadata đòi 25, runtime selection sẽ yêu cầu 25; việc tải/chạy thực tế còn phụ thuộc package có sẵn và nền tảng.

Dawn quét PATH/common directories rộng hơn, chấp nhận Java major lớn hơn yêu cầu; heuristic riêng coi version major > 1 là Java 21 nếu không có major khác truyền vào. Không nên suy ra Dawn chắc chắn chạy được mọi bản Minecraft mới chỉ vì list có version đó. Gorth có lợi thế kiểm tra exact major/vendor/arch, Dawn có lợi thế UI/discovery; Temurin-only là định hướng, không phải lỗi thiếu Java vendor khác.

Nguồn: [Gorth java](../lib/game/java.ts), [Gorth metadata](../lib/game/metadata.ts), [Dawn JavaService](../packages/dawn-launcher/src/launcher/JavaService.ts), [Dawn JavaInstallService](../packages/dawn-launcher/src/launcher/JavaInstallService.ts).

## 6. Authentication và skin

Phải phân biệt **SSO launcher** và **account Minecraft**:

1. Gorth launcher có login/register/refresh/logout, auth view nhúng cùng cửa sổ, callback và profile cache. Không mở popup; thanh điều hướng auth riêng. Có hook/provider cho UI.
2. Game hiện chỉ chạy bằng offline identity. `snapshot().providers.ely = false`, `gorthGame = false`; `resolveGameSession()` từ chối provider online. Có `ely.ts`, `gorth-game.ts` và đường authlib-injector không đồng nghĩa người dùng đã dùng được chúng.
3. SSO login thành công không tự tạo một Minecraft online identity hay entitlement.

Nguồn: [auth service](../lib/auth/service.ts), [Gorth OIDC](../lib/auth/gorth.ts), [auth view](../main/services/auth-view.ts), [auth provider](../providers/auth.tsx), [use-auth](../hooks/use-auth.ts), [user profiles](../services/user-profile.ts).

Vault dùng OS `safeStorage`, từ chối plaintext backend `basic_text`; có thể cần quyền Keychain/unlock. SQLite public profile cache không thay thế token vault. Không nên bỏ mã hóa để tránh prompt.

Dawn có Microsoft device flow → Xbox/XSTS → Minecraft profile/ownership và refresh; account service trả account có token và ghi trong JSON DB. Chưa thấy mã hóa vault tương đương ở đường đó. Gorth đang có ranh giới credential rõ hơn, nhưng chưa có online game auth hoạt động.

Pinecone có Ely device OAuth và official Authlib patches, khác với chỉ authlib-injector. Freesm có Ely/custom auth và skin settings. Prism gốc trong checkout kiểm tra phải có Microsoft account sở hữu game trước khi thêm offline account; Gorth không theo chính sách này.

Nguồn: [Dawn AccountService](../packages/dawn-launcher/src/launcher/AccountService.ts), [Pinecone ElyDeviceCodeStep](../packages/elyprism-pinecone/launcher/minecraft/auth/steps/ElyDeviceCodeStep.cpp), [Pinecone ElyPatchTask](../packages/elyprism-pinecone/launcher/minecraft/update/ElyPatchTask.cpp), [Freesm MinecraftAccount](../packages/FreesmLauncher/launcher/minecraft/auth/MinecraftAccount.cpp), [Prism AccountListPage](../packages/PrismLauncher/launcher/ui/pages/global/AccountListPage.cpp).

### Không gộp ba fork thành một sản phẩm hoàn toàn giống nhau

| Checkout          | Khác biệt cần giữ khi đối chiếu với Gorth                                                                                                                                   |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prism             | Nền component/task/resource/tooling dùng làm chuẩn về chiều sâu; chính sách offline trong checkout còn ràng buộc Microsoft account hợp lệ                                   |
| Pinecone/ElyPrism | Điểm phân biệt là Ely OAuth/device flow và official Authlib patches; Gorth có SSO launcher nhưng chưa đạt parity online identity/skin của fork này                          |
| Freesm            | Thêm custom auth, bỏ hạn chế offline, tiện ích clipboard screenshot và tùy biến giao diện/cat packs; không phải mọi khác biệt đều là chức năng game core cần Gorth sao chép |

Freesm đang khai báo nền/version khác Prism và Pinecone trong checkout này, nên component/provider/updater phải được nghiệm thu theo từng fork. Nguồn bổ sung: [Pinecone README](../packages/elyprism-pinecone/README.md), [Freesm README](../packages/FreesmLauncher/docs/README.md), [Freesm ScreenshotsPage](../packages/FreesmLauncher/launcher/ui/pages/instance/ScreenshotsPage.cpp).

Thiếu đúng nghĩa: kích hoạt/kiểm thử Ely OAuth và Gorth game auth theo contract server thực, refresh/revoke/cancellation/error UX, skin/cape và tương thích multiplayer với server phù hợp. Không cam kết alternative auth vào được server chỉ chấp nhận Microsoft/Mojang identity. Microsoft không phải backlog của Gorth.

## 7. Instance lifecycle và cấu hình riêng

Gorth có create/rename/copy/delete-to-Trash/restore, icon, nhóm, shortcut, đổi version/loader, purge giữ saves, tự dọn Trash theo retention khi startup, import orphan có receipt. Copy/delete/restore có journal startup recovery, guard tác vụ đang chạy, validation ID/path và từ chối symlink. Không nên tiếp tục liệt kê các mục này là “chưa có”.

Settings riêng đã có đầy đủ trường P1-3: RAM min/max, JVM args, Java, resolution/fullscreen, env, account mặc định, join server/world, pre-launch/post-exit, GPU/OpenGL/OpenAL/GLFW. Main đọc lại từ SQLite, không tin settings launch gửi từ renderer. Commands chạy không shell; toán tử shell như pipe/redirect không tự hoạt động. GPU hints chủ yếu áp dụng Linux, không cưỡng chế GPU của Windows/macOS.

Nguồn: [library store](../services/library-store.ts), [library IPC/shortcut](../lib/library/service.ts), [instance settings](../lib/library/instance-settings.ts), [settings form](../components/form/instance-settings-form.tsx), [launch](../lib/game/service.ts), [Java environment](../utils/environment.ts).

Giới hạn còn lại:

- Group là nhãn, chưa phải tree folder lồng nhau hay thao tác nhóm hàng loạt như một file manager.
- Đổi runtime giữ mods/config/saves nhưng không tự migrate mod, không xác minh mod tương thích, chưa có cảnh báo/backup bắt buộc khi downgrade world.
- Orphan recovery chỉ nhận directory ID hợp lệ và `installed.json`; chưa phục hồi tên/icon/settings gốc nếu DB mất, chưa nhận mọi thư mục game ngoại lai.
- Journal copy/delete/restore không chứng minh purge/runtime-change/modpack-update đều chịu được mất điện.
- Shortcut có mã đa OS, còn cần packaged-app end-to-end và đường dẫn đổi vị trí app/dev entrypoint.
- Guard nhiều thao tác là toàn cục: một game đang chạy có thể chặn quản lý dữ liệu của instance khác. Có lợi cho an toàn ban đầu nhưng chưa tối ưu UX đa instance.

Dawn xóa instance bằng `rm`, chưa thấy Trash/journal tương đương. Prism có model groups/component và overrides sâu hơn; copy UI Dawn không mang các model này vào Gorth.

## 8. Nội dung: mod, modpack, shader, resource pack, data pack

Gorth có search/version selection, cài vào instance, receipt, inventory managed/external, enable/disable/remove, tìm update và update content managed. Có kiểm tra dependency required, cycle, pinned version, incompatible projects, reverse dependency khi tắt/xóa, filename/hash và file người dùng sửa. Data pack đi vào world đã chọn; shader tự cài Iris/dependencies cho Fabric/NeoForge được hỗ trợ.

Modpack mới chỉ vào library sau khi chuẩn bị payload; update cùng runtime chỉ thay/xóa file khớp manifest cũ, giữ modified/untracked files. Release đổi Minecraft/loader cần tạo instance mới. CurseForge bị khóa download URL thì báo lỗi, không đoán CDN/bypass.

Nguồn: [providers](../lib/content/providers.ts), [content install/inventory](../lib/content/install.ts), [packs/update merge](../lib/content/packs.ts), [service](../lib/content/service.ts), [installed-content UI](../pages/content/installed-content/index.tsx).

**Đây chưa phải dependency resolver hoàn chỉnh cho mọi mod**:

- External JAR chưa được đọc toàn bộ `fabric.mod.json`, `mods.toml`, `neoforge.mods.toml`, nested JAR và version range để giải xung đột.
- Dependency guards dựa provider metadata/receipt; không bảo đảm mod không crash runtime.
- Mod trong pack không mặc nhiên có đủ receipt per-project như mod cài riêng; không nên giả định luôn update được từng file pack độc lập.
- Update giữ file người dùng là an toàn, nhưng chưa có trình bày conflict diff/merge hoặc rollback toàn bộ pack như giao dịch.
- Iris automation không đồng nghĩa đã hỗ trợ mọi shader stack, Forge/OptiFine hay mọi version.

Prism có LocalModParseTask/resource models/GetModDependenciesTask và update dialogs chuyên dụng. Cũng không nên gọi Prism là solver hoàn hảo: parser có giới hạn, ví dụ source ghi chỉ lấy mod đầu tiên trong một số file TOML.

Nguồn: [Prism LocalModParseTask](../packages/PrismLauncher/launcher/minecraft/mod/tasks/LocalModParseTask.cpp), [Prism GetModDependenciesTask](../packages/PrismLauncher/launcher/minecraft/mod/tasks/GetModDependenciesTask.cpp), [Prism ResourceUpdateDialog](../packages/PrismLauncher/launcher/ui/dialogs/ResourceUpdateDialog.cpp).

### Các giới hạn đáng chú ý của Dawn

- ContentService quản lý file bằng tên/path và extension; toggle/remove nhận path từ IPC, chưa thấy guard root như Gorth.
- Modrinth install lấy version đầu, đệ quy dependency bằng project ID; exact dependency version ID không được bảo toàn đầy đủ trong nhánh đã đọc.
- CurseForge `installCurseForgeModpack()` tải ZIP rồi chép `overrides/` và `mods/`. **Chưa thấy resolve `manifest.json.files` projectID/fileID** trong hàm này. Nhiều pack ZIP chuẩn sẽ không chứa JAR trực tiếp, nên không thể coi implementation đó tương đương importer Gorth/Prism.
- Pack install sửa instance hiện có, không có staging/commit tạo instance mới tương đương Gorth; chưa thấy update manifest giữ sửa đổi người dùng.
- Có `join(instance.gameDir, relative)` với path archive/manifest; không thấy validation containment ở những điểm này. Cần kiểm tra và harden trước khi dùng với archive không tin cậy; đây không phải kết quả khai thác thử.

Nguồn: [Dawn ContentService](../packages/dawn-launcher/src/launcher/ContentService.ts), [Dawn MarketplaceService](../packages/dawn-launcher/src/api/MarketplaceService.ts).

## 9. World, instance data và trao đổi pack

### Đã có trong Gorth

- World list theo thư mục saves, tính size/mtime.
- Backup ZIP, restore có backup bản hiện tại, xóa world/backup.
- Screenshot preview/reveal/delete ở các giao diện tương ứng.
- Đọc/ghi `servers.dat` bằng NBT, thêm/xóa server.
- Notes, đọc logs/crash-reports và log gzip có giới hạn kích thước.
- Export ZIP instance với `.minecraft`, metadata cơ bản Prism/Gorth, notes/backups; import folder/ZIP Prism/MultiMC và một số dạng FTB local.

Nguồn: [instance service](../lib/instance/service.ts), [NBT](../lib/instance/nbt.ts), [archive](../lib/instance/archive.ts), [instance-data panels](../pages/instances/data/index.tsx), [Screenshots trong Edit](../components/element/instance-screenshots.tsx).

### Chưa đạt parity

1. World list chưa là trình đọc `level.dat` đầy đủ: tên hiển thị/world version/icon/game mode và cảnh báo không tương thích còn thiếu. Server list chưa có status ping/latency/online player/browser tích hợp.
2. Backup còn local/thủ công, chưa lịch backup/quota/retention theo world/cloud và verify restore lớn.
3. Gallery hiện manual refresh, hiển thị tối đa 60 ảnh sau filter, chưa watcher, viewer/zoom/chọn nhiều/copy clipboard tương đương Dawn/Freesm. Backend đọc thêm định dạng cũng cần đồng bộ với inventory.
4. Export metadata chưa kèm toàn bộ per-instance settings, icon/group hoặc content receipts ở root. Round-trip có thể mất các dữ liệu này và mất liên kết update provider, dù game files vẫn còn. `instance.cfg` chỉ ghi trường cơ bản, importer chưa parse toàn bộ override trong INI Prism.
5. ZIP instance **không phải** export `.mrpack` hoặc CurseForge manifest có source URLs/hash/optional files. Prism có `ModrinthPackExportTask` và `FlamePackExportTask` riêng.
6. ZIP writer Gorth là implementation ZIP32 tự viết, không nén; số entry dùng 16-bit, size/offset dùng 32-bit trong khi scan cho phép tới 100.000 file. Pack/world lớn có thể vượt giới hạn format và lỗi export; cần ZIP64 hoặc guard rõ trước khi ghi. Chưa kiểm thử trường hợp >65.535 entry/>4 GiB.
7. Import FTB local không phải FTB catalog/API install. Chưa có Packwiz/ATLauncher/Technic/legacy FTB platform tương đương các module trong Prism.

Nguồn: [Dawn GalleryService watcher](../packages/dawn-launcher/src/launcher/GalleryService.ts), [Freesm ScreenshotsPage](../packages/FreesmLauncher/launcher/ui/pages/instance/ScreenshotsPage.cpp), [Gorth export/import metadata](../lib/instance/archive.ts), [Prism mrpack export](../packages/PrismLauncher/launcher/modplatform/modrinth/ModrinthPackExportTask.cpp), [Prism CF export](../packages/PrismLauncher/launcher/modplatform/flame/FlamePackExportTask.cpp), [Prism FTB](../packages/PrismLauncher/launcher/modplatform/ftb/FTBPackInstallTask.cpp), [Prism Packwiz](../packages/PrismLauncher/launcher/modplatform/packwiz/Packwiz.cpp), [Prism ATLauncher](../packages/PrismLauncher/launcher/modplatform/atlauncher/ATLPackInstallTask.cpp), [Prism Technic](../packages/PrismLauncher/launcher/modplatform/technic/TechnicPackProcessor.cpp).

Module FTB trong checkout Prism là bằng chứng có source, không bảo đảm dịch vụ FTB ngoài mạng hiện cho phép/download hoạt động. Không dùng README/web cũ để xác nhận API live.

## 10. Process manager, log và thống kê

P1-7 **đã có implementation**, không nên tiếp tục mô tả Gorth chỉ cho một game chạy:

- Map task/job theo instance, nhiều Java process cho các instance khác nhau.
- FIFO install scheduler; pause/resume/cancel/stop theo ID.
- Console riêng, tìm kiếm, lọc mức log, copy/clear/export; crash detection dựa exit/log và crash hints heuristic.
- Play history lưu SQLite, có UI search/sort/virtualization ở Settings.

Nguồn: [game service](../lib/game/service.ts), [Console](../pages/console/index.tsx), [Downloads](../pages/downloads/index.tsx), [Launch History](../pages/settings/history/index.tsx), [store history](../services/library-store.ts).

Giới hạn cần nghiệm thu tiếp:

- Một instance không chạy hai bản đồng thời; đây là guard tránh ghi chung saves/config, không phải thiếu nhiều instance.
- Queue/task/log chưa sống qua restart; crash/quit launcher không có reconnect tới process/session đang tồn tại.
- Console chỉ giữ 1.000 dòng/job, line bị cắt độ dài; export xuất buffer đó, không phải full session log. Các file Minecraft logs có thể xem riêng nhưng không thay thế mọi stdout/stderr của launcher/processor.
- History giữ 1.000 phiên; tổng thời gian ở dashboard cộng các phiên còn lưu, **không phải lifetime total bền**. Dawn có `totalPlayTimeMs` tích lũy trên instance ngoài retention history — đây là điểm Gorth còn thua Dawn về ngữ nghĩa thống kê.
- Crash hint là heuristic, không xác định chắc nguyên nhân; thiếu crash bundle có redaction/metadata đầy đủ.
- Stop dùng signal + fallback kill; cần test process tree, lifecycle command treo, shutdown khi nhiều Java/installer đang chạy và tổng RAM ở cả ba OS.
- Chưa có UI quản lý budget RAM tổng, download bandwidth, queue persist/reorder và concurrency tùy chỉnh.

Nguồn Dawn: [MinecraftService](../packages/dawn-launcher/src/minecraft/MinecraftService.ts), [store console retention](../packages/dawn-launcher/src/store/useLauncherStore.ts), [Logger/rotation](../packages/dawn-launcher/src/launcher/Logger.ts). Gorth chưa có logger structured/rotation riêng tương đương; nhiều service còn `console.error`.

## 11. UI và tiện ích

Gorth có Home (chơi nhanh/gần đây), Instances, bốn mục nội dung, Accounts, Downloads (tác vụ/tiến trình), Console, Notifications, Launcher Settings và Edit instance (cấu hình/nội dung đã cài/dữ liệu/ảnh/log). Gallery và Instance Data chỉ còn URL tương thích dẫn vào Edit; lịch sử đầy đủ ở Launch History. Đã đưa bố cục Dawn vào component shadcn, không phải đem runtime/mock store của Dawn sang. Trang catalog dùng layout giới hạn chiều rộng; project detail giữ sidebar trái, webview trung tâm và detail bên phải.

Navigation bar có back/forward/sidebar; auth mode có Undo2, URL read-only và reload spinner, không popup. Window state có restore/clamp work area; kích thước mong muốn 1920×1080/min 1280×720 sẽ được giảm nếu màn hình nhỏ hơn, không phải luôn ép vượt màn hình.

Nguồn: [app/index.tsx](../app/index.tsx), [navigation bar](../layouts/navigation-bar.tsx), [Home](../pages/home/index.tsx), [content detail](../pages/content/project-detail/index.tsx), [window state](../main/windows/state.ts).

Notifications có unread/mark-read/dismiss/clear, nhưng chỉ React state tối đa 100 mục, chưa persist SQLite/native OS notification. Không tính đây là notification center bền. Dawn cũng có notification store/event nhưng chưa thấy đường persist/read-back hoàn chỉnh chỉ từ việc schema có trường notifications.

Nguồn: [Gorth notifications](../hooks/use-notifications.ts), [Dawn store](../packages/dawn-launcher/src/store/useLauncherStore.ts), [Dawn Notifications](../packages/dawn-launcher/src/components/Notifications.tsx).

Các tiện ích còn thiếu/chưa đầy đủ: i18n, skin/cape UI, proxy cấu hình, news/changelog feed, disk-space preflight/cache cleanup, native tray/start-minimized, profiler integration, launcher backup/restore, quản lý shortcut đa OS đã nghiệm thu, accessibility/keyboard flow xuyên dialog và webview. Những trang hiện có cũng còn pha tiếng Việt/Anh.

Không đưa Plugin/Discord lên backlog “parity bắt buộc” chỉ vì Dawn có toggle: `PluginService` hiện list/toggle manifest, `PluginHost` là khung activate/deactivate; chưa thấy discovery/load/install/runtime integration đầy đủ. `discordRpc` có settings UI nhưng chưa thấy adapter Discord chạy thật. `electron-updater` được khai báo dependency cũng chưa chứng minh auto-update đã tích hợp.

Nguồn: [Dawn PluginService](../packages/dawn-launcher/src/launcher/PluginService.ts), [Dawn PluginHost](../packages/dawn-launcher/src/plugins/PluginHost.ts), [Dawn Settings](../packages/dawn-launcher/src/pages/SettingsPage.tsx), [Dawn package](../packages/dawn-launcher/package.json). Prism có profiler integration thực trong [Application.cpp](../packages/PrismLauncher/launcher/Application.cpp) và [tools](../packages/PrismLauncher/launcher/tools/GenericProfiler.cpp).

## 12. An toàn, vận hành và phát hành

### Điểm tốt hiện có của Gorth

- Shell renderer sandbox/context isolation/no Node; semantic preload API, không expose raw filesystem/child process.
- RPC có kiểm tra window/main frame/renderer URL và bounded requests.
- Project webview không preload/Node, session riêng, deny permissions/popups/website downloads, allowlist navigation.
- Main kiểm tra command/path/archive/hash; game/settings lấy từ storage đã validate.
- Token ở main/vault, renderer nhận public view, game log có redaction; CurseForge key không truyền trong Java environment mặc định.
- Single-instance lock bảo vệ root; WAL/transaction/journal; packaged fuses và ASAR được cấu hình.

Nguồn: [main window](../main/windows/capital.ts), [RPC IPC](../main/ipc/rpc.ts), [webview](../main/windows/webview.ts), [vault](../lib/auth/vault.ts), [Forge](../forge.config.ts).

### Những điểm chưa được bảo đảm

1. Các IPC legacy thường kiểm tra owning window/main frame, chưa đồng nhất kiểm tra exact renderer URL như RPC. Đây là hardening cần rà soát, không phải kết luận có exploit.
2. Java và lifecycle commands không bị sandbox OS. Mod code chạy với quyền user; `shell:false` chỉ tránh shell parsing, không làm mod/pre-launch command an toàn.
3. `getJavaEnvironment()` lọc một số biến nhạy cảm nhưng vẫn bắt đầu từ toàn bộ `process.env`; cần policy rõ cho biến bí mật khác khi chạy Java/commands. Không đọc `.env.local` hay xác nhận lộ secret thực tế trong lần này.
4. Metadata/schema/content receipts cần thêm corruption/schema-version recovery và transaction recovery cho update nhiều file.
5. Chưa có kiểm tra thống nhất dung lượng trước download/copy/backup, giới hạn tổng RAM và diagnostics bundle redacted.
6. Forge có makers Squirrel/ZIP/DEB/RPM, app icon và fuses, nhưng chưa thấy `osxSign`/`osxNotarize`, Windows signing hoặc updater/channel/rollback được nối vào sản phẩm. Version 0.0.1 không chứng minh readiness.
7. Không thấy `.github` workflow trong checkout workspace, kể cả ở các mẫu; **không kết luận upstream Prism thiếu CI**. Với Gorth, chưa có bằng chứng pipeline build/test/sign/publish đa OS trong source được cung cấp.
8. Cần rà soát nguồn/license/attribution của asset Dawn đã copy trong `assets/dawn` trước phát hành; chưa tìm thấy LICENSE/COPYING riêng trong checkout Dawn này. Không suy ra license của Gorth tự áp dụng cho mọi asset tham chiếu.

Dawn trong checkout có `sandbox:false`, IPC `openExternal`/reveal/content operations nhận URL/path trực tiếp; account có token trong JSON và trả qua bridge. Đây là lý do không nên bê nguyên lớp native/service của Dawn sang Gorth chỉ để hoàn thiện UI.

Nhóm Prism có updater subsystem thực, kể cả Sparkle/PrismUpdater, translation models, resource parsers và các C++ tests. Điều đó chứng minh chiều sâu source/tooling, không chứng minh mọi đường phát hành được signing hay mọi chức năng không lỗi. Nguồn: [Prism updater](../packages/PrismLauncher/launcher/updater/prismupdater/PrismUpdater.cpp), [translations](../packages/PrismLauncher/launcher/translations/TranslationsModel.cpp), [Prism tests](../packages/PrismLauncher/tests/CMakeLists.txt), [Dawn main](../packages/dawn-launcher/src/electron/main.ts).

### Hiệu năng

Renderer build Gorth lần này khoảng **865,01 kB JS minified / 267,00 kB gzip**, CSS 214,74 kB; năm ảnh Dawn riêng tổng khoảng 10,7 MB. Có warning chunk >500 kB. Chưa benchmark RSS/CPU/cold start/download throughput giữa các launcher, không thể kết luận Electron “chậm hơn X lần” hoặc Gorth nhanh hơn Dawn. Định hướng tối ưu: lazy-load page/chunk, tối ưu ảnh, hạn chế snapshot/log broadcasts lớn và profiling trước khi refactor.

## 13. Kiểm thử thực hiện trong lần audit này

| Lệnh                                                                                                 | Kết quả                         | Phạm vi chứng minh                                                                                       |
| ---------------------------------------------------------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`                                                                                     | Pass                            | TypeScript app                                                                                           |
| `pnpm exec tsc --project tests/tsconfig.json --noEmit`                                               | Pass                            | TypeScript các Vitest fixture/test được cấu hình                                                         |
| `pnpm lint`                                                                                          | **Fail: 1 error**               | Import `callerClient` không dùng ở `tests/http.test.ts:14`                                               |
| `pnpm test:unit`                                                                                     | 10/10 pass                      | Development/Forge lifecycle logic                                                                        |
| `pnpm test:window`                                                                                   | 6/6 pass                        | Electron thật, factory/preload, close/SIGINT/SIGTERM/server down/parent exit/SIGKILL parent; profile tạm |
| `pnpm test:game`                                                                                     | 7/7 pass                        | Rules/catalog/arguments/hash/cache/cancellation và crash heuristic; không chạy Minecraft thật            |
| `pnpm test:library`                                                                                  | 6/6 pass                        | SQLite/migration/lifecycle/recovery/guard với dữ liệu kiểm thử                                           |
| `pnpm test:content`                                                                                  | 9/9 pass                        | Provider fixtures, pack paths/dependencies/hash/inventory/update giữ file sửa                            |
| `pnpm test:instance-data`                                                                            | 2/2 pass                        | NBT server round-trip và ZIP nested world; không phải toàn bộ import/export settings                     |
| `pnpm test:rpc`                                                                                      | 6/6 pass                        | IPC adapter, schema/settings/routes và renderer URL guard                                                |
| `pnpm test:auth`                                                                                     | 5/5 pass khi chạy ngoài sandbox | OIDC giả lập loopback, offline identity, vault/service/auth-view guards; không đăng nhập SSO thật        |
| `pnpm exec vite build`                                                                               | Pass, warning chunk size        | Renderer production build                                                                                |
| `pnpm exec vite build --config rollup.config.ts --ssr app/main.ts --outDir .vite/audit-main`         | Pass                            | Compile main với entry explicit; không phải đóng gói Forge                                               |
| `pnpm exec vite build --config rolldown.config.ts --ssr app/preload.ts --outDir .vite/audit-preload` | Pass                            | Compile preload với entry explicit; không phải installer                                                 |

Auth test ban đầu bị sandbox chặn `listen 127.0.0.1` (`EPERM`); rerun ngoài sandbox với SSO fixture đã pass. Không đánh dấu lần bị chặn là bug login sản phẩm. Config main/preload là cấu hình được Forge bổ sung entry; chạy Vite standalone không có entry không phải cách kiểm tra chúng.

Các suite legacy còn warning CJS `import.meta`, `Buffer()` deprecated ở một số dependency/test. Vitest hiện chỉ include `tests/vitest/**`; `pnpm test` **không chạy mọi suite legacy**. Không có assertion “toàn bộ test app đều xanh”: lint vẫn lỗi và các test ngoài bảng chưa rerun. Không thêm/sửa test runner trong lượt audit này.

Không thực hiện trong lượt này:

- E2E UI toàn app với DB/session khôi phục thực; không rerun bộ 12 trang/mock-renderer hay live webview.
- SSO thật, Ely/Gorth online game auth, CurseForge có key thật.
- Download/start/gameplay nhiều Minecraft process thật, multiplayer, GPU/audio, world downgrade.
- Chạy/build Dawn hoặc C++ mẫu, benchmark hoặc signing/notarization/install/update.
- Windows/Linux/ARM64 và mọi Minecraft version được liệt kê.

`docs/game.md` có ghi startup smoke macOS của loader/modpack từ lần trước. Đó là thông tin lịch sử, không phải kết quả tái kiểm thử ngày 07/10; phần docs này còn mô tả console “200 dòng” trong khi code hiện giữ 1.000, và nói online game account ở Supported dù service đang tắt. Cần cập nhật docs cũ theo implementation, không dùng chúng làm bằng chứng parity.

Nguồn kiểm thử: [package.json](../package.json), [vitest config](../vitest.config.ts), [testing.md](testing.md), [game tests](../tests/game.test.ts), [content tests](../tests/content.test.ts), [auth tests](../tests/auth.test.ts), [window test](../tests/vitest/window.test.ts).

## 14. Backlog đề xuất theo mức ưu tiên

### P0 — Trước khi công bố là launcher dùng được ổn định

1. **Baseline xanh và regression E2E**: xử lý lint hiện tại; chạy app/full renderer thật với profile tạm, restore session, auth callback, detail webview, dialogs; chạy cả legacy và Vitest qua CI rõ ràng.
2. **Nghiệm thu game thật**: default Vanilla 1.20.1/Temurin 17 và từng curated pair, nhiều process, stop/quit/installer cancellation, ARM64/natives, permission/disk full; Windows/macOS/Linux.
3. **Ngăn mất dữ liệu**: export/import giữ settings/receipt, downgrade world cảnh báo + backup, update nhiều file có rollback/recovery, ZIP32/ZIP64 guard và test pack lớn.
4. **Online game auth nếu còn trong scope sản phẩm**: triển khai Ely/Gorth end-to-end, không gọi stub là complete; phân biệt launcher SSO và game identity rõ trên UI.
5. **Release pipeline**: installer thật, signing/notarization theo nền tảng, configuration/protocol/port conflict khi packaged, updater có kiểm tra integrity và phương án rollback.

### P1 — Nâng độ bền và tiệm cận nhóm Prism

1. Queue persist/recover, retry/resume semantics rõ, full session log có rotation, diagnostics redaction, lifetime statistics không mất do retention.
2. Import Prism/MultiMC/FTB round-trip đầy đủ, export `.mrpack`/CF manifest, mapping component/settings và provider metadata.
3. Metadata từ JAR/version constraints, external mod identification/update, conflict diff cho pack, runtime-change migration/compatibility check.
4. Backup schedule/retention/quota, world metadata, launcher backup; orphan recovery không chỉ dựa receipt.
5. FTB/Packwiz/ATLauncher/Technic nếu phù hợp người dùng mục tiêu và điều kiện API; không bắt buộc triển khai mọi nền tảng một lúc.
6. Đồng nhất IPC sender policy, Java env policy, typed/structured errors, ổn định service boundaries và schema migration.

### P2 — Hoàn thiện trải nghiệm

1. Notification SQLite/native OS, screenshot watcher/viewer/clipboard/bulk actions.
2. Disk usage/cache cleanup, configurable download concurrency/bandwidth, tổng RAM đa instance.
3. i18n, accessibility/keyboard/drag consistency; skin/cape, news, proxy, profiler, tray tùy nhu cầu.
4. Tối ưu assets/chunks và benchmark có số đo; thống nhất thuật ngữ Instances/Library/Content để sidebar không trùng ý nghĩa.

### Không tính là thiếu

Không Microsoft auth, không Quilt, không snapshot/alpha/beta và không Vanilla trước 1.7.10; curated loader pins, Temurin-only, không Aternos, không gradient và button h-9. Đây là quyết định sản phẩm. Có thể đánh giá ảnh hưởng tới phạm vi pack hỗ trợ, nhưng không “sửa” bằng cách tự động mở catalog ngoài yêu cầu.

## 15. Kết luận cuối

**Dawn nên là mẫu bố cục/tiện ích UX, nhóm Prism nên là mẫu chiều sâu lifecycle/component/resource/task, còn Gorth giữ kiến trúc TypeScript/Electron và SSO riêng.** Không cần C++ để bổ sung các chức năng thiếu đã liệt kê; phần khó hiện tại là contract, dữ liệu, compatibility, recovery và nghiệm thu đa nền tảng.

Ở trạng thái source hiện tại, Gorth có các guard/lifecycle/content workflows sâu hơn Dawn ở một số điểm nhưng chưa vượt nhóm Prism về hệ sinh thái và vận hành. Chưa đủ bằng chứng gọi Gorth production-ready. Công việc có giá trị nhất tiếp theo là biến các implementation đã có thành chức năng bền, có kiểm thử thực và có quy trình phát hành rõ ràng.
