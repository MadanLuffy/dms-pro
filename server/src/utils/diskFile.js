import fs from 'fs';
import path from 'path';
import { UPLOAD_DIR } from '../middleware/upload.js';

export function unlinkUploadByUrl(fileUrl) {
  const filename = path.posix.basename(fileUrl || '');
  if (!filename) return;
  const full = path.resolve(UPLOAD_DIR, filename);
  const root = path.resolve(UPLOAD_DIR);
  if (!full.startsWith(root + path.sep) && full !== root) return;
  fs.unlink(full, () => {});
}
