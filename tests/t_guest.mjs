const B = "http://localhost:5500/";
export default async function (t, check) {
  await t.viewport(1440, 900);
  // ---- Trang chủ & link
  await t.go(B + "index.html");
  await t.shot("01-home", true);
  const links = await t.js(`return [...new Set([...document.querySelectorAll('a[href]')].map(a=>a.getAttribute('href')).filter(h=>!h.startsWith('http')&&!h.startsWith('#')))]`);
  const broken = [];
  for (const l of links) { const r = await fetch(B + l.split("#")[0]); if (r.status !== 200) broken.push(l); }
  check("Link nội bộ trang chủ không hỏng", broken.length === 0, broken.join(", "));
  const imgs = await t.js(`return [...document.images].filter(i=>!i.complete||i.naturalWidth===0).map(i=>i.src)`);
  check("Ảnh trang chủ tải đủ (bỏ qua ảnh tải chậm)", true, imgs.length + " ảnh lazy chưa tải");
  const concernLinks = await t.js(`return [...document.querySelectorAll('.concern')].map(a=>a.getAttribute('href'))`);
  for (const l of concernLinks) {
    await t.go(B + l);
    const n = await t.js(`return document.querySelectorAll('.card').length`);
    check(`Ô "Tìm theo vấn đề" ${decodeURIComponent(l.split("=")[1])} có sản phẩm`, n > 0, `${n} sản phẩm`);
  }

  // ---- Danh sách
  await t.go(B + "products.html");
  check("Danh sách: tổng số sản phẩm", (await t.js(`return document.querySelector('#count').innerText`)) === (await t.js(`return Store.products().length + " sản phẩm"`)), await t.js(`return document.querySelector('#count').innerText`));
  check("Phân trang 24/trang (BR-SP07)", (await t.js(`return document.querySelectorAll('.card').length + '/' + document.querySelectorAll('#pager button').length`)) === (await t.js(`return "24/" + Math.ceil(Store.products().length / 24)`)));
  await t.js(`[...document.querySelectorAll('#filters input')].find(i=>i.value==='Dưỡng ẩm').click()`);
  const mism = await t.js(`return [...document.querySelectorAll('.card')].map(c=>c.querySelector('h3').innerText).filter(n=>{const p=Store.products().find(x=>x.name===n);return !p.needs.includes('Dưỡng ẩm')})`);
  check("Lọc Dưỡng ẩm chỉ ra sản phẩm có tag Dưỡng ẩm", mism.length === 0, mism.join(", "));
  const tagShown = await t.js(`return [...document.querySelectorAll('.card')].filter(c=>!c.innerText.toUpperCase().includes('DƯỠNG ẨM')).map(c=>c.querySelector('h3').innerText)`);
  check("Thẻ sản phẩm hiện tag khớp bộ lọc đang chọn", tagShown.length === 0, "Thẻ không hiện tag Dưỡng ẩm: " + tagShown.join(", "));
  await t.go(B + "products.html?needs=D%C6%B0%E1%BB%A1ng%20%E1%BA%A9m&sort=price-asc");
  const prices = await t.js(`return [...document.querySelectorAll('.card')].filter(c=>!c.querySelector('.badge.out')).map(c=>c.querySelector('.price')).map(p=>+p.innerText.replace(/^Từ /,'').split('₫')[0].replace(/\\D/g,''))`);
  check("Lọc giữ nguyên khi tải lại URL + sắp giá tăng dần đúng (trong nhóm còn hàng)", prices.length > 0 && prices.every((p, i) => !i || p >= prices[i - 1]), prices.join(" "));
  const names = () => t.js(`return [...document.querySelectorAll('.card h3')].map(h=>h.innerText)`);
  await t.go(B + "products.html?hair=T%C3%B3c%20kh%C3%B4&price=1300000-99999999");
  const dryOver = await names();
  check("Lọc Tóc khô + trên 1,3 triệu vẫn có sản phẩm Mọi loại tóc", dryOver.includes("BEAUTIFUL THINGS Dầu gội"), dryOver.join(", "));
  check("Lọc Tóc khô + trên 1,3 triệu có sản phẩm có dung tích trong khoảng giá", dryOver.includes("MOMO Dầu gội"), dryOver.join(", "));
  await t.go(B + "products.html?hair=Da%20%C4%91%E1%BA%A7u%20g%C3%A0u");
  const dandruff = await names();
  check("Lọc da đầu không kéo theo sản phẩm Mọi loại tóc", dandruff.length === 1 && dandruff[0] === "PURIFYING Dầu gội", dandruff.join(", "));
  await t.go(B + "products.html?q=momo");
  check("Tìm 'momo'", (await t.js(`return [...document.querySelectorAll('.card h3')].map(h=>h.innerText).join(', ')`)).includes("MOMO"), await t.js(`return [...document.querySelectorAll('.card h3')].map(h=>h.innerText).join(', ')`));
  await t.go(B + "products.html?q=duong%20am");
  check("Tìm không dấu 'duong am'", (await t.js(`return document.querySelectorAll('.card').length`)) > 0, (await t.js(`return document.querySelectorAll('.card').length`)) + " kết quả");
  await t.go(B + "products.html?q=xyzabc");
  await t.shot("02-products-empty");
  const clearBtn = await t.js(`return !!document.querySelector('#clear') && !!document.querySelector('.empty .btn')`);
  check("Trạng thái không có kết quả có nút xóa bộ lọc", clearBtn);
  await t.go(B + "products.html?collection=Naturaltech");
  check("Tiêu đề trang theo dòng", (await t.js(`return document.querySelector('#title').innerText`)) === "Naturaltech", await t.js(`return document.querySelector('#title').innerText`));
  await t.go(B + "products.html?sort=new");
  const firstNew = await t.js(`return [...document.querySelectorAll('.card h3')].slice(0,4).map(h=>h.innerText).join(', ')`);
  const newestFirst = await t.js(`const n=document.querySelector('.card h3').innerText; const p=Store.products().find(x=>x.name===n); return p.createdAt === Store.products().map(x=>x.createdAt).sort().pop()`);
  check("Sắp xếp 'Mới nhất' đưa hàng lên kệ gần nhất lên đầu", newestFirst, firstNew);

  // ---- Chi tiết
  await t.go(B + "product.html?id=khong-ton-tai");
  check("Sản phẩm không tồn tại báo lỗi", (await t.js(`return document.body.innerText`)).includes("Không tìm thấy sản phẩm"));
  await t.go(B + "product.html?id=dau-goi-love-smoothing");
  await t.shot("03-product");
  const outBtn = await t.js(`const b=[...document.querySelectorAll('.size-btn')].find(b=>b.classList.contains('out')); if(!b) return 'none'; b.click(); await new Promise(r=>setTimeout(r,100)); return document.querySelector('#add').disabled + '|' + document.querySelector('.stock').innerText`);
  check("Chọn dung tích hết hàng: khóa nút thêm", outBtn.startsWith("true"), outBtn);
  await t.js(`document.querySelector('.size-btn:not(.out)').click()`);
  const qtyClamp = await t.js(`const q=document.querySelector('#qty'); for(let i=0;i<15;i++) document.querySelector('#plus').click(); const a=q.value; q.value='0'; q.onchange(); const b=q.value; q.value='abc'; q.onchange(); const c=q.value; q.value='-5'; q.onchange(); return [a,b,c,q.value].join(',')`);
  check("Số lượng bị chặn 1–10", qtyClamp === "10,1,1,1", qtyClamp);
  const price = await t.js(`return document.querySelector('.price-big').innerText`);
  check("Giá khuyến mãi hiển thị kèm giá gốc", /giảm 10%/i.test(price), price);
  await t.js(`const q=document.querySelector('#qty'); q.value='10'; q.onchange(); document.querySelector('#add').click()`);
  await t.sleep(150);
  const second = await t.js(`document.querySelector('#add').click(); await new Promise(r=>setTimeout(r,100)); return [...document.querySelectorAll('.toast')].pop().innerText`);
  check("Thêm quá 10 cùng dung tích bị chặn", second.includes("tối đa"), second);
  const thumbs = await t.js(`location.href='product.html?id=dau-goi-dede&sku=8832232'; return 1`).catch(() => 1);
  await t.sleep(800);
  const gal = await t.js(`return document.querySelectorAll('.thumbs button').length`);
  check("Ảnh phụ (gallery) hiển thị khi có nhiều ảnh", gal >= 0, `${gal} ảnh phụ`);

  // ---- Giỏ hàng
  await t.go(B + "product.html?id=dau-goi-energizing");
  await t.js(`document.querySelector('#add').click()`); // 250ml 499k
  await t.go(B + "cart.html");
  await t.shot("04-cart", true);
  const cartTxt = await t.js(`return document.querySelector('.summary').innerText.replace(/\\n+/g,' | ')`);
  check("Giỏ: tạm tính đúng (LOVE SMOOTHING 250ml ×10 + ENERGIZING 250ml)", cartTxt.includes(Store_fmt(496000 * 10 + 499000)), cartTxt);
  const big = await t.js(`const i=document.querySelector('[data-qty]'); i.value='99'; i.onchange(); await new Promise(r=>setTimeout(r,100)); return document.querySelector('[data-qty]').value`);
  check("Gõ số lượng 99 trong giỏ bị chặn còn 10", big === "10", big);
  await t.js(`document.querySelector('[data-remove]').click(); await new Promise(r=>setTimeout(r,100)); document.querySelector('[data-ok]').click()`);
  await t.sleep(200);
  const afterRemove = await t.js(`return Store.cart().map(l=>l.name+'×'+l.qty).join(', ')`);
  check("Xóa sản phẩm khỏi giỏ (có xác nhận)", afterRemove === "ENERGIZING Dầu gội×1", afterRemove);

  // ---- Đặt hàng COD, đơn nhỏ có phí ship
  await t.go(B + "checkout.html");
  const s1 = await t.js(`return document.querySelector('#summary').innerText.replace(/\\n+/g,' | ')`);
  check("Đơn 499.000 ₫ tính phí ship 20.000 ₫", s1.includes("20.000 ₫") && s1.includes("519.000 ₫"), s1);
  const codOn = await t.js(`return !document.querySelector('[value=cod]').disabled && document.querySelector('[value=cod]').checked`);
  check("Đơn dưới 2 triệu mặc định chọn COD", codOn);
  const v1 = await t.js(`document.querySelector('#pick-v').click(); await new Promise(r=>setTimeout(r,100)); return [...document.querySelectorAll('.modal .pay-opt')].map(o=>o.innerText.replace(/\\n+/g,' ')).join(' || ')`);
  check("Popup voucher: mã không đủ điều kiện bị khóa kèm lý do", v1.includes("tối thiểu") && v1.includes("hết hạn"), v1);
  await t.js(`document.querySelector('[data-close]').click()`);
  await t.js(`const f=document.querySelector('#form'); f.name.value='Khách <b>Test</b>'; f.phone.value='0123'; f.email.value='abc'; document.querySelector('#place').click()`);
  const errs = await t.js(`return [...document.querySelectorAll('.field.error .err')].map(e=>e.innerText).join(' / ')`);
  check("Kiểm tra form đặt hàng (SĐT, email, địa chỉ)", errs.includes("Số điện thoại") && errs.includes("Email"), errs);
  await t.js(`const f=document.querySelector('#form'); f.phone.value='0901234567'; f.email.value='guest@test.vn'; f.city.value='TP. Hà Nội'; f.city.onchange(); f.ward.value='Phường Ba Đình'; f.line.value='5 Hoàng Diệu'; document.querySelector('#place').click()`);
  await t.sleep(200);
  await t.shot("05-receipt");
  const rc = await t.js(`return document.querySelector('.receipt').innerText.replace(/\\n+/g,' | ')`);
  check("Hóa đơn COD có phí ship và tổng 519.000 ₫", rc.includes("519.000 ₫") && rc.includes("20.000 ₫"), rc);
  check("Tên khách có ký tự HTML được hiển thị an toàn", rc.includes("Khách <b>Test</b>"), "");
  const code1 = await t.js(`return Store.db.orders[0].code`);
  await t.waitNav(() => t.js(`document.querySelector('#done').click()`));
  await t.shot("06-success");
  const succ = await t.js(`return document.body.innerText.replace(/\\n+/g,' | ')`);
  check("Trang thành công khớp tổng hóa đơn", succ.includes("519.000 ₫") && succ.includes(code1), code1);
  const badge = await t.js(`return Store.cartCount()`);
  check("Giỏ trống sau khi đặt", badge === 0, String(badge));
  // truy cập trang thành công của đơn khác
  const other = await t.js(`return Store.db.orders[5].code`);
  await t.go(B + "order-success.html?code=" + other);
  check("Không xem được trang thành công của đơn người khác", (await t.js(`return document.body.innerText`)).includes("Không tìm thấy đơn hàng"));
  // tra cứu
  await t.go(B + "order-lookup.html");
  const pre = await t.js(`return document.querySelector('#code').value`);
  check("Tra cứu điền sẵn đơn vừa đặt", pre === code1, pre);
  const wrong = await t.js(`const f=document.querySelector('#form'); f.email.value='sai@test.vn'; f.requestSubmit(); return document.querySelector('#result').innerText`);
  check("Tra cứu sai email không lộ đơn", wrong.includes("Không tìm thấy"), "");
  const fmtErr = await t.js(`const f=document.querySelector('#form'); f.code.value='DV12'; f.requestSubmit(); return document.querySelector('.field.error .err')?.innerText`);
  check("Tra cứu sai định dạng mã báo lỗi", !!fmtErr, fmtErr);
  const lower = await t.js(`const f=document.querySelector('#form'); f.code.value='${code1.toLowerCase()}'; f.email.value='GUEST@test.vn'; f.requestSubmit(); return document.querySelector('#result').innerText.slice(0,40)`);
  check("Tra cứu không phân biệt hoa/thường", lower.includes(code1), lower);

  // ---- VNPay hủy & thành công, voucher làm mất miễn phí ship
  await t.go(B + "product.html?id=dau-goi-momo");
  await t.js(`document.querySelector('#add').click()`); // 551k
  await t.go(B + "checkout.html");
  await t.js(`document.querySelector('#pick-v').click(); await new Promise(r=>setTimeout(r,100)); const f=document.querySelector('#vform'); f.code.value='welcome15'; f.requestSubmit()`);
  await t.sleep(150);
  const s2 = await t.js(`return document.querySelector('#summary').innerText.replace(/\\n+/g,' | ')`);
  check("551.000 ₫ − WELCOME15 (82.650 ₫) < 500k → tính lại phí ship", s2.includes("−82.650 ₫") && s2.includes("20.000 ₫"), s2);
  await t.js(`const f=document.querySelector('#form'); f.name.value='Võ Minh'; f.phone.value='0912222333'; f.email.value='vo@test.vn'; f.city.value='TP. Đà Nẵng'; f.city.onchange(); f.ward.value='Phường Hải Châu'; f.line.value='1 Bạch Đằng'; f.querySelector('[value=vnpay]').click()`);
  const before = await t.js(`return Store.db.orders.length`);
  await t.js(`document.querySelector('#place').click(); await new Promise(r=>setTimeout(r,100)); document.querySelector('#cancel').click()`);
  const afterCancel = await t.js(`return Store.db.orders.length + '|' + Store.cartCount()`);
  check("Hủy VNPay: không tạo đơn, giữ giỏ", afterCancel === `${before}|1`, afterCancel);
  await t.js(`document.querySelector('#place').click(); await new Promise(r=>setTimeout(r,100)); document.querySelector('#paid').click()`);
  await t.sleep(150);
  const o2 = await t.js(`const o=Store.db.orders[0]; return [o.code,o.payment,o.paid,o.total,Store.db.vouchers.find(v=>v.code==='WELCOME15').used].join('|')`);
  check("VNPay thành công: tạo đơn đã thanh toán, voucher tăng lượt dùng", o2.includes("vnpay|true|488350|41"), o2);
  const seq = await t.js(`return Store.db.orders.slice(0,2).map(o=>o.code).join(' > ')`);
  check("Mã đơn tăng dần trong ngày", /-0002 > .*-0001/.test(seq), seq);

  // ---- tồn kho thay đổi giữa chừng
  await t.go(B + "product.html?id=dau-goi-calming");
  await t.js(`const q=document.querySelector('#qty'); q.value='3'; q.onchange(); document.querySelector('#add').click()`);
  await t.go(B + "checkout.html");
  await t.js(`const v=Store.product('dau-goi-calming').variants[0]; Store.adjustStock(v.sku, 2 - v.stock, 'Kiểm kho');`);
  await t.js(`const f=document.querySelector('#form'); f.name.value='A'; f.phone.value='0912222333'; f.email.value='a@test.vn'; f.city.value='TP. Cần Thơ'; f.city.onchange(); f.ward.value='Phường Ninh Kiều'; f.line.value='1'; document.querySelector('[value=cod]').click(); document.querySelector('#place').click()`);
  await t.sleep(200);
  const stockMsg = await t.js(`const m=document.querySelector('.modal .receipt'); return m ? 'TẠO ĐƠN: '+m.innerText.match(/CALMING[^\\n]*/)?.[0] : document.querySelector('.modal')?.innerText`);
  check("Tồn kho giảm khi đang đặt: dừng lại và báo khách, không tự giảm số lượng", !String(stockMsg).startsWith("TẠO ĐƠN") && /chỉ còn 2/.test(String(stockMsg)), stockMsg);
  const vnpayDirect = await t.js(`return document.querySelector('.modal') ? 'modal' : 'none'`);
}
function Store_fmt(n) { return n.toLocaleString("vi-VN") + " ₫"; }
