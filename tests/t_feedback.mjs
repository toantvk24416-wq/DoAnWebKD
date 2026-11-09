// Kiểm tra các mục góp ý trong 2 tài liệu TestWeb và FBWEB. Chạy: node cdp.mjs t_feedback.mjs out_feedback
const B = `http://localhost:${process.env.PORT || 5500}/`;
const S = (ms) => new Promise((r) => setTimeout(r, ms));
export default async function (t, check) {
  await t.viewport(1440, 900);
  // --- TestWeb 1: hết hàng luôn nằm cuối
  for (const sort of ["new", "best", "price-asc", "price-desc", "name"]) {
    await t.go(B + "products.html?sort=" + sort);
    const r = await t.js(`const names=[...document.querySelectorAll('.card h3')].map(h=>h.innerText); const out=names.map(n=>!Store.inStock(Store.products().find(p=>p.name===n))); const first=out.indexOf(true); return {n:names.length, firstOut:first, ok:first<0||out.slice(first).every(Boolean), head:names.slice(0,3).join(', ')}`);
    check(`Hết hàng nằm cuối khi sắp xếp ${sort}`, r.ok, JSON.stringify(r));
  }
  // --- TestWeb 2: mô tả không ghi dung tích
  await t.go(B + "product.html?id=dau-goi-love-curl");
  const desc = await t.js(`return document.querySelector('.accordion details p').innerText`);
  check("Mô tả không ghi dung tích", !/\d+\s*(ml|g)\b/i.test(desc), desc);
  const content = await t.js(`return [...document.querySelectorAll('.accordion summary')].map(s=>s.innerText).join(',')`);
  check("Vẫn giữ mục Công dụng / Thành phần", content.includes("Công dụng") && content.includes("Thành phần"), content);
  // --- TestWeb 3: tách nhóm da đầu
  await t.go(B + "products.html");
  const groups = await t.js(`const out={}; document.querySelectorAll('#filters fieldset').forEach(f=>out[f.querySelector('h4').innerText]=[...f.querySelectorAll('label')].map(l=>l.innerText.trim())); return out`);
  const hairKey = Object.keys(groups).find((k) => /^loại tóc$/i.test(k)), scalpKey = Object.keys(groups).find((k) => /da đầu/i.test(k));
  check("Tách Loại tóc và Tình trạng da đầu", !!scalpKey && groups[hairKey].every((x) => !/^da đầu/i.test(x)) && groups[scalpKey].every((x) => /^da đầu/i.test(x)), JSON.stringify(groups[scalpKey]));
  // --- TestWeb 4: gợi ý sát nhu cầu
  await t.go(B + "products.html?hair=T%C3%B3c%20kh%C3%B4");
  const dry = await t.js(`return [...document.querySelectorAll('.card h3')].map(h=>{const p=Store.products().find(x=>x.name===h.innerText);return {n:p.name,spec:p.hair.includes('Tóc khô'),inS:Store.inStock(p)}})`);
  const stock = dry.filter((x) => x.inS), firstGeneric = stock.findIndex((x) => !x.spec);
  check("Tóc khô: sản phẩm đúng loại tóc đứng trước 'Mọi loại tóc'", stock[0].spec && (firstGeneric < 0 || stock.slice(firstGeneric).every((x) => !x.spec)), dry.slice(0, 5).map((x) => x.n).join(", "));
  await t.go(B + "index.html");
  const dau = await t.js(`const a=[...document.querySelectorAll('.concern')].find(a=>a.innerText.includes('Da đầu dầu')); return a.getAttribute('href')`);
  check("Ô Da đầu dầu dùng nhóm da đầu", dau.includes("scalp="), dau);
  // --- TestWeb 5: WELCOME15 chỉ đơn đầu
  await t.js(`const p=Store.product('dau-goi-momo'); Store.addToCart(p.variants[0].sku,1)`);
  await t.go(B + "checkout.html");
  await t.js(`const f=document.querySelector('#form'); f.name.value='Khách Mới'; f.phone.value='0977000111'; f.email.value='moi@test.vn'; f.city.value='TP. Hà Nội'; f.city.onchange(); f.ward.value='Phường Ba Đình'; f.line.value='1 A'; document.querySelector('#pick-v').click(); await new Promise(r=>setTimeout(r,100)); const v=document.querySelector('#vform'); v.code.value='WELCOME15'; v.requestSubmit(); await new Promise(r=>setTimeout(r,100)); document.querySelector('[value=cod]').click(); document.querySelector('#place').click()`);
  await S(200);
  const o1 = await t.js(`return Store.db.orders[0].voucher`);
  check("WELCOME15 dùng được ở đơn đầu", o1 === "WELCOME15", String(o1));
  const again = await t.js(`return Store.checkVoucher('WELCOME15',600000,{phone:'0977000111'}).error`);
  check("WELCOME15 bị chặn lần 2 cùng SĐT", !!again, again);
  // --- FB UC01
  await t.go(B + "products.html");
  check("24 sản phẩm mỗi trang (BR-SP07)", (await t.js(`return document.querySelectorAll('.card').length`)) === 24);
  // --- FB UC02
  const blank = await t.js(`const q=document.querySelector('#q'); q.value='   '; document.querySelector('#search-form').requestSubmit(); await new Promise(r=>setTimeout(r,100)); return document.querySelector('#q-err').innerText`);
  check("Chỉ nhập khoảng trắng: báo lỗi từ khóa", blank.includes("2 đến 100"), blank);
  await t.js(`document.querySelector('#btn-search').click(); const f=document.querySelector('#search-bar form'); f.q.value='   '; f.requestSubmit()`);
  await S(150);
  check("Ô tìm trên header: khoảng trắng không chuyển trang, báo lỗi", (await t.js(`return document.querySelector('#search-bar .err').innerText`)).includes("2 đến 100"));
  // --- FB UC04
  await t.go(B + "login.html?mode=register");
  const promo = await t.js(`return !document.querySelector('[name=promo]')`);
  check("Không còn ô nhận tin khuyến mãi (góp ý lần 02)", promo === true);
  const clearErr = await t.js(`const f=document.querySelector('#f'); f.requestSubmit(); await new Promise(r=>setTimeout(r,50)); const before=f.name.closest('.field').classList.contains('error'); f.name.value='A'; f.name.dispatchEvent(new Event('input',{bubbles:true})); return before+'|'+f.name.closest('.field').classList.contains('error')`);
  check("Gõ lại thì dòng báo lỗi mất ngay", clearErr === "true|false", clearErr);
  const dup = await t.js(`const f=document.querySelector('#f'); f.name.value='A B'; f.email.value='an.nguyen@email.com'; f.phone.value='0987654321'; f.pass.value='Matkhau123'; f.pass2.value='Matkhau123'; f.agree.checked=true; f.requestSubmit(); await new Promise(r=>setTimeout(r,100)); return {t:f.email.closest('.field').innerText, l:!!document.querySelector('#dup-login'), q:!!document.querySelector('#dup-forgot')}`);
  check("Email trùng: gợi ý Đăng nhập / Quên mật khẩu", dup.l && dup.q, dup.t);
  await t.js(`const f=document.querySelector('#f'); f.email.value='moi2@test.vn'; f.requestSubmit()`);
  await S(400);
  const afterReg = await t.js(`return {u:!!Store.currentUser(), page:document.querySelector('h1').innerText, email:document.querySelector('#email')?.value}`);
  check("Đăng ký xong không tự đăng nhập, sang Đăng nhập điền sẵn email", !afterReg.u && afterReg.page === "Đăng nhập" && afterReg.email === "moi2@test.vn", JSON.stringify(afterReg));
  // --- FB UC05
  await t.go(B + "products.html?q=momo");
  const href = await t.js(`return document.querySelector('.header-icons a').getAttribute('href')`);
  await t.go(B + href);
  await t.js(`const f=document.querySelector('#f'); f.email.value='moi2@test.vn'; f.pass.value='Matkhau123'; f.requestSubmit()`);
  await S(800);
  const back = await t.js(`return location.pathname+location.search`);
  check("Đăng nhập xong quay về trang đang xem", back.startsWith("/products.html?q=momo"), back);
  await t.js(`Store.logout()`);
  await t.go("about:blank");
  await t.go(B + "login.html");
  await t.js(`const f=document.querySelector('#f'); f.email.value='moi2@test.vn'; f.pass.value='Matkhau123'; f.requestSubmit()`);
  await S(800);
  const home = await t.js(`return location.pathname`);
  check("Vào thẳng trang đăng nhập: xong về trang chủ", /index\.html|\/$/.test(home), home);
  await t.js(`Store.logout()`);
  // --- FB UC07
  await t.go(B + "login.html");
  const noMail = await t.js(`document.querySelector('#forgot').click(); await new Promise(r=>setTimeout(r,100)); const f=document.querySelector('.modal form'); f.email.value='chuaco@test.vn'; f.requestSubmit(); await new Promise(r=>setTimeout(r,100)); return document.querySelector('.modal').innerText`);
  check("Quên mật khẩu, email chưa đăng ký: báo đúng", noMail.includes("Email chưa được đăng ký"), "");
  await t.go(B + "login.html");
  const reset = await t.js(`document.querySelector('#forgot').click(); await new Promise(r=>setTimeout(r,100)); const f=document.querySelector('.modal form'); f.email.value='moi2@test.vn'; f.requestSubmit(); await new Promise(r=>setTimeout(r,150)); return document.querySelector('.modal')?.innerText || document.body.innerText.slice(0,200)`);
  check("Quên mật khẩu, email đã đăng ký: có liên kết đặt lại (mô phỏng)", /liên kết|đặt lại/i.test(reset), reset.slice(0, 140).replace(/\n+/g, " | "));
  const tk = await t.js(`const r=Store.requestReset('moi2@test.vn'); const ok=Store.resetPassword(r.token,'Matkhau999'); return ok.ok && Store.login('moi2@test.vn','Matkhau999').ok`);
  check("Đặt lại mật khẩu rồi đăng nhập được", tk === true);
  // --- FB UC08
  await t.go(B + "account.html");
  const gender = await t.js(`const f=document.querySelector('#f'); const has=f.querySelectorAll('[name=gender]').length; f.querySelector('[name=gender][value=female]').click(); f.phone.value='0987654321'; f.requestSubmit(); await new Promise(r=>setTimeout(r,100)); return has+'|'+Store.currentUser().gender`);
  check("Có và lưu được Giới tính", gender.endsWith("female"), gender);
  const addr = await t.js(`const base={name:'A',phone:'0912345678',city:'TP. Hà Nội',ward:'Phường Ba Đình',isDefault:false}; const res=[]; for(let i=1;i<=11;i++) { res.push(Store.saveAddress({...base,line:'Số '+i}).ok); await new Promise(r=>setTimeout(r,3)); } return {res:res.filter(Boolean).length, count:Store.currentUser().addresses.length}`);
  check("Tối đa 10 địa chỉ, chặn địa chỉ thứ 11", addr.res === 10 && addr.count === 10, JSON.stringify(addr));
  await t.go(B + "account.html?tab=address");
  const addBtn = await t.js(`document.querySelector('#add').click(); await new Promise(r=>setTimeout(r,100)); return {modal:!!document.querySelector('.modal'), toast:[...document.querySelectorAll('.toast')].pop()?.innerText}`);
  check("Trang địa chỉ: bấm thêm khi đủ 10 báo lỗi", !addBtn.modal && /tối đa 10/i.test(addBtn.toast || ""), addBtn.toast);
  const defDel = await t.js(`const u=Store.currentUser(); const d=u.addresses.find(a=>a.isDefault); Store.deleteAddress(d.id); const a=Store.currentUser().addresses; return a.filter(x=>x.isDefault).length+'|'+a[a.length-1].isDefault`);
  check("Xóa địa chỉ mặc định: địa chỉ mới nhất thành mặc định", defDel === "1|true", defDel);
  // --- FB UC11
  await t.js(`Store.logout()`);
  await t.go(B + "order-lookup.html");
  const cod = await t.js(`const o=Store.db.orders.find(o=>o.payment==='cod'&&!o.paid); const f=document.querySelector('#form'); f.code.value=o.code; f.email.value=o.customer.email; f.requestSubmit(); await new Promise(r=>setTimeout(r,100)); return document.querySelector('#result').innerText`);
  check("Đơn COD chỉ ghi 'Thanh toán khi nhận hàng'", cod.includes("Thanh toán khi nhận hàng") && !cod.includes("Chưa thanh toán"), "");
  const hide = await t.js(`const f=document.querySelector('#form'); f.code.value='DV12'; f.requestSubmit(); await new Promise(r=>setTimeout(r,100)); return document.querySelector('#result').innerText.trim()`);
  check("Tra cứu sai mã: ẩn kết quả cũ", hide === "", hide.slice(0, 50));
  // --- Không mất phần đã làm
  await t.go(B + "products.html");
  await t.js(`document.querySelectorAll('img[loading=lazy]').forEach(i=>i.loading='eager'); await new Promise(r=>setTimeout(r,600))`);
  const frames = await t.js(`return [...new Set([...document.querySelectorAll('.card .img')].map(e=>{const r=e.getBoundingClientRect();return Math.round(r.width)+'x'+Math.round(r.height)}))]`);
  check("Khung ảnh vẫn đồng nhất", frames.length === 1, frames.join(","));
  await t.shot("products-merged");
  await t.go(B + "admin/login.html"); await S(300);
  check("Link quản trị cũ chuyển về tab Quản trị", (await t.js(`return document.querySelector('#tabs .on')?.innerText`)).toLowerCase().includes("quản trị"));
}
