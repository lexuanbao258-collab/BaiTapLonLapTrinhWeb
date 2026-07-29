# Kiểm thử TaskFlow – v1.6.2

## Môi trường

| Mục | Giá trị |
| --- | --- |
| Trình duyệt | Google Chrome (Chromium) |
| Độ phân giải | 1440×900, 1024×768, 768×1024, 375×812, 320×568 |
| Cách chạy | Live Server (VS Code) tại `http://127.0.0.1:5500` |
| Ngày kiểm thử | 24/07/2026 |

**Phân loại kết quả:**
- **Pass** – Đã xác minh qua source code tĩnh hoặc phân tích logic.
- **Chưa thực hiện** – Cần thao tác UI thủ công trên trình duyệt.
- **Không áp dụng** – Trường hợp không liên quan đến kiến trúc hiện tại.

---

## Kiểm thử bắt buộc: Cách ly tài khoản

Có thể chạy kiểm tra tự động tại
`tests/account-isolation-check.html?run=1` qua web server cục bộ. Luôn dùng
profile trình duyệt riêng vì kiểm tra tạo hai tài khoản thử nghiệm và giữ lại
các khóa để đối chiếu LocalStorage.

| Test | Kịch bản | Kết quả mong đợi | Trạng thái v1.6.2 |
| --- | --- | --- | --- |
| 1 | Đăng ký A → tạo `ONLY-ACCOUNT-A` → logout → đăng ký/login B | B không thấy task của A | Pass – test tự động |
| 2 | B tạo `ONLY-ACCOUNT-B` → logout → login A | A chỉ thấy `ONLY-ACCOUNT-A` | Pass – test tự động |
| 3 | Mở DevTools → LocalStorage sau Test 1/2 | Có `taskflow_tasks_v1__user_<ID_A>` và `taskflow_tasks_v1__user_<ID_B>`, nội dung khác nhau | Pass – test tự động |
| 4 | Refresh trang A và B; logout/login lặp lại | Mỗi account vẫn giữ đúng dữ liệu của mình | Pass – test tự động (đọc lại sau session mới); cần xác nhận F5 UI thủ công |
| 5 | Import, Clear All, reset, backup/restore ở A | Chỉ khóa `__user_<ID_A>` thay đổi; B không đổi | Pass – import/clear/backup/restore tự động; reset UI chỉ dành cho demo |
| 6 | Login demo hai lần và một account vừa đăng ký | Demo có mẫu một lần; account thường có task trống và không tự có mẫu sau login | Pass – test tự động |
| 7 | Logout rồi gọi storage dữ liệu cá nhân | Bị từ chối với `Phiên đăng nhập không hợp lệ.`; không tạo khóa `__guest` | Pass – test tự động |

## Xác thực (Authentication)

| STT | Chức năng | Kết quả mong đợi | Kết quả thực tế | Trạng thái |
| ---: | --- | --- | --- | --- |
| 1 | Đăng ký tài khoản mới hợp lệ | Tài khoản được tạo, chuyển đến dashboard | Xác minh qua `assets/js/services/auth-service.js` | Cần kiểm tra UI |
| 2 | Đăng ký email đã tồn tại | Hiển thị lỗi "email đã tồn tại" | Logic có trong `assets/js/services/auth-service.js` | Cần kiểm tra UI |
| 3 | Đăng ký email sai định dạng | Hiển thị lỗi validation | HTML type="email" + validation JS | Cần kiểm tra UI |
| 4 | Đăng ký mật khẩu < 6 ký tự | Hiển thị lỗi | Validation có trong `assets/js/services/auth-service.js` | Cần kiểm tra UI |
| 5 | Đăng nhập đúng thông tin | Chuyển đến dashboard | AuthService.login() | Cần kiểm tra UI |
| 6 | Đăng nhập sai thông tin | Hiển thị lỗi | AuthService.login() trả false | Cần kiểm tra UI |
| 7 | Đăng xuất | Xóa session, về login | logoutButton → AuthService.logout() | Cần kiểm tra UI |
| 8 | Refresh giữ phiên (có ghi nhớ) | Vẫn đăng nhập | SessionStorage + LocalStorage | Cần kiểm tra UI |
| 9 | Tài khoản demo | Điền sẵn email/password | Nút demoLogin trong login.html | Cần kiểm tra UI |
| 10 | Dữ liệu hai tài khoản tách biệt | Mỗi tài khoản có dữ liệu riêng | `USER_SCOPED_STORAGE` trong `assets/js/core/config.js` | Pass (logic) |

