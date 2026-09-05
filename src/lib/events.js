const EVENT_NAMES = {
  FILE_CREATED: 'file:created',
  FILE_FORWARDED: 'file:forwarded',
  FILE_APPROVED: 'file:approved',
  FILE_DELETED: 'file:deleted',
  FILE_RETURNED: 'file:returned',
  NOTE_ADDED: 'note:added',
  NOTE_REPLY: 'note:reply',
  APPROVAL_GRANTED: 'approval:granted',
  APPROVAL_READY: 'approval:ready',
  APPROVAL_RETURNED: 'approval:returned',
};

const pretty = {
  [EVENT_NAMES.FILE_CREATED]: 'New file created',
  [EVENT_NAMES.FILE_FORWARDED]: 'File forwarded to you',
  [EVENT_NAMES.FILE_APPROVED]: 'File approved',
  [EVENT_NAMES.FILE_DELETED]: 'File deleted',
  [EVENT_NAMES.FILE_RETURNED]: 'File returned',
  [EVENT_NAMES.NOTE_ADDED]: 'New note added',
  [EVENT_NAMES.NOTE_REPLY]: 'Note replied',
  [EVENT_NAMES.APPROVAL_GRANTED]: 'Approval granted',
  [EVENT_NAMES.APPROVAL_READY]: 'Approval requested',
  [EVENT_NAMES.APPROVAL_RETURNED]: 'Approval returned',
};

export { EVENT_NAMES, pretty as eventPrettyNames };