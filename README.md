# Website Davines Việt Nam (HTML/CSS/JS)

Web tĩnh chạy hoàn toàn trên trình duyệt, dữ liệu lưu bằng `localStorage` (giả lập cơ sở dữ liệu).

## Chạy thử
Mở thư mục `website` bằng VS Code, cài extension **Live Server**, chuột phải `index.html` → *Open with Live Server*.
Hoặc chạy: `python -m http.server 5500` trong thư mục `website` rồi mở http://localhost:5500.

## Tài khoản demo
| Vai trò | Trang | Email | Mật khẩu |
| --- | --- | --- | --- |
| Thành viên | `login.html` | an.nguyen@email.com | Davines@2026 |
| Quản trị | `admin/login.html` | admin@davines.vn | Admin@2026 |

Mã ưu đãi demo: `DAVINES10` (−100.000 ₫, đơn từ 1.000.000 ₫), `WELCOME15` (−15%, tối đa 150.000 ₫, đơn từ 500.000 ₫), `THANG9` (đã hết hạn, để thử lỗi).

Muốn xóa toàn bộ dữ liệu thử nghiệm: mở Console của trình duyệt, gõ `Store.reset()`.

## Cấu trúc
| File | Nội dung |
| --- | --- |
| `assets/js/data.js` | Dữ liệu sản phẩm, sinh tự động từ `../output/products.json` bằng `tools/build_data.py` |
| `assets/js/store.js` | Toàn bộ quy tắc nghiệp vụ: giỏ hàng, giá, voucher, phí ship, đơn hàng, tồn kho, báo cáo |
| `assets/js/ui.js` | Header, footer, thẻ sản phẩm, toast, modal, hóa đơn, kiểm tra form |
| `assets/css/style.css` | Style theo Style Guide Figma (Crimson Text + Hanken Grotesk) |
| `*.html` | Trang cửa hàng: trang chủ, sản phẩm, chi tiết, giỏ, đặt hàng, thành công, tra cứu, đăng nhập/đăng ký, tài khoản, giới thiệu |
| `admin/` | Đăng nhập quản trị và trang quản trị (báo cáo, đơn hàng, sản phẩm, danh mục, tồn kho, voucher) |

Thêm sản phẩm mới từ crawl: chạy lại `python tools/build_data.py` (từ thư mục `Đồ án web`), rồi `Store.reset()` trên trình duyệt.

## Quy tắc nghiệp vụ đã cài
- Phí giao 20.000 ₫, miễn phí khi tạm tính sau giảm giá từ 500.000 ₫; voucher không trừ vào phí ship.
- COD chỉ cho đơn đến 2.000.000 ₫; VNPay (mô phỏng) giữ hàng 15 phút, đơn chỉ được tạo khi thanh toán thành công.
- Tối đa 10 sản phẩm mỗi dung tích, không vượt tồn kho; sản phẩm hết hàng/ngừng bán hiện "Không khả dụng" và không vào đơn.
- Mã đơn `DV-YYMMDD-NNNN`, tăng dần theo ngày. Đặt xong: trừ kho, xóa sản phẩm đã mua khỏi giỏ.
- Trạng thái đơn: Chờ xác nhận → Đã xác nhận → Đang giao hàng → Đã giao hàng / Giao hàng thất bại (hoàn kho). Khách không tự hủy đơn.
- Giỏ khách vãng lai chỉ giữ trong phiên; khi đăng nhập, nếu tài khoản đã có giỏ lưu thì dùng giỏ của tài khoản.
- Hóa đơn, trang thành công, tra cứu đơn và lịch sử đơn dùng chung một khối tổng tiền nên luôn khớp nhau.
