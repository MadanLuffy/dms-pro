import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(command, args, cwd = root) {
  console.log(`[render-build] ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    cwd,
    env: process.env,
    shell: false,
  });
  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(npmCmd, ['install', '--include=dev']);
run(npmCmd, ['install', '--prefix', 'server', '--include=dev']);
run(npmCmd, ['run', 'build']);

const databaseUrl = process.env.DATABASE_URL || '';
const isPostgres = /^postgres(ql)?:\/\//i.test(databaseUrl);

if (isPostgres) {
  run(npmCmd, ['run', 'db:generate:pg', '--prefix', 'server']);
  run(npmCmd, ['run', 'db:push:pg', '--prefix', 'server']);
} else {
  run(npmCmd, ['run', 'db:push', '--prefix', 'server']);
}

run(npmCmd, ['run', 'db:seed', '--prefix', 'server']);
