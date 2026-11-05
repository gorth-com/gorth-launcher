# Folders

Route: `gorth://settings/folders`.

Launcher có mục Folders trong sidebar Settings, dùng cùng layout/container với các trang khác.

Path dùng `@gorth/primitive/default/input` ở chế độ read-only để không nhận chuỗi đường dẫn tuỳ ý từ renderer.
Bấm input có thể chỉnh (hoặc Enter khi focus) mở hộp thoại chọn thư mục của hệ điều hành.
Open ở cuối dòng gọi `shell.openPath` trong main process.
Không dùng URL để mở thư mục và không cấp filesystem hoặc shell tuỳ ý qua preload.

## Các vị trí

Application là thư mục chứa app đang chạy; Application data là profile/database/phiên mã hoá.
Hai vị trí này chỉ hiển thị và Open, không đổi nơi cài app hoặc di chuyển profile đang mở.

Các vị trí có thể cấu hình: Launcher root, Instances, Central mods, Skins, Java,
Icon themes, Widget themes, Cat packs, Instance icons, Downloads và Logs.

Launcher root là workspace Minecraft (mặc định `<userData>/minecraft`), **không phải** profile Chromium hay SQLite.
Root, Instances và Java đã nối với engine cài/chạy game, nội dung, thư viện và quản lý instance.
Logs được áp dụng bằng `app.setAppLogsPath` khi khởi động.
Downloads làm defaultPath cho hộp thoại xuất ZIP instance và console log, không thay đổi thư mục Downloads của OS.

Central mods, Skins, Icon themes, Widget themes, Cat packs và Instance icons hiện là vị trí dự kiến,
có mô tả rõ trên UI. Gorth chưa có thư viện mod dùng chung/theme/cat-pack engine tương ứng.
Icon instance hiện vẫn lưu data URL trong database; mod của từng instance vẫn nằm trong game/mods.
Không giả lập rằng những tính năng chưa có đã hoạt động.

Lựa chọn được ghi nguyên tử vào `<userData>/folder-locations.json`.
Path active được giữ nguyên suốt phiên hiện tại; UI hiển thị path sắp áp dụng và path active nếu khác nhau.
Phải khởi động lại app để engine/store dùng path mới.
Khi đổi Launcher root, các thư mục con chưa có override riêng đi theo root mới.
Những override đã chọn riêng giữ nguyên.

Hộp thoại xác nhận nhắc rõ: **không tự di chuyển, sao chép hay xoá dữ liệu cũ**.
Chọn thư mục chứa dữ liệu phù hợp hoặc tự sao chép nội dung cần thiết trước khi restart.
Các instance cũ có thể phải Locate/cài lại. Thư viện SQLite/tài khoản vẫn nằm trong profile cũ.
Không chọn thư mục hệ thống hoặc profile làm workspace. Nếu lưu nhầm, chọn lại path cũ và restart.

Trash của Instances đặt cùng volume với Instances để tránh lỗi rename chéo ổ đĩa.
Runtime downloader vẫn kiểm tra checksum; thay path không tắt xác thực artifact hoặc allowlist nguồn tải.

## Bảo mật và kiểm thử

IPC kiểm tra cửa sổ sở hữu sender, main frame và URL renderer tin cậy.
Renderer chỉ gửi ID thư mục; main tự resolve path hoặc lấy path từ native dialog.
Path tuỳ ý và các request từ subframe/remote bị từ chối. Lỗi trên giao diện dùng toast.

Unit tests kiểm tra path, routing, IPC và persistence.
Native UI fixture chạy Electron với profile/thư mục tạm và API dialog/Open giả lập.
Nó kiểm chứng input, click và cập nhật UI, **không chứng minh Finder/Explorer hoặc native dialog thật đã được người dùng thao tác**.
Không dùng profile thật, không đổi path thật trong kiểm thử.

