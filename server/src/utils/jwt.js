import '../loadEnv.js';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

let JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set via environment variables in production');
  }
  JWT_SECRET = crypto.randomBytes(48).toString('hex');
  console.warn(
    '[dms-server] JWT_SECRET is not set. Generated a random in-memory secret; sessions will be invalidated on restart. Set JWT_SECRET in server/.env to keep dev sessions stable.'
  );
}

const COOKIE_NAME = 'dms_token';
const COOKIE_MAX_AGE = 1000 * 60 * 60 * 24 * 7; // 7 days

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function setAuthCookie(res, token) {
  const sameSite = (process.env.COOKIE_SAMESITE || 'lax').toLowerCase();
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: sameSite === 'none' ? 'none' : 'lax',
    secure: process.env.NODE_ENV === 'production' || sameSite === 'none',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export const COOKIE_NAME_EXPORT = COOKIE_NAME;