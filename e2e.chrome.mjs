import fs from 'fs';
import os from 'os';
import path from 'path';

const CANDIDATES = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

export function chromePath() {
  const found = CANDIDATES.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error('Chrome not found. Set PUPPETEER_EXECUTABLE_PATH to a Chromium binary.');
  }
  return found;
}

export const APP = (process.env.E2E_BASE_URL || 'http://127.0.0.1:5188').replace(/\/$/, '');
export const TMP = os.tmpdir();
export const E2E_CSV = path.join(TMP, 'e2e-note.csv');
export const E2E_LOG = path.join(TMP, 'dms-e2e.log');
