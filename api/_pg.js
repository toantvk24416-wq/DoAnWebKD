/* Đọc / ghi dữ liệu web vào Postgres (Neon trên Vercel). Dùng cùng 14 bảng như các file CSV khi chạy trên máy.
 * client là một object có 2 hàm:
 *   query(text, params)  -> mảng các dòng kết quả
 *   tx([[text, params], ...]) -> chạy các câu lệnh trong một giao dịch (lỗi một câu thì không câu nào được ghi) */
const { SCHEMA, toTables, fromTables } = require("./_dbmap");

const TYPE = { s: "text not null default ''", o: "text", n: "double precision not null default 0", b: "boolean not null default false", l: "text[] not null default '{}'" };
// Khóa chính của từng bảng
const PK = {
  products: ["id"], product_variants: ["sku"], users: ["id"], addresses: ["userId", "id"], cart_items: ["userId", "sku"],
  admins: ["id"], orders: ["code"], vouchers: ["code"], order_sequence: ["day"], password_resets: ["token"], meta: ["key"],
};
// Khóa ngoại (kiểm tra lúc kết thúc giao dịch nên xóa rồi ghi lại cả bảng vẫn hợp lệ)
const FK = {
  product_variants: [["productId", "products", "id"]],
  addresses: [["userId", "users", "id"]],
  cart_items: [["userId", "users", "id"], ["sku", "product_variants", "sku"]],
  orders: [["userId", "users", "id"]],
  order_items: [["orderCode", "orders", "code"]],
  order_history: [["orderCode", "orders", "code"]],
  password_resets: [["userId", "users", "id"]],
};
const q = (name) => '"' + name + '"';
const NAMES = Object.keys(SCHEMA);

// Tạo bảng nếu chưa có, thêm cột mới nếu SCHEMA có thêm cột. Cột "_i" giữ đúng thứ tự dòng như trên web.
function createStatements() {
  const list = [];
  for (const name of NAMES) {
    const cols = Object.entries(SCHEMA[name]).map(([c, t]) => `${q(c)} ${TYPE[t]}`);
    cols.push('"_i" integer not null default 0');
    if (PK[name]) cols.push(`primary key (${PK[name].map(q).join(", ")})`);
    (FK[name] || []).forEach(([c, ref, rc]) => cols.push(`foreign key (${q(c)}) references ${q(ref)} (${q(rc)}) deferrable initially deferred`));
    list.push([`create table if not exists ${q(name)} (${cols.join(", ")})`, []]);
    for (const [c, t] of Object.entries(SCHEMA[name])) list.push([`alter table ${q(name)} add column if not exists ${q(c)} ${TYPE[t]}`, []]);
  }
  return list;
}

// Chuẩn hóa từng ô theo kiểu cột trước khi ghi
function clean(row, cols, i) {
  const o = { _i: i };
  for (const [c, t] of Object.entries(cols)) {
    const v = row[c];
    if (t === "n") o[c] = Number.isFinite(Number(v)) && v !== null && v !== "" ? Number(v) : 0;
    else if (t === "b") o[c] = v === true || v === "true";
    else if (t === "l") o[c] = Array.isArray(v) ? v.map(String) : [];
    else if (t === "o") o[c] = v === undefined || v === null || v === "" ? null : String(v);
    else o[c] = v === undefined || v === null ? "" : String(v);
  }
  return o;
}

function makeStore(client) {
  let ready = null;
  const init = () => (ready = ready || client.tx(createStatements()).catch((e) => { ready = null; throw e; }));

  async function read() {
    await init();
    // Một câu lệnh lấy cả 14 bảng dưới dạng JSON
    const parts = NAMES.map((n) => `'${n}', (select coalesce(json_agg(x order by x."_i"), '[]'::json) from ${q(n)} x)`).join(", ");
    const [row] = await client.query(`select json_build_object(${parts}) as db`, []);
    let t = row.db;
    if (typeof t === "string") t = JSON.parse(t);
    if (!t.meta.length || !t.products.length) return null; // chưa có dữ liệu: web sẽ tạo dữ liệu mẫu rồi gửi lên
    for (const n of NAMES) t[n] = t[n].map(({ _i, ...r }) => r);
    return fromTables(t);
  }

  async function write(db) {
    await init();
    const tables = toTables(db);
    const list = [];
    // Xóa bảng con trước, ghi bảng cha trước
    for (const n of [...NAMES].reverse()) list.push([`delete from ${q(n)}`, []]);
    for (const n of NAMES) {
      const rows = tables[n].map((r, i) => clean(r, SCHEMA[n], i));
      if (!rows.length) continue;
      const cols = ["_i", ...Object.keys(SCHEMA[n])].map(q).join(", ");
      list.push([`insert into ${q(n)} (${cols}) select ${cols} from jsonb_populate_recordset(null::${q(n)}, $1::jsonb)`, [JSON.stringify(rows)]]);
    }
    await client.tx(list);
  }

  return { read, write };
}

// Xử lý yêu cầu GET / POST /api/db giống server.js để store.js không phải đổi gì
function makeHandler(getClient) {
  let store = null;
  return async function handler(req, res) {
    const send = (status, obj) => {
      res.statusCode = status;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.end(JSON.stringify(obj));
    };
    // Chỉ nhận yêu cầu từ chính trang web này
    const origin = req.headers.origin;
    if (origin) { try { if (new URL(origin).host !== req.headers.host) return send(403, { error: "Không được phép" }); } catch (e) { return send(403, { error: "Không được phép" }); } }
    let client;
    try { client = getClient(); } catch (e) { return send(503, { error: e.message }); } // chưa nối database: web tự lưu vào trình duyệt
    store = store && store.client === client ? store : Object.assign(makeStore(client), { client });
    try {
      if (req.method === "GET") return send(200, { db: await store.read() });
      if (req.method === "POST") {
        if (!String(req.headers["content-type"] || "").startsWith("application/json")) return send(415, { error: "Cần JSON" });
        let db = req.body;
        if (db === undefined) db = await readBody(req);
        if (typeof db === "string") db = JSON.parse(db);
        if (!db || !Array.isArray(db.products) || !Array.isArray(db.orders) || !Array.isArray(db.users)) return send(400, { error: "Dữ liệu không hợp lệ" });
        await store.write(db);
        return send(200, { ok: true, pending: [] });
      }
      return send(405, { error: "Không hỗ trợ" });
    } catch (e) {
      console.error("Lỗi database:", e);
      return send(e instanceof SyntaxError ? 400 : 500, { error: e instanceof SyntaxError ? "Dữ liệu không hợp lệ" : "Lỗi database: " + e.message });
    }
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => { size += c.length; if (size > 4.5e6) { reject(new Error("Dữ liệu quá lớn")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

module.exports = { makeHandler, makeStore, createStatements };
