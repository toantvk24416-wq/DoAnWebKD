# Website Davines Việt Nam (HTML/CSS/JS)

Giao diện viết bằng HTML/CSS/JavaScript. Một server Node nhỏ (`server.js`, không cần cài thêm thư viện) phục vụ web và lưu dữ liệu xuống các file CSV trong thư mục `data`.

## Chạy web
Cần cài Node.js (máy đã có sẵn).

1. Nhấp đúp `chay-web.bat`, hoặc mở Terminal trong thư mục này (VS Code: **Terminal › New Terminal**) rồi chạy `node server.js`.
2. Mở http://localhost:3000 (file `.bat` tự mở trình duyệt).
3. Muốn tắt web: nhấn **Ctrl+C** trong cửa sổ Terminal.

Nếu chưa có thư mục `data`, lần mở web đầu tiên sẽ tạo thư mục này với sản phẩm, tài khoản và 46 đơn mẫu.

> Chỉ có `node server.js` mới ghi được CSV. Nếu mở bằng Live Server thì web vẫn chạy nhưng dữ liệu chỉ nằm trong `localStorage` của trình duyệt, và không dùng chung dữ liệu với địa chỉ `localhost:3000`.

## Dữ liệu lưu ở đâu
Mỗi lần có thay đổi (đăng ký, thêm vào giỏ của thành viên, đặt hàng, quản trị sửa sản phẩm, nhập kho, tạo voucher...), file CSV liên quan được ghi lại ngay. Khi mở trang, web đọc lại từ các file này, nên tắt server hay đổi trình duyệt trên cùng máy vẫn còn dữ liệu.

| File trong `data/` | Nội dung |
| --- | --- |
| `products.csv` | Sản phẩm: tên, dòng, nhu cầu, loại tóc, mô tả, % giảm, trạng thái bán |
| `product_variants.csv` | Từng dung tích: SKU, giá, tồn kho, ảnh |
| `users.csv` | Tài khoản thành viên (mật khẩu đã băm) |
| `addresses.csv` | Sổ địa chỉ của thành viên |
| `cart_items.csv` | Giỏ hàng của thành viên |
| `admins.csv` | Tài khoản quản trị (mật khẩu đã băm) |
| `orders.csv` | Đơn hàng: khách, địa chỉ, tiền, thanh toán, trạng thái |
| `order_items.csv` | Sản phẩm trong từng đơn, giá tại lúc đặt |
| `order_history.csv` | Lịch sử đổi trạng thái của từng đơn |
| `vouchers.csv` | Mã ưu đãi và số lượt đã dùng |
| `stock_log.csv` | Lịch sử thay đổi tồn kho |
| `order_sequence.csv` | Số thứ tự mã đơn theo ngày |
| `password_resets.csv` | Liên kết đặt lại mật khẩu còn hiệu lực |
| `meta.csv` | Phiên bản dữ liệu |

**Mở bằng Excel:** nên chỉ xem, và đóng file khi web đang chạy. Nếu file đang mở, web báo chưa ghi được, giữ dữ liệu trong server và tự ghi lại khi bạn đóng file (nếu tắt server trước đó thì phần chưa ghi sẽ mất). Không nên bấm Save trong Excel vì Excel có thể làm mất số 0 đầu của số điện thoại và đổi dấu phân cách.

**Sửa CSV bằng tay:** dùng VS Code, giữ nguyên dòng tiêu đề, rồi tải lại trang. Cột danh sách (`needs`, `hair`, `benefits`, `images`) ngăn bằng dấu `|`.

**Xóa dữ liệu thử:** mở Console của trình duyệt (F12), gõ `Store.reset()`. Lệnh này ghi đè toàn bộ CSV về dữ liệu mẫu, muốn giữ lại thì chép thư mục `data` trước.

**Giới hạn:** CSV không phải cơ sở dữ liệu thật. Server chỉ nhận kết nối từ chính máy này, và nếu 2 tab cùng bấm lưu trong đúng một lúc thì lần lưu sau sẽ thắng. Mật khẩu chỉ được băm đơn giản, chỉ dùng cho đồ án.

## Tài khoản demo
| Vai trò | Trang | Email | Mật khẩu |
| --- | --- | --- | --- |
| Thành viên | `login.html` (tab Khách hàng) | an.nguyen@email.com | Davines@2026 |
| Quản trị | `login.html` (tab Quản trị) | admin@davines.vn | Admin@2026 |

