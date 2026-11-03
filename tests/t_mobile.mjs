const B = "http://localhost:5500/";
export default async function (t, check) {
  await t.viewport(390, 844, true);
  const overflow = () => t.js(`const w=document.documentElement.clientWidth; const bad=[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect(); return r.width>0 && (r.right>w+1) && getComputedStyle(e).position!=='fixed'}).slice(0,4).map(e=>e.tagName.toLowerCase()+(e.className?'.'+String(e.className).split(' ')[0]:'')+'('+Math.round(e.getBoundingClientRect().right)+')'); return {sw:document.documentElement.scrollWidth,w,bad}`);
  // chuẩn bị dữ liệu: giỏ có hàng + đăng nhập
  await t.go(B + "index.html");
  await t.js(`Store.addToCart('8832234',1); Store.addToCart(Store.product('dau-goi-nounou').variants[0].sku,1);`);
  const pages = [["30-m-home", "index.html"], ["31-m-products", "products.html"], ["32-m-product", "product.html?id=dau-goi-momo"], ["33-m-cart", "cart.html"], ["34-m-checkout", "checkout.html"], ["36-m-lookup", "order-lookup.html"], ["37-m-login", "login.html"]];
  for (const [name, url] of pages) {
    await t.go(B + url);
    const o = await overflow();
    check(`Điện thoại 390px – ${url}: không tràn ngang`, o.sw <= o.w + 1, `scrollWidth ${o.sw} / ${o.w}${o.bad.length ? " · " + o.bad.join(", ") : ""}`);
    await t.shot(name, true);
  }
  // header nav fits?
  await t.go(B + "index.html");
  const nav = await t.js(`const hidden=getComputedStyle(document.querySelector('.nav')).display; document.querySelector('#menu-btn').click(); const shown=getComputedStyle(document.querySelector('.nav')).display; return hidden+'→'+shown`);
  check("Header điện thoại: menu gọn trong nút ☰, bấm mới mở", nav === "none→flex", nav);
  await t.shot("30b-m-menu-open");
  // filter sidebar position
  await t.go(B + "products.html");
  const gridTop = await t.js(`return Math.round(document.querySelector('#grid').getBoundingClientRect().top + scrollY)`);
  check("Danh sách điện thoại: sản phẩm không bị đẩy xuống quá sâu bởi bộ lọc", gridTop < 1200, `Sản phẩm đầu tiên bắt đầu ở ${gridTop}px`);
  // modal on mobile
  await t.go(B + "checkout.html");
  await t.js(`document.querySelector('#pick-v').click()`);
  await t.sleep(200);
  await t.shot("35-m-voucher-modal");
  // account & admin
  await t.js(`Store.login('an.nguyen@email.com','Davines@2026')`);
  await t.go(B + "account.html?tab=orders");
  let o = await overflow();
  check("Điện thoại – account.html (lịch sử đơn): không tràn ngang", o.sw <= o.w + 1, `scrollWidth ${o.sw} / ${o.w} · ${o.bad.join(", ")}`);
  await t.shot("38-m-account-orders", true);
  await t.js(`Store.adminLogin('admin@davines.vn','Admin@2026')`);
  await t.go(B + "admin/index.html");
  for (const h of ["report", "orders", "products", "inventory", "vouchers"]) {
    await t.js(`location.hash="${h}"`); await t.sleep(300);
    o = await overflow();
    check(`Điện thoại – admin #${h}: không tràn ngang`, o.sw <= o.w + 1, `scrollWidth ${o.sw} / ${o.w} · ${o.bad.join(", ")}`);
    await t.shot("39-m-admin-" + h);
  }
  // tablet & desktop wide
  await t.viewport(1024, 768);
  await t.go(B + "products.html");
  o = await overflow();
  check("Máy tính bảng 1024px – products: không tràn", o.sw <= o.w + 1, `scrollWidth ${o.sw}`);
  await t.shot("40-tablet-products");
  await t.viewport(1920, 1080);
  await t.go(B + "index.html");
  await t.shot("41-desktop-1920");
}
