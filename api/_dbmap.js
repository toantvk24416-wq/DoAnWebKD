/* Phần dùng chung giữa server.js (lưu CSV trên máy) và api/db.js (lưu Postgres trên Vercel):
 * cấu trúc 14 bảng và cách đổi qua lại giữa dữ liệu của web (một object lồng nhau) với các bảng phẳng.
 * Tên file bắt đầu bằng dấu _ nên Vercel không biến nó thành một đường dẫn API. */

// Kiểu cột: s chuỗi, n số, b đúng/sai, l danh sách (CSV ngăn bằng |, Postgres dùng mảng text[]), o chuỗi có thể rỗng (null)
const SCHEMA = {
  products: { id: "s", name: "s", kind: "s", line: "s", collection: "s", needs: "l", hair: "l", short: "s", description: "s", url: "s", benefits: "l", extra: "s", ingredients: "o", sale: "n", active: "b", createdAt: "s" },
  product_variants: { productId: "s", sku: "s", size: "s", price: "n", sale: "n", stock: "n", images: "l" }, // sale: % giảm riêng của dung tích; products.sale = mức giảm cao nhất của các dung tích
  users: { id: "s", role: "s", name: "s", email: "s", phone: "s", birthday: "s", gender: "s", promo: "b", pass: "s" },
  addresses: { userId: "s", id: "s", name: "s", phone: "s", city: "s", ward: "s", line: "s", isDefault: "b" },
  cart_items: { userId: "s", sku: "s", qty: "n" },
  admins: { id: "s", name: "s", email: "s", pass: "s" },
  orders: { code: "s", createdAt: "s", day: "s", userId: "o", customerName: "s", customerEmail: "s", customerPhone: "s", city: "s", ward: "s", line: "s", note: "s", subtotal: "n", discount: "n", voucher: "o", shipping: "n", total: "n", payment: "s", paid: "b", status: "s" },
  order_items: { orderCode: "s", sku: "s", productId: "s", name: "s", size: "s", image: "s", price: "n", listPrice: "n", qty: "n", total: "n" },
  order_history: { orderCode: "s", status: "s", at: "s" },
  vouchers: { code: "s", type: "s", value: "n", minOrder: "n", maxDiscount: "n", start: "s", end: "s", limit: "n", used: "n", active: "b", firstOrderOnly: "b", desc: "s" },
  stock_log: { at: "s", sku: "s", name: "s", change: "n", after: "n", reason: "s" },
  order_sequence: { day: "s", lastNumber: "n" },
  password_resets: { token: "s", userId: "s", exp: "n" },
  meta: { key: "s", value: "s" },
};

// Dữ liệu web -> các bảng phẳng
function toTables(db) {
  const t = Object.fromEntries(Object.keys(SCHEMA).map((k) => [k, []]));
  (db.products || []).forEach((p) => {
    t.products.push(p);
    (p.variants || []).forEach((v) => t.product_variants.push({ productId: p.id, ...v }));
  });
  (db.users || []).forEach((u) => {
    t.users.push(u);
    (u.addresses || []).forEach((a) => t.addresses.push({ userId: u.id, ...a }));
    (u.cart || []).forEach((c) => t.cart_items.push({ userId: u.id, ...c }));
  });
  t.admins = db.admins || [];
  (db.orders || []).forEach((o) => {
    const c = o.customer || {};
    t.orders.push({ ...o, customerName: c.name, customerEmail: c.email, customerPhone: c.phone, city: c.city, ward: c.ward, line: c.line, note: c.note });
    (o.items || []).forEach((i) => t.order_items.push({ orderCode: o.code, ...i }));
    (o.history || []).forEach((h) => t.order_history.push({ orderCode: o.code, ...h }));
  });
  t.vouchers = db.vouchers || [];
  t.stock_log = db.stockLog || [];
  t.order_sequence = Object.entries(db.seq || {}).map(([day, lastNumber]) => ({ day, lastNumber }));
  t.password_resets = db.resets || [];
  t.meta = [{ key: "version", value: String(db.version) }];
  return t;
}

// Các bảng phẳng -> dữ liệu web
function fromTables(t) {
  const group = (rows, key) => { const m = new Map(); rows.forEach((r) => { const k = r[key]; if (!m.has(k)) m.set(k, []); const { [key]: _, ...rest } = r; m.get(k).push(rest); }); return m; };
  const variants = group(t.product_variants, "productId");
  const addresses = group(t.addresses, "userId");
  const carts = group(t.cart_items, "userId");
  const items = group(t.order_items, "orderCode");
  const history = group(t.order_history, "orderCode");
  const meta = Object.fromEntries(t.meta.map((m) => [m.key, m.value]));
  return {
    version: Number(meta.version),
    products: t.products.map((p) => ({ ...p, variants: variants.get(p.id) || [] })),
    users: t.users.map((u) => ({ ...u, addresses: addresses.get(u.id) || [], cart: carts.get(u.id) || [] })),
    admins: t.admins,
    vouchers: t.vouchers,
    orders: t.orders.map(({ customerName, customerEmail, customerPhone, city, ward, line, note, ...o }) => ({
      ...o,
      customer: { name: customerName, email: customerEmail, phone: customerPhone, city, ward, line, note },
      items: items.get(o.code) || [],
      history: history.get(o.code) || [],
    })),
    seq: Object.fromEntries(t.order_sequence.map((s) => [s.day, s.lastNumber])),
    stockLog: t.stock_log,
    resets: t.password_resets,
  };
}

module.exports = { SCHEMA, toTables, fromTables };
