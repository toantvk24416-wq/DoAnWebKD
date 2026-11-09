/* API /api/db trên Vercel: lưu dữ liệu web vào Postgres (Neon) thay cho các file CSV.
 * Vercel tự đưa biến DATABASE_URL vào khi project đã nối với database Neon (tab Storage). */
const { neon } = require("@neondatabase/serverless");
const { makeHandler } = require("./_pg");

let client = null;
function getClient() {
  if (client) return client;
  const url = process.env.DATABASE_URL || process.env.DATABASE_POSTGRES_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error("Chưa nối database (thiếu DATABASE_URL)");
  const sql = neon(url);
  client = {
    query: (text, params) => sql.query(text, params),
    tx: (list) => sql.transaction(list.map(([text, params]) => sql.query(text, params))),
  };
  return client;
}

module.exports = makeHandler(getClient);
