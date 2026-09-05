import './loadEnv.js';
import http from 'http';
import { createApp } from './app.js';
import { initSocket } from './sockets/index.js';
import { getClientOrigins } from './config.js';

const PORT = process.env.PORT || 5120;
const CLIENT_ORIGINS = getClientOrigins();

const app = createApp();
const server = http.createServer(app);
initSocket(server, CLIENT_ORIGINS);

server.listen(PORT, () => {
  console.log(`[dms-server] API listening on http://localhost:${PORT}`);
  console.log(`[dms-server] Socket.io enabled, CORS origin: ${CLIENT_ORIGINS.join(', ')}`);
});