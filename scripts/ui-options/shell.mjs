// Builds one self-contained docs/ui/<page>.html from a page definition.
// Page def: { slug, title, route, source, chosen: null | {option, date}, options: [{key, name, note, html}] }

export const GOOGLE_G = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z"/><path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1Z"/><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9Z"/></svg>`;

export const logo = (size = 48, id = "lg") => `<svg viewBox="0 0 64 64" width="${size}" height="${size}" role="img" aria-label="RepresENT"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff4fa0"/><stop offset=".55" stop-color="#9d6bff"/><stop offset="1" stop-color="#3ad6f0"/></linearGradient></defs><rect width="64" height="64" rx="16" fill="#0b0b10"/><rect x="3" y="3" width="58" height="58" rx="14" fill="none" stroke="url(#${id})" stroke-width="3"/><text x="32" y="42" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="26" fill="url(#${id})">ENT</text></svg>`;

// Mirrors src/app/globals.css tokens and the shadcn components the app uses.
const APP_CSS = `
:root{--background:oklch(.145 .012 285);--foreground:oklch(.97 .005 285);--card:oklch(.185 .018 285);--primary:oklch(.72 .21 352);--primary-foreground:oklch(.16 .02 350);--secondary:oklch(.3 .09 295);--muted:oklch(.235 .02 285);--muted-foreground:oklch(.74 .02 285);--accent:oklch(.27 .04 295);--destructive:oklch(.7 .19 22);--border:oklch(1 0 0/10%);--input:oklch(1 0 0/14%);--cyan:oklch(.8 .13 205);--violet:oklch(.7 .17 295);--amber:oklch(.879 .169 91.6);--ok:oklch(.75 .14 155);--r:.75rem}
*{box-sizing:border-box}html{color-scheme:dark}
body{margin:0;min-height:100vh;display:flex;flex-direction:column;background:var(--background);background-image:radial-gradient(60rem 30rem at 100% -10%,oklch(.72 .21 352/.08),transparent 60%),radial-gradient(50rem 30rem at -10% 110%,oklch(.7 .17 295/.08),transparent 60%);color:var(--foreground);font:14px/1.5 Inter,"Segoe UI",system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased}
h1,h2,h3{font-size:inherit}
h1,h2,h3,.display{font-family:"Space Grotesk","Segoe UI",system-ui,sans-serif;letter-spacing:-.01em;margin:0}
p{margin:0}a{color:inherit}strong{font-weight:600}
.card{background:var(--card);border-radius:calc(var(--r)*1.8);box-shadow:0 0 0 1px oklch(.97 .005 285/.1);padding:24px 0;display:flex;flex-direction:column;gap:24px;overflow:hidden}
.card>.hd,.card>.ct,.card>.ft{padding:0 24px}.hd{display:grid;gap:6px}
.title{font-size:1.25rem;font-weight:500;line-height:1.3}.desc{color:var(--muted-foreground)}
.ft{display:flex;align-items:center;gap:8px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:36px;padding:0 12px;border-radius:calc(var(--r)*2.6);border:1px solid transparent;font:500 14px/1 inherit;font-family:inherit;color:inherit;background:none;cursor:pointer;text-decoration:none;white-space:nowrap}
.btn-lg{height:40px;padding:0 16px}.btn-xl{height:48px;padding:0 22px;font-size:15px}
.btn-primary{background:var(--primary);color:var(--primary-foreground)}.btn-primary:hover{background:oklch(.72 .21 352/.8)}
.btn-outline{border-color:var(--border);background:oklch(1 0 0/4.2%)}.btn-outline:hover{background:oklch(1 0 0/7%)}
.btn-ghost:hover{background:oklch(.235 .02 285/.5)}.btn-light{background:#fff;color:#1f1f1f}
.w-full{width:100%}.ml-auto{margin-left:auto}
.muted{color:var(--muted-foreground)}.xs{font-size:12px}.sm{font-size:14px}.lg{font-size:17px}
.stack{display:flex;flex-direction:column}.row{display:flex;align-items:center;gap:12px}.wrap{flex-wrap:wrap}
.g2{gap:8px}.g3{gap:12px}.g4{gap:16px}.g6{gap:24px}
.center-screen{flex:1;display:flex;align-items:center;justify-content:center;padding:24px;background:oklch(.235 .02 285/.3)}
.max-md{width:100%;max-width:28rem}.max-xl{width:100%;max-width:36rem}
.alert-d{border:1px solid oklch(.7 .19 22/.4);border-radius:var(--r);padding:10px 12px;color:var(--destructive)}
.avatar{width:32px;height:32px;flex-shrink:0;border-radius:50%;background:var(--muted);display:grid;place-items:center;font-size:12px;font-weight:600}
.avatar.lg{width:56px;height:56px;font-size:18px;background:linear-gradient(135deg,oklch(.72 .21 352),oklch(.7 .17 295));color:var(--primary-foreground)}
.chip{display:flex;align-items:center;gap:12px;text-align:left;border:1px solid var(--border);border-radius:calc(var(--r)*1.4);padding:12px;min-width:0}
.trunc{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.minw0{min-width:0}
.field{display:flex;flex-direction:column;gap:6px}.label{font-weight:500}
.input{height:36px;width:100%;border:1px solid var(--input);background:oklch(1 0 0/4.2%);border-radius:calc(var(--r)*.8);padding:0 12px;color:inherit;font:inherit}
.input::placeholder{color:var(--muted-foreground)}
.sep{height:1px;background:var(--border);border:0;margin:0}
.calrow{display:flex;align-items:center;gap:12px;border:1px solid var(--border);border-radius:calc(var(--r)*1.4);padding:12px;cursor:pointer}
.chk{width:16px;height:16px;flex-shrink:0;border-radius:4px;border:1px solid var(--input);display:grid;place-items:center;font-size:11px;line-height:1}
.chk.on{background:var(--primary);border-color:var(--primary);color:var(--primary-foreground)}
.dot{width:12px;height:12px;border-radius:50%;flex-shrink:0}
.pill{display:inline-flex;align-items:center;gap:6px;border-radius:99px;padding:2px 10px;font-size:12px;font-weight:500;background:var(--accent)}
.grad-text{background:linear-gradient(90deg,#ff4fa0,#9d6bff 55%,#3ad6f0);-webkit-background-clip:text;background-clip:text;color:transparent}
details>summary{cursor:pointer;list-style:none}details>summary::-webkit-details-marker{display:none}
`;

