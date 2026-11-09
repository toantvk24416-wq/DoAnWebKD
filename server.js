/* Server Node nhỏ cho web Davines: phục vụ các trang web và lưu dữ liệu xuống file CSV trong thư mục data.
 * Không cần cài thêm thư viện. Chạy: node server.js rồi mở http://localhost:3000
 * Mỗi lần web có thay đổi (store.js gọi POST /api/db), server ghi lại các file CSV có nội dung mới.
 * Khi mở trang (GET /api/db), server đọc CSV và trả dữ liệu về cho web. */
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, "data"));
const PORT = Number(process.env.PORT) || 3000;
const BLOCKED = new Set(["data", "tools", "tests", "website", "node_modules", "anh-goc", "tai-lieu", "api"]); // không cho tải các thư mục này qua web
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".svg": "image/svg+xml", ".webp": "image/webp", ".ico": "image/x-icon" };

// Cấu trúc 14 bảng và cách đổi dữ liệu web <-> bảng phẳng nằm ở api/_dbmap.js (dùng chung với bản Vercel)
const { SCHEMA, toTables, fromTables } = require("./api/_dbmap");

// ---------- Đọc / ghi CSV ----------
// Dấu ' đứng trước giá trị bắt đầu bằng = + - @ để Excel không hiểu nhầm là công thức; khi đọc lại sẽ bỏ dấu này.
const risky = /^[=+\-@\t\r]/;
function toCell(value, type) {
  let s;
  if (type === "l") s = (value || []).join("|");
  else if (type === "b") s = value ? "true" : "false";
  else if (type === "n") s = value === undefined || value === null ? "" : String(value);
  else s = value === undefined || value === null ? "" : String(value);
  if ((type === "s" || type === "o" || type === "l") && risky.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function fromCell(raw, type) {
  const s = raw && raw[0] === "'" && risky.test(raw.slice(1)) ? raw.slice(1) : raw;
  if (type === "n") return s === "" || s === undefined ? 0 : Number(s);
  if (type === "b") return String(s).toLowerCase() === "true";
  if (type === "l") return s ? s.split("|") : [];
  if (type === "o") return s ? s : null;
  return s === undefined ? "" : s;
}
function toCsv(rows, cols) {
  const names = Object.keys(cols);
  const lines = [names.join(",")].concat(rows.map((r) => names.map((n) => toCell(r[n], cols[n])).join(",")));
  return "﻿" + lines.join("\r\n") + "\r\n"; // BOM để Excel hiển thị đúng tiếng Việt
}
function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else quoted = false; } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (c !== "\r") cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
const fileOf = (name) => path.join(DATA_DIR, name + ".csv");

function readAll() {
  if (!fs.existsSync(fileOf("products")) || !fs.existsSync(fileOf("meta"))) return null;
  const t = {};
  for (const [name, cols] of Object.entries(SCHEMA)) {
    if (!fs.existsSync(fileOf(name))) { t[name] = []; continue; }
    const [head = [], ...rows] = parseCsv(fs.readFileSync(fileOf(name), "utf8"));
    t[name] = rows.filter((r) => r.some((c) => c !== "")).map((r) => {
      const o = {};
      head.forEach((h, i) => { if (cols[h.trim()]) o[h.trim()] = fromCell(r[i], cols[h.trim()]); });
      Object.keys(cols).forEach((c) => { if (!(c in o)) o[c] = fromCell(undefined, cols[c]); });
      return o;
    });
  }
  return fromTables(t);
}

// Ghi file nào có nội dung đổi. File đang mở bằng Excel thì không ghi được -> trả về danh sách để thử lại sau.
function writeAll(db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tables = toTables(db);
  const failed = [], changed = [];
  for (const [name, cols] of Object.entries(SCHEMA)) {
    const content = toCsv(tables[name], cols), file = fileOf(name);
    try {
      if (fs.existsSync(file) && fs.readFileSync(file, "utf8") === content) continue;
      const tmp = file + ".tmp";
      fs.writeFileSync(tmp, content, "utf8");
      fs.renameSync(tmp, file);
      changed.push(name + ".csv");
    } catch (e) {
      try { fs.unlinkSync(file + ".tmp"); } catch (_) { /* không có file tạm */ }
      failed.push(name + ".csv");
    }
  }
  return { failed, changed };
}

// Dữ liệu chưa ghi được nằm trong bộ nhớ và được thử ghi lại mỗi 3 giây, nên không bị mất khi đang mở file bằng Excel.
let pending = null;
function persist(db) {
  const { failed, changed } = writeAll(db);
  if (changed.length) console.log(`[${new Date().toLocaleTimeString("vi-VN")}] Đã ghi: ${changed.join(", ")}`);
  pending = failed.length ? db : null;
  if (failed.length) console.warn(`Chưa ghi được ${failed.join(", ")} (có thể đang mở bằng Excel). Sẽ tự thử lại.`);
  return failed;
}
setInterval(() => { if (pending) persist(pending); }, 3000).unref();

// ---------- HTTP ----------
function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  res.end(body);
}
const json = (res, status, obj) => send(res, status, JSON.stringify(obj));
// Chỉ nhận yêu cầu từ chính web trên máy này, không cho trang web khác đọc hay ghi đè dữ liệu.
function allowed(req) {
  const host = String(req.headers.host || "").replace(/:\d+$/, "");
  if (!["localhost", "127.0.0.1", "[::1]"].includes(host)) return false;
  const origin = req.headers.origin;
  if (origin) { try { if (new URL(origin).host !== req.headers.host) return false; } catch (e) { return false; } }
  return true;
}

