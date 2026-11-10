// Kiểm tra các lỗi được báo trong bảng ca kiểm thử (TC-UC01-04 ... TC-UC20-02). Chạy trên dữ liệu mới, server cổng 5500.
const B = "http://localhost:5500/";
const S = (ms) => new Promise((r) => setTimeout(r, ms));
export default async function (t, check) {
  const toasts = () => t.js(`return [...document.querySelectorAll('.toast')].map(e=>e.innerText).join(' | ')`);
  const errs = () => t.js(`return [...document.querySelectorAll('.field.error .err')].map(e=>e.innerText).join(' / ')`);
  await t.viewport(1440, 900);
  // đưa mọi lời gọi ghi /api/db về địa chỉ hỏng (mô phỏng nguồn lưu lỗi) hoặc trả lại bình thường
  const breakSave = (on) => t.js(`
    if (!window.__open) window.__open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = ${on} ? function (m, u, a) { return window.__open.call(this, m, m === 'POST' ? '/api/nope' : u, a); } : window.__open;`);
  const breakAll = (on) => t.js(`
    if (!window.__open) window.__open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = ${on} ? function (m, u, a) { return window.__open.call(this, m, '/api/nope', a); } : window.__open;`);

  // ================= TC-UC07-05: mật khẩu tối đa 64 ký tự
  await t.go(B + "index.html");
  const pw = await t.js(`const v=UI.V.password; return [v('a'.repeat(63)+'1'), v('a'.repeat(64)+'1'), v('a'.repeat(7)), v('abcdefgh'), v('Abcdef1!')].map(x=>x?'lỗi':'ok').join(',')`);
  check("Mật khẩu 64 ký tự hợp lệ, 65 ký tự bị chặn", pw === "ok,lỗi,lỗi,lỗi,ok", pw);

  // ================= TC-UC20-02: đổi mật khẩu, để trống cả ba ô
  await t.js(`Store.login('an.nguyen@email.com','Davines@2026')`);
  await t.go(B + "account.html?tab=password");
  await t.js(`document.querySelector('#f').requestSubmit()`);
  const blank = await errs();
  check("Đổi mật khẩu để trống: báo lỗi cả ô nhập lại mật khẩu mới", blank.split(" / ").length === 3 && blank.includes("nhập lại mật khẩu"), blank);

  // ================= TC-UC13-03: quyền xem đơn
  await t.go(B + "account.html?tab=orders&code=DV-261001-0001");
  await S(200);
  check("Member mở đơn không thuộc tài khoản: bị từ chối và có thông báo", (await toasts()).includes("Không thể truy cập đơn hàng"), await toasts());
  await t.go(B + "account.html?tab=orders&code=DV-999999-9999");
  await S(200);
  check("Mở đơn không tồn tại: có thông báo", (await toasts()).includes("Không thể truy cập đơn hàng"), await toasts());
  await t.js(`Store.logout()`);
  await t.go(B + "account.html?tab=orders&code=DV-261001-0001");
  await S(300);
  const guest = await t.js(`return location.pathname + location.search + ' | ' + document.body.innerText.includes('Vui lòng đăng nhập để xem')`);
  check("Guest mở trực tiếp đơn Member: về trang đăng nhập kèm thông báo", guest.includes("login.html") && guest.includes("| true"), guest);

  // ================= TC-UC05-04: lỗi ghi phiên đăng nhập
  await t.go(B + "login.html");
  await t.js(`const real = Storage.prototype.setItem; window.__real = real; Storage.prototype.setItem = function (k, v) { if (k === 'davines_session') throw new Error('quota'); return real.call(this, k, v); };`);
  await t.js(`const f=document.querySelector('#f'); f.email.value='an.nguyen@email.com'; f.pass.value='Davines@2026'; f.requestSubmit()`);
  await S(300);
  const lf = await t.js(`return [location.pathname, document.body.innerText.includes('Chưa thể đăng nhập, vui lòng thử lại'), Store.currentUser() === null].join('|')`);
  check("Lỗi ghi phiên: báo \"Chưa thể đăng nhập, vui lòng thử lại\", vẫn là Guest", lf === "/login.html|true|true", lf);
  await t.js(`Storage.prototype.setItem = window.__real`);

  // ================= TC-UC04-05: lỗi lưu khi đăng ký, rồi thử lại
  await t.go(B + "login.html?mode=register");
  await breakSave(true);
  await t.js(`const f=document.querySelector('#f'); f.name.value='Khach Loi'; f.email.value='loi@test.vn'; f.phone.value='0987654321'; f.pass.value='Matkhau123'; f.pass2.value='Matkhau123'; f.agree.checked=true; f.requestSubmit()`);
  await S(300);
  const rf = await t.js(`const f=document.querySelector('#f'); return [document.body.innerText.includes('Đăng ký chưa thành công, vui lòng thử lại'), f.email.value, f.pass.value === '', Store.db.users.some(u=>u.email==='loi@test.vn')].join('|')`);
  check("Lỗi lưu khi đăng ký: báo lỗi, giữ thông tin (trừ mật khẩu), không tạo tài khoản", rf === "true|loi@test.vn|true|false", rf);
  await breakSave(false);
  await t.js(`const f=document.querySelector('#f'); f.pass.value='Matkhau123'; f.pass2.value='Matkhau123'; f.requestSubmit()`);
  await S(500);
  const rf2 = await t.js(`return [document.body.innerText.includes('Đăng ký thành công'), document.body.innerText.includes('đã được đăng ký')].join('|')`);
  check("Thử lại đăng ký sau khi hết lỗi: thành công, không báo email trùng", rf2 === "true|false", rf2);

  // ================= TC-UC08-08: lỗi lưu hồ sơ / địa chỉ
  await t.js(`Store.login('an.nguyen@email.com','Davines@2026')`);
  await t.go(B + "account.html?tab=info");
  await breakSave(true);
  await t.js(`const f=document.querySelector('#f'); f.name.value='Ten Moi Loi'; f.dispatchEvent(new Event('input',{bubbles:true})); f.requestSubmit()`);
  await S(300);
  const pf = await t.js(`return [document.body.innerText.includes('Lưu không thành công'), document.querySelector('#f').name.value, Store.currentUser().name].join('|')`);
  check("Lỗi lưu hồ sơ: báo không thành công, giữ dữ liệu cũ và dữ liệu vừa nhập trên biểu mẫu", pf === "true|Ten Moi Loi|Nguyễn Văn An", pf);
  await t.go(B + "account.html?tab=address");
  await breakSave(true);
  await t.js(`document.querySelector('#add').click()`);
  await S(150);
  await t.js(`const f=document.querySelector('#af'); f.name.value='Nguoi Moi'; f.phone.value='0912345678'; f.city.value=f.city.options[1].value; f.city.onchange && f.city.onchange(); f.ward.value=f.ward.options[1].value; f.line.value='12 Duong Thu'; f.requestSubmit()`);
  await S(300);
  const af = await t.js(`return [!!document.querySelector('#af'), Store.currentUser().addresses.length].join('|')`);
  check("Lỗi lưu địa chỉ: giữ biểu mẫu mở, không thêm địa chỉ", af === "true|1", af);
  await breakSave(false);
  await t.js(`document.querySelector('#af').requestSubmit()`);
  await S(400);
  check("Thử lại sau khi hết lỗi: thêm địa chỉ thành công, không trùng", (await t.js(`return Store.currentUser().addresses.length`)) === 2);

  // ================= TC-UC08-06: thông báo khi đặt mặc định và xóa địa chỉ
  await t.go(B + "account.html?tab=address");
  await t.js(`document.querySelector('[data-def]').click()`);
  await S(200);
  check("Đặt địa chỉ mặc định: có thông báo thành công riêng", (await toasts()).includes("địa chỉ mặc định"), await toasts());
  await t.js(`document.querySelector('[data-del]').click()`);
  await S(200);
  await t.js(`document.querySelector('[data-ok]').click()`);
  await S(250);
  check("Xóa địa chỉ: có thông báo thành công riêng", (await toasts()).includes("Đã xóa địa chỉ"), await toasts());

  // ================= TC-UC08-09: phiên hết hạn sau 30 phút không thao tác
  await t.go(B + "account.html?tab=address");
  const before = await t.js(`return Store.currentUser().addresses.length`);
  await t.js(`const real = Date.now.bind(Date); Date.now = () => real() + 31 * 60000; document.querySelector('#add').click()`);
  await S(600);
  const ex = await t.js(`return [location.pathname, document.body.innerText.includes('Phiên đăng nhập đã hết hạn'), Store.currentUser() === null].join('|')`);
  check("Phiên quá 30 phút: thao tác chuyển về đăng nhập kèm thông báo hết hạn", ex === "/login.html|true|true", ex);
  const after = await t.js(`return (await fetch('/api/db').then(r=>r.json())).db.users.find(u=>u.email==='an.nguyen@email.com').addresses.length`);
  check("Phiên hết hạn: dữ liệu cũ giữ nguyên", after === before, `${before} -> ${after}`);
  // Còn trong 30 phút thì vẫn dùng được
  await t.js(`Store.login('an.nguyen@email.com','Davines@2026')`);
  await t.go(B + "account.html?tab=address");
  await t.js(`const real = Date.now.bind(Date); Date.now = () => real() + 20 * 60000; document.querySelector('#add').click()`);
  await S(250);
  check("Dưới 30 phút: vẫn thao tác bình thường", await t.js(`return !!document.querySelector('#af') && location.pathname.endsWith('account.html')`));
  await t.js(`Store.logout()`);

  // ================= TC-UC09-02: số lượng giỏ hàng và trang sản phẩm
  await t.go(B + "product.html?id=dau-goi-momo");
  await t.js(`document.querySelector('.size-btn:not(.out)').click()`);
  const pq = await t.js(`const q=document.querySelector('#qty'); document.querySelector('#plus').click(); document.querySelector('#plus').click(); const base=q.value; const out=[base]; for (const v of ['', '0', '-1.5', '1.5', '999']) { q.value=v; q.onchange(); out.push(q.value); } return out.join(',')`);
  check("Trang sản phẩm: số lượng rỗng / 0 / âm / thập phân / vượt mức giữ nguyên số cũ", pq === "3,3,3,3,3,3", pq);
  await t.js(`document.querySelector('#add').click()`);
  await t.go(B + "cart.html");
  const cq = await t.js(`const i=document.querySelector('[data-qty]'); const out=[i.value]; for (const v of ['', '0', '-1.5', '1.5', '999']) { const el=document.querySelector('[data-qty]'); el.value=v; el.onchange(); out.push(document.querySelector('[data-qty]').value); } return out.join(',')`);
  check("Giỏ hàng: nhập số lượng sai thì báo lỗi và giữ số lượng trước đó", cq === "3,3,3,3,3,3", cq);
  await t.js(`const el=document.querySelector('[data-qty]'); el.value='2'; el.onchange();`);
  check("Giỏ hàng: số lượng hợp lệ được cập nhật", (await t.js(`return document.querySelector('[data-qty]').value`)) === "2");

  // ================= TC-UC01-04: sắp xếp về trang 1
  await t.go(B + "products.html?page=2");
  await t.js(`const s=document.querySelector('#sort'); s.value='price-asc'; s.onchange({target:s})`);
  await S(150);
  const pg = await t.js(`return document.querySelector('#pager button.on')?.innerText + '|' + location.search`);
  check("Đổi cách sắp xếp khi đang ở trang 2: về trang 1", pg.startsWith("1|") && !pg.includes("page=2"), pg);

  // ================= TC-UC10-04: nguồn dữ liệu lỗi khi tra cứu
  await t.go(B + "order-lookup.html");
  await breakAll(true);
  await t.js(`const f=document.querySelector('#form'); f.code.value='DV-261001-0001'; f.email.value='x@y.vn'; f.requestSubmit()`);
  await S(200);
  const lk = await t.js(`const r=document.querySelector('#result').innerText; return [r.includes('Không thể hoàn tất tra cứu'), r.includes('Không tìm thấy đơn hàng')].join('|')`);
  check("Nguồn lỗi 503/không đọc được: báo lỗi truy xuất, không báo \"không tìm thấy\"", lk === "true|false", lk);
  await breakAll(false);
  await t.js(`document.querySelector('#retry').click()`);
  await S(200);
  check("Khôi phục nguồn rồi tra cứu lại: kết quả đúng", (await t.js(`return document.querySelector('#result').innerText`)).includes("Không tìm thấy đơn hàng"));

  // ================= TC-UC11-04: dữ liệu đổi trước khi sang VNPay; TC-UC12-03: rời trang khi cổng còn mở
  const fill = `const f=document.querySelector('#form'); f.name.value='A'; f.phone.value='0912222333'; f.email.value='a@test.vn'; f.city.value='TP. Cần Thơ'; f.city.onchange(); f.ward.value='Phường Ninh Kiều'; f.line.value='1'; document.querySelector('[value=vnpay]').click();`;
  await t.go(B + "checkout.html");
  await t.js(fill);
  await t.js(`await fetch('/api/db').then(r=>r.json()).then(j=>{ const p=j.db.products.find(p=>p.id==='dau-goi-momo'); p.variants.forEach(v=>{ v.price += 60000; }); return fetch('/api/db',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(j.db)}); })`);
  await t.js(`document.querySelector('#place').click()`);
  await S(400);
  const vp = await t.js(`const m=document.querySelector('.modal'); return m ? (m.innerText.toLowerCase().includes('cổng thanh toán vnpay') ? 'vnpay' : m.innerText.includes('cần kiểm tra lại') ? 'kiểm tra lại' : m.innerText.slice(0, 60)) : 'không có modal'`);
  check("Giá đổi trước khi thanh toán: chặn, không mở VNPay, yêu cầu kiểm tra lại", vp === "kiểm tra lại", vp);
  await t.js(`document.querySelectorAll('.modal-back').forEach(m=>m.remove())`);
  await t.js(fill);
  await t.js(`document.querySelector('#place').click()`);
  await S(300);
  check("Dữ liệu đã xác nhận lại: mở được cổng VNPay", (await t.js(`return !!document.querySelector('.modal')?.innerText.toLowerCase().includes('cổng thanh toán vnpay')`)));
  await t.go(B + "index.html");
  await S(700);
  check("Rời trang khi cổng VNPay còn mở: báo thanh toán chưa hoàn tất", (await toasts()).includes("Thanh toán VNPay chưa hoàn tất"), await toasts());
  check("Rời trang khi thanh toán dở: không tạo đơn, giữ giỏ hàng", await t.js(`return !Store.db.orders.some(o => o.customer.email === 'a@test.vn') && Store.cartCount() > 0`));

  // ================= Quản trị
  await t.js(`Store.adminLogin('admin@davines.vn','Admin@2026')`);
  // TC-UC19-02: kỳ quá 12 tháng
  await t.go(B + "admin/index.html#report");
  await S(300);
  const rep = await t.js(`
    const today = Store.today(); const [Y, M, D] = today.split('-');
    const exact = (+Y - 1) + '-' + M + '-' + D;
    const d = new Date(exact + 'T00:00:00'); d.setDate(d.getDate() - 1);
    const over = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const f = document.querySelector('#rf');
    const run = (a, b) => { f.from.value = a; f.to.value = b; f.requestSubmit(); return [...document.querySelectorAll('.field.error .err')].map(e => e.innerText).join(''); };
    return [run(over, today), run(exact, today), run(today, over)].join(' || ')`);
  const [overErr, exactErr, revErr] = rep.split(" || ");
  check("Kỳ 1 năm 1 ngày: báo vượt 12 tháng", overErr.includes("tối đa 12 tháng"), overErr);
  check("Kỳ đúng 12 tháng kết thúc hôm nay: hợp lệ", exactErr === "", exactErr);
  check("Ngày bắt đầu sau ngày kết thúc: báo lỗi", revErr.includes("Phải sau ngày bắt đầu"), revErr);
  // TC-UC19-03: không có dữ liệu
  const empty = await t.js(`const f=document.querySelector('#rf'); f.from.value='2020-01-01'; f.to.value='2020-01-31'; f.requestSubmit(); const a=document.querySelector('#rep').innerText.includes('Không có dữ liệu phù hợp'); f.from.value='2026-10-01'; f.to.value='2026-10-31'; f.requestSubmit(); const b=document.querySelector('#rep').innerText.includes('Doanh thu'); return [a,b].join('|')`);
  check("Kỳ không có đơn: báo không có dữ liệu; đổi kỳ có dữ liệu thì hiện lại báo cáo", empty === "true|true", empty);
  // TC-UC14-03: ngừng bán / mở bán lại có thông báo
  await t.go(B + "admin/index.html?x=1#products");
  await S(300);
  await t.js(`const q=document.querySelector('#pq'); q.value='nounou d'; q.oninput(); document.querySelector('[data-t="dau-goi-nounou"]').click()`);
  await S(200);
  await t.js(`document.querySelector('[data-ok]').click()`);
  await S(250);
  const stopT = await toasts();
  await t.js(`document.querySelector('[data-t="dau-goi-nounou"]').click()`);
  await S(250);
  const openT = await toasts();
  check("Ngừng bán và mở bán lại: có thông báo thành công", stopT.includes("Đã ngừng bán") && openT.includes("Đã mở bán lại"), stopT + " // " + openT);
  // TC-UC14-04: dung tích 0 ml
  await t.js(`const q=document.querySelector('#pq'); q.value='momo d'; q.oninput(); document.querySelector('[data-e="dau-goi-momo"]').click()`);
  await S(200);
  await t.js(`const i=document.querySelector('#vt [data-f=size]'); i.value='0 ml'; i.dispatchEvent(new Event('input')); document.querySelector('#ef').requestSubmit()`);
  await S(250);
  const sz = await t.js(`return [...document.querySelectorAll('.toast')].map(e=>e.innerText).join('|') + '#' + Store.product('dau-goi-momo').variants[0].size`);
  check("Dung tích 0 ml bị chặn, không lưu", sz.includes("Dung tích phải có số lớn hơn 0") && !sz.endsWith("#0 ml"), sz);
}