const SHELL_CSS = `
:root{--bg:#0d0d12;--panel:#17171e;--ink:#ececf1;--muted:#9a9aa6;--line:#2a2a33;--acc:#ff5fa8;--ok:#4cc27e}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;padding:20px 16px 40px}
.wrap{max-width:1320px;margin:0 auto}
header{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 14px;margin-bottom:14px}
h1{font-size:1.4rem;margin:0}.meta{color:var(--muted);font-size:13px}code{font:12.5px ui-monospace,Consolas,monospace;background:#ffffff10;padding:1px 6px;border-radius:4px}
.status{margin-left:auto;font-size:13px;font-weight:600;padding:3px 10px;border-radius:99px;border:1px solid var(--line);color:var(--muted)}
.status.done{border-color:var(--ok);color:var(--ok)}
.bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;margin-bottom:10px}
.seg{display:inline-flex;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:3px;gap:3px;flex-wrap:wrap}
.seg button{font:inherit;font-weight:600;color:var(--muted);background:none;border:0;border-radius:7px;padding:6px 12px;cursor:pointer}
.seg button[aria-pressed=true]{background:#ffffff14;color:var(--ink)}
.badge{display:inline-block;margin-left:6px;font-size:11px;font-weight:700;color:#0d0d12;background:var(--ok);border-radius:99px;padding:0 7px;vertical-align:1px}
.note{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:10px 14px;margin-bottom:14px}
.note b{color:var(--ink)}.note p{margin:0;color:var(--muted)}
.stage{display:flex;justify-content:center;overflow:hidden}
.frame{position:relative;flex-shrink:0}
iframe{border:0;background:#0b0b10;border-radius:14px;box-shadow:0 0 0 1px var(--line),0 20px 60px #0008;transform-origin:top left;display:block}
.dims{color:var(--muted);font-size:12px;text-align:center;margin-top:8px}
`;

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

