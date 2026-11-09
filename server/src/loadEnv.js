import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../.env');

function applyEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

applyEnvFile(envPath);

// Cloud / Production automatic defaults if env vars were not manually provided
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:./dev.db';
  console.log('[dms-server] Notice: DATABASE_URL not set in environment. Using default SQLite database (file:./dev.db).');
}

if (!process.env.CLIENT_ORIGIN && process.env.RENDER_EXTERNAL_URL) {
  process.env.CLIENT_ORIGIN = process.env.RENDER_EXTERNAL_URL;
  console.log('[dms-server] Detected RENDER_EXTERNAL_URL:', process.env.RENDER_EXTERNAL_URL);
}
