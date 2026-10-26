// End-to-end test of the real app in a real browser (needs `npm run dev` running on port 5317).
//   node tests/e2e.mjs            (or: npm run e2e)
// 1. Learner flow: fresh profile -> Continue Learning -> answer questions -> complete lesson -> reload -> progress
//    persisted -> Continue points to the next lesson -> mixed quiz in Review -> Progress page -> backup export.
// 2. Smoke test: every lesson and every exercise page renders with no console errors.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const BASE = process.env.COURSE_URL || 'http://localhost:5317/';
const CHROME = process.env.CHROME_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find((p) => fs.existsSync(p));
if (!CHROME) { console.error('Chrome/Chromium not found; set CHROME_PATH'); process.exit(2); }

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.createBrowserContext();               // fresh profile: empty localStorage
const page = await ctx.newPage();
await page.setViewport({ width: 1200, height: 900 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
let failed = 0;
const check = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) failed++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const go = async (hash) => { await page.goto(BASE + hash, { waitUntil: 'networkidle0' }); await sleep(300); };
const progress = () => page.evaluate(() => JSON.parse(localStorage.getItem('ddia-course-progress-v1') || '{}'));

// ---------------------------------------------------------------- 1. learner flow
await go('#/');
const href = await page.$eval('[data-testid="continue"]', (a) => a.getAttribute('href'));
check(href === '#/lesson/w01d1', `fresh start: Continue Learning points to W1 D1 (${href})`);
await page.click('[data-testid="continue"]');
await sleep(500);
check(page.url().endsWith('#/lesson/w01d1'), 'Continue opens the first lesson');
check((await page.$$('.section')).length >= 3, 'lesson renders its sections');

// answer the first multiple-choice question (first option) and the first free-text question
const opt = await page.$('.quiz button.opt');
check(!!opt, 'lesson has a multiple-choice question');
if (opt) { await opt.click(); await sleep(200); }
const ta = await page.$('textarea.answer');
if (ta) {
  await ta.type('Reliability means working correctly even when faults happen.');
  const [btn] = await page.$$('xpath/.//button[contains(., "Compare with model answer")]');
  if (btn) { await btn.click(); await sleep(200); }
  const [gradeBtn] = await page.$$('xpath/.//button[contains(., "I missed something")]');
  if (gradeBtn) { await gradeBtn.click(); await sleep(200); }
}
let st = await progress();
check(Object.keys(st.answers || {}).length >= 1, `answers saved (${Object.keys(st.answers || {}).length})`);
check(Object.keys(st.cards || {}).length >= 1, 'review cards created');

await page.click('[data-testid="complete"]');
await sleep(500);
check(page.url().endsWith('#/lesson/w01d2'), 'Complete lesson & continue goes to W1 D2');

await page.reload({ waitUntil: 'networkidle0' });
st = await progress();
check(!!st.completed?.w01d1, 'completion persisted across reload');
await go('#/');
const href2 = await page.$eval('[data-testid="continue"]', (a) => a.getAttribute('href'));
check(href2 === '#/lesson/w01d2', `Continue Learning now points to W1 D2 (${href2})`);

await go('#/review');
const [mixed] = await page.$$('xpath/.//button[contains(., "Start mixed quiz")]');
check(!!mixed, 'Review page offers a mixed quiz');
if (mixed) {
  await mixed.click(); await sleep(300);
  const o = await page.$('button.opt');
  const t = await page.$('textarea.answer');
  check(!!(o || t), 'mixed quiz shows a question');
}

await go('#/progress');
const text = await page.$eval('main, body', (el) => el.innerText);
check(/1\s*(of|\/)\s*144|1 lesson/i.test(text) || text.includes('144'), 'Progress page shows course progress');
const [exportBtn] = await page.$$('xpath/.//button[contains(., "Export") or contains(., "export") or contains(., "backup")]');
check(!!exportBtn, 'Progress page has a backup/export button');

// ---------------------------------------------------------------- 2. smoke test every page
const ids = await page.evaluate(async () => {
  const mod = await import('/src/lib/content.ts');
  return { lessons: mod.lessons.map((l) => l.id), exercises: mod.exercises.map((e) => e.id) };
});
check(ids.lessons.length === 144, `144 lessons (${ids.lessons.length})`);
let broken = [];
for (const id of ids.lessons) {
  await page.goto(`${BASE}#/lesson/${id}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.section', { timeout: 5000 }).catch(() => broken.push(id));
}
check(broken.length === 0, `every lesson renders (${broken.length ? broken.join(', ') : 'all ok'})`);
broken = [];
for (const id of ids.exercises) {
  await page.goto(`${BASE}#/practice/${id}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('h1, h2', { timeout: 5000 }).catch(() => broken.push(id));
  const txt = await page.$eval('body', (b) => b.innerText);
  if (txt.includes('Exercise not found')) broken.push(id);
}
check(broken.length === 0, `every exercise page renders (${ids.exercises.length} exercises)`);
check(errors.length === 0, `no console errors${errors.length ? ':\n  ' + [...new Set(errors)].slice(0, 5).join('\n  ') : ''}`);

await browser.close();
console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll end-to-end checks passed');
process.exit(failed ? 1 : 0);
