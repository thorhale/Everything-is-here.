#!/usr/bin/env node
// UI audit gate: renders a fixed set of routes at desktop and phone widths,
// runs axe-core (WCAG 2.x A/AA + best-practice), records console errors, tap
// target sizes, horizontal overflow culprits, heading structure, heavy images,
// and probes the site navigation for keyboard and touch operability.
//
// This is the measurement behind docs/ui-overhaul-plan.md. Every phase there
// states its acceptance in terms of this script's output, so the numbers can
// be re-measured rather than asserted.
//
// Usage (against a production build — `next dev` injects its own overlays):
//   cd app && npx next build && (npx next start -p 3123 &) && sleep 5
//   node scripts/ui-audit.cjs http://localhost:3123 /tmp/ui-audit [--strict]
//
// Output: a per-route summary on stdout, /tmp/ui-audit/audit.json, and
// screenshots under /tmp/ui-audit/shots. With --strict the exit code is 1 when
// any critical/serious axe violation remains, a page throws, the nav is not
// keyboard-operable, or any route the plan says must render returns 5xx.
//
// The browser: Playwright's own download is not always present in a sandbox;
// set PW_EXE to a Chromium binary (this environment: /opt/pw-browsers/chromium)
// and it is used directly.
const { chromium } = require("playwright");
const { AxeBuilder } = require("@axe-core/playwright");
const fs = require("fs");
const path = require("path");

const BASE = process.argv[2] || "http://localhost:3123";
const OUT = process.argv[3] || "/tmp/ui-audit";
const STRICT = process.argv.includes("--strict");

// Routes that render without a database (the calculators and reference pages)
// plus the three that need one, so a missing DATABASE_URL shows up as a
// friendly error page (after Phase 4) rather than as a bare 500.
const ROUTES = [
  "/", "/tools", "/build", "/pitching", "/water/builder", "/sources", "/takedown",
  "/troubleshooting", "/yeasts/propagation", "/fermentation", "/data-download",
  "/fermentables/db/method", "/account", "/calculator", "/this-page-does-not-exist",
  "/recipes", "/guidelines",
];
// Must be 200 with or without a database once Phase 4 lands.
const MUST_RENDER = ["/", "/tools", "/build", "/pitching", "/water/builder", "/sources"];

fs.mkdirSync(path.join(OUT, "shots"), { recursive: true });

