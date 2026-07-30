# TaskFlow – Quản lý công việc cá nhân

Phiên bản **1.7.2** · Bài tập lớn môn Cơ sở lập trình Web.

TaskFlow là ứng dụng quản lý công việc chạy hoàn toàn trên trình duyệt bằng HTML, CSS và JavaScript ES6+. Dữ liệu được lưu cục bộ bằng LocalStorage; project không dùng framework, backend, database hoặc CDN bên ngoài.

## Chức năng

- Đăng ký, đăng nhập, đăng xuất và đặt lại mật khẩu mô phỏng.
- Dữ liệu task, category, cài đặt, hoạt động và backup được tách riêng theo từng tài khoản.
- CRUD công việc, đánh dấu hoàn thành, ghim, nhân bản, checklist, nhãn và ghi chú.
- Tìm kiếm theo tiêu đề/mô tả, lọc, sắp xếp và phân trang.
- Dashboard, Statistics (Canvas), Kanban kéo thả, Calendar và Categories.
- Profile có đổi/xem/xóa ảnh đại diện, dark/light mode, accent color, compact mode và responsive mobile/tablet/desktop.
- Trang **Công việc** hỗ trợ xuất CSV và nhập CSV theo chế độ gộp hoặc ghi đè.
- Trang **Cài đặt & dữ liệu** hỗ trợ xuất/nhập JSON, backup/restore và Clear All có xác nhận.
- Toast, modal có quản lý focus, validation realtime, PWA/Service Worker và hoạt động offline cho tài nguyên đã cache.

## Chạy project

Mở project qua một HTTP server cục bộ; không nên dùng `file://` vì Service Worker sẽ không hoạt động đầy đủ.

```powershell
python -m http.server 5500
```

