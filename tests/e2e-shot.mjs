// Screenshot helper: node tests/e2e-shot.mjs <route-without-#/> <out.png> [width] [theme]
// e.g. node tests/e2e-shot.mjs lesson/w01d1 shot.png 1200 light
import puppeteer from 'puppeteer-core';

const [, , route = '', out = 'shot.png', width = '1200', theme = 'light'] = process.argv;
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
});
const page = await browser.newPage();
await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }]);
await page.setViewport({ width: Number(width), height: 900 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const clean = route.replace(/^#?\/?/, '');
await page.goto(`http://localhost:5317/#/${clean}`, { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 800));
await page.screenshot({ path: out, fullPage: true });
console.log(page.url());
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors');
await browser.close();
