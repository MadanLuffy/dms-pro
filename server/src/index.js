import './loadEnv.js';
import http from 'http';
import { syncSchema } from './syncSchema.js';
import { getClientOrigins } from './config.js';

const PORT = process.env.PORT || 5120;
const IS_PROD = process.env.NODE_ENV === 'production';

async function main() {
  if (IS_PROD) {
    syncSchema();
  }

  const { createApp } = await import('./app.js');
  const { initSocket } = await import('./sockets/index.js');
  const { ensureBootstrap } = await import('./ensureBootstrap.js');

  await ensureBootstrap();

  const CLIENT_ORIGINS = getClientOrigins();
  const app = createApp();
  const server = http.createServer(app);
  initSocket(server, CLIENT_ORIGINS);

  server.listen(PORT, () => {
    console.log(`[dms-server] API listening on http://localhost:${PORT}`);
    console.log(`[dms-server] Socket.io enabled, CORS origin: ${CLIENT_ORIGINS.join(', ')}`);
  });
}

main().catch((err) => {
  console.error('[dms-server] Failed to start', err);
  process.exit(1);
});
