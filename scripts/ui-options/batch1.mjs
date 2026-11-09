import { GOOGLE_G, logo } from "./shell.mjs";

const googleBtn = (cls = "btn btn-outline btn-lg w-full", label = "Continue with Google") =>
  `<button class="${cls}">${GOOGLE_G}${label}</button>`;

const CAL_HELP = `RepresENT asks for access to your Google Calendar so it can find times when the crew is free and add rehearsals to your calendar.`;
const UNVERIFIED = `Google may warn that the app &ldquo;hasn&rsquo;t been verified&rdquo;. That&rsquo;s expected for a small community app — choose <strong>Advanced</strong>, then <strong>Go to RepresENT</strong>.`;
const browse = (extra = "") => `<p class="sm muted" style="text-align:center${extra}">Not a member? <a href="#" style="color:var(--primary);font-weight:500;text-decoration:none">Browse our covers</a></p>`;
const signOut = `<button class="btn btn-ghost ml-auto">Sign out</button>`;
const jamieChip = `<div class="chip"><div class="avatar">JL</div><div class="minw0"><p class="sm trunc" style="font-weight:500">Jamie Lim</p><p class="sm muted trunc">jamie@example.com</p></div></div>`;
const statusCard = (title, desc, body, actions = "") => `<main class="center-screen"><div class="card max-md">
<div class="hd"><h2 class="title">${title}</h2><p class="desc">${desc}</p></div>
${body ? `<div class="ct stack g4">${body}</div>` : ""}
<div class="ft">${actions}${signOut}</div></div></main>`;

const CALS = [
  { name: "Personal", color: "#ec4899", primary: true, on: true },
  { name: "Work", color: "#8b5cf6", on: false },
  { name: "Uni timetable", color: "#06b6d4", on: false },
  { name: "Holidays in Singapore", color: "#64748b", on: false },
];
const calList = (toggle = false) => `<ul class="stack g2" style="list-style:none;margin:0;padding:0">${CALS.map(
  (c) => `<li><label class="calrow"${toggle ? ` onclick="var k=this.querySelector('.chk');k.classList.toggle('on');k.textContent=k.classList.contains('on')?'✓':'';window.syncCals&&syncCals()"` : ""} data-cal="${c.name}"><span class="chk${c.on ? " on" : ""}">${c.on ? "✓" : ""}</span><span class="dot" style="background:${c.color}"></span><span class="trunc" style="flex:1">${c.name}</span>${c.primary ? `<span class="xs muted">Primary</span>` : ""}</label></li>`,
).join("")}</ul>`;
const field = (label, value, hint = "", ph = "", id = "") =>
  `<div class="field"><label class="label sm">${label}</label><input class="input"${id ? ` id="${id}"` : ""} value="${value}" placeholder="${ph}">${hint ? `<p class="xs muted">${hint}</p>` : `<p class="xs"></p>`}</div>`;
const profileFields = (ids = false) =>
  field("Display name", "Jamie Lim", "How the crew will see you.", "", ids ? "f-name" : "") +
  field("Stage name (optional)", "Jamie", "", "", ids ? "f-stage" : "") +
  field("Instagram handle (optional)", "", "", "@yourhandle", ids ? "f-ig" : "");
const CAL_INTRO = `<div><h2 class="label" style="font-family:inherit">Calendars that count as busy</h2><p class="sm muted">We only look at <em>when</em> you&rsquo;re busy in these calendars, not what the events are, to work out your availability for rehearsals.</p></div>`;
const GOOGLE_ACCESS = `<section class="stack g2 sm muted"><h2 class="label" style="font-family:inherit;color:var(--foreground)">About Google access</h2>
<p><strong style="color:var(--foreground)">&ldquo;Google hasn&rsquo;t verified this app&rdquo;</strong> — you probably saw this when signing in. RepresENT is a small community app that hasn&rsquo;t been through Google&rsquo;s paid verification. It&rsquo;s safe to continue via <strong>Advanced → Go to RepresENT</strong>.</p>
<p><strong style="color:var(--foreground)">What we write to your calendar:</strong> when you join a rehearsal or shoot, RepresENT adds that event to your Google Calendar and keeps it up to date if the plan changes. We never edit or delete events we didn&rsquo;t create.</p></section>`;
const DEMO = `<span class="xs" style="display:block;margin-top:4px;color:var(--amber)">Demo mode: these calendars are simulated, not read from your Google account.</span>`;

