const BASE = import.meta.env.VITE_API_URL || '/api';

async function request(path, { method = 'GET', body, headers } = {}) {
  const opts = {
    method,
    headers: { ...headers },
    credentials: 'include',
  };
  if (body !== undefined) {
    if (body instanceof FormData) {
      opts.body = body;
    } else {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
  }

  const res = await fetch(`${BASE}${path}`, opts);
  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  base: BASE,
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  del: (path) => request(path, { method: 'DELETE' }),

  auth: {
    login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
    logout: () => request('/auth/logout', { method: 'POST' }),
    me: () => request('/auth/me'),
  },
  files: {
    list: (params = {}) => {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v && v !== 'ALL') qs.set(k, v);
      });
      const q = qs.toString();
      return request(`/files${q ? `?${q}` : ''}`);
    },
    get: (id) => request(`/files/${id}`),
    getNoteThread: (id, noteId) => request(`/files/${id}/notes/${noteId}`),
    create: (payload) => {
      const fd = new FormData();
      Object.entries(payload).forEach(([k, v]) => {
        if (v === undefined || v === null) return;
        if (k === 'attachments' && Array.isArray(v)) {
          for (const f of v) fd.append('attachments', f);
        } else if (Array.isArray(v)) {
          fd.append(k, JSON.stringify(v));
        } else {
          fd.append(k, v);
        }
      });
      return request('/files', { method: 'POST', body: fd });
    },
    update: (id, payload) => request(`/files/${id}`, { method: 'PATCH', body: payload }),
    remove: (id) => request(`/files/${id}`, { method: 'DELETE' }),
    addNote: (id, { content, sentTo, attachments }) => {
      const fd = new FormData();
      fd.append('content', content);
      fd.append('sentTo', sentTo || '');
      if (attachments) {
        for (const file of attachments) fd.append('attachments', file);
      }
      return request(`/files/${id}/notes`, { method: 'POST', body: fd });
    },
    replyToNote: (id, noteId, { content, sentTo, attachments }) => {
      const fd = new FormData();
      fd.append('content', content);
      fd.append('sentTo', sentTo || '');
      if (attachments) {
        for (const file of attachments) fd.append('attachments', file);
      }
      return request(`/files/${id}/notes/${noteId}/replies`, { method: 'POST', body: fd });
    },
    decide: (id, { decision, approvalId, comments }) =>
      request(`/files/${id}/approvals`, { method: 'POST', body: { decision, approvalId, comments } }),
  },
  audit: {
    list: (params = {}) => {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v && v !== 'ALL') qs.set(k, v);
      });
      const q = qs.toString();
      return request(`/audit${q ? `?${q}` : ''}`);
    },
  },
  meta: {
    departments: () => request('/departments'),
    users: () => request('/users'),
  },
  admin: {
    directory: () => request('/admin/directory'),
    createDepartment: (body) => request('/admin/departments', { method: 'POST', body }),
    createUser: (body) => request('/admin/users', { method: 'POST', body }),
    updateUser: (id, body) => request(`/admin/users/${id}`, { method: 'PATCH', body }),
  },
};

export function attachmentUrl(relPath) {
  if (!relPath) return null;
  if (relPath.startsWith('http')) return relPath;
  const origin = api.base.replace(/\/api\/?$/, '');
  return `${origin}${relPath.startsWith('/') ? relPath : `/${relPath}`}`;
}

export async function fetchAttachment(relPath) {
  const url = attachmentUrl(relPath);
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) {
    let message = `Could not open file (${res.status})`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      /* body may not be JSON */
    }
    throw new Error(message);
  }
  return res;
}