Sau đó mở [http://localhost:5500](http://localhost:5500). Có thể thay bằng Live Server trong VS Code/IDE.

Tài khoản demo:

- Email: `demo@taskflow.local`
- Mật khẩu: `123456`

## Cấu trúc thư mục

```text
TaskFlow/
├── assets/
│   ├── css/
│   │   ├── style.css              # Variables, layout, components và page styles
│   │   └── responsive.css         # Breakpoint mobile/tablet/desktop
│   ├── img/                       # Logo, empty state và icon PWA
│   └── js/
│       ├── core/
│       │   ├── config.js
│       │   ├── storage.js
│       │   ├── utils.js
│       │   └── validators.js
│       ├── services/
│       │   ├── auth-service.js
│       │   ├── task-service.js
│       │   ├── category-service.js
│       │   ├── csv-service.js
│       │   ├── backup-service.js
│       │   ├── statistics-service.js
│       │   ├── settings-service.js
│       │   ├── activity-service.js
│       │   └── workspace-service.js
│       ├── components/
│       │   ├── modal.js, confirm-dialog.js, toast.js
│       │   ├── task-card.js, task-form.js, task-actions.js
│       │   ├── icons.js, ui-facade.js
│       ├── pages/
│       │   ├── auth-page.js, dashboard-page.js, tasks-page.js
│       │   ├── kanban-page.js, calendar-page.js, categories-page.js
│       │   ├── statistics-page.js, profile-page.js
│       │   ├── settings-page.js, about-page.js
│       └── app.js                 # Khởi tạo UI dùng chung/PWA
├── data/sample-tasks.json
├── tests/
│   ├── account-isolation-check.html
│   ├── task-crud-check.html
│   ├── csv-service-check.html
│   ├── backup-merge-check.html
│   ├── legacy-migration-check.html
│   ├── pwa-cache-check.html
│   └── hidden-visibility-check.html
├── *.html
├── manifest.webmanifest
└── service-worker.js
```

## Dữ liệu LocalStorage và tương thích phiên bản cũ

Các key tài khoản và phiên vẫn giữ nguyên:

- `taskflow_users_v1`
- `taskflow_session_v1`
- `taskflow_last_email_v1`

Dữ liệu workspace sử dụng đúng key cũ với hậu tố tài khoản, ví dụ `taskflow_tasks_v1__user_<USER_ID>`. Không thay đổi ID task hoặc schema task hiện có.

Khi phát hiện dữ liệu workspace cũ chưa có hậu tố người dùng, ứng dụng tạo snapshot an toàn trước khi dọn key cũ và thực hiện migration một lần vào workspace của phiên đang hoạt động. Migration không ghi đè workspace scoped đã có dữ liệu khác; nếu có xung đột, dữ liệu legacy được giữ lại để tránh lộ hoặc mất dữ liệu giữa tài khoản.

## Nhập và xuất dữ liệu

### CSV trên trang Công việc

- Xuất file CSV UTF-8 có BOM để mở ổn định trong Excel.
- Nhập file `.csv` theo đúng header mẫu; dữ liệu được validate trước khi lưu.
- Chế độ gộp bỏ qua task trùng chữ ký; chế độ ghi đè tạo backup trước khi thay thế task.

### JSON trên trang Cài đặt & dữ liệu

- Export JSON chứa `tasks`, `categories` và `settings` của tài khoản hiện tại.
- Import **Gộp** giữ task/category hiện có, thêm dữ liệu mới, khớp category không phân biệt hoa thường/khoảng trắng và không tạo ID trùng.
- Import **Ghi đè** chỉ thực hiện sau khi người dùng chọn rõ ràng và xác nhận trong modal.
- Clear All chỉ xóa workspace của tài khoản hiện tại sau xác nhận.

## PWA và xóa cache khi phát triển

`service-worker.js` đang dùng cache `taskflow-v1.7.4`. HTML, CSS, JavaScript, manifest và Service Worker được kiểm tra network-first để cache cũ không giữ mã nguồn cũ sau refactor.

Khi phát triển và cần xóa cache:

1. Mở DevTools → **Application** → **Service Workers**.
2. Chọn **Unregister** nếu muốn bỏ worker hiện tại.
3. Vào **Storage** → **Clear site data**.
4. Reload cứng trang (`Ctrl+Shift+R`).

Service Worker không cache LocalStorage, file CSV/JSON người dùng chọn hoặc dữ liệu cá nhân.

## Kiểm tra thủ công

Các trang trong `tests/` hỗ trợ thêm kiểm tra hồi quy qua query `?run=1`:

- `tests/account-isolation-check.html?run=1`
- `tests/task-crud-check.html?run=1`
- `tests/csv-service-check.html?run=1`
- `tests/backup-merge-check.html?run=1`
- `tests/legacy-migration-check.html?run=1`
- `tests/profile-interaction-check.html?run=1`
- `tests/mobile-interaction-check.html?width=390&height=844`
- `tests/pwa-cache-check.html?run=1`
- `tests/hidden-visibility-check.html`

## Giới hạn

Đăng nhập là mô phỏng frontend cho mục đích bài tập. Mật khẩu chỉ là dữ liệu demo trong LocalStorage, không phù hợp cho hệ thống production hoặc dữ liệu thật.

## Thông tin nhóm

Chưa có thông tin thành viên, báo cáo hoặc video demo được cung cấp. Bổ sung các thông tin này theo nhóm thực tế trước khi nộp bài.

## Thay đổi đáng chú ý

### v1.7.2

- Bổ sung thanh tìm kiếm mobile có mở/đóng, focus, Escape và giữ nguyên luồng Enter sang trang Công việc.
- Thêm hành động đổi trạng thái trực tiếp trong menu task và nút tiêu đề mở chi tiết bằng một lần chạm; giữ kéo-thả Kanban trên desktop.
- Chuẩn hóa vùng chạm, pointer event, focus-visible, sidebar và responsive cho mobile/tablet; bổ sung trang kiểm thử hồi quy tương tác.

### v1.7.1

- Sửa vùng bấm menu tài khoản ở header khi avatar đang hiển thị ảnh tải lên.
- Chuẩn hóa hit-area tối thiểu 48 × 48 px, thao tác touch và focus cho `profileChip`.
- Bổ sung kiểm thử avatar, tên, mũi tên, click ngoài, Escape và cấu trúc `profileChip` trên mọi trang nội bộ.

### v1.7.0

- Bổ sung chọn, cắt vuông, thu nhỏ, nén, xem trước, xem lớn và xóa ảnh đại diện.
- Đồng bộ avatar theo đúng tài khoản ở trang hồ sơ, header và profile popover mà không cần reload.
- Tinh gọn Thông tin cá nhân còn Họ tên, Email, Giới thiệu ngắn và Ảnh đại diện; không còn hiển thị Vai trò/Tổ chức.
- Mở rộng kiểm thử hồ sơ cho lưu/hủy, email trùng, dữ liệu user cũ, responsive, định dạng/kích thước tệp, lưu bền vững, cách ly tài khoản, modal và xóa ảnh.

### v1.6.6

- Bỏ hiệu ứng che nội dung khi mở trang để vùng làm việc hiển thị ngay.
- Đẩy cập nhật badge sidebar và Service Worker ra sau lần render đầu tiên; Service Worker chỉ kiểm tra cập nhật một lần mỗi phiên.

### v1.6.5

- Dùng lớp chuyển trang chủ động để đảm bảo hiệu ứng nhất quán cả khi trình duyệt không hỗ trợ chuyển cảnh tài liệu gốc.

### v1.6.4

- Bổ sung chuyển cảnh giữa các trang cùng website và làm ấm các trang ở thanh điều hướng trước khi mở.

### v1.6.3

- Áp dụng giao diện đã lưu trước lần vẽ đầu tiên để tránh nháy nền sáng khi chuyển trang.
- Giữ chuyển động nội dung nhẹ nhàng mà không làm toàn trang mờ đi lúc tải.

### v1.6.2

- Chuẩn hóa JavaScript theo `core`, `services`, `components` và `pages`; loại bỏ bản mã cũ bị trùng.
- Tách backup/JSON, CSV, thống kê và UI dùng chung theo đúng trách nhiệm.
- Sửa merge JSON để không thay category hiện có, đồng thời xử lý trùng ID và tên category.
- Bổ sung migration LocalStorage an toàn, cập nhật Service Worker và cache version.
- Thêm regression checks cho CRUD, cách ly tài khoản, CSV, merge backup, migration và cache PWA.
