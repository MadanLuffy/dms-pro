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

  step = 'login-admin';
  await page.goto(`${APP}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#login-email', { timeout: 15000 });
  await page.type('#login-email', 'admin@skandasoft.com');
  await page.type('#login-password', 'Password@123');
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => location.pathname === '/admin', { timeout: 20000 });
  console.log('ADMIN HOME:', page.url());

  step = 'admin-nav';
  await page.waitForSelector('#dept-id', { timeout: 15000 });
  const hasCreateFile = await page.evaluate(() =>
    [...document.querySelectorAll('button')].some((b) => b.textContent.includes('Create New File'))
  );
  const hasRegistry = await page.evaluate(() =>
    [...document.querySelectorAll('button')].some((b) => b.textContent.includes('File Registry'))
  );
  if (hasCreateFile || hasRegistry) throw new Error('Admin nav still shows file workflow');
  console.log('ADMIN NAV HAS NO FILE WORKFLOW');

  step = 'create-dept';
  const suffix = String(Date.now() % 100000);
  await page.type('#dept-id', `QA${suffix}`.slice(0, 20));
  await page.type('#dept-name', `QA Department ${suffix}`);
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Create Department'));
    btn.click();
  });
  await page.waitForFunction((id) => document.body.textContent.includes(id), { timeout: 15000 }, `QA${suffix}`.slice(0, 20));
  console.log('DEPARTMENT CREATED');

  step = 'create-user';
  const email = `qa.staff.${suffix}@skandasoft.com`;
  await page.type('#user-name', 'QA Staff');
  await page.type('#user-email', email);
  await page.type('#user-password', 'Password@123');
  await page.select('#user-role', 'STAFF');
  await page.waitForFunction((id) => [...document.querySelectorAll('#user-dept option')].some((o) => o.value === id), { timeout: 10000 }, `QA${suffix}`.slice(0, 20));
  await page.select('#user-dept', `QA${suffix}`.slice(0, 20));
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Create User'));
    btn.click();
  });
  await page.waitForFunction((em) => document.body.textContent.includes(em), { timeout: 15000 }, email);
  console.log('USER CREATED:', email);

  await browser.close();
  console.log('---- RUNTIME ERRORS ----');
  if (errors.length === 0) console.log('(none)');
  else errors.forEach((e) => console.log(e));
}

main()
  .then(() => {
    console.log('E2E_ADMIN_PASS');
    process.exit(0);
  })
  .catch((err) => {
    console.error(`FAILED at step [${step}]:`, err.message);
    console.error('Errors captured:', errors.slice(0, 10));
    process.exit(1);
  });
