const B = "http://localhost:5500/";
const S = (ms) => new Promise((r) => setTimeout(r, ms));
export default async function (t, check) {
  await t.viewport(1440, 900);
  // ---- SKU rỗng
  await t.go(B + "product.html?id=dau-goi-melu");
  await t.js(`[...document.querySelectorAll('.size-btn')].find(b=>b.innerText.includes('1000')).click()`);
  await t.js(`document.querySelector('#add').click()`);
  const melu = await t.js(`return Store.cart().map(l=>l.name+' '+l.size).join(', ')`);
  check("Thêm MELU 1000 ml vào giỏ đúng dung tích", melu === "MELU Dầu gội 1000 ml", "Giỏ có: " + melu);
  await t.go(B + "product.html?id=dau-goi-prep");
  await t.js(`document.querySelector('.size-btn:not(.out)')?.click(); document.querySelector('#add').click()`);
  const prep = await t.js(`return Store.cart().map(l=>l.name+' '+l.size+'×'+l.qty).join(', ')`);
  check("PREP đang hết hàng nên không vào giỏ", !prep.includes("PREP"), "Giỏ có: " + prep);
  await t.js(`sessionStorage.clear()`);

  // ---- Bảo vệ trang
  await t.go(B + "account.html");
  check("Chưa đăng nhập vào Tài khoản → chuyển sang Đăng nhập", (await t.js(`return location.pathname`)) === "/login.html");
  await t.go(B + "login.html?next=https://evil.example.com");
  await t.js(`const f=document.querySelector('#f'); f.email.value='an.nguyen@email.com'; f.pass.value='Davines@2026'; f.requestSubmit()`);
  await S(600);
  check("Tham số next ra ngoài bị chặn", (await t.js(`return location.host`)) === "localhost:5500", await t.js(`return location.href`));
  await t.js(`Store.logout()`);

  // ---- Đăng ký
  await t.go(B + "login.html?mode=register");
  await t.shot("10-register");
  const regErr = await t.js(`const f=document.querySelector('#f'); f.name.value='Lê Test'; f.email.value='an.nguyen@email.com'; f.phone.value='0987654321'; f.pass.value='abc'; f.pass2.value='abd'; f.requestSubmit(); return [...document.querySelectorAll('.field.error .err')].map(e=>e.innerText).join(' / ')`);
  check("Đăng ký: mật khẩu yếu, nhập lại sai", regErr.includes("8 đến 64") && regErr.includes("không khớp"), regErr);
  const dup = await t.js(`const f=document.querySelector('#f'); f.pass.value='Matkhau123'; f.pass2.value='Matkhau123'; f.agree.checked=true; f.requestSubmit(); return document.querySelector('.field.error .err')?.innerText`);
  check("Đăng ký: email trùng", dup?.includes("đã được đăng ký"), dup);
  // giỏ khách trước khi đăng ký
  await t.go(B + "product.html?id=dau-goi-volu");
  await t.js(`document.querySelector('#add').click()`);
  await t.go(B + "login.html?mode=register");
  await t.js(`const f=document.querySelector('#f'); f.name.value='Lê Test'; f.email.value='le.test@email.com'; f.phone.value='0987654321'; f.pass.value='Matkhau123'; f.pass2.value='Matkhau123'; f.agree.checked=true; f.requestSubmit()`);
  await S(700);
  check("Đăng ký xong KHÔNG tự đăng nhập, chuyển sang Đăng nhập (BR-TK04)", !(await t.js(`return Store.currentUser()?.email`)) && (await t.js(`return document.querySelector('#f').email.value`)) === "le.test@email.com");
  await t.js(`const f=document.querySelector('#f'); f.pass.value='Matkhau123'; f.requestSubmit()`);
  await S(700);
  check("Giỏ khách được giữ khi đăng ký", (await t.js(`return Store.cartCount()`)) === 1);

  // ---- Thông tin cá nhân
  await t.go(B + "account.html");
  await t.shot("11-account");
  const saveDisabled = await t.js(`return document.querySelector('#save').disabled`);
  check("Nút Lưu chỉ bật khi có thay đổi", saveDisabled);
  const bad = await t.js(`const f=document.querySelector('#f'); f.phone.value='12345'; f.dispatchEvent(new Event('input')); f.requestSubmit(); return document.querySelector('.field.error .err')?.innerText`);
  check("Sửa SĐT sai bị báo lỗi", !!bad, bad);
  await t.js(`const f=document.querySelector('#f'); f.phone.value='0911111111'; f.birthday.value='2030-01-01'; f.requestSubmit()`);
  const bday = await t.js(`return Store.currentUser().birthday`);
  check("Không lưu ngày sinh ở tương lai", bday !== "2030-01-01", "Đã lưu: " + bday);

  // ---- Địa chỉ
  await t.go(B + "account.html?tab=address");
  await t.js(`document.querySelector('#add').click(); await new Promise(r=>setTimeout(r,100)); const f=document.querySelector('#af'); f.city.value='TP. Hà Nội'; f.city.onchange(); f.ward.value='Phường Cầu Giấy'; f.line.value='10 Xuân Thủy'; f.requestSubmit()`);
  await S(150);
  await t.js(`document.querySelector('#add').click(); await new Promise(r=>setTimeout(r,100)); const f=document.querySelector('#af'); f.name.value='Người nhận 2'; f.city.value='TP. Hồ Chí Minh'; f.city.onchange(); f.ward.value='Phường Sài Gòn'; f.line.value='2 Đồng Khởi'; f.isDefault.checked=true; f.requestSubmit()`);
  await S(150);
  const addrs = await t.js(`return Store.currentUser().addresses.map(a=>a.line+(a.isDefault?'*':'')).join(', ')`);
  check("Thêm 2 địa chỉ, đổi mặc định", addrs === "10 Xuân Thủy, 2 Đồng Khởi*", addrs);
  await t.js(`document.querySelector('[data-edit]').click(); await new Promise(r=>setTimeout(r,100)); const f=document.querySelector('#af'); f.isDefault.checked=false; f.line.value='10 Xuân Thủy (sửa)'; f.requestSubmit()`);
  await S(150);
  // bỏ chọn mặc định ở địa chỉ đang mặc định
  await t.js(`[...document.querySelectorAll('[data-edit]')][1].click(); await new Promise(r=>setTimeout(r,100)); const f=document.querySelector('#af'); f.isDefault.checked=false; f.requestSubmit()`);
  await S(150);
  const def = await t.js(`return Store.currentUser().addresses.filter(a=>a.isDefault).length`);
  check("Luôn còn đúng 1 địa chỉ mặc định", def === 1, `Số địa chỉ mặc định: ${def}`);
  await t.js(`document.querySelector('[data-del]').click(); await new Promise(r=>setTimeout(r,100)); document.querySelector('[data-ok]').click()`);
  await S(150);
  check("Xóa địa chỉ", (await t.js(`return Store.currentUser().addresses.length`)) === 1);

  // ---- Đặt hàng thành viên
  await t.go(B + "checkout.html");
  const pre = await t.js(`const f=document.querySelector('#form'); return [f.name.value,f.email.value,f.city.value,f.ward.value,f.line.value].join('|')`);
  check("Đặt hàng: điền sẵn địa chỉ mặc định", pre.includes("le.test@email.com") && pre.length > 30, pre);
  const emailEditable = await t.js(`return !document.querySelector('#email').readOnly`);
  check("Email thành viên ở trang đặt hàng bị khóa", !emailEditable);
  await t.js(`document.querySelector('#place').click()`);
  await S(200);
  const code = await t.js(`return Store.db.orders[0].code`);
  await t.waitNav(() => t.js(`document.querySelector('#done').click()`));
  const link = await t.js(`return document.querySelector('a.btn-outline').getAttribute('href')`);
  check("Trang thành công dẫn về Lịch sử đơn của tài khoản", link.includes("account.html"), link);
  await t.go(B + link);
  const modal = await t.js(`return document.querySelector('.modal')?.innerText.slice(0,30)`);
  check("Lịch sử đơn mở sẵn chi tiết đơn vừa đặt", modal?.includes(code), modal);
  await t.shot("12-order-detail");

  // ---- Giỏ lưu theo tài khoản
  await t.go(B + "product.html?id=dau-goi-oi");
  await t.js(`document.querySelector('#add').click()`);
  await t.js(`Store.logout()`);
  await t.go(B + "cart.html");
  check("Đăng xuất: giỏ trống (giỏ thuộc tài khoản)", (await t.js(`return Store.cartCount()`)) === 0);
  await t.go(B + "product.html?id=dau-goi-dede");
  await t.js(`document.querySelector('#add').click()`);
  await t.go(B + "login.html");
  await t.js(`const f=document.querySelector('#f'); f.email.value='le.test@email.com'; f.pass.value='Matkhau123'; f.requestSubmit()`);
  await S(600);
  const merged = await t.js(`return Store.cart().map(l=>l.name).join(', ')`);
  check("Đăng nhập lại: gộp giỏ tài khoản (OI) với giỏ khách (DEDE)", merged.includes("DEDE") && merged.includes("OI"), merged);

  // ---- Đổi mật khẩu
  await t.go(B + "account.html?tab=password");
  const pw = await t.js(`const f=document.querySelector('#f'); f.old.value='sai'; f.pass.value='Matkhau456'; f.pass2.value='Matkhau456'; f.requestSubmit(); return document.querySelector('.field.error .err')?.innerText`);
  check("Đổi mật khẩu: sai mật khẩu cũ", pw?.includes("không đúng"), pw);
  await t.js(`const f=document.querySelector('#f'); f.old.value='Matkhau123'; f.requestSubmit()`);
  await t.js(`Store.logout()`);
  check("Đăng nhập bằng mật khẩu mới", (await t.js(`return Store.login('le.test@email.com','Matkhau456').ok`)) === true);

  // ---- Quên mật khẩu
  await t.js(`Store.logout()`);
  await t.go(B + "login.html");
  await t.js(`document.querySelector('#forgot').click(); await new Promise(r=>setTimeout(r,100)); const f=document.querySelector('#ff'); f.email.value='le.test@email.com'; f.requestSubmit()`);
  check("Quên mật khẩu: email đã đăng ký → có liên kết (hộp thư mô phỏng)", (await t.js(`return !!document.querySelector('a[href*="reset="]')`)));
  await t.go(B + "login.html");
  const notReg = await t.js(`document.querySelector('#forgot').click(); await new Promise(r=>setTimeout(r,100)); const f=document.querySelector('#ff'); f.email.value='khongco@email.com'; f.requestSubmit(); return document.querySelector('#ff .err')?.innerText`);
  check("Quên mật khẩu: email chưa đăng ký → báo lỗi, không gửi", notReg?.includes("Email chưa được đăng ký"), notReg);

  // ---- Đơn hàng của khách vãng lai cùng email
  const guestSameEmail = await t.js(`return Store.db.orders.filter(o=>o.customer.email==='an.nguyen@email.com' && !o.userId).length`);
  await t.js(`Store.register({name:'Kẻ lạ',email:'khach1@email.com',phone:'0912345670',pass:'Matkhau123'})`);
  const leak = await t.js(`return Store.myOrders().length`);
  check("Đăng ký bằng email của khách vãng lai không xem được đơn của họ", leak === 0, `${leak} đơn`);
}
