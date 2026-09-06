import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma.js';
import { UPLOAD_DIR } from '../middleware/upload.js';
import { canAccessFile, fileAccessSelect } from '../utils/fileView.js';

function contentTypeFor(attachment, filename) {
  if (attachment?.mimeType && attachment.mimeType !== 'application/octet-stream') {
    return attachment.mimeType;
  }
  const ext = path.extname(filename || attachment?.filename || '').toLowerCase();
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.webp') return 'image/webp';
  return attachment?.mimeType || 'application/octet-stream';
}

function contentDisposition(originalName) {
  const fallback = String(originalName || 'download').replace(/[\r\n"]/g, '_');
  const encoded = encodeURIComponent(originalName || 'download');
  return `inline; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

export async function streamUpload(req, res, next) {
  try {
    const filename = path.basename(req.params.filename || '');
    if (!filename || filename !== req.params.filename) {
      return res.status(400).json({ error: 'Invalid file name' });
    }

    const attachment = await prisma.attachment.findFirst({
      where: { fileUrl: `/uploads/${filename}` },
      select: {
        filename: true,
        mimeType: true,
        file: { select: fileAccessSelect },
      },
    });
    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }
    if (!canAccessFile(req.user, attachment.file)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const diskPath = path.resolve(UPLOAD_DIR, filename);
    const root = path.resolve(UPLOAD_DIR);
    if (!diskPath.startsWith(root + path.sep) && diskPath !== root) {
      return res.status(400).json({ error: 'Invalid file path' });
    }
    if (!fs.existsSync(diskPath)) {
      return res.status(404).json({
        error: 'This file is no longer on the server. Upload it again. On Render Free, files are lost after sleep or redeploy unless you add a persistent disk.',
      });
    }

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', contentTypeFor(attachment, filename));
    res.setHeader('Content-Disposition', contentDisposition(attachment.filename));
    res.setHeader('Cache-Control', 'private, no-store');
    return res.sendFile(diskPath);
  } catch (err) {
    next(err);
  }
}
