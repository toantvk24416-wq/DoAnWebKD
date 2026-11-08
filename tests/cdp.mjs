// Mini CDP driver for headless Edge: node cdp.mjs <scenario.mjs> <outDir>
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [, , scenarioPath, outDir] = process.argv;
mkdirSync(outDir, { recursive: true });
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const port = 9333;
const profile = path.resolve(outDir, "profile");
const edge = spawn(EDGE, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run", "--disable-extensions", "--window-size=1440,900", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let targets;
for (let i = 0; i < 120; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (targets.length) break; } catch {} await sleep(300); }
const page = targets.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map(); const listeners = [];
const logs = [];
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) { const { res, rej } = pending.get(msg.id); pending.delete(msg.id); msg.error ? rej(new Error(msg.error.message)) : res(msg.result); }
  else if (msg.method) {
    if (msg.method === "Runtime.exceptionThrown") logs.push("EXCEPTION " + (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text));
    if (msg.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(msg.params.type)) logs.push(msg.params.type + " " + msg.params.args.map((a) => a.value ?? a.description).join(" "));
    if (msg.method === "Page.javascriptDialogOpening") { logs.push("DIALOG " + msg.params.message); send("Page.handleJavaScriptDialog", { accept: true }); }
    listeners.forEach((l) => l(msg));
  }
};
function send(method, params = {}) { return new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); }); }
await send("Page.enable"); await send("Runtime.enable");

const t = {
  logs,
  sleep,
  async viewport(w, h, mobile = false) {
    t.dpr = mobile ? 2 : 1;
    await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: mobile ? 2 : 1, mobile });
    await send("Emulation.setTouchEmulationEnabled", { enabled: mobile });
  },
  async go(url) {
    const loaded = new Promise((r) => { const l = (m) => { if (m.method === "Page.loadEventFired") { listeners.splice(listeners.indexOf(l), 1); r(); } }; listeners.push(l); });
    await send("Page.navigate", { url });
    await loaded; await sleep(400);
  },
  async js(expr) {
    const r = await send("Runtime.evaluate", { expression: `(async()=>{${expr}})()`, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error("JS: " + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r.result.value;
  },
  async waitNav(fn) {
    const loaded = new Promise((r) => { const l = (m) => { if (m.method === "Page.loadEventFired") { listeners.splice(listeners.indexOf(l), 1); r(); } }; listeners.push(l); });
    await fn(); await Promise.race([loaded, sleep(4000)]); await sleep(400);
  },
  async shot(name, full = false) {
    let params = { format: "png" };
    if (full) {
      const m = await send("Page.getLayoutMetrics");
      const h = Math.min(Math.ceil(m.cssContentSize.height), 6000);
      // Màn hình điện thoại (mật độ ×2): chụp ở tỉ lệ 0.5 để ảnh không quá lớn làm Edge headless bị treo
      params = { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: m.cssLayoutViewport.clientWidth, height: h, scale: 1 / (t.dpr || 1) } };
    }
    const r = await send("Page.captureScreenshot", params);
    writeFileSync(path.join(outDir, name + ".png"), Buffer.from(r.data, "base64"));
  },
};

const results = [];
try {
  const scenario = (await import(pathToFileURL(path.resolve(scenarioPath)).href)).default;
  await scenario(t, (name, ok, detail = "") => { results.push({ name, ok, detail }); console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? " | " + detail : ""}`); });
} catch (e) { console.log("RUNNER ERROR", e.stack); }
console.log("--- console/exceptions:"); logs.forEach((l) => console.log(l));
console.log(`--- ${results.filter((r) => r.ok).length}/${results.length} passed`);
ws.close(); edge.kill(); process.exit(0);
