import '../loadEnv.js';
import { PrismaClient } from '@prisma/client';

const url = process.env.DATABASE_URL || '';
if (process.env.NODE_ENV === 'production' && (url.startsWith('file:') || url.includes('dev.db'))) {
  console.warn(
    '[dms-server] SQLite is a single-writer database. Switch DATABASE_URL to PostgreSQL before real concurrent users.'
  );
}

export const prisma = new PrismaClient();