export const pages = [
  // ───────────────────────────── login
  {
    slug: "login",
    title: "Login",
    route: "/login",
    source: "src/app/(public)/login/page.tsx",
    chosen: null,
    options: [
      {
        key: "A",
        name: "Current (as built)",
        note: "Centred card on a muted backdrop: title, one Google button, and a small-print footer explaining calendar access and Google's \"unverified app\" warning. A \"Not a member? Browse our covers\" link under the button leads visitors to /explore. Errors (removed, blocked, misconfigured) show as a red alert above the button.",
        html: `<main class="center-screen"><div class="card max-md">
<div class="hd"><h2 class="title" style="font-size:1.5rem">RepresENT</h2><p class="desc">Sign in with your Google account to continue.</p></div>
<div class="ct stack g4">${googleBtn()}${browse()}</div>
<div class="ft stack xs muted" style="align-items:flex-start;gap:8px"><p>${CAL_HELP}</p><p>${UNVERIFIED}</p></div></div></main>`,
      },
      {
        key: "B",
        name: "Split screen",
        note: "Brand panel (a spot for a crew photo) beside a focused sign-in column. Feels more like a club than a tool. On phones the brand panel shrinks to a header strip. Costs: needs a real photo to shine, and the help text competes less for attention.",
        html: `<style>.split{flex:1;display:grid;grid-template-rows:auto 1fr}.brand{position:relative;padding:28px 24px;display:flex;flex-direction:column;justify-content:flex-end;gap:10px;min-height:190px;overflow:hidden;background:linear-gradient(160deg,oklch(.72 .21 352/.55),oklch(.3 .09 295/.7) 55%,oklch(.8 .13 205/.35))}
.brand .ph{position:absolute;inset:0;display:flex;align-items:flex-start;justify-content:flex-end;padding:14px 16px;font-size:12px;color:#fff6;letter-spacing:.08em;text-transform:uppercase;background:repeating-linear-gradient(135deg,#ffffff06 0 12px,transparent 12px 24px)}
.brand h1{font-size:2rem;position:relative}.brand p{position:relative;color:#fffc}
.side{display:flex;align-items:flex-start;justify-content:center;padding:28px 24px}.side .in{width:100%;max-width:22rem}
@media(min-width:900px){.split{grid-template-rows:none;grid-template-columns:1.15fr 1fr}.brand{padding:56px;min-height:auto}.side{align-items:center}.brand h1{font-size:3.2rem}}</style>
<div class="split"><section class="brand"><div class="ph">Crew photo</div><div style="position:relative">${logo(44, "b1")}</div><h1>RepresENT</h1><p class="lg">K-pop dance covers, organised. Rehearsals, filming and every cover we&rsquo;ve posted.</p></section>
<section class="side"><div class="in stack g6"><div class="stack g2"><h2 style="font-size:1.5rem">Welcome back</h2><p class="muted">Members only. Sign in with the Google account you joined with.</p></div>
${googleBtn("btn btn-light btn-xl w-full")}${browse(";margin-top:-12px")}
<div class="stack g2 xs muted"><p>${CAL_HELP}</p><p>${UNVERIFIED}</p></div></div></section></div>`,
      },
      {
        key: "C",
        name: "Brand hero",
        note: "One bold centred moment: big gradient wordmark and a single primary button. The calendar and \"unverified\" explanations move into an expandable \"Why Google?\" section so first glance stays clean. \"Browse our covers\" becomes a visible second button, so visitors have an obvious path to /explore. Risk: people who skip the expander may be surprised by Google's warning.",
        html: `<style>.hero{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:40px 24px;gap:22px}
.hero h1{font-size:3rem;line-height:1;font-weight:700}@media(min-width:900px){.hero h1{font-size:5.5rem}}
.why{max-width:26rem;width:100%;text-align:left;border:1px solid var(--border);border-radius:calc(var(--r)*1.4);background:oklch(.185 .018 285/.7)}
.why summary{padding:12px 14px;font-weight:500;display:flex;justify-content:space-between}.why summary::after{content:"+";color:var(--muted-foreground)}.why[open] summary::after{content:"–"}
.why .b{padding:0 14px 14px;display:grid;gap:8px}</style>
<main class="hero">${logo(64, "c1")}<div class="stack g2"><h1 class="grad-text">RepresENT</h1><p class="lg muted">Members&rsquo; portal</p></div>
${googleBtn("btn btn-primary btn-xl", "Sign in with Google")}
<details class="why"><summary>Why does RepresENT need Google?</summary><div class="b sm muted"><p>${CAL_HELP}</p><p>${UNVERIFIED}</p></div></details>
<a href="#" class="btn btn-outline btn-lg">Browse our covers</a></main>`,
      },
    ],
  },
  // ───────────────────────────── pending
  {
    slug: "pending",
    title: "Awaiting approval",
    route: "/pending",
    source: "src/app/(public)/pending/page.tsx",
    chosen: null,
    options: [
      {
        key: "A",
        name: "Current (as built)",
        note: "Status card: explanation, a chip showing who you signed in as, then \"Check again\" and \"Sign out\". Clear and compact, but gives no sense of progress or how long it takes.",
        html: statusCard(
          "Awaiting approval",
          "Thanks for signing up! An admin needs to approve your account before you can use RepresENT. You'll see a notification here once you're in.",
          jamieChip,
          `<button class="btn btn-outline">Check again</button>`,
        ),
      },
      {
        key: "B",
        name: "Step tracker",
        note: "Same card, but the copy becomes a 3-step tracker (Signed in → Admin review → You're in) so it's obvious where you are. \"Check again\" becomes the primary action. The \"usually within a day\" line is a promise admins would need to keep.",
        html: `<style>.steps{list-style:none;margin:0;padding:0;display:grid;gap:0}.steps li{display:grid;grid-template-columns:28px 1fr;gap:12px;position:relative;padding-bottom:18px}
.steps li:not(:last-child)::before{content:"";position:absolute;left:13px;top:28px;bottom:2px;width:2px;background:var(--border)}
.steps li.done::before{background:var(--primary)}
.ic{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-size:13px;font-weight:700;border:2px solid var(--border);color:var(--muted-foreground)}
.done .ic{background:var(--primary);border-color:var(--primary);color:var(--primary-foreground)}
.now .ic{border-color:var(--primary);color:var(--primary);box-shadow:0 0 0 4px oklch(.72 .21 352/.15)}</style>
<main class="center-screen"><div class="card max-md">
<div class="hd"><h2 class="title">Almost there, Jamie</h2><p class="desc">An admin needs to approve your account before you can use RepresENT.</p></div>
<div class="ct"><ol class="steps">
<li class="done"><span class="ic">✓</span><div><p style="font-weight:500">Signed in with Google</p><p class="sm muted">jamie@example.com</p></div></li>
<li class="now"><span class="ic">2</span><div><p style="font-weight:500">Admin review</p><p class="sm muted">Usually within a day. We&rsquo;ll notify you here.</p></div></li>
<li><span class="ic">3</span><div><p style="font-weight:500;color:var(--muted-foreground)">You&rsquo;re in</p><p class="sm muted">Set up your profile and calendars.</p></div></li>
</ol></div>
<div class="ft"><button class="btn btn-primary">Check again</button>${signOut}</div></div></main>`,
      },
      {
        key: "C",
        name: "Friendly waiting room",
        note: "No card: a full-screen, illustrated message with \"what happens next\" bullets. Warmer and more on-brand for new joiners, but takes more vertical space and repeats some information.",
        html: `<style>.wait{flex:1;display:flex;align-items:center;justify-content:center;padding:32px 24px}.wait .in{max-width:30rem;width:100%;display:grid;gap:22px;justify-items:center;text-align:center}
.art{width:120px;height:120px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 30% 30%,oklch(.72 .21 352/.45),oklch(.3 .09 295/.5) 60%,transparent 70%)}
.next{width:100%;text-align:left;display:grid;gap:10px;margin:0;padding:16px 18px;list-style:none;border-radius:calc(var(--r)*1.4);background:oklch(.185 .018 285/.8);box-shadow:0 0 0 1px var(--border)}
.next li{display:grid;grid-template-columns:22px 1fr;gap:8px}.next b{color:var(--primary)}</style>
<main class="wait"><div class="in">
<div class="art"><svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2h12M6 22h12M7 2v4a5 5 0 0 0 10 0V2M7 22v-4a5 5 0 0 1 10 0v4"/></svg></div>
<div class="stack g2"><h1 style="font-size:2rem">You&rsquo;re on the list</h1><p class="muted">Thanks for signing up, Jamie. An admin will review your request soon.</p></div>
<ul class="next sm"><li><b>1</b><span>An admin checks you&rsquo;re part of the crew.</span></li><li><b>2</b><span>You get a notification here once you&rsquo;re approved.</span></li><li><b>3</b><span>You set up your profile and pick your calendars.</span></li></ul>
<div style="width:100%">${jamieChip}</div>
<div class="row g2"><button class="btn btn-primary btn-lg">Check again</button><button class="btn btn-ghost btn-lg">Sign out</button></div>
</div></main>`,
      },
    ],
  },
  // ───────────────────────────── not-approved
  {
    slug: "not-approved",
    title: "Not approved",
    route: "/not-approved",
    source: "src/app/(public)/not-approved/page.tsx",
    chosen: null,
    options: [
      {
        key: "A",
        name: "Current (as built)",
        note: "Status card with the rejection message and only a \"Sign out\" button. Polite and minimal, but leaves the person without a concrete next step.",
        html: statusCard(
          "Not approved",
          "Your request to join RepresENT wasn't approved. If you think this is a mistake, reach out to one of the admins — they can approve you later.",
          "",
        ),
      },
      {
        key: "B",
        name: "Next steps",
        note: "Adds a \"How to reach an admin\" box that shows which email they signed in with (a common cause of rejection), plus \"Use a different Google account\". That button would be a small new feature: sign out, then return to /login.",
        html: `<main class="center-screen"><div class="card max-md">
<div class="hd"><h2 class="title">Not approved</h2><p class="desc">Your request to join RepresENT wasn&rsquo;t approved. Admins can approve you later.</p></div>
<div class="ct stack g4"><div class="stack g2" style="border-radius:calc(var(--r)*1.4);padding:14px;background:var(--accent)">
<p style="font-weight:500">Think this is a mistake?</p>
<ul class="sm muted" style="margin:0;padding-left:18px;display:grid;gap:4px"><li>Message an admin in the crew group chat, or ask at the next practice.</li><li>Tell them the email you signed in with: <strong style="color:var(--foreground)">jamie@example.com</strong></li><li>Signed in with the wrong account? Try another one.</li></ul></div></div>
<div class="ft wrap"><button class="btn btn-outline">Use a different Google account</button>${signOut}</div></div></main>`,
      },
      {
        key: "C",
        name: "Minimal",
        note: "No card at all: one headline, one sentence and a text link. Quiet and respectful, but plain and easy to miss on large screens.",
        html: `<main style="flex:1;display:flex;align-items:center;justify-content:center;padding:32px 24px"><div style="max-width:32rem;display:grid;gap:14px">
${logo(36, "c3")}<h1 style="font-size:2.2rem">Not approved</h1>
<p class="lg muted">Your request to join RepresENT wasn&rsquo;t approved. If you think that&rsquo;s a mistake, reach out to an admin — they can approve you later.</p>
<p class="sm"><a href="#" style="color:var(--primary)">Sign out</a></p></div></main>`,
      },
    ],
  },
  // ───────────────────────────── onboarding
  {
    slug: "onboarding",
    title: "Onboarding / profile",
    route: "/onboarding",
    source: "src/app/onboarding/page.tsx",
    chosen: null,
    options: [
      {
        key: "A",
        name: "Current (as built)",
        note: "One long card: About you → Calendars that count as busy → About Google access → Finish setup. Everything on one screen, but long on phones, and the Google explainer sits after the choices it explains. Returning members see the same form titled \"Your profile\" with a Save button.",
        html: `<main class="max-xl stack g4" style="margin:0 auto;padding:24px"><div class="card">
<div class="hd"><h2 class="title">Welcome to RepresENT</h2><p class="desc">A couple of things before you start.${DEMO}</p></div>
<div class="ct"><form class="stack g6" onsubmit="return false">
<section class="stack g4"><h2 class="label" style="font-family:inherit">About you</h2>${profileFields()}</section>
<hr class="sep"><section class="stack g3">${CAL_INTRO}${calList(true)}</section>
<hr class="sep">${GOOGLE_ACCESS}
<button class="btn btn-primary btn-lg">Finish setup</button></form></div></div></main>`,
      },
      {
        key: "B",
        name: "3-step wizard",
        note: "Splits setup into Profile → Calendars → Done, with a progress bar, so each screen is short on phones and the Google explanation sits next to the calendar choice. Use Next/Back to try it. Costs: more taps, and returning members would need a separate single-page \"edit profile\" view.",
        html: `<style>.wz{width:100%;max-width:32rem;margin:0 auto;padding:24px;display:grid;gap:16px}.prog{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.prog span{height:4px;border-radius:99px;background:var(--border)}.prog span.on{background:var(--primary)}
.step{display:none}.step.on{display:flex}</style>
<main class="wz"><div class="stack g2"><p class="xs muted" id="lbl">Step 1 of 3 · Profile</p><div class="prog"><span class="on"></span><span></span><span></span></div></div>
<div class="card"><div class="ct">
<div class="step on stack g4" data-s="1"><div class="stack g2"><h2 class="title">Welcome, Jamie</h2><p class="desc">How should the crew see you?</p></div>${profileFields()}</div>
<div class="step stack g4" data-s="2"><div class="stack g2"><h2 class="title">Your calendars</h2><p class="desc">We only look at <em>when</em> you&rsquo;re busy, never what the events are.${DEMO}</p></div>${calList(true)}
<details style="border-radius:var(--r);background:var(--accent);padding:10px 12px"><summary class="sm" style="font-weight:500">Saw &ldquo;Google hasn&rsquo;t verified this app&rdquo;?</summary><p class="sm muted" style="margin-top:6px">RepresENT is a small community app that hasn&rsquo;t been through Google&rsquo;s paid verification. It&rsquo;s safe to continue via <strong>Advanced → Go to RepresENT</strong>.</p></details></div>
<div class="step stack g4" data-s="3" style="text-align:center;align-items:center"><div class="avatar lg">JL</div><h2 class="title">You&rsquo;re all set</h2><p class="desc">When you join a rehearsal or shoot, we&rsquo;ll add it to your Google Calendar and keep it up to date. We never touch events we didn&rsquo;t create.</p></div>
</div></div>
<div class="row"><button class="btn btn-ghost" id="back" style="visibility:hidden">Back</button><button class="btn btn-primary btn-lg ml-auto" id="next">Next</button></div></main>
<script>var s=1,L=["Profile","Calendars","Done"];function go(n){s=n;document.querySelectorAll(".step").forEach(function(e){e.classList.toggle("on",+e.dataset.s===s)});document.querySelectorAll(".prog span").forEach(function(e,i){e.classList.toggle("on",i<s)});document.getElementById("lbl").textContent="Step "+s+" of 3 · "+L[s-1];document.getElementById("back").style.visibility=s>1?"visible":"hidden";document.getElementById("next").textContent=s===2?"Continue":s===3?"Go to dashboard":"Next"}
document.getElementById("next").onclick=function(){if(s<3)go(s+1)};document.getElementById("back").onclick=function(){if(s>1)go(s-1)};</script>`,
      },
      {
        key: "C",
        name: "Form + live preview",
        note: "The form sits beside a live preview of the member card the crew will see (type in the fields to try it). Makes the purpose of each field obvious. On phones the preview collapses to a compact strip above the form. Costs: a second component to keep in sync with the real member card.",
        html: `<style>.lay{width:100%;max-width:64rem;margin:0 auto;padding:24px;display:grid;gap:20px}
@media(min-width:900px){.lay{grid-template-columns:1fr 20rem;align-items:start}.pv{position:sticky;top:24px;order:2}}
.pv .big{display:none}@media(min-width:900px){.pv .big{display:flex}.pv .small{display:none}}
.mc{border-radius:calc(var(--r)*1.8);padding:20px;background:linear-gradient(160deg,oklch(.72 .21 352/.22),oklch(.3 .09 295/.35));box-shadow:0 0 0 1px var(--border)}</style>
<main class="lay"><aside class="pv"><p class="xs muted" style="margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em">How the crew sees you</p>
<div class="mc big stack g3" style="align-items:flex-start"><div class="avatar lg" id="p-av">JL</div><div><h3 style="font-size:1.3rem" id="p-name">Jamie Lim</h3><p class="muted" id="p-stage">aka Jamie</p></div><p class="sm" id="p-ig" style="color:var(--cyan)"></p><div class="row wrap g2" id="p-cals"></div></div>
<div class="chip small" style="background:var(--card)"><div class="avatar" id="p-av2">JL</div><div class="minw0"><p class="trunc" style="font-weight:500" id="p-name2">Jamie Lim</p><p class="xs muted trunc" id="p-stage2">aka Jamie</p></div></div></aside>
<div class="card"><div class="hd"><h2 class="title">Welcome to RepresENT</h2><p class="desc">A couple of things before you start.${DEMO}</p></div>
<div class="ct stack g6">${profileFields(true)}<hr class="sep"><section class="stack g3">${CAL_INTRO}${calList(true)}</section><hr class="sep">${GOOGLE_ACCESS}<button class="btn btn-primary btn-lg">Finish setup</button></div></div></main>
<script>function v(id){return document.getElementById(id).value.trim()}function ini(n){return n.split(/\\s+/).slice(0,2).map(function(p){return(p[0]||"").toUpperCase()}).join("")||"?"}
function sync(){var n=v("f-name")||"Your name",st=v("f-stage"),ig=v("f-ig");["p-name","p-name2"].forEach(function(i){document.getElementById(i).textContent=n});["p-stage","p-stage2"].forEach(function(i){document.getElementById(i).textContent=st?"aka "+st:"No stage name"});["p-av","p-av2"].forEach(function(i){document.getElementById(i).textContent=ini(n)});document.getElementById("p-ig").textContent=ig?(ig[0]==="@"?ig:"@"+ig):""}
window.syncCals=function(){var h="";document.querySelectorAll(".calrow").forEach(function(r){if(r.querySelector(".chk.on"))h+='<span class="pill"><span class="dot" style="width:8px;height:8px;background:'+r.querySelector(".dot").style.background+'"></span>'+r.dataset.cal+"</span>"});document.getElementById("p-cals").innerHTML=h||'<span class="xs muted">No calendars picked</span>'};
["f-name","f-stage","f-ig"].forEach(function(i){document.getElementById(i).addEventListener("input",sync)});sync();syncCals();</script>`,
      },
    ],
  },
];
