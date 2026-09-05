import { io } from 'socket.io-client';

const BASE = import.meta.env.VITE_API_URL?.replace(/\/api$/, '') || '';

let socket = null;

export function connectSocket() {
  if (socket != null) return socket;
  socket = io(BASE || undefined, {
    transports: ['websocket', 'polling'],
    withCredentials: true,
  });
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket() {
  return socket;
}