---

## CRUD Công việc

| STT | Chức năng | Kết quả mong đợi | Trạng thái |
| ---: | --- | --- | --- |
| 11 | Thêm công việc hợp lệ | Task được thêm, toast xác nhận | Cần kiểm tra UI |
| 12 | Bỏ trống tiêu đề | Lỗi "Vui lòng nhập tiêu đề công việc" | Pass – Validators.task() |
| 13 | Tiêu đề chỉ khoảng trắng | Bị chặn (trim trả rỗng) | Pass – String.trim() trước validate |
| 14 | Mô tả < 10 ký tự | Lỗi "Mô tả cần ít nhất 10 ký tự" | Pass – `assets/js/core/validators.js` |
| 15 | Mô tả chỉ khoảng trắng | Bị chặn | Pass – trim() trước validate |
| 16 | Deadline trong quá khứ (tạo mới) | Bị chặn | Pass – validateDeadline() |
| 17 | Deadline hôm nay | Hợp lệ | Pass – `deadline >= today` |
| 18 | Priority không hợp lệ | Bị chặn | Pass – Validators.task() |
| 19 | Status không hợp lệ | Bị chặn | Pass – Validators.task() |
| 20 | Sửa công việc | Cập nhật thành công | Cần kiểm tra UI |
| 21 | Sửa và giữ deadline cũ đã qua hạn | Được phép giữ | Pass – `originalDeadline` logic |
| 22 | Xóa công việc | Xóa thành công + update UI | Cần kiểm tra UI |
| 23 | Hủy xóa (modal confirm) | Task không bị xóa | Cần kiểm tra UI |
| 24 | Đánh dấu hoàn thành | status → done, progress → 100% | Pass – TaskService.toggleDone() |
| 25 | Hoàn tác (mở lại) | status → todo, progress về 0 | Pass – TaskService.toggleDone() |
| 26 | Ghim công việc | Task lên đầu danh sách | Cần kiểm tra UI |
| 27 | Nhân đôi task | Bản sao với deadline ≥ hôm nay | Pass – TaskService.duplicate() |
| 28 | Refresh giữ dữ liệu | Task còn sau F5 | Pass – LocalStorage |

---

## Tìm kiếm, Lọc, Sắp xếp

| STT | Chức năng | Kết quả mong đợi | Trạng thái |
| ---: | --- | --- | --- |
| 29 | Search theo tiêu đề | Lọc đúng kết quả | Pass – logic trong `assets/js/pages/tasks-page.js` |
| 30 | Search theo mô tả | Lọc đúng kết quả | Pass – getFiltered() |
| 31 | Search không phân biệt hoa thường | Đúng | Pass – Utils.normalize() |
| 32 | Search chuỗi có dấu | Đúng (bỏ dấu để so) | Pass – NFD normalize |
| 33 | Lọc "Chưa hoàn thành" | Bao gồm todo + progress | Pass – `task.status !== 'done'` |
| 34 | Lọc "Cần làm" | Chỉ todo | Pass |
| 35 | Lọc "Đang thực hiện" | Chỉ progress | Pass |
| 36 | Lọc "Hoàn thành" | Chỉ done | Pass |
| 37 | Lọc theo ưu tiên Cao | Đúng | Pass |
| 38 | Kết hợp Search + Status + Priority | Đúng | Pass – logic AND |
| 39 | Sort deadline gần nhất | Đúng thứ tự | Pass |
| 40 | Sort ưu tiên cao trước | Đúng | Pass |
| 41 | Sort mới tạo gần đây | Đúng | Pass |
| 42 | Reset bộ lọc | Về mặc định | Cần kiểm tra UI |
| 43 | Pagination giữ điều kiện lọc | Đúng | Pass – state trong closure |

