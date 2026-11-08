# Test tự động

Cần web đang chạy ở http://localhost:5500 và Microsoft Edge.

```
cd website/tests
node cdp.mjs t_guest.mjs out_guest
node cdp.mjs t_member.mjs out_member
node cdp.mjs t_admin.mjs out_admin
node cdp.mjs t_mobile.mjs out_mobile
```

Kết quả PASS/FAIL in ra màn hình, ảnh chụp nằm trong thư mục out_*.

node cdp.mjs t_feedback.mjs out_feedback

Test lưu CSV cần server riêng với thư mục dữ liệu tạm: đặt biến PORT và DATA_DIR giống nhau cho `node ../server.js` và `node cdp.mjs t_csv.mjs out_csv`.