const slugOf = (r) => (r === "/" ? "home" : r.replace(/^\//, "").replace(/[\/?=]/g, "_"));

(async () => {
  const browser = await chromium.launch(process.env.PW_EXE ? { executablePath: process.env.PW_EXE } : {});
  const results = [];
  for (const route of ROUTES) {
    const r = { route, console: [], pageErrors: [] };

    // ---------------- desktop ----------------
    let ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    let page = await ctx.newPage();
    page.on("console", (m) => { if (m.type() === "error") r.console.push(m.text().slice(0, 200)); });
    page.on("pageerror", (e) => r.pageErrors.push(String(e).slice(0, 200)));
    let resp = null;
    try { resp = await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 30000 }); }
    catch (e) { r.error = String(e).slice(0, 200); }
    r.status = resp ? resp.status() : null;
    r.finalUrl = page.url().replace(BASE, "");
    r.title = await page.title();
    r.h1s = await page.$$eval("h1", (els) => els.map((e) => e.textContent.trim().slice(0, 60)));
    r.hasMainLandmark = await page.$("main") !== null;
    r.hasSkipLink = await page.$('a[href="#main"], a[href="#content"], a.skip-link') !== null;
    r.elements = await page.evaluate(() => document.getElementsByTagName("*").length);
    r.heavyImages = await page.evaluate(async () => {
      const out = [];
      for (const img of document.images) {
        try {
          const res = await fetch(img.currentSrc, { method: "HEAD" });
          const kb = Math.round((+res.headers.get("content-length") || 0) / 1024);
          if (kb > 150) out.push({ src: img.currentSrc.replace(location.origin, ""), kb, renderedW: Math.round(img.getBoundingClientRect().width), naturalW: img.naturalWidth });
        } catch {}
      }
      return out;
    });
    await page.screenshot({ path: path.join(OUT, "shots", `${slugOf(route)}-desktop.png`), fullPage: true });
    if (r.status === 200) {
      try {
        const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa", "best-practice"]).analyze();
        r.axe = axe.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help, sample: String(v.nodes[0]?.target?.[0] ?? "").slice(0, 80) }));
      } catch (e) { r.axeError = String(e).slice(0, 200); }
    }
    if (route === "/tools") {
      // Keyboard: focusing a top-level nav item must expose its submenu.
      r.nav = await page.evaluate(() => {
        const items = [...document.querySelectorAll("nav li")].filter((li) => li.querySelector("ul, [aria-controls]"));
        const li = items[2] || items[0];
        if (!li) return { found: false };
        const trigger = li.querySelector("a, button");
        trigger.focus();
        const sub = li.querySelector("ul");
        const expanded = trigger.getAttribute("aria-expanded");
        return { found: true, submenuVisibleOnFocus: sub ? getComputedStyle(sub).display !== "none" : null, ariaExpanded: expanded };
      });
      r.focusStyle = await page.evaluate(() => {
        const a = document.querySelector("main a"); if (!a) return null; a.focus();
        const cs = getComputedStyle(a); return `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}; shadow ${cs.boxShadow}`;
      });
    }
    await ctx.close();

    // ---------------- phone ----------------
    ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    page = await ctx.newPage();
    try { await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 30000 }); } catch {}
    r.mobile = await page.evaluate(() => {
      const w = window.innerWidth;
      const overflow = [];
      for (const el of document.querySelectorAll("body *")) {
        const b = el.getBoundingClientRect();
        if (b.right > w + 1 && b.width > 0) overflow.push(`${el.tagName.toLowerCase()}${typeof el.className === "string" && el.className ? "." + el.className.split(" ")[0] : ""} right=${Math.round(b.right)}`);
        if (overflow.length >= 6) break;
      }
      // Children wider than their parent box: the in-container overflow a
      // viewport check misses (e.g. a <select> spilling out of its fieldset).
      const spill = [];
      for (const el of document.querySelectorAll("main select, main input, main table, main pre")) {
        const b = el.getBoundingClientRect(); const p = el.parentElement.getBoundingClientRect();
        if (b.right > p.right + 2) spill.push(`${el.tagName.toLowerCase()} ${Math.round(b.right - p.right)}px past parent`);
        if (spill.length >= 6) break;
      }
      const chromeBottom = (() => { const m = document.querySelector("main"); return m ? Math.round(m.getBoundingClientRect().top) : null; })();
      const small = [];
      for (const el of document.querySelectorAll("header a, header button, nav a, nav button, footer a, .wh-disclaimer a")) {
        const b = el.getBoundingClientRect();
        if (b.width > 0 && b.height > 0 && b.height < 24) small.push(`${el.tagName.toLowerCase()}:${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 22)} ${Math.round(b.width)}x${Math.round(b.height)}`);
        if (small.length >= 8) break;
      }
      return { innerW: w, docScrollW: document.documentElement.scrollWidth, overflow, spill, chromeHeightPx: chromeBottom, chromeShareOfFirstScreen: chromeBottom != null ? Math.round((chromeBottom / window.innerHeight) * 100) + "%" : null, smallChromeTapTargets: small };
    });
    await page.screenshot({ path: path.join(OUT, "shots", `${slugOf(route)}-mobile.png`), fullPage: true });
    if (route === "/tools") {
      // Touch: tapping a parent nav item (or the menu button) must open a menu,
      // not navigate away.
      const before = page.url();
      const menuBtn = await page.$('header button[aria-expanded], nav button[aria-expanded]');
      if (menuBtn) { await menuBtn.tap(); await page.waitForTimeout(500); }
      else { const a = await page.$("nav > ul > li:nth-child(3) > a"); if (a) { await a.tap(); await page.waitForTimeout(800); } }
      const after = page.url();
      const opened = await page.evaluate(() => !!document.querySelector('[aria-expanded="true"]'));
      r.mobileNav = { menuButtonPresent: !!menuBtn, tapOpenedMenu: opened, navigatedAway: after !== before, landedOn: after.replace(BASE, "") };
    }
    await ctx.close();
    results.push(r);
    const seriousAxe = (r.axe || []).filter((v) => ["critical", "serious"].includes(v.impact)).reduce((n, v) => n + v.nodes, 0);
    console.log(`${route.padEnd(26)} ${String(r.status).padEnd(4)} h1=${r.h1s.length} axe(serious+critical nodes)=${r.axe ? seriousAxe : "-"} consoleErr=${r.console.length} chrome=${r.mobile.chromeShareOfFirstScreen ?? "-"} spill=${r.mobile.spill.length} smallTaps=${r.mobile.smallChromeTapTargets.length}`);
  }
  fs.writeFileSync(path.join(OUT, "audit.json"), JSON.stringify(results, null, 1));

  // ---------------- summary ----------------
  const agg = {};
  for (const r of results) for (const v of r.axe || []) { const a = (agg[v.id] ||= { impact: v.impact, nodes: 0, routes: 0, help: v.help }); a.nodes += v.nodes; a.routes += 1; }
  console.log("\naxe violations across routes:");
  for (const [id, a] of Object.entries(agg).sort((x, y) => y[1].nodes - x[1].nodes)) console.log(`  [${a.impact}] ${id}: ${a.nodes} nodes on ${a.routes} routes — ${a.help}`);
  const tools = results.find((r) => r.route === "/tools");
  console.log("\nnavigation:", JSON.stringify({ keyboard: tools?.nav, touch: tools?.mobileNav, focusStyle: tools?.focusStyle }));
  const heavy = results.flatMap((r) => r.heavyImages.map((i) => `${r.route} ${i.src} ${i.kb} KB (rendered ${i.renderedW}px of ${i.naturalW})`));
  if (heavy.length) console.log("\nimages over 150 KB:\n  " + heavy.join("\n  "));

  if (STRICT) {
    const problems = [];
    for (const r of results) {
      if (MUST_RENDER.includes(r.route) && (r.status == null || r.status >= 500)) problems.push(`${r.route} returned ${r.status}`);
      if (r.pageErrors.length) problems.push(`${r.route} threw: ${r.pageErrors[0]}`);
      for (const v of r.axe || []) if (["critical", "serious"].includes(v.impact)) problems.push(`${r.route} axe ${v.id} (${v.impact}, ${v.nodes} nodes)`);
      if (r.h1s.length !== 1 && r.status === 200) problems.push(`${r.route} has ${r.h1s.length} h1 elements`);
      if (r.mobile.spill.length) problems.push(`${r.route} phone: ${r.mobile.spill[0]}`);
    }
    if (tools && tools.nav?.found && !tools.nav.submenuVisibleOnFocus && tools.nav.ariaExpanded == null) problems.push("nav submenu not reachable by keyboard");
    if (tools && tools.mobileNav && tools.mobileNav.navigatedAway) problems.push("tapping a parent nav item navigates instead of opening a menu");
    if (tools && tools.mobileNav && !tools.mobileNav.tapOpenedMenu) problems.push("phone nav exposes no state: nothing has aria-expanded=\"true\" after tapping a menu trigger");
    if (problems.length) { console.log("\nSTRICT: failing —\n  " + problems.join("\n  ")); process.exitCode = 1; }
    else console.log("\nSTRICT: passing.");
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
