import puppeteer from 'puppeteer-core';
import { writeFileSync, appendFileSync } from 'fs';
import { chromePath, APP, E2E_CSV, E2E_LOG } from './e2e.chrome.mjs';

const PASS = 'Password@123';

function log(msg) {
  const line = `[${new Date().toISOString().slice(11, 19)}] ${msg}`;
  console.log(msg);
  appendFileSync(E2E_LOG, line + '\n');
}

writeFileSync(E2E_LOG, '');
writeFileSync(E2E_CSV, 'Name,Role,Status\nShiv,CEO,Approved\nPriya,Staff,Pending\n');

const errors = [];
let step = 'init';

async function login(page, email) {
  await page.goto(`${APP}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#login-email', { timeout: 15000, polling: 200 });
  await page.type('#login-email', email);
  await page.type('#login-password', PASS);
  await page.evaluate(() => document.querySelector('button[type="submit"]').click());
  await page.waitForFunction(() => location.pathname === '/files', { timeout: 20000, polling: 200 });
}

async function logout(page) {
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.getAttribute('title') === 'Log out');
    if (b) b.click();
  });
  await page.waitForFunction(() => location.pathname === '/login', { timeout: 15000, polling: 200 });
}

async function clickByText(page, text) {
  await page.waitForFunction(
    (t) => [...document.querySelectorAll('button')].some((x) => x.textContent.includes(t)),
    { timeout: 20000, polling: 200 },
    text
  );
  await page.evaluate((t) => {
    const btn = [...document.querySelectorAll('button')].find((x) => x.textContent.includes(t));
    if (!btn) throw new Error(`button not found: ${t}`);
    HTMLElement.prototype.click.call(btn);
  }, text);
}

async function setValue(page, selector, value) {
  await page.evaluate((sel, val) => {
    const el = document.querySelector(sel);
    if (!el) throw new Error(`Element not found: ${sel}`);
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && desc.set) {
      desc.set.call(el, val);
    } else {
      el.value = val;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, selector, value);
}

function submitForm(page) {
  return page.evaluate(() => {
    const form = document.querySelector('form');
    form.requestSubmit();
    return 'submitted';
  });
}

async function waitRowStatus(page, refNo, regex, timeout = 30000) {
  await page.waitForFunction(
    `(rn) => { const rows=document.querySelectorAll('table tbody tr'); for (const r of rows) if (r.textContent.includes(rn)) return ${regex}.test(r.textContent); return false; }`,
    { timeout, polling: 200 },
    refNo
  );
}

async function main() {
  const browser = await puppeteer.launch({ executablePath: chromePath(), headless: 'new', protocolTimeout: 60000 });
  const ctxA = await browser.createBrowserContext();
  const ctxB = await browser.createBrowserContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();
  globalThis.__A = pageA;
  globalThis.__B = pageB;
  for (const pg of [pageA, pageB]) {
    pg.on('console', (m) => { if (m.type() === 'error') errors.push(`[console.error] ${m.text()}`); });
    pg.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
    pg.on('dialog', async (d) => { await d.accept(); });
    pg.on('request', (req) => {
      if (req.method() === 'POST') log(`REQ ${pg === pageA ? 'A' : 'B'} ${req.method()} ${req.url()}`);
    });
  }

  // 1. RAVI (STAFF/IT) creates a file targeting FINANCE
  step = 'login-ravi';
  await login(pageA, 'ravi.kumar@skandasoft.com');
  log('ravi logged in');
  step = 'create-file';
  await pageA.goto(`${APP}/files/new`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await pageA.waitForSelector('#subject', { timeout: 15000, polling: 200 });
  const subj = `E2E Procurement Policy ${Date.now() % 10000}`;
  await setValue(pageA, '#subject', subj);
  await submitForm(pageA);
  await pageA.waitForFunction(() => /^\/files\/[0-9a-f-]+$/.test(location.pathname), { timeout: 20000, polling: 200 });
  const fileId = pageA.url().split('/').pop();
  const refNo = await pageA.evaluate(() => (document.body.textContent.match(/DMS-[0-9A-Z]{6}/) || [])[0]);
  log(`created: ${refNo} (id=${fileId})`);

  // 2. Open the note composer via the Write Note button, pick recipient, attach, send
  step = 'compose-note';
  await pageA.waitForFunction(() => document.body.textContent.includes('Write Note'), { timeout: 20000, polling: 200 });
  await clickByText(pageA, 'Write Note');
  await pageA.waitForSelector('#note-text', { timeout: 10000, polling: 200 });
  const fwdSel = await pageA.$('#fwd-recipient');
  if (fwdSel) await pageA.select('#fwd-recipient', 'Sunil Verma (DEPT HEAD - Information Technology)');
  await setValue(pageA, '#note-text', 'E2E auto note to IT dept. Attaching supporting spreadsheet.');
  const noteFileInput = await pageA.$('input[type="file"]');
  await noteFileInput.uploadFile(E2E_CSV);
  await pageA.waitForFunction(() => document.body.textContent.includes('e2e-note.csv'), { timeout: 10000, polling: 200 });
  await clickByText(pageA, 'Send Note');
  await pageA.waitForFunction(() => !document.body.textContent.includes('Write Note & Send'), { timeout: 10000, polling: 200 });
  await pageA.waitForFunction(() => document.body.textContent.includes('Unseen by Head'), { timeout: 10000, polling: 200 });
  log('note + attachment posted via compose modal; shows Unseen by Head');

  // Test creating and deleting an unviewed note
  step = 'delete-unviewed-note';
  await clickByText(pageA, 'Write Note');
  await pageA.waitForSelector('#note-text', { timeout: 10000, polling: 200 });
  await setValue(pageA, '#note-text', 'Temporary draft note to test deletion.');
  await clickByText(pageA, 'Send Note');
  await pageA.waitForFunction(() => !document.body.textContent.includes('Write Note & Send'), { timeout: 10000, polling: 200 });
  await pageA.waitForFunction(() => {
    const cards = [...document.querySelectorAll('[data-testid="note-card"]')];
    return cards.some((c) => c.textContent.includes('Temporary draft note to test deletion.'));
  }, { timeout: 15000, polling: 200 });
  await pageA.evaluate(() => {
    const cards = [...document.querySelectorAll('[data-testid="note-card"]')];
    const target = cards.find((c) => c.textContent.includes('Temporary draft note to test deletion.'));
    if (!target) throw new Error('target note to delete not found');
    const delBtn = [...target.querySelectorAll('button')].find((b) => /delete/i.test(b.textContent));
    if (!delBtn) throw new Error('delete button on unviewed note not found');
    delBtn.click();
  });
  await pageA.waitForFunction(() => !document.body.textContent.includes('Temporary draft note to test deletion.'), { timeout: 10000, polling: 200 });
  log('successfully deleted unviewed note before Head saw it');

  // 3. PAGE A parks on the list, confirms DEPT_HEAD_REVIEW shows
  step = 'park-on-list';
  await pageA.goto(`${APP}/files`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await pageA.waitForFunction(`(rn) => { const rows=document.querySelectorAll('table tbody tr'); return [...rows].some(r=>r.textContent.includes(rn)); }`, { timeout: 20000, polling: 200 }, refNo);
  await waitRowStatus(pageA, refNo, /DEPT[_ ]?HEAD[_ ]?Review|Department Review/i);
  log('page A idle: row shows DEPARTMENT REVIEW');

  // 4. SUNIL (IT dept head) opens the file, replies to Ravi's note with an attachment
  step = 'login-sunil';
  await login(pageB, 'sunil.verma@skandasoft.com');
  log('sunil logged in');
  await pageB.goto(`${APP}/files/${fileId}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await pageB.waitForSelector('h1', { timeout: 15000, polling: 200 });

  step = 'reply-note';
  await pageB.waitForFunction(() => document.body.textContent.includes('E2E auto note to IT dept.'), { timeout: 20000, polling: 200 });
  await pageB.waitForSelector('[data-testid="note-card"]', { timeout: 10000, polling: 200 });
  await pageB.evaluate(() => document.querySelector('[data-testid="note-card"]').click());
  await pageB.waitForFunction(() => location.pathname.includes('/notes/'), { timeout: 20000, polling: 200 });
  await pageB.waitForSelector('[data-testid="thread-root"]', { timeout: 10000, polling: 200 });
  await pageB.evaluate(() => {
    const card = document.querySelector('[data-testid="thread-root"]');
    const btn = [...card.querySelectorAll('button')].find((b) => /reply/i.test(b.textContent));
    if (!btn) throw new Error('root reply button not found');
    btn.click();
  });
  await pageB.waitForSelector('#threadReply-text', { timeout: 10000, polling: 200 });
  await setValue(pageB, '#threadReply-text', 'E2E reply from IT dept head - acknowledged, proceeding with review.');
  const replyFileInput = await pageB.$('#threadReply-file');
  await replyFileInput.uploadFile(E2E_CSV);
  await pageB.waitForFunction(() => document.body.textContent.includes('e2e-note.csv'), { timeout: 10000, polling: 200 });
  await clickByText(pageB, 'Send Reply');
  await pageB.waitForFunction(() => document.body.textContent.includes('E2E reply from IT dept head'), { timeout: 20000, polling: 200 });
  await pageB.goto(`${APP}/files/${fileId}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await pageB.waitForFunction(() => document.body.textContent.includes('1 reply'), { timeout: 20000, polling: 200 });
  log('sunil replied with attachment');

  // 4b. FIRST USER (Ravi) clicks the note -> thread page, replies to the reply (nested thread)
  step = 'first-user-sees-reply';
  await pageA.goto(`${APP}/files/${fileId}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await pageA.waitForFunction(() => document.body.textContent.includes('1 reply'), { timeout: 20000, polling: 200 });
  await pageA.waitForFunction(() => document.body.textContent.includes('Seen by Head'), { timeout: 15000, polling: 200 });
  log('first user (ravi) sees the reply and Seen by Head');

  step = 'open-note-thread';
  await pageA.waitForSelector('[data-testid="note-card"]', { timeout: 10000, polling: 200 });
  await pageA.evaluate(() => document.querySelector('[data-testid="note-card"]').click());
  await pageA.waitForFunction(() => location.pathname.includes('/notes/'), { timeout: 20000, polling: 200 });
  await pageA.waitForFunction(() => document.body.textContent.includes('E2E reply from IT dept head'), { timeout: 20000, polling: 200 });
  log('thread page opened by clicking the note');

  step = 'reply-to-reply';
  await pageA.evaluate(() => {
    const card = document.querySelector('[data-testid="thread-reply"]');
    const btn = [...card.querySelectorAll('button')].find((b) => /reply/i.test(b.textContent));
    if (!btn) throw new Error('nested reply button not found');
    btn.click();
  });
  await pageA.waitForSelector('#threadReply-text', { timeout: 10000, polling: 200 });
  await setValue(pageA, '#threadReply-text', 'E2E nested reply from the first user - acknowledged your reply.');
  const threadFileInput = await pageA.$('#threadReply-file');
  await threadFileInput.uploadFile(E2E_CSV);
  await pageA.waitForFunction(() => document.body.textContent.includes('e2e-note.csv'), { timeout: 10000, polling: 200 });
  await clickByText(pageA, 'Send Reply');
  await pageA.waitForFunction(() => document.body.textContent.includes('E2E nested reply from the first user'), { timeout: 20000, polling: 200 });
  await pageA.waitForFunction(() => document.body.textContent.includes('replying to @Sunil Verma'), { timeout: 15000, polling: 200 });
  log('ravi replied to sunil\'s reply (nested thread)');

  await pageA.goto(`${APP}/files`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await pageA.waitForFunction((rn) => [...document.querySelectorAll('table tbody tr')].some((r) => r.textContent.includes(rn)), { timeout: 20000, polling: 200 }, refNo);

  // 4c. SUNIL approves the DEPT gate while PAGE A watches
  step = 'approve-dept';
  await clickByText(pageB, 'Approve & Sign');
  await pageB.waitForFunction(() => document.body.textContent.includes('Confirm Authorization & Sign'), { timeout: 10000, polling: 200 });
  await setValue(pageB, 'textarea', 'Approved by IT.');
  await clickByText(pageB, 'Confirm Approval');
  await pageB.waitForFunction(() => /CEO[_ ]?Review|CEO_REVIEW/i.test(document.body.textContent), { timeout: 20000, polling: 200 });
  log('sunil approved');

  // 5. PAGE A flips to CEO REVIEW with zero interaction -> socket proof
  step = 'socket-flip-1';
  await waitRowStatus(pageA, refNo, /CEO[_ ]?Review/i);
  log('SOCKET OK: page A watched CEO REVIEW appear live');

  // 6. CEO approves
  step = 'login-ceo';
  const ctxC = await browser.createBrowserContext();
  const pageC = await ctxC.newPage();
  pageC.on('console', (m) => { if (m.type() === 'error') errors.push(`[console.error] ${m.text()}`); });
  pageC.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  await login(pageC, 'ceo@skandasoft.com');
  log('ceo logged in');
  await pageC.goto(`${APP}/files/${fileId}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await pageC.waitForSelector('h1', { timeout: 15000, polling: 200 });
  await clickByText(pageC, 'Approve & Sign');
  await pageC.waitForFunction(() => document.body.textContent.includes('Confirm Authorization & Sign'), { timeout: 10000, polling: 200 });
  await setValue(pageC, 'textarea', 'Final CEO approval granted.');
  await clickByText(pageC, 'Confirm Approval');
  await pageC.waitForFunction(() => /Approved/i.test(document.body.textContent), { timeout: 20000, polling: 200 });
  log('ceo approved');

  // 7. PAGE A flips to APPROVED live
  step = 'socket-flip-2';
  await waitRowStatus(pageA, refNo, /Approved/i);
  log('SOCKET OK: page A watched APPROVED appear live');

  // 8. Test return flow: create second file, DEPT HEAD returns it
  step = 'create-file-2';
  await pageA.goto(`${APP}/files/new`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await pageA.waitForSelector('#subject', { timeout: 15000, polling: 200 });
  const subj2 = `ResubmitTest-${Date.now() % 100000}`;
  await setValue(pageA, '#subject', subj2);
  await submitForm(pageA);
  await pageA.waitForFunction(() => /^\/files\/[0-9a-f-]+$/.test(location.pathname), { timeout: 20000, polling: 200 });
  const fileId2 = pageA.url().split('/').pop();
  const refNo2 = await pageA.evaluate(() => (document.body.textContent.match(/DMS-[0-9A-Z]{6}/) || [])[0]);
  log(`created second file: ${refNo2}`);

  step = 'return-file';
  await pageB.goto(`${APP}/files/${fileId2}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await pageB.waitForSelector('h1', { timeout: 15000, polling: 200 });
  await clickByText(pageB, 'Return Note');
  await pageB.waitForFunction(() => document.body.textContent.includes('Return file'), { timeout: 10000, polling: 200 });
  await setValue(pageB, 'textarea', 'Returned for clarification.');
  await clickByText(pageB, 'Confirm Return');

  // 6b. CSV preview grid renders in official note sheet (proves lazy xlsx + fetch preview works)
  step = 'csv-preview';
  await pageB.goto(`${APP}/files/${fileId}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await pageB.waitForSelector('[data-testid="note-card"]', { timeout: 10000, polling: 200 });
  await pageB.evaluate(() => document.querySelector('[data-testid="note-card"]').click());
  await pageB.waitForFunction(
    () => document.body.textContent.includes('Spreadsheet preview failed') === false && document.body.textContent.includes('Priya'),
    { timeout: 20000, polling: 200 }
  );
  log('CSV PREVIEW GRID RENDERED');

  // 7. PAGE A flips to APPROVED -> socket proof again
  step = 'socket-flip-2';
  await waitRowStatus(pageA, refNo, /Approved/);
  log('SOCKET OK: page A watched APPROVED appear live');

  await browser.close();
  log('---- RUNTIME ERRORS ----');
  log(errors.length === 0 ? '(none)' : errors.join('\n'));
  log('E2E2_PASS');
  process.exit(0);
}

main().catch(async (err) => {
  log(`FAILED at step [${step}]: ${err.message}`);
  for (const pg of [globalThis.__A, globalThis.__B].filter(Boolean)) {
    try {
      log('  URL: ' + pg.url());
      log('  BODY: ' + (await pg.evaluate(() => document.body.innerText.slice(0, 2000)).catch(() => 'n/a')).replace(/\n/g, ' | '));
    } catch {}
  }
  log(errors.slice(0, 8).join('\n') || '(no console errors)');
  process.exit(1);
});