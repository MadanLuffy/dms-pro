import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function prismaBin() {
  return path.join(serverDir, 'node_modules', '.bin', process.platform === 'win32' ? 'prisma.cmd' : 'prisma');
}

function runPrisma(args) {
  console.log(`[dms-server] prisma ${args.join(' ')}`);
  const result = spawnSync(prismaBin(), args, {
    stdio: 'inherit',
    cwd: serverDir,
    env: process.env,
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`prisma ${args.join(' ')} failed with exit ${result.status}`);
  }
}

export function syncSchema() {
  const databaseUrl = process.env.DATABASE_URL || '';
  const isPostgres = /^postgres(ql)?:\/\//i.test(databaseUrl);
  const schemaArgs = isPostgres ? ['--schema=prisma/schema.postgresql.prisma'] : [];
  runPrisma(['generate', ...schemaArgs]);
  runPrisma(['db', 'push', ...schemaArgs]);
}
