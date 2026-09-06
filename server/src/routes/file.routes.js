import { Router } from 'express';
import {
  listFiles,
  getFile,
  createFile,
  updateFile,
  deleteFile,
} from '../controllers/file.controller.js';
import { addNote, addNoteReply, getNoteThread, addNoteAttachments } from '../controllers/note.controller.js';
import { deleteAttachment } from '../controllers/attachment.controller.js';
import { decideApproval } from '../controllers/approval.controller.js';
import { upload } from '../middleware/upload.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadRateLimit } from '../middleware/rateLimit.js';

const router = Router();

router.use(requireAuth);

router.get('/', listFiles);
router.get('/:id', getFile);
router.post('/', uploadRateLimit, upload.array('attachments', 10), createFile);
router.patch('/:id', updateFile);
router.delete('/:id/attachments/:attachmentId', deleteAttachment);
router.delete('/:id', deleteFile);

router.post('/:id/notes', uploadRateLimit, upload.array('attachments', 5), addNote);
router.post('/:id/notes/:noteId/attachments', uploadRateLimit, upload.array('attachments', 5), addNoteAttachments);
router.post('/:id/notes/:noteId/replies', uploadRateLimit, upload.array('attachments', 5), addNoteReply);
router.get('/:id/notes/:noteId', getNoteThread);

router.post('/:id/approvals', decideApproval);

export default router;