export function buildPage(p) {
  const opts = p.options.map((o) => ({ key: o.key, name: o.name, note: o.note }));
  const templates = p.options
    .map((o) => `<template id="opt-${o.key}">${o.html}</template>`)
    .join("\n");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>UI options · ${esc(p.title)}</title>
<!-- UI options for ${p.route}. A = the page as built today; B and C are alternatives.
     Generated by scripts/ui-options; don't edit by hand. To record a choice, set \`chosen\`
     for this page in its batch file, e.g. {option:"B", date:"2026-11-10"}, then rebuild. -->
<style>${SHELL_CSS}</style></head><body><div class="wrap">
<header><h1>${esc(p.title)}</h1><span class="meta">Route <code>${esc(p.route)}</code> · Source <code>${esc(p.source)}</code></span><span class="status" id="status"></span></header>
<div class="bar"><div class="seg" id="tabs" role="group" aria-label="Option"></div>
<div class="seg" id="sizes" role="group" aria-label="Viewport"><button data-w="390" data-h="844">Phone</button><button data-w="1280" data-h="800">Desktop</button></div></div>
<div class="note" id="note"></div>
<div class="stage" id="stage"><div class="frame" id="frame"><iframe id="view" title="Option preview" sandbox="allow-scripts"></iframe></div></div>
<div class="dims" id="dims"></div>
</div>
${templates}
<script type="text/plain" id="app-css">${APP_CSS}</script>
<script>
const CHOSEN = ${p.chosen ? JSON.stringify(p.chosen) : "null"};
const OPTIONS = ${JSON.stringify(opts)};
const $ = (id) => document.getElementById(id);
let cur = "A", size = { w: 390, h: 844 };
try { const s = JSON.parse(localStorage.getItem("ui-opt-size") || "null"); if (s) size = s; } catch (e) {}
// Deep link: #B or #B/desktop
const [hOpt, hSize] = location.hash.slice(1).split("/");
if (OPTIONS.some((o) => o.key === hOpt)) cur = hOpt;
if (hSize === "desktop") size = { w: 1280, h: 800 }; else if (hSize === "phone") size = { w: 390, h: 844 };
$("status").textContent = CHOSEN ? "Chosen: " + CHOSEN.option + " · " + CHOSEN.date : "Not chosen yet";
if (CHOSEN) $("status").classList.add("done");
OPTIONS.forEach((o) => {
  const b = document.createElement("button");
  b.dataset.k = o.key;
  b.innerHTML = o.key + " · " + o.name + (CHOSEN && CHOSEN.option === o.key ? '<span class="badge">Chosen</span>' : "");
  b.onclick = () => { cur = o.key; render(); };
  $("tabs").appendChild(b);
});
document.querySelectorAll("#sizes button").forEach((b) => b.onclick = () => {
  size = { w: +b.dataset.w, h: +b.dataset.h };
  try { localStorage.setItem("ui-opt-size", JSON.stringify(size)); } catch (e) {}
  render();
});
function fit() {
  const avail = $("stage").clientWidth, s = Math.min(1, avail / size.w), f = $("view");
  f.style.width = size.w + "px"; f.style.height = size.h + "px"; f.style.transform = "scale(" + s + ")";
  $("frame").style.width = size.w * s + "px"; $("frame").style.height = size.h * s + "px";
  $("dims").textContent = size.w + " × " + size.h + (s < 1 ? " (shown at " + Math.round(s * 100) + "%)" : "");
}
function render() {
  const o = OPTIONS.find((x) => x.key === cur);
  document.querySelectorAll("#tabs button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.k === cur));
  document.querySelectorAll("#sizes button").forEach((b) => b.setAttribute("aria-pressed", +b.dataset.w === size.w));
  $("note").innerHTML = "<b>" + o.key + " · " + o.name + "</b><p>" + o.note + "</p>";
  $("view").srcdoc = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>' +
    $("app-css").textContent + "</style></head><body>" + $("opt-" + cur).innerHTML + "</body></html>";
  fit();
}
addEventListener("resize", fit);
render();
</script></body></html>
`;
}