function serveStatic(req, res, pathname) {
  let rel;
  try { rel = decodeURIComponent(pathname); } catch (e) { return send(res, 400, "Bad request", "text/plain; charset=utf-8"); }
  const parts = rel.split(/[\\/]+/).filter(Boolean);
  const blocked = parts.some((p) => p === ".." || p.startsWith(".") || BLOCKED.has(p)) || ["server.js", "readme.md"].includes((parts[0] || "").toLowerCase()) || /\.(bat|cmd)$/i.test(rel);
  let file = path.join(ROOT, ...parts);
  if (blocked || !file.startsWith(ROOT)) return send(res, 404, "Not found", "text/plain; charset=utf-8");
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, "Không tìm thấy trang", "text/plain; charset=utf-8");
    res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(req.method === "HEAD" ? undefined : data);
  });
}

const server = http.createServer((req, res) => {
  const { pathname } = new URL(req.url, "http://localhost");
  if (pathname === "/api/db") {
    if (!allowed(req)) return json(res, 403, { error: "Không được phép" });
    if (req.method === "GET") {
      try { return json(res, 200, { db: pending || readAll() }); }
      catch (e) { console.error("Không đọc được CSV:", e.message); return json(res, 500, { error: "Không đọc được file CSV: " + e.message }); }
    }
    if (req.method === "POST") {
      if (!String(req.headers["content-type"] || "").startsWith("application/json")) return json(res, 415, { error: "Cần JSON" });
      const chunks = [];
      let size = 0;
      req.on("data", (c) => { size += c.length; if (size <= 50e6) chunks.push(c); });
      req.on("end", () => {
        if (size > 50e6) return json(res, 413, { error: "Dữ liệu quá lớn" });
        try {
          const db = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          if (!Array.isArray(db.products) || !Array.isArray(db.orders)) return json(res, 400, { error: "Dữ liệu không hợp lệ" });
          json(res, 200, { ok: true, pending: persist(db) });
        } catch (e) { json(res, 400, { error: "Dữ liệu không hợp lệ" }); }
      });
      return;
    }
    return json(res, 405, { error: "Không hỗ trợ" });
  }
  if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Method not allowed", "text/plain; charset=utf-8");
  serveStatic(req, res, pathname);
});

server.on("error", (e) => {
  console.error(e.code === "EADDRINUSE" ? `Cổng ${PORT} đang được dùng. Hãy tắt chương trình đang dùng cổng này rồi chạy lại.` : e.message);
  process.exit(1);
});
server.listen(PORT, "127.0.0.1", () => {
  console.log(`Web Davines: http://localhost:${PORT}`);
  console.log(`Dữ liệu CSV: ${DATA_DIR}`);
  console.log("Nhấn Ctrl+C để tắt.");
});

module.exports = { toTables, fromTables, toCsv, parseCsv, SCHEMA };
