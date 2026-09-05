import { Server as SocketServer } from 'socket.io';
import { verifyToken } from '../utils/jwt.js';

let io = null;
const userSockets = new Map(); // userId -> Set<socketId>
const socketUsers = new Map(); // socketId -> userId

function readAuthToken(socket) {
  const cookie = socket.handshake.headers?.cookie || '';
  const match = cookie.match(/(?:^|;\s*)dms_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function initSocket(httpServer, corsOrigin) {
  const origins = Array.isArray(corsOrigin)
    ? corsOrigin
    : [corsOrigin, 'http://localhost:5188', 'http://127.0.0.1:5188'].filter(Boolean);

  io = new SocketServer(httpServer, {
    cors: { origin: origins, credentials: true },
  });

  io.use((socket, next) => {
    const token = readAuthToken(socket);
    const payload = token ? verifyToken(token) : null;
    if (!payload?.sub) return next(new Error('Unauthorized'));
    socket.userId = payload.sub;
    next();
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;
    if (!userSockets.has(userId)) userSockets.set(userId, new Set());
    userSockets.get(userId).add(socket.id);
    socketUsers.set(socket.id, userId);

    socket.on('disconnect', () => {
      socketUsers.delete(socket.id);
      const set = userSockets.get(userId);
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) userSockets.delete(userId);
      }
    });
  });

  return io;
}

export function emitToUser(userId, event, payload) {
  if (!io || !userId) return;
  const sockets = userSockets.get(userId);
  if (!sockets) return;
  for (const socketId of sockets) {
    io.to(socketId).emit(event, payload);
  }
}

export function broadcast(event, payload) {
  if (!io) return;
  io.emit(event, payload);
}

export function getIO() {
  return io;
}