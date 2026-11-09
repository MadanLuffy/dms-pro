import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rootDir = path.resolve(serverDir, '..');

function getPrismaRunner() {
  const isWin = process.platform === 'win32';
  const binName = isWin ? 'prisma.cmd' : 'prisma';

  // 1. Check server/node_modules/.bin/prisma
  const serverBin = path.join(serverDir, 'node_modules', '.bin', binName);
  if (fs.existsSync(serverBin)) {
    return { cmd: serverBin, argsPrefix: [], useShell: isWin };
  }

  // 2. Check root node_modules/.bin/prisma
  const rootBin = path.join(rootDir, 'node_modules', '.bin', binName);
  if (fs.existsSync(rootBin)) {
    return { cmd: rootBin, argsPrefix: [], useShell: isWin };
  }

  // 3. Fallback to npx
  const npxCmd = isWin ? 'npx.cmd' : 'npx';
  return { cmd: npxCmd, argsPrefix: ['prisma'], useShell: isWin };
}

function runPrisma(args) {
  const { cmd, argsPrefix, useShell } = getPrismaRunner();
  const fullArgs = [...argsPrefix, ...args];
  console.log(`[dms-server] Running: ${cmd} ${fullArgs.join(' ')}`);

  const result = spawnSync(cmd, fullArgs, {
    stdio: 'inherit',
    cwd: serverDir,
    env: process.env,
    shell: useShell,
  });

  if (result.error) {
    console.warn(`[dms-server] Warning: prisma ${args.join(' ')} failed:`, result.error.message);
    return false;
  }
  if (result.status !== 0) {
    console.warn(`[dms-server] Warning: prisma ${args.join(' ')} exited with status ${result.status}`);
    return false;
  }
  return true;
}

export function syncSchema() {
  if (process.env.SKIP_SYNC_SCHEMA === 'true') {
    console.log('[dms-server] Skipping runtime schema sync (SKIP_SYNC_SCHEMA=true)');
    return;
  }

  try {
    const databaseUrl = process.env.DATABASE_URL || '';
    const isPostgres = /^postgres(ql)?:\/\//i.test(databaseUrl);
    const schemaArgs = isPostgres ? ['--schema=prisma/schema.postgresql.prisma'] : [];
    runPrisma(['generate', ...schemaArgs]);
    runPrisma(['db', 'push', ...schemaArgs]);
  } catch (err) {
    console.warn('[dms-server] Non-fatal schema sync notice:', err.message);
  }
}
