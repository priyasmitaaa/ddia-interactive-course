// Screenshot every visualization in the given lessons: node tests/viz-shots.mjs outdir w02d1 w02d2 ...
// Optionally clicks the first primary button in each viz first, to show an active state.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const [, , outDir, ...ids] = process.argv;
fs.mkdirSync(outDir, { recursive: true });
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 900, height: 900 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
for (const id of ids) {
  await page.goto(`http://localhost:5317/#/lesson/${id}`, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 400));
  const vizzes = await page.$$('.viz');
  for (let i = 0; i < vizzes.length; i++) {
    const btn = await vizzes[i].$('button.primary');
    if (btn) { await btn.click(); await new Promise((r) => setTimeout(r, 2500)); }
    await vizzes[i].screenshot({ path: `${outDir}/${id}-${i}.png` });
  }
  console.log(id, vizzes.length, 'viz');
}
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors');
await browser.close();
