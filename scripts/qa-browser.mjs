// Real-browser QA: layout at phone/tablet/desktop widths, accessibility (axe, WCAG 2.2 AA), console errors, failed requests.
// Usage: BASE_URL=http://localhost:3000 npm run qa:browser   (add SHOTS=/tmp/shots to save screenshots)
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { readFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const SHOTS = process.env.SHOTS || '';
const PAGES = (process.env.PAGES || '/,/shop,/shop/wigs,/products/body-wave-lace-front,/find-your-wig,/about,/contact,/cart,/checkout,/account/login,/account/register,/account/forgot-password,/policies/returns,/admin/login,/no-such-page').split(',');
const WIDTHS = (process.env.WIDTHS || '320,375,414,768,1024,1440').split(',').map(Number);
const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const browser = await puppeteer.launch({ args: [...chromium.args.filter((a) => !['--single-process', '--no-zygote'].includes(a)), '--no-sandbox', '--disable-dev-shm-usage'], executablePath: await chromium.executablePath(), headless: 'shell' });
const page = await browser.newPage();
let errors = [], current = '';
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
page.on('pageerror', (e) => errors.push(`pageerror: ${String(e.message).slice(0, 200)}`));
page.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(BASE) && !r.url().includes('/api/session') && !(current === '/no-such-page' && r.url() === BASE + current)) errors.push(`HTTP ${r.status()} ${r.url().replace(BASE, '')}`); });
const problems = []; const axeSeen = new Map();
const note = (page, w, kind, detail) => problems.push({ page, w, kind, detail });

for (const path of PAGES) {
  for (const w of WIDTHS) {
    const started = Date.now();
    current = path; errors = [];
    await page.setViewport({ width: w, height: 800, deviceScaleFactor: 1, isMobile: w < 768, hasTouch: w < 768 });
    try {
      // 'load' plus a short settle: puppeteer's network-idle wait can stall on repeat visits to a cached page
      await page.goto(BASE + path, { waitUntil: 'load', timeout: 45000 });
      await new Promise((r) => setTimeout(r, 900));
      await page.evaluate(() => document.fonts.ready);
      const overflow = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth, over = document.documentElement.scrollWidth - vw;
        const offenders = over > 1 ? [...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().right > vw + 1).slice(0, 3).map((e) => e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : '')) : [];
        return { over, offenders };
      });
      if (overflow.over > 1) note(path, w, 'horizontal-overflow', `${overflow.over}px wider than the screen (${overflow.offenders.join(', ')})`);
      for (const e of errors) note(path, w, 'console/network', e);
      if (w === 375 || w === 1440) {
        await page.evaluate(axeSource);
        const res = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })).violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, target: v.nodes[0].target.join(' '), help: v.help })));
        for (const v of res) { const k = `${path}|${v.id}`; if (!axeSeen.has(k)) axeSeen.set(k, { ...v, widths: [w] }); else axeSeen.get(k).widths.push(w); }
      }
      if (SHOTS && [375, 1440].includes(w)) await page.screenshot({ path: `${SHOTS}/${path.replace(/\//g, '_') || '_'}-${w}.png`, fullPage: false });
    } catch (e) { note(path, w, 'load-failed', String(e.message).slice(0, 160)); }
    if (process.env.VERBOSE) console.log(`${path} @${w}px ${((Date.now() - started) / 1000).toFixed(1)}s`);
  }
}
await page.close().catch(() => {}); await browser.close().catch(() => {});
const axeList = [...axeSeen.entries()].map(([k, v]) => ({ page: k.split('|')[0], ...v }));
console.log(`\nPages: ${PAGES.length}  Widths: ${WIDTHS.join(', ')}`);
console.log(`Layout/console/network problems: ${problems.length}`); for (const p of problems) console.log(`  [${p.w}px] ${p.page}  ${p.kind}: ${p.detail}`);
console.log(`Accessibility violations (WCAG 2.2 AA via axe): ${axeList.length}`); for (const v of axeList) console.log(`  ${v.page}  ${v.id} (${v.impact}) x${v.n} at ${v.widths.join('/')}px: ${v.help}\n      e.g. ${v.target}`);
process.exit(problems.length || axeList.length ? 1 : 0);
