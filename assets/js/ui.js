/* Thành phần giao diện dùng chung: header, footer, thẻ sản phẩm, toast, modal, hóa đơn. */
(function () {
  const { fmt } = Store;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const qs = (k) => new URLSearchParams(location.search).get(k);

  const ICON = {
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
    bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 8h14l-1 13H6L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
  };

  // Trang hiện tại (dạng "products.html?..."), dùng làm ?next= để đăng nhập xong quay lại đúng chỗ (BR-TK11).
  function here() { const f = location.pathname.split("/").pop() || "index.html"; return f + location.search; }
  function loginHref() { const h = here(); return /^(login|account)\.html/.test(h) ? "login.html" : `login.html?next=${encodeURIComponent(h)}`; }
  // Từ khóa tìm kiếm: bỏ khoảng trắng 2 đầu rồi phải dài 2–100 ký tự (UC02 EF1).
  const KEYWORD_ERR = "Từ khóa phải dài từ 2 đến 100 ký tự";
  function keywordError(raw) { const v = String(raw || "").trim(); return v.length < 2 || v.length > 100 ? KEYWORD_ERR : ""; }

  function header(active) {
    const user = Store.currentUser();
    const el = document.createElement("div");
    el.innerHTML = `
      <div class="topbar">Miễn phí giao hàng cho đơn từ ${fmt(Store.RULES.freeShipFrom)}</div>
      <header class="site-header">
        <div class="container">
          <button class="icon-btn menu-btn" id="menu-btn" aria-label="Mở menu" aria-expanded="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
          <nav class="nav" id="nav">
            <a href="index.html" class="${active === "home" ? "active" : ""}">Trang chủ</a>
            <a href="about.html" class="${active === "about" ? "active" : ""}">Về Davines</a>
            <div class="nav-item has-mega">
              <a href="products.html" class="${active === "products" ? "active" : ""}" aria-haspopup="true">Sản phẩm</a>
              ${megaMenu()}
            </div>
            <a href="order-lookup.html" class="${active === "lookup" ? "active" : ""}">Tra cứu đơn</a>
          </nav>
          <a href="index.html" class="logo" aria-label="Davines – Trang chủ"><img class="logo-img" src="assets/img/brand/logo-davines.svg" alt="davines" width="140" height="41"></a>
          <div class="header-icons">
            <button class="icon-btn" id="btn-search" aria-label="Tìm kiếm">${ICON.search}</button>
            <a class="icon-btn" href="${user ? "account.html" : loginHref()}" aria-label="${user ? "Tài khoản của tôi" : "Đăng nhập"}" title="${user ? esc(user.name) : "Đăng nhập"}">${ICON.user}</a>
            <a class="icon-btn" href="cart.html" aria-label="Giỏ hàng">${ICON.bag}<span class="badge-count" id="cart-count"></span></a>
          </div>
        </div>
        <div class="search-bar hidden" id="search-bar">
          <form class="container" action="products.html" novalidate>
            <div class="field" style="flex:1;margin:0"><input class="input" name="q" placeholder="Tìm sản phẩm (2–100 ký tự)" maxlength="100"><div class="err"></div></div>
            <button class="btn">Tìm</button>
          </form>
        </div>
      </header>`;
    document.body.prepend(...el.children);
    $("#menu-btn").onclick = () => { const open = $("#nav").classList.toggle("open"); $("#menu-btn").setAttribute("aria-expanded", open); };
    $("#btn-search").onclick = () => { $("#search-bar").classList.toggle("hidden"); $("#search-bar input").focus(); };
    $("#search-bar form").onsubmit = (e) => {
      const input = e.target.q, msg = keywordError(input.value), fld = input.closest(".field");
      fld.classList.toggle("error", !!msg); $(".err", fld).textContent = msg;
      if (msg) { e.preventDefault(); input.focus(); } else input.value = input.value.trim();
    };
    // Bấm vào link trong menu sản phẩm thì đóng menu ngay (khi đang ở products.html trang không tải lại)
    $$("#nav .mega a").forEach((a) => a.addEventListener("click", () => { const m = $("#nav .has-mega"); m.classList.add("closed"); setTimeout(() => m.classList.remove("closed"), 300); }));
    refreshCartCount();
    window.addEventListener("store:change", refreshCartCount);
  }

  // Khoảng giá dùng chung cho menu sản phẩm và bộ lọc: [từ, đến) theo giá bán sau giảm.
  // Trả về dung tích rẻ nhất có giá nằm trong khoảng (sản phẩm khớp nếu có ít nhất 1 dung tích trong khoảng).
  function priceVariant(p, min, max) {
    return p.variants.filter((v) => { const u = Store.unitPrice(p, v); return u >= min && u < max; }).sort((x, y) => x.price - y.price)[0];
  }
  const PRICE_BANDS = [[0, 500000, "Dưới 500.000 ₫"], [500000, 1000000, "500.000 – 1.000.000 ₫"], [1000000, 99999999, "Trên 1.000.000 ₫"]];

  // Menu "Sản phẩm" xổ xuống: số lượng tính trực tiếp từ dữ liệu nên luôn khớp với trang danh sách.
  function megaMenu() {
    const all = Store.products();
    const count = (vals) => { const m = {}; all.forEach((p) => [...new Set(vals(p))].forEach((v) => (m[v] = (m[v] || 0) + 1))); return Object.entries(m).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])); };
    const url = (params) => "products.html?" + params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
    const row = (href, label, n) => `<a href="${esc(href)}"><span>${esc(label)}</span><small>${n}</small></a>`;
    const col = (title, rows) => `<h5>${title}</h5>${rows.join("")}`;

    const needs = count((p) => p.needs), topNeeds = needs.slice(0, 6), restNeeds = needs.slice(6).map(([v]) => v);
    const restCount = all.filter((p) => p.needs.some((n) => restNeeds.includes(n))).length;
    const hair = count((p) => p.hair).sort((a, b) => (a[0] === "Mọi loại tóc") - (b[0] === "Mọi loại tóc"));
    const onSale = all.filter((p) => p.sale > 0).sort((a, b) => b.sale - a.sale);
    const maxSale = onSale.length ? onSale[0].sale : 0;

    const sale = onSale.length ? `
      <div class="mega-sale">
        <div class="eyebrow">Đang giảm giá</div>
        <h4>${onSale.length} sản phẩm, giảm đến ${maxSale}%</h4>
        ${onSale.slice(0, 3).map((p) => {
          const v = [...p.variants].sort((a, b) => a.price - b.price)[0], img = (p.variants.find((x) => x.images[0]) || v).images[0];
          return `<a class="mega-sale-item" href="product.html?id=${encodeURIComponent(p.id)}"><span class="thumb">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : ""}</span><span><span class="name">${esc(p.name)}</span><span class="small"><b>${fmt(Store.unitPrice(p, v))}</b> <s>${fmt(v.price)}</s> <em>−${p.sale}%</em></span></span></a>`;
        }).join("")}
        <a class="link small" href="products.html?sale=1">Xem ${onSale.length} sản phẩm đang giảm</a>
      </div>` : "";

    const shortcuts = [["Dưỡng ẩm cho tóc khô", [["needs", "Dưỡng ẩm"], ["hair", "Tóc khô"]]], ["Giữ màu tóc nhuộm", [["needs", "Giữ màu tóc nhuộm"]]], ["Làm sạch sâu da đầu", [["needs", "Làm sạch sâu"]]]]
      .map(([l, q]) => `<a class="chip" href="${esc(url(q))}">${l}</a>`).join("") + (onSale.length ? `<a class="chip" href="products.html?sale=1">Đang giảm giá</a>` : "");

    return `
      <div class="mega" role="region" aria-label="Danh mục sản phẩm">
        <div class="container">
          <div class="mega-cols${sale ? " with-sale" : ""}">
            <div>
              ${col("Loại sản phẩm", count((p) => [p.kind]).map(([v, n]) => row(url([["kind", v]]), v, n)))}
              ${col("Theo mức giá", PRICE_BANDS.map(([a, b, l]) => row(`products.html?price=${a}-${b}`, l, all.filter((p) => priceVariant(p, a, b)).length)))}
            </div>
            <div>${col("Nhu cầu chăm sóc", topNeeds.map(([v, n]) => row(url([["needs", v]]), v, n)).concat(restNeeds.length ? [row(url(restNeeds.map((v) => ["needs", v])), "Nhu cầu khác", restCount)] : []))}</div>
            <div>${col("Loại tóc, da đầu", hair.map(([v, n]) => row(url([[/^da đầu/i.test(v) ? "scalp" : "hair", v]]), v, n)))}</div>
            <div>${col("Dòng sản phẩm", count((p) => [p.collection]).map(([v, n]) => row(url([["collection", v]]), v, n)))}</div>
            ${sale}
          </div>
          <div class="mega-foot">
            <div class="mega-chips"><span class="muted small">Lối tắt phổ biến</span>${shortcuts}</div>
            <div class="mega-all"><span class="muted small">Kết hợp nhiều tiêu chí ngay ở trang danh sách</span><a class="btn btn-outline" href="products.html">Xem tất cả ${all.length} sản phẩm</a></div>
          </div>
        </div>
      </div>`;
  }

  function refreshCartCount() {
    const n = Store.cartCount();
    const b = $("#cart-count");
    if (b) { b.textContent = n; b.classList.toggle("hidden", n === 0); }
  }

  function footer() {
    const el = document.createElement("footer");
    el.className = "site-footer";
    el.innerHTML = `
      <div class="container">
        <div class="cols">
          <div><div class="logo"><img class="logo-img" src="assets/img/brand/logo-davines-white.svg" alt="davines" width="140" height="41"></div><p class="small" style="opacity:.8;max-width:320px">Sản phẩm chăm sóc tóc bền vững từ Parma, Ý. Website đồ án môn Web – mô hình B2C.</p></div>
          <div><h4>Mua sắm</h4><a href="products.html">Tất cả sản phẩm</a><a href="products.html?sort=best">Sản phẩm bán chạy</a><a href="products.html?sort=new">Sản phẩm mới</a><a href="${scalpHref()}">Chăm sóc theo loại da đầu</a></div>
          <div><h4>Hỗ trợ</h4><a href="order-lookup.html">Tra cứu đơn hàng</a><a href="about.html#chinh-sach">Giao hàng và thanh toán</a></div>
          <div><h4>Tài khoản</h4><a href="${loginHref()}">Đăng nhập / Đăng ký</a><a href="account.html?tab=orders">Lịch sử đơn hàng</a></div>
        </div>
        <div class="copy">© 2026 Davines Việt Nam – Đồ án môn Web. Dữ liệu sản phẩm tham khảo từ davinesvietnam.com.</div>
      </div>`;
    document.body.append(el);
  }

  // Ảnh gen hiện khi rê chuột vào ảnh sản phẩm (bảng tra trong assets/js/hover-images.js).
  // Ưu tiên ảnh gen của đúng ảnh đang hiện, nếu không có thì lấy ảnh gen của dung tích đó; không có thì trả "".
  function hoverImg(p, v, src) {
    const H = window.HOVER_IMAGES || {};
    return (H.byImage && H.byImage[src]) || (v && H.byVariant && H.byVariant[p.id + "|" + v.size]) || "";
  }

  // Nhãn trên thẻ: NEW-IN = sản phẩm thuộc đợt lên kệ mới nhất; BEST-SELLER = 4 sản phẩm bán nhiều nhất (đơn đã giao),
  // khớp với 2 khối "Hàng mới về" và "Bán chạy nhất" ở trang chủ
  let TAGS = null;
  window.addEventListener("store:change", () => (TAGS = null));
  function tagsOf(p) {
    if (!TAGS) {
      const all = Store.products(), sold = {};
      Store.db.orders.filter((o) => o.status === "delivered").forEach((o) => o.items.forEach((i) => (sold[i.productId] = (sold[i.productId] || 0) + i.qty)));
      const newest = all.map((x) => x.createdAt || "").sort().pop();
      TAGS = {
        best: new Set(Object.entries(sold).filter(([id]) => all.some((x) => x.id === id)).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id]) => id)),
        fresh: new Set(all.filter((x) => newest && x.createdAt === newest).map((x) => x.id)),
      };
    }
    return { best: TAGS.best.has(p.id), fresh: TAGS.fresh.has(p.id) };
  }
  // Link lọc toàn bộ sản phẩm chăm sóc da đầu (mọi tình trạng da đầu đang có trong dữ liệu)
  function scalpHref() {
    const vals = [...new Set(Store.products().flatMap((p) => p.hair.filter((h) => /^da đầu/i.test(h))))].sort();
    return "products.html?" + vals.map((v) => "scalp=" + encodeURIComponent(v)).join("&");
  }

  // picked: dung tích cần hiển thị giá (khi lọc theo giá); .map(UI.productCard) truyền chỉ số mảng nên phải kiểm tra .sku
  // opts.buy: thêm nút "Thêm vào giỏ" (trang danh sách) – thêm dung tích đang hiện giá, hoặc dung tích rẻ nhất còn hàng
  function productCard(p, picked, opts) {
    const pick = picked && picked.sku ? picked : null;
    const buy = !!(opts && opts.buy === true);
    const r = Store.priceRange(p);
    const shown = (pick && pick.images[0] ? pick : null) || p.variants.find((v) => v.images[0]);
    const img = shown?.images[0];
    const hover = img ? hoverImg(p, shown, img) : "";
    const first = p.variants[0];
    const priceHtml = pick
      ? `${fmt(Store.unitPrice(p, pick))}${p.sale ? `<s>${fmt(pick.price)}</s>` : ""} <span class="small muted">· ${esc(pick.size)}</span>`
      : p.sale
      ? `${r.multi ? "Từ " : ""}${fmt(r.min)}<s>${fmt(Math.min(...p.variants.map((v) => v.price)))}</s>`
      : `${r.multi ? "Từ " : ""}${fmt(r.min)}`;
    const href = `product.html?id=${encodeURIComponent(p.id)}${pick ? `&sku=${encodeURIComponent(pick.sku)}` : ""}`;
    const buyV = pick && pick.stock > 0 ? pick : p.variants.filter((v) => v.stock > 0).sort((a, b) => a.price - b.price)[0];
    const buyHtml = !buy ? "" : buyV
      ? `<button class="btn btn-outline btn-block add-btn" type="button" data-add="${esc(buyV.sku)}">Thêm vào giỏ</button>`
      : `<button class="btn btn-block add-btn out" type="button" disabled>Hết hàng</button>`;
    // Cả thẻ bấm được nhờ link ở tên sản phẩm phủ kín thẻ (.card h3 a::after); nút Thêm vào giỏ nằm trên lớp đó
    return `
      <article class="card${hover ? " has-hover" : ""}">
        <div class="img">
          ${img ? `<img src="${esc(img)}" alt="${esc(p.name)}" loading="lazy">` : ""}
          ${hover ? `<img class="hover-img" src="${esc(hover)}" alt="" loading="lazy">` : ""}
          <div class="badges">${p.sale ? `<span class="badge sale">Giảm ${p.sale}%</span>` : ""}${tagsOf(p).fresh ? `<span class="badge new">New-in</span>` : ""}${tagsOf(p).best ? `<span class="badge best">Best-seller</span>` : ""}</div>
          ${!Store.inStock(p) ? `<span class="badge out">Hết hàng</span>` : ""}
        </div>
        <div class="body">
          <div class="eyebrow">${esc(p.collection)}</div>
          <h3><a href="${href}">${esc(p.name)}</a></h3>
          <div class="tags">${[...p.needs, ...p.hair].slice(0, 2).map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>
          <div class="price">${priceHtml}</div>
          ${buyHtml}
        </div>
      </article>`;
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest("[data-add]");
    if (!b) return;
    const f = Store.findVariant(b.dataset.add);
    const r = Store.addToCart(b.dataset.add, 1);
    if (!r.ok) return toast(r.error, "error");
    toast(`Đã thêm <b>${esc(f.p.name)} ${esc(f.v.size)} × 1</b> vào giỏ. <a href="cart.html">Xem giỏ hàng</a>`);
  });

  let toastWrap;
  function toast(html, type) {
    if (!toastWrap) { toastWrap = document.createElement("div"); toastWrap.className = "toast-wrap"; document.body.append(toastWrap); }
    const t = document.createElement("div");
    t.className = "toast" + (type === "error" ? " error" : "");
    t.setAttribute("role", "status");
    t.innerHTML = html;
    toastWrap.append(t);
    setTimeout(() => t.remove(), 4000);
  }

  // modal(html, {wide}) -> trả về {el, close}; đóng khi bấm nền hoặc Esc.
  function modal(html, opts = {}) {
    const back = document.createElement("div");
    back.className = "modal-back";
    back.innerHTML = `<div class="modal ${opts.wide ? "wide" : ""}" role="dialog" aria-modal="true">${html}</div>`;
    const close = () => { back.remove(); document.removeEventListener("keydown", onKey); opts.onClose && opts.onClose(); };
    const onKey = (e) => { if (e.key === "Escape" && !opts.locked) close(); };
    back.addEventListener("click", (e) => { if (e.target === back && !opts.locked) close(); });
    document.addEventListener("keydown", onKey);
    document.body.append(back);
    $$("[data-close]", back).forEach((b) => (b.onclick = close));
    return { el: back, close };
  }
  function confirmBox(title, text, okLabel = "Xác nhận") {
    return new Promise((resolve) => {
      const m = modal(`<h3>${esc(title)}</h3><p class="muted">${esc(text)}</p><div class="modal-actions"><button class="btn" data-ok>${esc(okLabel)}</button><button class="btn btn-outline" data-close>Hủy</button></div>`, { onClose: () => resolve(false) });
      $("[data-ok]", m.el).onclick = () => { resolve(true); m.el.remove(); };
    });
  }

  function dt(iso, withTime = true) {
    const d = new Date(iso);
    const p = (n) => String(n).padStart(2, "0");
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}` + (withTime ? ` lúc ${p(d.getHours())}:${p(d.getMinutes())}` : "");
  }
  const PAY = { cod: "Thanh toán khi nhận hàng", vnpay: "VNPay" };
  // BR-TT02: đơn COD chưa thu tiền chỉ ghi "Thanh toán khi nhận hàng", không thêm "Chưa thanh toán".
  function payLabel(o) { return o.payment === "cod" ? (o.paid ? `${PAY.cod} · Đã thanh toán` : PAY.cod) : `${PAY[o.payment]} · ${o.paid ? "Đã thanh toán" : "Chưa thanh toán"}`; }

  // Khối tổng tiền dùng chung cho hóa đơn, trang thành công, tra cứu, chi tiết đơn -> luôn khớp nhau.
  function totalsRows(o) {
    return `
      <div class="kv"><span>Tạm tính</span><span>${fmt(o.subtotal)}</span></div>
      ${o.discount ? `<div class="kv"><span>Giảm giá (${esc(o.voucher)})</span><span>−${fmt(o.discount)}</span></div>` : ""}
      <div class="kv"><span>Phí giao hàng</span><span>${o.shipping ? fmt(o.shipping) : "Miễn phí"}</span></div>`;
  }
  function receipt(o) {
    return `
      <div class="receipt">
        <div class="head"><h3>HÓA ĐƠN</h3><div class="small muted">Davines Việt Nam · Đồ án môn Web</div></div>
        <div class="kv"><span class="muted">Mã đơn</span><b>${esc(o.code)}</b></div>
        <div class="kv"><span class="muted">Ngày đặt</span><span>${dt(o.createdAt)}</span></div>
        <div class="kv"><span class="muted">Khách hàng</span><span>${esc(o.customer.name)}</span></div>
        <div class="kv"><span class="muted">Giao đến</span><span style="text-align:right">${esc(o.customer.line)}, ${esc(o.customer.ward)}, ${esc(o.customer.city)}</span></div>
        <div class="kv"><span class="muted">Thanh toán</span><span>${payLabel(o)}</span></div>
        <div class="sep"></div>
        ${o.items.map((i) => `<div class="kv"><span>${esc(i.name)} · ${esc(i.size)} × ${i.qty}</span><span>${fmt(i.total)}</span></div>`).join("")}
        <div class="sep"></div>
        ${totalsRows(o)}
        <div class="sep"></div>
        <div class="kv grand"><span>TỔNG THANH TOÁN</span><span>${fmt(o.total)}</span></div>
        <div class="sep"></div>
        <div class="small muted" style="text-align:center;letter-spacing:2px">CẢM ƠN BẠN ĐÃ MUA HÀNG</div>
      </div>`;
  }
  function statusBadge(k) { return `<span class="status s-${k}">${Store.statusLabel(k)}</span>`; }
  // Chi tiết đơn đầy đủ: dùng cho Tra cứu đơn (khách vãng lai) và Lịch sử đơn (thành viên).
  function orderDetail(o) {
    const path = o.status === "failed" ? ["pending", "confirmed", "shipping", "failed"] : ["pending", "confirmed", "shipping", "delivered"];
    return `
      <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start">
        <div><h3 style="margin:0">Đơn hàng ${esc(o.code)}</h3><div class="small muted">Đặt ngày ${dt(o.createdAt)}</div></div>
        ${statusBadge(o.status)}
      </div>
      <div class="timeline">${path.map((s) => { const h = o.history.find((x) => x.status === s); return `<div class="${h ? "done" : ""}">${Store.statusLabel(s)}<small>${h ? dt(h.at).replace(" lúc", " ·") : "—"}</small></div>`; }).join("")}</div>
      <div class="mini-items">${o.items.map((i) => `<div class="it"><div class="thumb">${i.image ? `<img src="${esc(i.image)}" alt="">` : ""}</div><div>${esc(i.name)}<div class="small muted">${esc(i.size)} × ${i.qty} · Đơn giá ${fmt(i.price)}</div></div><b>${fmt(i.total)}</b></div>`).join("")}</div>
      <div class="receipt" style="margin-top:12px">
        <div class="sep"></div>${totalsRows(o)}<div class="sep"></div>
        <div class="kv grand"><span>Tổng thanh toán</span><span>${fmt(o.total)}</span></div>
        <div class="kv"><span class="muted">Thanh toán</span><span>${payLabel(o)}</span></div>
        <div class="kv"><span class="muted">Người nhận</span><span>${esc(o.customer.name)} · ${esc(o.customer.phone)}</span></div>
        <div class="kv"><span class="muted">Địa chỉ</span><span style="text-align:right">${esc(o.customer.line)}, ${esc(o.customer.ward)}, ${esc(o.customer.city)}</span></div>
      </div>`;
  }

  // Kiểm tra form đơn giản: rules = {name: [fn(value) -> lỗi | ""]}
  function validate(form, rules) {
    let ok = true;
    Object.entries(rules).forEach(([name, fns]) => {
      const input = form.elements[name];
      const field = input.closest(".field");
      const msg = fns.map((fn) => fn(input.value.trim(), form)).find(Boolean) || "";
      field.classList.toggle("error", !!msg);
      let err = $(".err", field);
      if (!err) { err = document.createElement("div"); err.className = "err"; field.append(err); }
      err.textContent = msg;
      if (msg) ok = false;
    });
    return ok;
  }
  // Gõ lại vào ô đang báo lỗi thì ẩn lỗi ngay, không cần bấm nút gửi lần nữa (UC04).
  document.addEventListener("input", (e) => {
    const fld = e.target.closest && e.target.closest(".field.error");
    if (!fld || !e.target.value.trim()) return;
    fld.classList.remove("error");
    const err = $(".err", fld); if (err) err.textContent = "";
  });
  document.addEventListener("change", (e) => {
    const fld = e.target.closest && e.target.closest(".field.error, .check.error");
    if (fld && (e.target.type === "checkbox" ? e.target.checked : e.target.value)) { fld.classList.remove("error"); const err = $(".err", fld); if (err) err.textContent = ""; }
  });

  const V = {
    required: (label) => (v) => (v ? "" : `Vui lòng nhập ${label}.`),
    email: (v) => (!v || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? "" : "Email không hợp lệ."),
    phone: (v) => (!v || /^0(3|5|7|8|9)\d{8}$/.test(v) ? "" : "Số điện thoại không hợp lệ (10 số, bắt đầu bằng 03/05/07/08/09)."),
    password: (v) => (!v || (v.length >= 8 && /\d/.test(v) && /[A-Za-z]/.test(v)) ? "" : "Mật khẩu tối thiểu 8 ký tự, gồm cả chữ và số."),
  };

  // Danh sách tỉnh/thành và phường/xã rút gọn cho bản demo.
  const PLACES = {
    "TP. Hồ Chí Minh": ["Phường Bến Thành", "Phường Bến Nghé", "Phường Sài Gòn", "Phường Tân Định", "Phường Thủ Đức", "Phường Bình Thạnh"],
    "TP. Hà Nội": ["Phường Hoàn Kiếm", "Phường Ba Đình", "Phường Đống Đa", "Phường Cầu Giấy", "Phường Hai Bà Trưng"],
    "TP. Đà Nẵng": ["Phường Hải Châu", "Phường Thanh Khê", "Phường Sơn Trà", "Phường Ngũ Hành Sơn"],
    "TP. Cần Thơ": ["Phường Ninh Kiều", "Phường Cái Răng", "Phường Bình Thủy"],
  };
  function fillPlaces(citySel, wardSel, city, ward) {
    citySel.innerHTML = `<option value="">Chọn tỉnh/thành</option>` + Object.keys(PLACES).map((c) => `<option ${c === city ? "selected" : ""}>${c}</option>`).join("");
    const sync = (w) => { wardSel.innerHTML = `<option value="">Chọn phường/xã</option>` + (PLACES[citySel.value] || []).map((x) => `<option ${x === w ? "selected" : ""}>${x}</option>`).join(""); };
    citySel.onchange = () => sync("");
    sync(ward);
  }

  window.UI = { $, $$, esc, qs, here, loginHref, keywordError, KEYWORD_ERR, payLabel, header, footer, productCard, hoverImg, priceVariant, PRICE_BANDS, toast, modal, confirmBox, receipt, orderDetail, statusBadge, dt, PAY, validate, V, fillPlaces };
})();
