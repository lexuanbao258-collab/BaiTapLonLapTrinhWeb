# TaskFlow – Website quản lý công việc cá nhân

## Giới thiệu

TaskFlow là website quản lý công việc cá nhân được xây dựng bằng HTML5, CSS3 và JavaScript ES6+. Hệ thống hỗ trợ CRUD công việc, tìm kiếm, lọc, sắp xếp, LocalStorage, Dashboard, Kanban, Calendar, Statistics, hồ sơ cá nhân, ảnh đại diện, CSV/JSON, responsive và PWA.

Project chạy hoàn toàn trên trình duyệt, không sử dụng framework giao diện, backend hoặc cơ sở dữ liệu máy chủ. Dữ liệu công việc được tách theo từng tài khoản và lưu cục bộ trên trình duyệt.

## Thành viên nhóm

- Lê Xuân Bảo – Nhóm trưởng
- Trần Văn Chính
- Nguyễn Minh Duy
- Nguyễn Văn Duy
- Phạm Thế Cường

## Phân công chính

- Lê Xuân Bảo: Kiến trúc, cách ly dữ liệu tài khoản, Dashboard, Statistics, tích hợp và báo cáo.
- Trần Văn Chính: CRUD, validation, tìm kiếm, lọc, sắp xếp và phân trang.
- Nguyễn Minh Duy: UI/UX, responsive, dark/light mode và component giao diện.
- Nguyễn Văn Duy: Kanban, Calendar, danh mục và nhãn.
- Phạm Thế Cường: Đăng nhập, hồ sơ, CSV/JSON, PWA, kiểm thử và tài liệu.

## Công nghệ

- HTML5
- CSS3
- JavaScript ES6+
- LocalStorage
- SessionStorage
- Canvas
- Service Worker
- PWA

## Chức năng chính

- Đăng ký, đăng nhập và đăng xuất.
- Cách ly dữ liệu theo tài khoản.
- CRUD công việc.
- Tìm kiếm, lọc, sắp xếp và phân trang.
- Dashboard.
- Kanban.
- Calendar.
- Danh mục và nhãn.
- Statistics.
- Hồ sơ cá nhân và ảnh đại diện.
- Đổi mật khẩu.
- Xuất/nhập CSV.
- Sao lưu và khôi phục JSON theo chế độ gộp hoặc ghi đè.
- Dark mode.
- Responsive trên desktop, tablet và mobile.
- PWA và cache offline.

## Cách chạy project

### Cách 1: IntelliJ IDEA

1. Mở thư mục chứa `index.html`.
2. Chuột phải vào `index.html`.
3. Chọn **Open In Browser**.

Cách này dùng được cho các chức năng chính. Để Service Worker và PWA hoạt động đầy đủ, nên chạy project qua HTTP Server.

### Cách 2: HTTP Server

Mở terminal tại thư mục project và chạy:

```powershell
python -m http.server 5500
```

Sau đó mở:

```text
http://localhost:5500
```

## Website GitHub Pages

https://lexuanbao258-collab.github.io/BaiTapLonLapTrinhWeb/

## Tài khoản trải nghiệm

Email:

```text
trai-nghiem@taskflow.local
```

Mật khẩu:

```text
123456
```

Tài khoản trải nghiệm chỉ dùng để xem thử hệ thống, không được chỉnh sửa hồ sơ, đổi mật khẩu hoặc xóa tài khoản.

## Nhập và xuất dữ liệu

- Trang **Công việc** hỗ trợ xuất CSV và nhập CSV theo chế độ gộp hoặc ghi đè.
- Trang **Cài đặt & dữ liệu** hỗ trợ xuất bản sao lưu JSON, xem trước dữ liệu và khôi phục theo chế độ gộp hoặc ghi đè.
- Dữ liệu nhập được kiểm tra trước khi lưu.
- Thao tác ghi đè tạo bản sao lưu an toàn theo luồng hiện tại của ứng dụng.

## Kiểm thử

Các trang kiểm thử nằm trong thư mục:

```text
tests/
```

Khởi động HTTP Server, sau đó mở trang test tương ứng. Những test hỗ trợ chạy tự động có thể dùng tham số `?run=1`, ví dụ:

```text
http://localhost:5500/tests/content-audit-check.html?run=1
http://localhost:5500/tests/profile-interaction-check.html?run=1
http://localhost:5500/tests/task-crud-check.html?run=1
http://localhost:5500/tests/backup-merge-check.html?run=1
http://localhost:5500/tests/pwa-cache-check.html?run=1
```

`mobile-interaction-check.html` chạy trực tiếp và nhận kích thước kiểm tra qua `width` và `height`, ví dụ:

```text
http://localhost:5500/tests/mobile-interaction-check.html?width=390&height=844
```

Các trang test hiện có kiểm tra CRUD, cách ly tài khoản, CSV, JSON, migration dữ liệu cũ, hồ sơ, responsive, theme, accessibility, tài nguyên tĩnh và cache PWA.

## PWA và cache

Service Worker cache các trang và tài nguyên tĩnh cần thiết để ứng dụng tiếp tục mở được khi ngoại tuyến. Dữ liệu LocalStorage và các file CSV/JSON do người dùng chọn không được ghi vào cache.

Cache hiện tại:

```text
taskflow-v1.7.5
```

Khi cần kiểm tra bản mới trên GitHub Pages, có thể reload cứng bằng `Ctrl+Shift+R`. Nếu trình duyệt vẫn giữ worker cũ, mở DevTools → **Application** → **Service Workers** để cập nhật hoặc unregister worker.

## Giới hạn

- Không có backend.
- Không có cơ sở dữ liệu máy chủ.
- Dữ liệu lưu theo trình duyệt và thiết bị.
- Không đồng bộ giữa nhiều thiết bị.
- Xác thực chỉ mang tính mô phỏng phục vụ học tập, không phù hợp để lưu dữ liệu nhạy cảm trong môi trường thực tế.
