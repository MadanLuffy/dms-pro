import { prisma } from '../lib/prisma.js';
import { createAuditLog } from '../utils/audit.js';
import { emitToFileParticipants } from '../utils/fileAudience.js';
import { canAccessFile } from '../utils/fileView.js';
import { areAttachmentsLocked, canDeleteAttachment } from '../utils/attachmentPolicy.js';
import { unlinkUploadByUrl } from '../utils/diskFile.js';
import { ACTIONS } from '../constants.js';

export async function deleteAttachment(req, res, next) {
  try {
    const { id: fileId, attachmentId } = req.params;
    const attachment = await prisma.attachment.findFirst({
      where: { id: attachmentId, fileId },
      include: {
        note: { select: { id: true, authorId: true } },
        file: {
          include: {
            targetDepts: { select: { deptId: true } },
            approvalMatrix: { select: { status: true, gate: true } },
          },
        },
      },
    });

    if (!attachment) return res.status(404).json({ error: 'Attachment not found' });
    if (!canAccessFile(req.user, attachment.file)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (areAttachmentsLocked(attachment.file)) {
      return res.status(409).json({
        error: 'Cannot remove attachments after a department head or CEO has approved. If the file is returned, you can remove extras before resubmitting.',
      });
    }
    if (!canDeleteAttachment(req.user, attachment.file, attachment)) {
      return res.status(403).json({ error: 'Only the file creator or the person who attached this file can remove it' });
    }

    await prisma.attachment.delete({ where: { id: attachment.id } });
    unlinkUploadByUrl(attachment.fileUrl);

    await createAuditLog({
      userId: req.user.id,
      userName: req.user.name,
      action: ACTIONS.ATTACHMENT_REMOVED,
      details: { refNo: attachment.file.refNo, filename: attachment.filename, attachmentId: attachment.id },
      ipAddress: req.ipAddress,
    });

    await emitToFileParticipants(attachment.file, 'attachment:removed', {
      fileId,
      attachmentId: attachment.id,
      noteId: attachment.noteId,
      filename: attachment.filename,
    });

    res.json({ ok: true, attachmentId: attachment.id });
  } catch (err) {
    next(err);
  }
}
