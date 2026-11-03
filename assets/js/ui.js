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

  function header(active) {
    const user = Store.currentUser();
    const el = document.createElement("div");
    el.innerHTML = `
      <div class="topbar">Miễn phí giao hàng cho đơn từ ${fmt(Store.RULES.freeShipFrom)}</div>
      <header class="site-header">
        <div class="container">
          <button class="icon-btn menu-btn" id="menu-btn" aria-label="Mở menu" aria-expanded="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
          <nav class="nav" id="nav">
            <a href="about.html" class="${active === "about" ? "active" : ""}">Về Davines</a>
            <a href="products.html" class="${active === "products" ? "active" : ""}">Sản phẩm</a>
            <a href="order-lookup.html" class="${active === "lookup" ? "active" : ""}">Tra cứu đơn</a>
          </nav>
          <a href="index.html" class="logo" aria-label="Davines – Trang chủ">davines</a>
          <div class="header-icons">
            <button class="icon-btn" id="btn-search" aria-label="Tìm kiếm">${ICON.search}</button>
            <a class="icon-btn" href="${user ? "account.html" : "login.html"}" aria-label="${user ? "Tài khoản của tôi" : "Đăng nhập"}" title="${user ? esc(user.name) : "Đăng nhập"}">${ICON.user}</a>
            <a class="icon-btn" href="cart.html" aria-label="Giỏ hàng">${ICON.bag}<span class="badge-count" id="cart-count"></span></a>
          </div>
        </div>
        <div class="search-bar hidden" id="search-bar">
          <form class="container" action="products.html">
            <input class="input" name="q" placeholder="Tìm sản phẩm (2–100 ký tự)" minlength="2" maxlength="100" required>
            <button class="btn">Tìm</button>
          </form>
        </div>
      </header>`;
    document.body.prepend(...el.children);
    $("#menu-btn").onclick = () => { const open = $("#nav").classList.toggle("open"); $("#menu-btn").setAttribute("aria-expanded", open); };
    $("#btn-search").onclick = () => { $("#search-bar").classList.toggle("hidden"); $("#search-bar input").focus(); };
    refreshCartCount();
    window.addEventListener("store:change", refreshCartCount);
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
          <div><div class="logo" style="color:#fff">davines</div><p class="small" style="opacity:.8;max-width:320px">Sản phẩm chăm sóc tóc bền vững từ Parma, Ý. Website đồ án môn Web – mô hình B2C.</p></div>
          <div><h4>Mua sắm</h4><a href="products.html">Tất cả sản phẩm</a><a href="products.html?collection=Essential%20Haircare">Essential Haircare</a><a href="products.html?collection=Naturaltech">Naturaltech</a></div>
          <div><h4>Hỗ trợ</h4><a href="order-lookup.html">Tra cứu đơn hàng</a><a href="about.html#chinh-sach">Chính sách giao hàng</a><a href="about.html#lien-he">Liên hệ</a></div>
          <div><h4>Tài khoản</h4><a href="login.html">Đăng nhập / Đăng ký</a><a href="account.html?tab=orders">Lịch sử đơn hàng</a></div>
        </div>
        <div class="copy">© 2026 Davines Việt Nam – Đồ án môn Web. Dữ liệu sản phẩm tham khảo từ davinesvietnam.com.</div>
      </div>`;
    document.body.append(el);
  }

  // picked: dung tích cần hiển thị giá (khi lọc theo giá); .map(UI.productCard) truyền chỉ số mảng nên phải kiểm tra .sku
  function productCard(p, picked) {
    const pick = picked && picked.sku ? picked : null;
    const r = Store.priceRange(p);
    const img = p.variants.find((v) => v.images[0])?.images[0];
    const first = p.variants[0];
    const priceHtml = pick
      ? `${fmt(Store.unitPrice(p, pick))}${p.sale ? `<s>${fmt(pick.price)}</s>` : ""} <span class="small muted">· ${esc(pick.size)}</span>`
      : p.sale
      ? `${r.multi ? "Từ " : ""}${fmt(r.min)}<s>${fmt(Math.min(...p.variants.map((v) => v.price)))}</s>`
      : `${r.multi ? "Từ " : ""}${fmt(r.min)}`;
    return `
      <a class="card" href="product.html?id=${encodeURIComponent(p.id)}${pick ? `&sku=${encodeURIComponent(pick.sku)}` : ""}">
        <div class="img">
          ${img ? `<img src="${esc(img)}" alt="${esc(p.name)}" loading="lazy">` : ""}
          ${p.sale ? `<span class="badge sale">Giảm ${p.sale}%</span>` : ""}
          ${!Store.inStock(p) ? `<span class="badge out">Hết hàng</span>` : ""}
        </div>
        <div class="body">
          <div class="eyebrow">${esc(p.collection)}</div>
          <h3>${esc(p.name)}</h3>
          <div class="small muted">${esc(p.short)}</div>
          <div class="tags">${[...p.needs, ...p.hair].slice(0, 3).map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>
          <div class="price">${priceHtml}</div>
        </div>
      </a>`;
  }

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
        <div class="kv"><span class="muted">Thanh toán</span><span>${PAY[o.payment]}${o.paid ? " · Đã thanh toán" : ""}</span></div>
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
        <div class="kv"><span class="muted">Thanh toán</span><span>${PAY[o.payment]} · ${o.paid ? "Đã thanh toán" : "Chưa thanh toán"}</span></div>
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

  window.UI = { $, $$, esc, qs, header, footer, productCard, toast, modal, confirmBox, receipt, orderDetail, statusBadge, dt, PAY, validate, V, fillPlaces };
})();
