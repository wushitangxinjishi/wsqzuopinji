/* =============================================================================
 *  开发自检脚本（可选，部署前可以删掉）
 * -----------------------------------------------------------------------------
 *  用无头 Edge 打开页面，检查：能否正常加载、图片/视频素材有没有被识别到、
 *  有没有 JS 报错，并把关键区域截图到 .check/ 目录。
 *
 *  用法：
 *    1) 先启动一个带调试端口的无头浏览器：
 *       "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" ^
 *         --headless=new --remote-debugging-port=9226 --user-data-dir=%TEMP%\edge-check about:blank
 *    2) node tools/check.mjs 9226
 * ========================================================================== */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const PORT = process.argv[2] || "9226";
const OUT = process.argv[3] || ".check";
const ROOT = path.resolve(import.meta.dirname, "..");
const URL_FILE = pathToFileURL(path.join(ROOT, "index.html")).href;
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = list.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const problems = [];

await new Promise((res) => ws.addEventListener("open", res));
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { res, rej } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
  } else if (m.method === "Runtime.exceptionThrown") {
    problems.push("EXCEPTION: " + (m.params.exceptionDetails?.exception?.description ||
      m.params.exceptionDetails?.text));
  } else if (m.method === "Log.entryAdded" && m.params.entry.level === "error" &&
             !/fonts\.googleapis/.test(m.params.entry.url || "")) {
    problems.push("LOG: " + m.params.entry.text + " " + (m.params.entry.url || ""));
  }
});
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const mid = ++id;
    pending.set(mid, { res, rej });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
const evalJs = async (expression) =>
  (await send("Runtime.evaluate", { expression, returnByValue: true })).result?.value;
const shoot = async (name) => {
  const s = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(OUT, name + ".png"), Buffer.from(s.data, "base64"));
};

await send("Page.enable");
await send("Runtime.enable");
await send("Log.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: 1440, height: 900, deviceScaleFactor: 1, mobile: false
});
await send("Page.navigate", { url: URL_FILE });

let loaded = false;
for (let i = 0; i < 60 && !loaded; i++) {
  await sleep(500);
  loaded = (await evalJs("document.body.classList.contains('is-loading')")) === false;
}
await sleep(1500);

console.log("页面加载完成:", loaded);
console.log("概览:", JSON.stringify(await evalJs(`(() => {
  const pl = document.getElementById('preloader');
  const portrait = document.getElementById('aboutPortrait');
  return {
    bodyClass: document.body.className,
    preloader: pl ? getComputedStyle(pl).display : 'none',
    sections: document.querySelectorAll('section[data-nav]').length,
    gallery: document.querySelectorAll('.gitem').length,
    videos: document.querySelectorAll('.vitem').length,
    accounts: document.querySelectorAll('.acct').length,
    portrait: portrait ? {
      file: portrait.src.split('/').pop(),
      loaded: portrait.naturalWidth > 0,
      size: portrait.naturalWidth + 'x' + portrait.naturalHeight
    } : null,
    docH: Math.round(document.documentElement.scrollHeight)
  };
})()`)));

// 个人照片区域
await evalJs(`(() => { const el = document.getElementById('about');
  window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY + 380); })()`);
await sleep(1200);
await shoot("about-portrait");

// 视频弹层：点开第 1 条，确认视频文件被找到
await evalJs(`document.querySelector('.vitem').click()`);
await sleep(3500);
console.log("视频弹层:", JSON.stringify(await evalJs(`(() => {
  const v = document.querySelector('#vmodalPlayer video');
  const empty = document.getElementById('vmodalEmpty');
  return {
    hasVideoEl: !!v,
    src: v ? decodeURIComponent(v.currentSrc || v.src).split('/').slice(-1)[0] : null,
    readyState: v ? v.readyState : null,
    duration: v && v.duration ? Math.round(v.duration) + '秒' : null,
    emptyShown: empty ? empty.classList.contains('is-on') : null,
    desc: (document.getElementById('vmodalDesc') || {}).textContent || null
  };
})()`)));
await shoot("video-modal");

// 生成 preview/ 里的板块预览图
const P = process.argv[4];
if (P) {
  fs.mkdirSync(P, { recursive: true });
  await evalJs("document.getElementById('vmodalClose').click()");
  await sleep(600);
  // 展开第一个账号，把展开后的图片+文字布局也拍进去
  await evalJs("document.querySelector('.acct__head').click()");
  await sleep(900);
  const spots = [
    ["01-首页", "home", 0],
    ["02-自我介绍", "about", 0],
    ["03-账号运营", "accounts", 300],
    ["04-数据分析", "data", 0],
    ["05-策划案例", "campaign", 0],
    ["06-品牌文案", "copy", 0],
    ["07-图片作品", "works", 0],
    ["08-剪辑作品", "video", 0],
    ["09-合作洽谈", "contact", 0]
  ];
  for (const [name, sec, off] of spots) {
    await evalJs(`(() => { const el = document.getElementById('${sec}');
      window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY + ${off}); })()`);
    await sleep(1300);
    const s = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(P, name + ".png"), Buffer.from(s.data, "base64"));
  }
  console.log("已更新预览图:", P);
}

console.log(problems.length ? "异常:\n" + problems.join("\n") : "无 JS 报错");
ws.close();
