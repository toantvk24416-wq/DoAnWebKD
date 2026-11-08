// Kiểm tra lưu dữ liệu xuống CSV. Chạy với thư mục dữ liệu riêng để không đụng data thật:
//   PORT=3100 DATA_DIR=<thư mục tạm> node ../server.js   rồi   PORT=3100 DATA_DIR=<thư mục tạm> node cdp.mjs t_csv.mjs out_csv
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
const B = `http://localhost:${process.env.PORT}/`, D = process.env.DATA_DIR;
const S = (ms) => new Promise((r) => setTimeout(r, ms));
const csv = (n) => readFileSync(`${D}/${n}.csv`, "utf8");
export default async function (t, check) {
  await t.viewport(1280, 800);
  await t.go(B + "index.html");
  const names = ["products", "product_variants", "users", "addresses", "cart_items", "admins", "orders", "order_items", "order_history", "vouchers", "stock_log", "order_sequence", "password_resets", "meta"];
  check("Mở web lần đầu tạo đủ các file CSV", names.every((n) => existsSync(`${D}/${n}.csv`)));
  const before = await t.js(`return JSON.stringify(Store.db)`);
  await t.go(B + "index.html");
  const after = await t.js(`return JSON.stringify(Store.db)`);
  const so = (o) => (Array.isArray(o) ? o.map(so) : o && typeof o === "object" ? Object.fromEntries(Object.keys(o).sort().map((k) => [k, so(o[k])])) : o);
  const norm = (s) => { const d = JSON.parse(s); d.orders.forEach((x) => { x.customer.note = x.customer.note || ""; }); d.vouchers.forEach((v) => { v.firstOrderOnly = !!v.firstOrderOnly; }); return so(d); };
  const a = norm(before), b = norm(after);
  let where = "";
  for (const k of Object.keys(a)) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) { const i = Array.isArray(a[k]) ? a[k].findIndex((x, n) => JSON.stringify(x) !== JSON.stringify(b[k][n])) : -1; where += `${k}@${i} ${JSON.stringify(i < 0 ? a[k] : a[k][i]).slice(0, 400)} VS ${JSON.stringify(i < 0 ? b[k] : b[k][i]).slice(0, 400)}; `; }
  check("Đọc CSV ra khớp hoàn toàn dữ liệu đã ghi", !where, where);
  check("Tiếng Việt và BOM trong CSV", csv("users").charCodeAt(0) === 0xfeff && csv("users").includes("Nguyễn Văn An"));
  // Đăng ký
  await t.go(B + "login.html?mode=register");
  await t.js(`const f=document.querySelector('#f'); f.name.value='=Lê, "CSV" Test'; f.email.value='csv@test.vn'; f.phone.value='0987654321'; f.pass.value='Matkhau123'; f.pass2.value='Matkhau123'; f.agree.checked=true; f.requestSubmit()`);
  await S(400);
  check("Đăng ký ghi xuống users.csv, ký tự đặc biệt an toàn", csv("users").includes("csv@test.vn") && csv("users").includes(`"'=Lê, ""CSV"" Test"`));
  await t.js(`const f=document.querySelector('#f'); f.pass.value='Matkhau123'; f.requestSubmit()`);
  await S(600);
  await t.go(B + "product.html?id=dau-goi-momo");
  await t.js(`document.querySelector('#add').click()`);
  check("Giỏ thành viên ghi xuống cart_items.csv", /u\d+,[^,]+,1/.test(csv("cart_items")), csv("cart_items").slice(1, 80));
  // Đặt hàng rồi chuyển trang ngay
  await t.go(B + "checkout.html");
  await t.js(`const f=document.querySelector('#form'); f.name.value='Trần, Mai'; f.phone.value='0901234567'; f.city.value='TP. Hà Nội'; f.city.onchange(); f.ward.value='Phường Ba Đình'; f.line.value='5 "A", Hoàng Diệu'; f.note.value='Giao giờ\\nhành chính'; document.querySelector('[value=cod]').click(); document.querySelector('#place').click()`);
  await S(200);
  const code = await t.js(`return Store.db.orders[0].code`);
  await t.waitNav(() => t.js(`document.querySelector('#done').click()`));
  check("Đơn hàng ghi xuống orders / order_items / order_history", csv("orders").includes(code) && csv("order_items").includes(code) && csv("order_history").includes(code), code);
  check("Kho và lịch sử kho ghi xuống CSV", csv("stock_log").includes(code) && /,29,/.test(csv("product_variants")));
  // Tải lại
  await t.go(B + "account.html?tab=orders");
  check("Tải lại vẫn đủ đơn; dấu phẩy, ngoặc kép, xuống dòng giữ nguyên", (await t.js(`return Store.order('${code}').customer.note`)).includes("\n") && (await t.js(`return Store.order('${code}').customer.line`)) === '5 "A", Hoàng Diệu');
  // Quản trị sửa giá, nhập kho
  await t.js(`Store.adminLogin('admin@davines.vn','Admin@2026')`);
  await t.go(B + "admin/index.html");
  await t.js(`const p=Store.product('dau-goi-momo'); p.variants[0].price=612345; Store.saveProduct(p); Store.adjustStock(p.variants[0].sku,5,'Nhập lô test')`);
  check("Sửa giá, nhập kho ghi xuống CSV", csv("product_variants").includes("612345") && csv("stock_log").includes("Nhập lô test"));
  // File bị khóa (giả lập đang mở bằng Excel)
  const f = `${D}/vouchers.csv`.replace(/\//g, "\\");
  execSync(`attrib +R "${f}"`);
  const used = await t.js(`const v=Store.db.vouchers[0]; Store.saveVoucher({...v,used:v.used+7}); return Store.db.vouchers[0].used`);
  await S(200);
  const toast = await t.js(`return [...document.querySelectorAll('.toast')].pop()?.innerText || ''`);
  check("File bị khóa: báo cho người dùng", /vouchers\.csv/.test(toast), toast);
  await t.go(B + "admin/index.html");
  check("File bị khóa: tải lại vẫn thấy dữ liệu mới", (await t.js(`return Store.db.vouchers[0].used`)) === used);
  execSync(`attrib -R "${f}"`);
  await S(3500);
  check("Mở khóa: tự ghi lại", new RegExp(`DAVINES10,amount,100000,1000000,0,\\S+,\\S+,500,${used},`).test(csv("vouchers")), csv("vouchers").split("\r\n")[1]);
  // Tab khác / trình duyệt khác vừa đổi dữ liệu
  await t.js(`await fetch('/api/db').then(r=>r.json()).then(j=>{j.db.orders[0].status='confirmed'; return fetch('/api/db',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(j.db)})});`);
  await t.js(`window.dispatchEvent(new Event('focus'))`);
  check("Quay lại tab: lấy dữ liệu mới nhất", (await t.js(`return Store.order('${code}').status`)) === "confirmed");
  // Bảo mật
  const open = [];
  for (const u of ["data/users.csv", "server.js", "tools/build_data.py", "tests/cdp.mjs", "%2e%2e/%2e%2e/README.md", "..%5cserver.js", "website/index.html", "chay-web.bat"]) { const r = await fetch(B + u); if (r.status === 200) open.push(u); }
  check("Không tải được CSV và mã nguồn server qua web", open.length === 0, open.join(","));
  const cross = await fetch(B + "api/db", { method: "POST", headers: { "Content-Type": "application/json", Origin: "http://evil.example" }, body: JSON.stringify({ products: [], orders: [] }) });
  const plain = await fetch(B + "api/db", { method: "POST", headers: { "Content-Type": "text/plain" }, body: "{}" });
  check("Từ chối ghi từ trang web khác", cross.status === 403 && plain.status === 415, cross.status + "/" + plain.status);
  check("Dữ liệu còn nguyên sau khi bị từ chối", csv("products").length > 1000);
  // Nâng phiên bản dữ liệu không mất đơn
  const up = await t.js(`const j=await fetch('/api/db').then(r=>r.json()); j.db.version=1; await fetch('/api/db',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(j.db)}); return j.db.orders.length`);
  await t.go(B + "index.html");
  check("Đổi phiên bản dữ liệu: giữ đơn, giá giảm, cập nhật version", (await t.js(`return Store.db.orders.length`)) === up && csv("meta").includes("version,4"), csv("meta").slice(1));
  // Khởi tạo lại
  await t.js(`Store.reset()`);
  check("Store.reset ghi lại CSV về mẫu", !csv("users").includes("csv@test.vn") && !csv("orders").includes(code));
}
