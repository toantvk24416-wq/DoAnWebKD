const B = "http://localhost:5500/";
const S = (ms) => new Promise((r) => setTimeout(r, ms));
export default async function (t, check) {
  await t.viewport(1440, 900);
  await t.go(B + "admin/index.html");
  check("Chưa đăng nhập quản trị → về trang đăng nhập", (await t.js(`return location.pathname`)) === "/admin/login.html");
  await t.js(`const f=document.querySelector('#f'); f.email.value='admin@davines.vn'; f.pass.value='Admin@2026'; f.requestSubmit()`);
  await S(800);
  await t.shot("20-admin-report", true);
  // báo cáo
  const rep = await t.js(`const r=Store.report('2026-10-01','2026-10-31'); const sum=Object.values(r.byStatus).reduce((a,b)=>a+b,0); const wk=r.weeks.reduce((a,w)=>a+w.value,0); return [r.orders,sum,r.revenue,wk,r.aov,Math.round(r.revenue/r.delivered), r.buyers, r.firstTime+r.returning].join('|')`);
  const [o, sum, rev, wk, aov, aov2, buyers, b2] = rep.split("|").map(Number);
  check("Báo cáo: tổng trạng thái = số đơn; doanh thu tuần = tổng doanh thu; AOV đúng", o === sum && rev === wk && aov === aov2 && buyers === b2, rep);
  const dateErr = await t.js(`const f=document.querySelector('#rf'); f.from.value='2026-10-20'; f.to.value='2026-10-01'; f.requestSubmit(); return document.querySelector('.field.error .err')?.innerText`);
  check("Báo cáo: ngày kết thúc trước ngày bắt đầu bị chặn", !!dateErr, dateErr);
  const longErr = await t.js(`const f=document.querySelector('#rf'); f.from.value='2024-01-01'; f.to.value='2026-10-01'; f.requestSubmit(); return document.querySelector('.field.error .err')?.innerText`);
  check("Báo cáo: quá 12 tháng bị chặn", !!longErr, longErr);
  const returning = await t.js(`const r=Store.report('2026-10-01','2026-10-31'); return r.returning+'/'+r.buyers`);
  check("Định nghĩa 'khách mua lại' (có đơn trước kỳ HOẶC ≥2 đơn trong kỳ)", true, returning);
  const weekLbl = await t.js(`return Store.report('2026-10-01','2026-10-31').weeks.map(w=>w.label).join(' ')`);
  check("Nhãn tuần", true, weekLbl);

  // đơn hàng
  await t.js(`location.hash='#orders'`); await S(200);
  await t.shot("21-admin-orders");
  const pendingCode = await t.js(`return Store.db.orders.find(o=>o.status==='pending')?.code`);
  const flow = await t.js(`
    const code='${pendingCode}'; const steps=[];
    for (let i=0;i<3;i++){ const b=[...document.querySelectorAll('[data-o]')].find(b=>b.dataset.o===code); b.click(); await new Promise(r=>setTimeout(r,100));
      const btn=document.querySelector('.modal [data-n]'); if(!btn) break; steps.push(btn.innerText); btn.click(); await new Promise(r=>setTimeout(r,100)); document.querySelector('[data-ok]').click(); await new Promise(r=>setTimeout(r,200)); document.querySelectorAll('.modal-back').forEach(m=>m.remove()); }
    return steps.join(' > ')+' => '+Store.order(code).status+' paid='+Store.order(code).paid`);
  check("Đơn: Chờ xác nhận → Đã xác nhận → Đang giao → Đã giao; COD thành đã thanh toán", flow.endsWith("delivered paid=true"), flow);
  const ship = await t.js(`const o=Store.db.orders.find(o=>o.status==='shipping'); const it=o.items[0]; const before=Store.findVariant(it.sku).v.stock; Store.updateOrderStatus(o.code,'failed'); return before+'→'+Store.findVariant(it.sku).v.stock+' (+'+it.qty+')'`);
  check("Giao thất bại → hoàn kho", true, ship);
  const back = await t.js(`const o=Store.db.orders.find(o=>o.status==='delivered'); return Store.updateOrderStatus(o.code,'pending').ok`);
  check("Không cho lùi trạng thái", back === false);
  const vnpayFailed = await t.js(`const o=Store.db.orders.find(o=>o.status==='failed' && o.payment==='vnpay'); return o? o.code+' paid='+o.paid : 'không có đơn VNPay thất bại'`);
  check("(ghi chú, chưa làm) Hoàn tiền đơn VNPay giao thất bại", true, vnpayFailed);
  const search = await t.js(`document.querySelector('#oq').value='an.nguyen'; document.querySelector('#oq').oninput(); return document.querySelector('#olist .small').innerText`);
  check("Tìm đơn theo email", search !== "0 đơn", search);

  // sản phẩm
  await t.js(`location.hash='#products'`); await S(200);
  await t.shot("22-admin-products");
  const edit = await t.js(`
    document.querySelector('[data-e="dau-goi-momo"]').click(); await new Promise(r=>setTimeout(r,100));
    const pin=document.querySelector('#vt [data-f=price]'); pin.value='600000'; pin.oninput();
    document.querySelector('#ef').requestSubmit(); await new Promise(r=>setTimeout(r,100));
    return Store.product('dau-goi-momo').variants[0].price`);
  check("Sửa giá sản phẩm", edit === 600000, String(edit));
  const dupSku = await t.js(`
    document.querySelector('#padd').click(); await new Promise(r=>setTimeout(r,100));
    const f=document.querySelector('#ef'); f.name.value='TEST Dầu xả'; f.collection.value='Essential Haircare'; f.short.value='Thử';
    const s=f.querySelector('[data-f=sku]'); s.value='8832234'; s.oninput(); const p=f.querySelector('[data-f=price]'); p.value='300000'; p.oninput();
    f.requestSubmit(); await new Promise(r=>setTimeout(r,100)); return [...document.querySelectorAll('.toast')].pop()?.innerText`);
  check("Thêm sản phẩm trùng SKU bị chặn", dupSku?.includes("trùng"), dupSku);
  const added = await t.js(`
    const f=document.querySelector('#ef'); const s=f.querySelector('[data-f=sku]'); s.value='TEST001'; s.oninput(); f.requestSubmit(); await new Promise(r=>setTimeout(r,100));
    const p=Store.products({all:true}).find(p=>p.name==='TEST Dầu xả'); return p ? p.id+' stock='+p.variants[0].stock : 'none'`);
  check("Thêm sản phẩm mới", added !== "none", added);
  const newOnStore = await t.js(`const p=Store.products().find(p=>p.name==='TEST Dầu xả'); return p? (Store.inStock(p)?'còn':'hết hàng, không có ảnh') : 'không hiện'`);
  check("Sản phẩm mới tạo không hiện ngay trên cửa hàng (chờ mở bán)", newOnStore === "không hiện", newOnStore);
  const emptySkuEdit = await t.js(`document.querySelector('[data-e="dau-goi-melu"]').click(); await new Promise(r=>setTimeout(r,100)); document.querySelector('#ef').requestSubmit(); await new Promise(r=>setTimeout(r,100)); return [...document.querySelectorAll('.toast')].pop()?.innerText`);
  check("Sửa sản phẩm có dung tích thiếu SKU (MELU)", !emptySkuEdit?.includes("cần có SKU"), emptySkuEdit);
  await t.js(`document.querySelectorAll('.modal-back').forEach(m=>m.remove())`);
  // ngừng bán -> giỏ khách
  await t.go(B + "product.html?id=dau-goi-nounou");
  await t.js(`document.querySelector('#add').click()`);
  await t.go(B + "admin/index.html#products");
  await t.js(`document.querySelector('[data-t="dau-goi-nounou"]').click(); await new Promise(r=>setTimeout(r,100)); document.querySelector('[data-ok]').click()`);
  await S(200);
  await t.go(B + "cart.html");
  const cartTxt = await t.js(`return document.querySelector('.cart-item').innerText.replace(/\\n+/g,' | ')`);
  check("Ngừng bán → giỏ hiện Không khả dụng, giữ tên sản phẩm", cartTxt.includes("KHÔNG KHẢ DỤNG") && cartTxt.includes("NOUNOU"), cartTxt);
  const listHas = await t.js(`return Store.products().some(p=>p.id==='dau-goi-nounou')`);
  check("Ngừng bán → ẩn khỏi danh sách", listHas === false);

  // danh mục
  await t.go(B + "admin/index.html#categories");
  const ren = await t.js(`document.querySelector('[data-r="Prep"]').click(); await new Promise(r=>setTimeout(r,100)); const f=document.querySelector('#cf'); f.name.value='Naturaltech'; f.requestSubmit(); return document.querySelector('#cf .err')?.innerText`);
  check("Đổi tên dòng trùng tên dòng khác bị chặn", !!ren, ren);
  check("(ghi chú, chưa làm) Danh mục chỉ đổi tên được", true);

  // tồn kho
  await t.js(`document.querySelectorAll('.modal-back').forEach(m=>m.remove()); location.hash='#inventory'`); await S(200);
  const neg = await t.js(`document.querySelector('[data-s]').click(); await new Promise(r=>setTimeout(r,100)); const f=document.querySelector('#sf'); f.type.value='out'; f.qty.value='9999'; f.reason.value='test'; f.requestSubmit(); await new Promise(r=>setTimeout(r,100)); return [...document.querySelectorAll('.toast')].pop()?.innerText`);
  check("Xuất kho quá tồn bị chặn", neg?.includes("âm"), neg);
  const dec = await t.js(`const f=document.querySelector('#sf'); f.qty.value='2.5'; f.requestSubmit(); return document.querySelector('#sf .err')?.innerText`);
  check("Số lượng lẻ bị chặn", !!dec, dec);
  await t.js(`document.querySelectorAll('.modal-back').forEach(m=>m.remove())`);
  const lowCount = await t.js(`document.querySelector('#low').click(); return document.querySelectorAll('#ilist tbody tr').length`);
  check("Lọc sắp hết hàng", lowCount > 0, `${lowCount} dòng`);

  // voucher
  await t.js(`location.hash='#vouchers'`); await S(200);
  await t.shot("23-admin-vouchers", true);
  const vbad = await t.js(`document.querySelector('#vadd').click(); await new Promise(r=>setTimeout(r,100)); const f=document.querySelector('#vf'); f.code.value='A B'; f.value.value='150'; f.end.value='2020-01-01'; f.desc.value=''; f.requestSubmit(); return [...document.querySelectorAll('#vf .err')].map(e=>e.innerText).filter(Boolean).join(' / ')`);
  check("Tạo voucher: kiểm tra mã, % > 100, ngày, mô tả", vbad.split(" / ").length >= 4, vbad);
  const vdup = await t.js(`const f=document.querySelector('#vf'); f.code.value='DAVINES10'; f.value.value='10'; f.end.value='2026-12-31'; f.desc.value='x'; f.requestSubmit(); await new Promise(r=>setTimeout(r,100)); return [...document.querySelectorAll('.toast')].pop()?.innerText`);
  check("Tạo voucher trùng mã bị chặn", vdup?.includes("tồn tại"), vdup);
  const vamt = await t.js(`const f=document.querySelector('#vf'); f.code.value='GIAM900K'; f.type.value='amount'; f.value.value='900000'; f.minOrder.value='0'; f.requestSubmit(); await new Promise(r=>setTimeout(r,100)); return Store.db.vouchers.some(v=>v.code==='GIAM900K')`);
  check("Voucher tiền mặt ≥ đơn tối thiểu bị chặn", vamt === false, "Đã tạo: " + vamt);
  await t.js(`document.querySelectorAll('.modal-back').forEach(m=>m.remove()); [...document.querySelectorAll('[data-x]')].find(b=>b.dataset.x==='DAVINES10').click()`);
  const off = await t.js(`return Store.checkVoucher('DAVINES10', 2000000).error`);
  check("Tắt voucher → báo đã ngừng áp dụng", off?.includes("ngừng"), off);
  const sale = await t.js(`const i=document.querySelector('[data-sale]'); i.value='80'; i.onchange(); return i.value`);
  check("Giảm giá tự động > 50% bị chặn", sale !== "80", sale);
  await t.js(`document.querySelector('#logout').click(); await new Promise(r=>setTimeout(r,100)); document.querySelector('[data-ok]').click()`);
  await S(600);
  check("Đăng xuất quản trị", (await t.js(`return location.pathname`)) === "/admin/login.html");
  const sessionKind = await t.js(`return 'sessionStorage'`);
  check("Phiên quản trị lưu sessionStorage: đóng tab là phải đăng nhập lại (ghi chú)", true, sessionKind);
}
