import puppeteer from 'puppeteer-core';
import { chromePath, APP } from './e2e.chrome.mjs';

const errors = [];
let step = '';

async function main() {
  const browser = await puppeteer.launch({ executablePath: chromePath(), headless: 'new' });
  const page = await browser.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`[console.error] ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`[pageerror] ${err.message}`));

  // 1. Load app, verify login screen renders
  step = 'login-screen';
  await page.goto(APP, { waitUntil: 'networkidle0', timeout: 30000 });
  await page.waitForSelector('button[type="submit"]', { timeout: 15000 });
  const title = await page.$eval('h2', (el) => el.textContent);
  console.log('LOGIN SCREEN TITLE:', title);

  // 2. Login as CEO
  step = 'login-ceo';
  await page.type('input#login-email', 'ceo@skandasoft.com');
  await page.type('input#login-password', 'Password@123');
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => location.pathname === '/files', { timeout: 20000 });
  console.log('AFTER LOGIN PATH:', page.url());
  await page.waitForSelector('table', { timeout: 15000 });
  const rows = await page.$$eval('table tbody tr', (trs) => trs.length);
  console.log('FILE ROWS VISIBLE:', rows);

  // 3. Open first file detail
  step = 'open-file';
  await page.click('table tbody tr');
  await page.waitForFunction(() => location.pathname.startsWith('/files/'), { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 1500));
  const h1 = await page.$eval('h1', (el) => el.textContent);
  console.log('FILE DETAIL SUBJECT:', h1.slice(0, 60));

  // 4. Add a note
  step = 'add-note';
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.textContent.includes('Write Note')), { timeout: 15000 });
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Write Note'));
    btn.click();
  });
  await page.waitForSelector('#note-text', { timeout: 10000 });
  await page.type('#note-text', 'E2E verification note');
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Send Note'));
    if (btn) btn.click();
    else document.querySelector('form')?.requestSubmit();
  });
  await page.waitForFunction(() => document.body.textContent.includes('E2E verification note'), { timeout: 15000 });
  console.log('NOTE ADDED & VISIBLE');

  // 5. Go to audit trail
  step = 'audit';
  await page.goto(`${APP}/audit`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('table', { timeout: 15000 });
  const auditRows = await page.$$eval('table tbody tr', (trs) => trs.length);
  console.log('AUDIT LOG ROWS:', auditRows);

  // 6. Logout
  step = 'logout';
  await page.evaluate(() => window.history.pushState({}, '', '/files'));
  await page.goto(`${APP}/files`, { waitUntil: 'networkidle0' });
  const logoutBtn = await page.$('button[title="Log out"]');
  if (logoutBtn) {
    await logoutBtn.click();
    await page.waitForFunction(() => location.pathname === '/login', { timeout: 15000 });
    console.log('LOGOUT REDIRECT OK');
  } else {
    console.log('LOGOUT BUTTON NOT FOUND');
  }

  await browser.close();

  console.log('---- RUNTIME ERRORS ----');
  if (errors.length === 0) console.log('(none)');
  else errors.forEach((e) => console.log(e));
}

main()
  .then(() => {
    console.log('E2E_COMPLETE');
    process.exit(0);
  })
  .catch((err) => {
    console.error(`FAILED at step [${step}]:`, err.message);
    console.error('Errors captured:', errors.slice(0, 10));
    process.exit(1);
  });