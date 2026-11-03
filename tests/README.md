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