---

## LocalStorage

| STT | Chức năng | Trạng thái |
| ---: | --- | --- |
| 44 | Thêm task → refresh → còn dữ liệu | Pass – LocalStorage |
| 45 | Sửa task → refresh → cập nhật | Pass |
| 46 | Xóa task → refresh → mất | Pass |
| 47 | LocalStorage đầy → thông báo lỗi | Pass – `assets/js/core/storage.js` trả về lỗi |

---

## Import / Export JSON

| STT | Chức năng | Trạng thái |
| ---: | --- | --- |
| 48 | Export tạo file JSON đúng cấu trúc | Cần kiểm tra UI |
| 49 | Import file đúng (chế độ merge) | Cần kiểm tra UI |
| 50 | Import file đúng (chế độ ghi đè) | Cần kiểm tra UI |
| 51 | Import file không phải JSON | Lỗi rõ ràng | Pass – kiểm tra đuôi file |
| 52 | Import file JSON lỗi cú pháp | Lỗi parse | Pass – try/catch |
| 53 | Import file > 2 MB | Từ chối | Pass – kiểm tra file.size |
| 54 | Import file thiếu trường tasks | Lỗi cấu trúc | Pass – kiểm tra Array.isArray |
| 55 | Import trùng ID (chế độ merge) | Bỏ qua ID trùng | Pass – Set existingIds |
| 56 | Ghi đè → backup tự động | Backup được tạo trước | Pass – TaskService.createBackup() |
| 57 | Ghi đè → modal xác nhận | Hiện số lượng task/category | Pass – UI.confirm() |
| 58 | Hủy ghi đè → không mất dữ liệu | Dữ liệu giữ nguyên | Pass – kiểm tra `!accepted` |
| 59 | Refresh sau import | Dữ liệu mới vẫn còn | Cần kiểm tra UI |

---

## Responsive

| STT | Kích thước | Trạng thái |
| ---: | --- | --- |
| 60 | 320 × 568 (Mobile nhỏ) | Cần kiểm tra UI |
| 61 | 375 × 667 (iPhone SE) | Cần kiểm tra UI |
| 62 | 390 × 844 (iPhone 14) | Cần kiểm tra UI |
| 63 | 768 × 1024 (Tablet) | Cần kiểm tra UI |
| 64 | 1366 × 768 (Laptop) | Cần kiểm tra UI |
| 65 | 1920 × 1080 (Desktop) | Cần kiểm tra UI |

---

## PWA

| STT | Chức năng | Trạng thái |
| ---: | --- | --- |
| 66 | Manifest hợp lệ (name, icons, display) | Pass – manifest đã hoàn thiện |
| 67 | Icon 192×192 không 404 | Pass – icon-192.png đã tạo |
| 68 | Icon 512×512 không 404 | Pass – icon-512.png đã tạo |
| 69 | Icon maskable không 404 | Pass – icon-maskable-512.png có sẵn |
| 70 | Service Worker cài đặt thành công | Pass – kiểm tra Chrome headless cục bộ |
| 71 | Service Worker trạng thái activated | Pass – worker `activated`, cache `taskflow-v1.6.2` |
| 72 | Offline – trang chính mở được | Pass – `index.html` trả HTTP 200 từ cache khi mô phỏng offline |
| 73 | Cache cập nhật khi đổi phiên bản | Pass – `taskflow-v1.6.2`, network-first cho HTML/JS/CSS + `skipWaiting()` + `clients.claim()` |

---

## Lưu ý cần kiểm tra thủ công

Các mục có trạng thái **Cần kiểm tra UI** yêu cầu người kiểm thử:
1. Mở project qua Live Server (`http://127.0.0.1:5500`).
2. Đăng nhập bằng tài khoản demo (`demo@taskflow.local` / `123456`).
3. Thực hiện từng thao tác và quan sát kết quả trên trình duyệt.
4. Với PWA: mở DevTools → Application → Service Workers để theo dõi trạng thái.
