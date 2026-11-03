/* Lớp dữ liệu của web Davines: lưu toàn bộ "cơ sở dữ liệu" trong localStorage.
 * Mọi quy tắc nghiệp vụ (giá, phí ship, voucher, tồn kho, mã đơn) nằm ở đây
 * để các trang chỉ việc gọi Store.xxx và luôn ra cùng một kết quả. */
(function () {
  const DB_KEY = "davines_db_v1";
  const SEED_VERSION = 4; // tăng số này khi đổi dữ liệu mẫu -> trình duyệt tự tạo lại dữ liệu
  const SESSION_KEY = "davines_session";
  const ADMIN_KEY = "davines_admin_session";
  const GUEST_CART_KEY = "davines_guest_cart"; // sessionStorage: giỏ khách chỉ giữ trong lần truy cập

  const RULES = {
    shippingFee: 20000,
    freeShipFrom: 500000,   // tính trên tạm tính sau giảm giá
    codLimit: 2000000,      // COD chỉ cho đơn tổng thanh toán đến 2.000.000 đ
    maxPerVariant: 10,
    vnpayHoldMinutes: 15,
  };

  const STATUS = [
    { key: "pending", label: "Chờ xác nhận" },
    { key: "confirmed", label: "Đã xác nhận" },
    { key: "shipping", label: "Đang giao hàng" },
    { key: "delivered", label: "Đã giao hàng" },
    { key: "failed", label: "Giao hàng thất bại" },
  ];
  const NEXT_STATUS = { pending: ["confirmed"], confirmed: ["shipping"], shipping: ["delivered", "failed"], delivered: [], failed: [] };

  // Băm mật khẩu đơn giản cho bản demo chạy offline (không dùng cho hệ thống thật).
  function hash(str) {
    let h = 2166136261;
    for (const ch of "davines:" + str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(16);
  }

  function pad(n, len = 2) { return String(n).padStart(len, "0"); }
  function rand(seed) { let s = seed; return () => (s = (s * 9301 + 49297) % 233280) / 233280; }

  // ---------- Khởi tạo dữ liệu mẫu ----------
  function seedDb() {
    const products = JSON.parse(JSON.stringify(window.DAVINES_SEED.products));
    // Khuyến mãi tự động theo sản phẩm (% giảm), quản trị có thể sửa ở trang Voucher & khuyến mãi
    const promos = { "dau-goi-nounou": 15, "dau-goi-love-smoothing": 10, "banh-goi-momo": 10 };
    products.forEach((p) => { p.sale = promos[p.id] || 0; p.active = true; p.createdAt = p.kind === "Dầu gội" ? "2026-09-01" : "2026-10-15"; });

    const db = {
      version: SEED_VERSION,
      products,
      users: [
        { id: "u1", role: "customer", name: "Nguyễn Văn An", email: "an.nguyen@email.com", phone: "0912345678", birthday: "1998-03-14",
          pass: hash("Davines@2026"), addresses: [{ id: "a1", name: "Nguyễn Văn An", phone: "0912345678", city: "TP. Hồ Chí Minh", ward: "Phường Bến Nghé", line: "45 Nguyễn Huệ", isDefault: true }], cart: [] },
      ],
      admins: [{ id: "ad1", name: "Quản trị viên", email: "admin@davines.vn", pass: hash("Admin@2026") }],
      vouchers: [
        { code: "DAVINES10", type: "amount", value: 100000, minOrder: 1000000, maxDiscount: 0, start: "2026-10-01", end: "2026-12-31", limit: 500, used: 12, active: true, desc: "Giảm 100.000 đ cho đơn từ 1.000.000 đ" },
        { code: "WELCOME15", type: "percent", value: 15, minOrder: 500000, maxDiscount: 150000, start: "2026-10-01", end: "2026-12-31", limit: 1000, used: 40, active: true, desc: "Giảm 15% (tối đa 150.000 đ) cho đơn từ 500.000 đ" },
        { code: "THANG9", type: "percent", value: 10, minOrder: 300000, maxDiscount: 100000, start: "2026-09-01", end: "2026-09-30", limit: 300, used: 300, active: true, desc: "Ưu đãi tháng 9 (đã hết hạn)" },
      ],
      orders: [],
      seq: {},
      stockLog: [],
    };
    seedOrders(db);
    return db;
  }

  // Sinh đơn mẫu tháng 10/2026 để trang báo cáo và lịch sử đơn có số liệu.
  function seedOrders(db) {
    const r = rand(42);
    const names = ["Trần Thị Mai", "Lê Hoàng Nam", "Phạm Thu Hà", "Võ Minh Khoa", "Đặng Ngọc Lan", "Bùi Anh Tuấn", "Hoàng Yến Nhi", "Ngô Gia Bảo"];
    const sellable = db.products.flatMap((p) => p.variants.map((v) => ({ p, v }))).filter((x) => x.v.stock > 0);
    for (let i = 0; i < 46; i++) {
      const day = 1 + Math.floor(r() * 30);
      const date = new Date(2026, 9, day, 8 + Math.floor(r() * 12), Math.floor(r() * 60));
      const isAn = i % 9 === 0;
      const who = isAn ? db.users[0] : null;
      const ni = Math.floor(r() * names.length);
      const nm = who ? who.name : names[ni];
      const email = who ? who.email : `khach${ni + 1}@email.com`;
      const lines = [];
      const n = 1 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) {
        const { p, v } = sellable[Math.floor(r() * sellable.length)];
        if (lines.some((l) => l.sku === v.sku)) continue;
        lines.push(makeLine(p, v, 1 + Math.floor(r() * 2)));
      }
      const t = calcTotals(lines, null);
      const age = (new Date(2026, 9, 31) - date) / 86400000;
      const status = age > 6 ? (r() < 0.93 ? "delivered" : "failed") : age > 3 ? "shipping" : age > 1.5 ? "confirmed" : "pending";
      const pay = t.total > RULES.codLimit || r() < 0.35 ? "vnpay" : "cod";
      const order = buildOrder(db, {
        date, lines, totals: t, voucher: null, payment: pay, userId: who ? who.id : null,
        customer: { name: nm, email, phone: "09" + String(10000000 + Math.floor(r() * 89999999)), city: "TP. Hồ Chí Minh", ward: "Phường Bến Thành", line: (10 + i) + " Lê Lợi" },
      });
      order.status = status;
      order.history = historyUntil(date, status);
      if (status === "delivered" && pay === "cod") order.paid = true;
      db.orders.push(order);
    }
    db.orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  function historyUntil(date, status) {
    const path = status === "failed" ? ["pending", "confirmed", "shipping", "failed"] : ["pending", "confirmed", "shipping", "delivered"];
    const end = path.indexOf(status);
    return path.slice(0, end + 1).map((s, i) => ({ status: s, at: new Date(date.getTime() + i * 26 * 3600000).toISOString() }));
  }

  function load() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (raw) { const db = JSON.parse(raw); if (db.version === SEED_VERSION) return db; }
    } catch (e) { /* hỏng dữ liệu -> tạo lại */ }
    const db = seedDb();
    save(db);
    return db;
  }
  function save(db) { localStorage.setItem(DB_KEY, JSON.stringify(db)); }
  let DB = load();
  function commit() { save(DB); window.dispatchEvent(new CustomEvent("store:change")); }

  // ---------- Sản phẩm ----------
  function unitPrice(p, v) { return Math.round(v.price * (100 - (p.sale || 0)) / 100 / 500) * 500; }
  function products(opts = {}) { return DB.products.filter((p) => opts.all || p.active); }
  function product(id) { return DB.products.find((p) => p.id === id); }
  function findVariant(sku) {
    for (const p of DB.products) { const v = p.variants.find((x) => x.sku === sku); if (v) return { p, v }; }
    return null;
  }
  function priceRange(p) {
    const prices = p.variants.map((v) => unitPrice(p, v));
    return { min: Math.min(...prices), max: Math.max(...prices), multi: new Set(prices).size > 1 };
  }
  function inStock(p) { return p.variants.some((v) => v.stock > 0); }

  // ---------- Tài khoản ----------
  function currentUser() {
    const id = localStorage.getItem(SESSION_KEY);
    return id ? DB.users.find((u) => u.id === id) || null : null;
  }
  function login(email, pass) {
    const u = DB.users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
    if (!u || u.pass !== hash(pass)) return { ok: false, error: "Email hoặc mật khẩu không đúng." };
    localStorage.setItem(SESSION_KEY, u.id);
    // Gộp giỏ khách vào giỏ đã lưu của tài khoản (cộng dồn, không vượt giới hạn) để khách không mất hàng vừa chọn.
    readGuestCart().forEach((g) => {
      const f = findVariant(g.sku);
      const limit = f ? Math.min(RULES.maxPerVariant, Math.max(f.v.stock, 1)) : g.qty;
      const cur = u.cart.find((i) => i.sku === g.sku);
      if (cur) cur.qty = Math.min(cur.qty + g.qty, limit); else u.cart.push({ sku: g.sku, qty: Math.min(g.qty, limit) });
    });
    sessionStorage.removeItem(GUEST_CART_KEY);
    commit();
    return { ok: true, user: u };
  }
  function logout() { localStorage.removeItem(SESSION_KEY); window.dispatchEvent(new CustomEvent("store:change")); }
  function register(data) {
    if (DB.users.some((u) => u.email.toLowerCase() === data.email.trim().toLowerCase())) return { ok: false, field: "email", error: "Email này đã được đăng ký." };
    const u = { id: "u" + Date.now(), role: "customer", name: data.name.trim(), email: data.email.trim(), phone: data.phone.trim(), birthday: "", pass: hash(data.pass), addresses: [], cart: [] };
    DB.users.push(u);
    commit();
    return login(u.email, data.pass);
  }
  function updateProfile(patch) { Object.assign(currentUser(), patch); commit(); }
  function changePassword(oldPass, newPass) {
    const u = currentUser();
    if (u.pass !== hash(oldPass)) return { ok: false, error: "Mật khẩu hiện tại không đúng." };
    u.pass = hash(newPass); commit(); return { ok: true };
  }
  function saveAddress(addr) {
    const u = currentUser();
    const old = u.addresses.find((a) => a.id === addr.id);
    if (old && old.isDefault) addr.isDefault = true; // luôn giữ đúng 1 địa chỉ mặc định
    if (addr.isDefault || !u.addresses.length) u.addresses.forEach((a) => (a.isDefault = false));
    const i = u.addresses.findIndex((a) => a.id === addr.id);
    if (i >= 0) u.addresses[i] = addr; else u.addresses.push({ ...addr, id: "a" + Date.now(), isDefault: addr.isDefault || !u.addresses.length });
    commit();
  }
  function deleteAddress(id) {
    const u = currentUser();
    const wasDefault = u.addresses.find((a) => a.id === id)?.isDefault;
    u.addresses = u.addresses.filter((a) => a.id !== id);
    if (wasDefault && u.addresses[0]) u.addresses[0].isDefault = true;
    commit();
  }

  // ---------- Quản trị ----------
  function currentAdmin() { const id = sessionStorage.getItem(ADMIN_KEY); return id ? DB.admins.find((a) => a.id === id) || null : null; }
  function adminLogin(email, pass) {
    const a = DB.admins.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
    if (!a || a.pass !== hash(pass)) return { ok: false, error: "Tài khoản quản trị hoặc mật khẩu không đúng." };
    sessionStorage.setItem(ADMIN_KEY, a.id);
    return { ok: true };
  }
  function adminLogout() { sessionStorage.removeItem(ADMIN_KEY); }

  // ---------- Giỏ hàng ----------
  function readGuestCart() { try { return JSON.parse(sessionStorage.getItem(GUEST_CART_KEY)) || []; } catch (e) { return []; } }
  function cartRaw() { const u = currentUser(); return u ? u.cart : readGuestCart(); }
  function writeCart(items) {
    const u = currentUser();
    if (u) { u.cart = items; commit(); } else { sessionStorage.setItem(GUEST_CART_KEY, JSON.stringify(items)); window.dispatchEvent(new CustomEvent("store:change")); }
  }
  // Trả về giỏ đã "làm giàu": giá hiện tại, tồn kho hiện tại, cờ không khả dụng.
  function cart() {
    return cartRaw().map((it) => {
      const f = findVariant(it.sku);
      if (!f) return { ...it, name: "Sản phẩm không còn tồn tại", size: "", price: 0, total: 0, unavailable: true, reason: "Sản phẩm đã bị xóa khỏi cửa hàng." };
      const { p, v } = f;
      if (!p.active) return { ...makeLine(p, v, it.qty), unavailable: true, reason: "Sản phẩm đã ngừng bán. Không tính vào tạm tính và không được đưa vào đơn." };
      const line = makeLine(p, v, it.qty);
      if (v.stock <= 0) return { ...line, unavailable: true, reason: "Hết hàng. Không tính vào tạm tính và không được đưa vào đơn." };
      if (it.qty > v.stock) return { ...line, qty: v.stock, adjusted: true };
      return line;
    });
  }
  function cartCount() { return cart().filter((i) => !i.unavailable).reduce((s, i) => s + i.qty, 0); }
  function addToCart(sku, qty) {
    const f = findVariant(sku);
    if (!f || f.v.stock <= 0) return { ok: false, error: "Phiên bản này đang hết hàng." };
    const items = cartRaw().slice();
    const cur = items.find((i) => i.sku === sku);
    const limit = Math.min(RULES.maxPerVariant, f.v.stock);
    const want = (cur ? cur.qty : 0) + qty;
    if (want > limit) return { ok: false, error: `Chỉ có thể mua tối đa ${limit} sản phẩm cho dung tích này (đã có ${cur ? cur.qty : 0} trong giỏ).` };
    if (cur) cur.qty = want; else items.push({ sku, qty });
    writeCart(items);
    return { ok: true, line: makeLine(f.p, f.v, qty) };
  }
  function setQty(sku, qty) {
    const f = findVariant(sku);
    const limit = f ? Math.min(RULES.maxPerVariant, f.v.stock) : 0;
    const items = cartRaw().map((i) => (i.sku === sku ? { ...i, qty: Math.max(1, Math.min(qty, limit)) } : i));
    writeCart(items);
  }
  function removeFromCart(sku) { writeCart(cartRaw().filter((i) => i.sku !== sku)); }
  function clearPurchased(skus) { writeCart(cartRaw().filter((i) => !skus.includes(i.sku))); }

  function makeLine(p, v, qty) {
    const price = unitPrice(p, v);
    return { sku: v.sku, productId: p.id, name: p.name, collection: p.collection, size: v.size, image: v.images[0] || p.variants.find((x) => x.images[0])?.images[0] || "", listPrice: v.price, price, sale: p.sale || 0, qty, total: price * qty };
  }

  // ---------- Voucher & tổng tiền ----------
  function localDay(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function today() { return localDay(new Date()); }
  function checkVoucher(code, subtotal) {
    const v = DB.vouchers.find((x) => x.code.toUpperCase() === String(code).trim().toUpperCase());
    if (!v) return { ok: false, error: "Mã ưu đãi không tồn tại." };
    if (!v.active) return { ok: false, error: "Mã ưu đãi đã ngừng áp dụng." };
    const t = today();
    if (t < v.start) return { ok: false, error: "Mã ưu đãi chưa đến thời gian áp dụng." };
    if (t > v.end) return { ok: false, error: "Mã ưu đãi đã hết hạn." };
    if (v.used >= v.limit) return { ok: false, error: "Mã ưu đãi đã hết lượt sử dụng." };
    if (subtotal < v.minOrder) return { ok: false, error: `Đơn hàng cần tối thiểu ${fmt(v.minOrder)} để dùng mã này.` };
    let discount = v.type === "percent" ? Math.round(subtotal * v.value / 100) : v.value;
    if (v.maxDiscount) discount = Math.min(discount, v.maxDiscount);
    return { ok: true, voucher: v, discount: Math.min(discount, subtotal) };
  }
  function calcTotals(lines, voucherCode) {
    const items = lines.filter((l) => !l.unavailable);
    const subtotal = items.reduce((s, l) => s + l.price * l.qty, 0);
    let discount = 0, voucher = null, voucherError = null;
    if (voucherCode) {
      const r = checkVoucher(voucherCode, subtotal);
      if (r.ok) { discount = r.discount; voucher = r.voucher.code; } else voucherError = r.error;
    }
    const afterDiscount = subtotal - discount;
    const shipping = items.length === 0 ? 0 : afterDiscount >= RULES.freeShipFrom ? 0 : RULES.shippingFee;
    return { count: items.reduce((s, l) => s + l.qty, 0), subtotal, discount, voucher, voucherError, shipping, total: afterDiscount + shipping };
  }

  // ---------- Đơn hàng ----------
  function nextCode(db, date) {
    const key = `${String(date.getFullYear()).slice(2)}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
    db.seq[key] = (db.seq[key] || 0) + 1;
    return `DV-${key}-${pad(db.seq[key], 4)}`;
  }
  function buildOrder(db, { date, lines, totals, voucher, payment, userId, customer }) {
    return {
      code: nextCode(db, date), createdAt: date.toISOString(), day: localDay(date), userId, customer,
      items: lines.map(({ sku, productId, name, size, image, price, listPrice, qty }) => ({ sku, productId, name, size, image, price, listPrice, qty, total: price * qty })),
      subtotal: totals.subtotal, discount: totals.discount, voucher: voucher || null, shipping: totals.shipping, total: totals.total,
      payment, paid: payment === "vnpay", status: "pending", history: [{ status: "pending", at: date.toISOString() }],
    };
  }
  // Kiểm tra lại toàn bộ giỏ ngay lúc đặt (giá, tồn kho, voucher) rồi mới tạo đơn.
  // expectedTotal: số tiền khách đang thấy; nếu giá/tồn kho đổi thì dừng lại để khách xem lại.
  function placeOrder({ customer, voucherCode, payment, expectedTotal }) {
    const lines = cart().filter((l) => !l.unavailable);
    if (!lines.length) return { ok: false, changed: true, error: "Giỏ hàng không có sản phẩm khả dụng." };
    const short = lines.filter((l) => l.adjusted);
    if (short.length) {
      short.forEach((l) => setQty(l.sku, l.qty));
      return { ok: false, changed: true, error: short.map((l) => `${l.name} ${l.size} chỉ còn ${l.qty} sản phẩm`).join("; ") + ". Đơn hàng đã được cập nhật, vui lòng kiểm tra lại trước khi đặt." };
    }
    const totals = calcTotals(lines, voucherCode);
    if (expectedTotal != null && totals.total !== expectedTotal) return { ok: false, changed: true, error: `Tổng tiền đã thay đổi thành ${fmt(totals.total)} do giá hoặc ưu đãi vừa cập nhật. Vui lòng kiểm tra lại.` };
    if (voucherCode && totals.voucherError) return { ok: false, error: totals.voucherError };
    if (payment === "cod" && totals.total > RULES.codLimit) return { ok: false, error: `Thanh toán khi nhận hàng chỉ áp dụng cho đơn đến ${fmt(RULES.codLimit)}. Vui lòng chọn VNPay.` };
    const user = currentUser();
    const order = buildOrder(DB, { date: new Date(), lines, totals, voucher: totals.voucher, payment, userId: user ? user.id : null, customer });
    lines.forEach((l) => {
      const { p, v } = findVariant(l.sku);
      v.stock -= l.qty;
      DB.stockLog.unshift({ at: order.createdAt, sku: l.sku, name: `${p.name} ${v.size}`, change: -l.qty, after: v.stock, reason: `Bán – đơn ${order.code}` });
    });
    if (totals.voucher) DB.vouchers.find((x) => x.code === totals.voucher).used++;
    DB.orders.unshift(order);
    if (user && !user.addresses.length) user.addresses.push({ id: "a" + Date.now(), name: customer.name, phone: customer.phone, city: customer.city, ward: customer.ward, line: customer.line, isDefault: true });
    clearPurchased(lines.map((l) => l.sku)); // giỏ chỉ còn lại sản phẩm không khả dụng (nếu có)
    commit();
    sessionStorage.setItem("davines_last_order", order.code);
    return { ok: true, order };
  }
  function order(code) { return DB.orders.find((o) => o.code === String(code).trim().toUpperCase()); }
  function lookupOrder(code, email) {
    const o = order(code);
    if (!o || o.customer.email.toLowerCase() !== email.trim().toLowerCase()) return null;
    return o;
  }
  function myOrders() { const u = currentUser(); return u ? DB.orders.filter((o) => o.userId === u.id) : []; }
  function updateOrderStatus(code, status) {
    const o = order(code);
    if (!NEXT_STATUS[o.status].includes(status)) return { ok: false, error: "Không thể chuyển sang trạng thái này." };
    o.status = status;
    o.history.push({ status, at: new Date().toISOString() });
    if (status === "delivered") o.paid = true;
    if (status === "failed") {
      o.items.forEach((it) => {
        const f = findVariant(it.sku);
        if (!f) return;
        f.v.stock += it.qty;
        DB.stockLog.unshift({ at: new Date().toISOString(), sku: it.sku, name: `${f.p.name} ${f.v.size}`, change: it.qty, after: f.v.stock, reason: `Hoàn kho – đơn ${o.code} giao thất bại` });
      });
    }
    commit();
    return { ok: true };
  }

  // ---------- Quản trị sản phẩm / kho / voucher ----------
  function saveProduct(p) {
    const i = DB.products.findIndex((x) => x.id === p.id);
    if (i >= 0) DB.products[i] = p; else DB.products.push(p);
    commit();
  }
  function adjustStock(sku, change, reason) {
    const f = findVariant(sku);
    if (f.v.stock + change < 0) return { ok: false, error: "Tồn kho không thể âm." };
    f.v.stock += change;
    DB.stockLog.unshift({ at: new Date().toISOString(), sku, name: `${f.p.name} ${f.v.size}`, change, after: f.v.stock, reason });
    commit();
    return { ok: true };
  }
  function saveVoucher(v, isNew) {
    if (isNew && DB.vouchers.some((x) => x.code === v.code)) return { ok: false, error: "Mã này đã tồn tại." };
    const i = DB.vouchers.findIndex((x) => x.code === v.code);
    if (i >= 0) DB.vouchers[i] = v; else DB.vouchers.unshift(v);
    commit();
    return { ok: true };
  }

  // ---------- Báo cáo ----------
  function report(from, to) {
    const inRange = DB.orders.filter((o) => o.day >= from && o.day <= to);
    const delivered = inRange.filter((o) => o.status === "delivered");
    const revenue = delivered.reduce((s, o) => s + o.total, 0);
    const byStatus = Object.fromEntries(STATUS.map((s) => [s.key, inRange.filter((o) => o.status === s.key).length]));
    const top = {};
    delivered.forEach((o) => o.items.forEach((it) => { top[it.productId] = (top[it.productId] || 0) + it.qty; }));
    const customers = {};
    DB.orders.forEach((o) => { const k = o.userId || o.customer.email.toLowerCase(); (customers[k] = customers[k] || []).push(o.day); });
    const buyers = new Set(inRange.map((o) => o.userId || o.customer.email.toLowerCase()));
    let returning = 0;
    buyers.forEach((k) => { if (customers[k].some((d) => d < from) || inRange.filter((o) => (o.userId || o.customer.email.toLowerCase()) === k).length > 1) returning++; });
    const weeks = [];
    for (let d = new Date(from); d <= new Date(to); d.setDate(d.getDate() + 7)) {
      const s = d.toISOString().slice(0, 10);
      const e = new Date(Math.min(new Date(d).setDate(d.getDate() + 6), new Date(to))).toISOString().slice(0, 10);
      weeks.push({ label: `${s.slice(8)}/${s.slice(5, 7)}–${e.slice(8)}/${e.slice(5, 7)}`, value: delivered.filter((o) => o.day >= s && o.day <= e).reduce((t, o) => t + o.total, 0) });
    }
    return {
      orders: inRange.length, revenue, delivered: delivered.length, aov: delivered.length ? Math.round(revenue / delivered.length) : 0,
      byStatus, buyers: buyers.size, returning, firstTime: buyers.size - returning, weeks,
      top: Object.entries(top).map(([id, qty]) => ({ product: product(id), qty })).filter((x) => x.product).sort((a, b) => b.qty - a.qty).slice(0, 10),
    };
  }

  // ---------- Tiện ích ----------
  function fmt(n) { return Number(n || 0).toLocaleString("vi-VN") + " ₫"; }
  function statusLabel(k) { return (STATUS.find((s) => s.key === k) || {}).label || k; }
  function reset() { localStorage.removeItem(DB_KEY); sessionStorage.removeItem(GUEST_CART_KEY); DB = load(); commit(); }

  window.Store = {
    RULES, STATUS, NEXT_STATUS, fmt, statusLabel, unitPrice, priceRange, inStock,
    get db() { return DB; },
    products, product, findVariant,
    today, currentUser, login, logout, register, updateProfile, changePassword, saveAddress, deleteAddress,
    currentAdmin, adminLogin, adminLogout,
    cart, cartCount, addToCart, setQty, removeFromCart,
    checkVoucher, calcTotals, placeOrder, order, lookupOrder, myOrders, updateOrderStatus,
    saveProduct, adjustStock, saveVoucher, report, reset,
  };
})();