Màn đăng nhập dùng chung, có 2 tab: **Khách hàng** (đăng nhập / đăng ký, xong quay lại trang đang xem hoặc trang chủ) và **Quản trị** (vào thẳng trang quản trị). `admin/login.html` cũ tự chuyển về tab Quản trị.

Mã ưu đãi demo: `DAVINES10` (−100.000 ₫, đơn từ 1.000.000 ₫), `WELCOME15` (−15%, tối đa 150.000 ₫, đơn từ 500.000 ₫, chỉ cho đơn đầu tiên của tài khoản / SĐT), `THANG9` (đã hết hạn, để thử lỗi).

## Cấu trúc
| File | Nội dung |
| --- | --- |
| `server.js` | Phục vụ web, đọc và ghi các file CSV |
| `chay-web.bat` | Nhấp đúp để chạy web |
| `data/` | Các file CSV |
| `assets/js/data.js` | Dữ liệu sản phẩm ban đầu, sinh tự động từ `output/products.json` bằng `tools/build_data.py` |
| `assets/js/store.js` | Toàn bộ quy tắc nghiệp vụ: giỏ hàng, giá, voucher, phí ship, đơn hàng, tồn kho, báo cáo |
| `assets/js/ui.js` | Header, footer, thẻ sản phẩm, toast, modal, hóa đơn, kiểm tra form |
| `assets/js/hover-images.js` | Bảng ảnh hover (ảnh gen) cho từng ảnh / dung tích, sinh tự động bằng `tools/build_hover_images.py` từ thư mục `web hinh anh`; ảnh đã thu nhỏ nằm ở `assets/img/products-gen/` |
| `assets/css/style.css` | Style theo Style Guide Figma (Crimson Text + Hanken Grotesk) |
| `*.html` | Trang cửa hàng: trang chủ, sản phẩm, chi tiết, giỏ, đặt hàng, thành công, tra cứu, đăng nhập/đăng ký, tài khoản, giới thiệu |
| `admin/` | Trang quản trị (báo cáo, đơn hàng, sản phẩm, danh mục, tồn kho, voucher) |
| `tests/` | Kịch bản test tự động |

Thêm sản phẩm mới từ crawl: chạy lại `python tools/build_data.py`, rồi tăng số `SEED_VERSION` trong `assets/js/store.js`. Khi mở web, danh mục sản phẩm được cập nhật và vẫn giữ tồn kho, giá, đơn hàng, tài khoản.

## Quy tắc nghiệp vụ đã cài
- Phí giao 20.000 ₫, miễn phí khi tạm tính sau giảm giá từ 500.000 ₫; voucher không trừ vào phí ship.
- COD chỉ cho đơn đến 2.000.000 ₫; VNPay (mô phỏng) giữ hàng 15 phút, đơn chỉ được tạo khi thanh toán thành công.
- Tối đa 10 sản phẩm mỗi dung tích, không vượt tồn kho; sản phẩm hết hàng/ngừng bán hiện "Không khả dụng" và không vào đơn.
- Mã đơn `DV-YYMMDD-NNNN`, tăng dần theo ngày. Đặt xong: trừ kho, xóa sản phẩm đã mua khỏi giỏ.
- Trạng thái đơn: Chờ xác nhận → Đã xác nhận → Đang giao hàng → Đã giao hàng / Giao hàng thất bại (hoàn kho). Khách không tự hủy đơn.
- Giỏ khách vãng lai chỉ giữ trong phiên; khi đăng nhập, giỏ khách được gộp vào giỏ đã lưu của tài khoản.
- Hóa đơn, trang thành công, tra cứu đơn và lịch sử đơn dùng chung một khối tổng tiền nên luôn khớp nhau.

## Ảnh hover sản phẩm
Rê chuột vào ảnh sản phẩm (thẻ ở trang chủ, trang sản phẩm và ảnh lớn ở trang chi tiết) sẽ hiện ảnh gen theo đúng dung tích đang xem. Thêm hoặc đổi ảnh trong `web hinh anh` (đặt tên `TEN_<dung tích>.jpg` và `TEN_da gen_<dung tích>.png` cùng thư mục) rồi chạy `python tools/build_hover_images.py`. Dung tích chưa có ảnh gen thì giữ ảnh gốc.
