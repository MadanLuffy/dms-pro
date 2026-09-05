import { prisma } from '../lib/prisma.js';
import { createAuditLog } from '../utils/audit.js';
import { emitToFileParticipants } from '../utils/fileAudience.js';
import { ACTIONS } from '../constants.js';
import { canAccessFile, fileAccessSelect } from '../utils/fileView.js';

const noteInclude = {
  author: true,
  attachments: true,
};

export async function addNote(req, res, next) {
  try {
    const { content = '', sentTo = '' } = req.body || {};
    const fileId = req.params.id;
    const file = await prisma.subjectFile.findUnique({
      where: { id: fileId },
      select: fileAccessSelect,
    });
    if (!file) return res.status(404).json({ error: 'File not found' });
    if (!canAccessFile(req.user, file)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const lastNote = await prisma.note.findFirst({
      where: { fileId },
      orderBy: { order: 'desc' },
    });
    const order = (lastNote?.order || 0) + 1;
    const version = (lastNote?.version || 0) + 1;

    const note = await prisma.note.create({
      data: {
        fileId,
        authorId: req.user.id,
        content,
        sentTo,
        version,
        order,
      },
      include: noteInclude,
    });

    if (req.files && req.files.length > 0) {
      await prisma.attachment.createMany({
        data: req.files.map((f) => ({
          fileId,
          noteId: note.id,
          filename: f.originalname,
          fileUrl: `/uploads/${f.filename}`,
          mimeType: f.mimetype,
          sizeBytes: f.size,
        })),
      });
    }

    await createAuditLog({
      userId: req.user.id,
      userName: req.user.name,
      action: ACTIONS.NOTE_ADDED,
      details: { refNo: file.refNo, version: note.version },
      ipAddress: req.ipAddress,
    });

    await emitToFileParticipants(file, 'note:added', {
      fileId: file.id,
      refNo: file.refNo,
      noteId: note.id,
      version: note.version,
      author: req.user.name,
    });

    res.status(201).json({ note: { id: note.id, version: note.version, content: note.content, sentTo: note.sentTo, createdAt: note.createdAt, author: { id: req.user.id, name: req.user.name, role: req.user.role } } });
  } catch (err) {
    next(err);
  }
}

export async function addNoteReply(req, res, next) {
  try {
    const { content = '', sentTo = '' } = req.body || {};
    const { id: fileId, noteId } = req.params;
    const parentNote = await prisma.note.findUnique({
      where: { id: noteId },
      include: {
        file: { select: fileAccessSelect },
      },
    });
    if (!parentNote || parentNote.fileId !== fileId) {
      return res.status(404).json({ error: 'Note not found' });
    }
    if (!canAccessFile(req.user, parentNote.file)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const reply = await prisma.note.create({
      data: {
        fileId,
        parentId: noteId,
        authorId: req.user.id,
        content,
        sentTo,
        version: parentNote.version,
        order: parentNote.order,
      },
      include: noteInclude,
    });

    if (req.files && req.files.length > 0) {
      await prisma.attachment.createMany({
        data: req.files.map((f) => ({
          fileId,
          noteId: reply.id,
          filename: f.originalname,
          fileUrl: `/uploads/${f.filename}`,
          mimeType: f.mimetype,
          sizeBytes: f.size,
        })),
      });
    }

    await createAuditLog({
      userId: req.user.id,
      userName: req.user.name,
      action: ACTIONS.NOTE_ADDED,
      details: { refNo: parentNote.file.refNo, version: reply.version, replyTo: noteId },
      ipAddress: req.ipAddress,
    });

    const replyPayload = {
      fileId,
      refNo: parentNote.file.refNo,
      noteId,
      replyId: reply.id,
      author: req.user.name,
    };
    await emitToFileParticipants(parentNote.file, 'note:reply', replyPayload);

    res.status(201).json({ note: { id: reply.id, version: reply.version, content: reply.content, sentTo: reply.sentTo, createdAt: reply.createdAt, author: { id: req.user.id, name: req.user.name, role: req.user.role } } });
  } catch (err) {
    next(err);
  }
}

export async function getNoteThread(req, res, next) {
  try {
    const { id: fileId, noteId } = req.params;
    const file = await prisma.subjectFile.findUnique({
      where: { id: fileId },
      select: fileAccessSelect,
    });
    if (!file) return res.status(404).json({ error: 'File not found' });
    if (!canAccessFile(req.user, file)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const notes = await prisma.note.findMany({
      where: { fileId },
      include: noteInclude,
      orderBy: { createdAt: 'asc' },
    });
    const root = notes.find((n) => n.id === noteId);
    if (!root) return res.status(404).json({ error: 'Note not found' });

    const inSubtree = new Set([root.id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const n of notes) {
        if (n.parentId && inSubtree.has(n.parentId) && !inSubtree.has(n.id)) {
          inSubtree.add(n.id);
          changed = true;
        }
      }
    }

    const mapNote = (n) => ({
      id: n.id,
      parentId: n.parentId,
      version: n.version,
      content: n.content,
      sentTo: n.sentTo,
      createdAt: n.createdAt,
      author: { id: n.author?.id, name: n.author?.name, role: n.author?.role },
      attachments: (n.attachments || []).map((a) => ({
        id: a.id,
        filename: a.filename,
        fileUrl: a.fileUrl,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
      })),
    });

    const thread = notes
      .filter((n) => inSubtree.has(n.id))
      .map(mapNote)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    res.json({ file, note: thread.find((t) => t.id === noteId), thread });
  } catch (err) {
    next(err);
  }
}