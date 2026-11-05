/* ===================== Personal Work OS — core: model, storage, operations ===================== */
const { useState, useEffect, useMemo, useRef, useCallback, useSyncExternalStore } = React;
const html = htm.bind(React.createElement);

const TYPE_LABEL = { note: 'Note', task: 'Task', project: 'Project', topic: 'Topic', resource: 'Resource', lead: 'Lead', file: 'Context file', prompt: 'Prompt', sequence: 'Sequence' };
/* Prompt Studio (Stage 5). Prompts and sequences are record types of their own; plans and reports are documents
 * (note kind "doc") with an optional category and an explicit "current master plan" mark. Sequence steps live
 * inside their sequence record, in order. Existing records get none of these fields. */
const PROMPT_STATUSES = ['Draft', 'Ready', 'In progress', 'Completed'];
const SEQ_STATUSES = ['Active', 'On hold', 'Completed'];
const STEP_STATUSES = ['Not started', 'Ready', 'In progress', 'Completed', 'Blocked'];
const PROMPT_CATEGORIES = ['Audit', 'Planning', 'Implementation', 'Testing', 'Review', 'Report', 'Research', 'Other'];
const DOC_CATEGORIES = ['Project Master Plan', 'Task Implementation Plan', 'Technical Audit', 'Research Report', 'Architecture / Structure', 'Decision Record', 'Progress Report', 'Testing / QA Report', 'Final Completion Report', 'Reference Document', 'Other'];
const TASK_STATUSES = ['Inbox', 'Next', 'In Progress', 'Waiting', 'Completed', 'Cancelled'];
const PRIORITIES = ['Urgent', 'High', 'Normal', 'Low'];
const PRI_RANK = { Urgent: 0, High: 1, Normal: 2, Low: 3 };
const PROJECT_STATUSES = ['active', 'on hold', 'completed', 'archived'];
const LEAD_STATUSES = ['New', 'Researching', 'Contacted', 'Follow-up', 'Interested', 'Won', 'Lost'];
const RES_TYPES = ['Website', 'YouTube', 'ChatGPT', 'Documentation', 'Article', 'Tutorial', 'Tool', 'Other'];
const NOTE_KINDS = { note: 'Note', idea: 'Idea', doc: 'Document' };
const MAX_DOC_BYTES = 250000;
const LOG_CAP = 300;
const LS_KEY = 'personal-work-os.records.v1';
const ID_RE = /^[A-Za-z0-9_\-.~:@+]{1,200}$/;

/* ---------- theme preference (per browser; System = follow OS / host) ---------- */
const THEME_KEY = 'personal-work-os.theme';
function readThemePref() { try { const v = localStorage.getItem(THEME_KEY); return v === 'light' || v === 'dark' ? v : 'system'; } catch (e) { return 'system'; } }
function applyTheme(t) { if (t === 'light' || t === 'dark') document.body.setAttribute('data-app-theme', t); else document.body.removeAttribute('data-app-theme'); window.__wosTheme = t; }
function saveThemePref(t) { try { if (t === 'system') localStorage.removeItem(THEME_KEY); else localStorage.setItem(THEME_KEY, t); return true; } catch (e) { return false; } }
applyTheme(readThemePref());

/* ---------- small utils ---------- */
const newId = (p = 'r') => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const nowISO = () => new Date().toISOString();
const pad = n => String(n).padStart(2, '0');
const localDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (dateStr, n) => { const d = new Date(dateStr + 'T00:00:00'); d.setDate(d.getDate() + n); return localDate(d); };
const isoToLocalInput = iso => { if (!iso) return ''; const d = new Date(iso); if (isNaN(d)) return ''; return `${localDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const localInputToIso = v => { if (!v) return null; const d = new Date(v); return isNaN(d) ? null : d.toISOString(); };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDay(dateStr) {
  if (!dateStr) return '';
  const t = localDate(); if (dateStr === t) return 'Today';
  if (dateStr === addDays(t, 1)) return 'Tomorrow';
  if (dateStr === addDays(t, -1)) return 'Yesterday';
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}` + (y !== new Date().getFullYear() ? `, ${y}` : '');
}
function fmtTime(iso) { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function fmtDateTime(iso) { if (!iso) return ''; const d = new Date(iso); if (isNaN(d)) return ''; return `${fmtDay(localDate(d))}, ${fmtTime(iso)}`; }
function relTime(iso) {
  if (!iso) return ''; const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago'; if (s < 86400 * 7) return Math.floor(s / 86400) + 'd ago';
  return fmtDay(localDate(new Date(iso)));
}
const URL_RE = /\bhttps?:\/\/[^\s<>"'`)\]]+/gi;
const findUrls = text => ((text || '').match(URL_RE) || []).map(u => u.replace(/[.,;:!?]+$/, ''));
const hostOf = url => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return url || ''; } };
const safeHref = url => /^https?:\/\//i.test(url || '') ? url : null;
const parseTags = s => [...new Set(String(s || '').split(/[,\n]/).map(t => t.trim().replace(/^#/, '')).filter(Boolean))];
function guessResType(url) {
  const h = hostOf(url).toLowerCase(), p = (url || '').toLowerCase();
  if (/youtube\.com|youtu\.be/.test(h)) return 'YouTube';
  if (/chatgpt\.com|chat\.openai\.com/.test(h)) return 'ChatGPT';
  if (/^docs\.|developer\.|devdocs|readthedocs/.test(h) || /\/docs?\//.test(p)) return 'Documentation';
  if (/medium\.com|dev\.to|substack|blog/.test(h + p)) return 'Article';
  if (/github\.com|npmjs\.com/.test(h)) return 'Tool';
  return 'Website';
}
function firstLine(text, max = 80) {
  const line = (text || '').split('\n').map(l => l.replace(URL_RE, '').trim()).find(Boolean) || '';
  return line.length > max ? line.slice(0, max - 1).trimEnd() + '…' : line;
}
function byteSize(obj) { try { return new Blob([JSON.stringify(obj)]).size; } catch (e) { return JSON.stringify(obj).length; } }
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) {
    try {
      const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok;
    } catch (e2) { return false; }
  }
}

/* ---------- record model ---------- */
function blank() {
  const t = nowISO();
  return {
    id: '', type: 'note', kind: null, title: '', body: '', bodyDoc: null, bodyDelta: null, url: '', tags: [],
    projectId: null, topicId: null, ownerId: null, parentId: null, dependsOn: null, links: [], leadId: null,
    status: null, priority: 'Normal', remindAt: null, reminderDismissed: false, dueAt: null, scheduledFor: null, completedAt: null,
    startDate: null, targetDate: null, resType: null, contactName: '', contact: '', lastContact: null, nextFollowUp: null,
    source: null, archived: false, inbox: false, sample: false, createdAt: t, updatedAt: t, log: []
  };
}
function normalize(r) {
  const out = { ...blank(), ...(r || {}) };
  out.tags = Array.isArray(out.tags) ? out.tags.filter(x => typeof x === 'string') : [];
  out.links = Array.isArray(out.links) ? [...new Set(out.links.filter(x => typeof x === 'string'))] : [];
  out.log = Array.isArray(out.log) ? out.log.filter(e => e && typeof e.at === 'string') : [];
  for (const k of ['title', 'body', 'url', 'contactName', 'contact']) if (typeof out[k] !== 'string') out[k] = out[k] == null ? '' : String(out[k]);
  if (out.type === 'task' && !TASK_STATUSES.includes(out.status)) out.status = 'Next';
  if (out.type === 'project' && !PROJECT_STATUSES.includes(out.status)) out.status = 'active';
  if (out.type === 'lead' && !LEAD_STATUSES.includes(out.status)) out.status = 'New';
  if (out.type === 'note' && !NOTE_KINDS[out.kind]) out.kind = 'note';
  if (out.type === 'resource' && !RES_TYPES.includes(out.resType)) out.resType = guessResType(out.url);
  if (out.type === 'prompt' || out.type === 'sequence') {
    if (out.type === 'prompt' && !PROMPT_STATUSES.includes(out.status)) out.status = 'Draft';
    if (out.type === 'sequence' && !SEQ_STATUSES.includes(out.status)) out.status = 'Active';
    for (const k of ['summary', 'notes', 'expected']) if (typeof out[k] !== 'string') out[k] = out[k] == null ? '' : String(out[k]);
    if (out.category != null && typeof out.category !== 'string') out.category = null;
    if (out.type === 'sequence') { out.steps = normalizeSteps(out.steps, out.id); if (out.refDocId != null && typeof out.refDocId !== 'string') out.refDocId = null; }
  }
  // documents keep these optional fields only when they already have them (older records stay byte-identical)
  if (out.type === 'note' && 'category' in out && out.category != null && typeof out.category !== 'string') out.category = null;
  if (out.type === 'note' && 'masterPlan' in out) out.masterPlan = out.masterPlan === true;
  if ('sequenceId' in out && out.sequenceId != null && typeof out.sequenceId !== 'string') out.sequenceId = null;
  if (!PRIORITIES.includes(out.priority)) out.priority = 'Normal';
  if (out.bodyDelta && !Array.isArray(out.bodyDelta.ops)) out.bodyDelta = null;
  if (out.bodyDoc && !(out.bodyDoc.type === 'doc' && Array.isArray(out.bodyDoc.content))) out.bodyDoc = null;
  if (out.bodyDoc && window.WosEditor) { try { out.body = WosEditor.docText(out.bodyDoc); } catch (e) { } }
  return out;
}
/** Steps keep their order and every field they carry; ids stay stable (a step without one gets a deterministic id). */
function normalizeSteps(steps, seqId) {
  const out = []; const seen = new Set();
  (Array.isArray(steps) ? steps : []).forEach((st, i) => {
    if (!st || typeof st !== 'object' || Array.isArray(st)) return;
    let id = typeof st.id === 'string' && st.id ? st.id : `${seqId || 'seq'}_s${i + 1}`;
    if (seen.has(id)) id = `${id}_${i + 1}`; seen.add(id);
    const step = { ...st, id, promptId: typeof st.promptId === 'string' ? st.promptId : null, status: STEP_STATUSES.includes(st.status) ? st.status : 'Not started',
      completedAt: typeof st.completedAt === 'string' ? st.completedAt : null, result: typeof st.result === 'string' ? st.result : '', notes: typeof st.notes === 'string' ? st.notes : '' };
    // Action steps (no prompt): a title and a checklist of bullet points. Prompt steps have no `kind` field at all.
    if (st.kind === 'action') {
      step.title = typeof st.title === 'string' ? st.title : '';
      step.items = (Array.isArray(st.items) ? st.items : []).filter(x => x && typeof x === 'object' && typeof x.text === 'string')
        .map((x, j) => ({ ...x, id: typeof x.id === 'string' && x.id ? x.id : `${id}_i${j + 1}`, done: x.done === true }));
    }
    out.push(step);
  });
  return out;
}
const isTask = r => r.type === 'task';
const isOpenTask = r => r.type === 'task' && !r.archived && r.status !== 'Completed' && r.status !== 'Cancelled';
const remindDay = r => r.remindAt ? localDate(new Date(r.remindAt)) : null;
const isOverdue = (r, today = localDate()) => isOpenTask(r) && !!r.dueAt && r.dueAt < today;
const isToday = (r, today = localDate()) => isOpenTask(r) && (r.dueAt === today || r.scheduledFor === today || remindDay(r) === today);
/** Any record can carry a reminder; a task's reminder ends when the task is done. */
const hasReminder = r => !!r.remindAt && !r.reminderDismissed && !r.archived && (r.type !== 'task' || isOpenTask(r));
const isReminderDue = (r, now = Date.now()) => hasReminder(r) && new Date(r.remindAt).getTime() <= now;
function isUpcoming(r, today = localDate(), days = 14) {
  if (!isOpenTask(r)) return false; const end = addDays(today, days);
  return [r.dueAt, r.scheduledFor, remindDay(r)].some(d => d && d > today && d <= end);
}
const nextDate = r => [r.dueAt, r.scheduledFor, remindDay(r)].filter(Boolean).sort()[0] || null;
function isBlocked(r, byId) { if (!r.dependsOn) return false; const d = byId.get(r.dependsOn); return !!d && isOpenTask(d); }
function sortTasks(list, by = 'smart', today = localDate()) {
  const a = [...list];
  const nd = r => nextDate(r) || '9999';
  const cmp = {
    smart: (x, y) => (isOpenTask(y) - isOpenTask(x)) || (isOverdue(y, today) - isOverdue(x, today)) || (PRI_RANK[x.priority] - PRI_RANK[y.priority]) || nd(x).localeCompare(nd(y)) || x.createdAt.localeCompare(y.createdAt),
    priority: (x, y) => (PRI_RANK[x.priority] - PRI_RANK[y.priority]) || nd(x).localeCompare(nd(y)),
    deadline: (x, y) => (x.dueAt || '9999').localeCompare(y.dueAt || '9999'),
    reminder: (x, y) => (x.remindAt || '9999').localeCompare(y.remindAt || '9999'),
    created: (x, y) => y.createdAt.localeCompare(x.createdAt),
    updated: (x, y) => y.updatedAt.localeCompare(x.updatedAt),
    completed: (x, y) => (y.completedAt || '').localeCompare(x.completedAt || ''),
    title: (x, y) => x.title.localeCompare(y.title)
  }[by] || (() => 0);
  return a.sort(cmp);
}
function topicPath(id, byId) { const names = []; let cur = byId.get(id), guard = 0; while (cur && guard++ < 50) { names.unshift(cur.title); cur = cur.parentId ? byId.get(cur.parentId) : null; } return names; }
function topicDescendants(id, recs) {
  const out = new Set([id]); let added = true;
  while (added) { added = false; for (const r of recs) if (r.type === 'topic' && r.parentId && out.has(r.parentId) && !out.has(r.id)) { out.add(r.id); added = true; } }
  return out;
}
function relatedOf(rec, recs, byId) {
  const ids = new Set(rec.links);
  for (const r of recs) {
    if (r.links.includes(rec.id)) ids.add(r.id);
    if (r.source && r.source.fromId === rec.id) ids.add(r.id);
  }
  if (rec.source && rec.source.fromId) ids.add(rec.source.fromId);
  ids.delete(rec.id);
  return [...ids].map(id => byId.get(id)).filter(Boolean);
}

/* ---------- storage ---------- */
const store = {
  mode: 'connecting', // 'db' | 'local' | 'memory'
  loaded: false, error: null, broken: false,
  snap: new Map(), overlay: new Map(), queues: new Map(), pending: 0,
  version: 0, listeners: new Set(), col: null, _all: null, _allV: -1,
  emit() { this.version++; this.listeners.forEach(f => f()); },
  all() {
    if (this._allV === this.version) return this._all;
    const m = new Map(this.snap);
    for (const [id, v] of this.overlay) { if (v === null) m.delete(id); else m.set(id, v); }
    this._all = m; this._allV = this.version; return m;
  },
  get(id) { return this.all().get(id); }
};
const notifier = { toast: () => {} };

function saveLocal() {
  if (store.mode !== 'local') return;
  localStorage.setItem(LS_KEY, JSON.stringify([...store.snap.values()]));
}
function loadLocal() {
  const raw = localStorage.getItem(LS_KEY);
  const arr = raw ? JSON.parse(raw) : [];
  const m = new Map(); (Array.isArray(arr) ? arr : []).forEach(r => { if (r && r.id) m.set(r.id, normalize(r)); });
  return m;
}
async function initStore() {
  let db = null, uid = null;
  try {
    if (window.claude && typeof window.claude.use === 'function') {
      const [d, u] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
      db = d; uid = u ? await u.id() : null;
    }
  } catch (e) { db = null; }
  if (db && uid) {
    try {
      store.col = db.doc('data/users/' + uid + '/ws').collection('records');
      store.mode = 'db';
      store.col.onSnapshot(snap => {
        const m = new Map();
        snap.docs.forEach(d => { if (d.exists) m.set(d.id, normalize({ ...d.data(), id: d.id })); });
        store.snap = m; store.loaded = true; store.emit();
      }, err => {
        store.broken = true;
        store.error = 'The connection to your saved data stopped (' + (err && err.code || 'unknown') + '). New changes will not be saved. Export a backup, then reload the page.';
        store.loaded = true; store.emit();
      });
      return;
    } catch (e) { store.error = 'Could not open saved storage: ' + (e.message || e); }
  }
  try { store.snap = loadLocal(); store.mode = 'local'; }
  catch (e) { store.mode = 'memory'; store.snap = new Map(); }
  store.loaded = true; store.emit();
}
function enqueue(id, fn) {
  const prev = store.queues.get(id) || Promise.resolve();
  const next = prev.then(fn, fn);
  store.queues.set(id, next.catch(() => {}));
  return next;
}
async function withRetry(fn) {
  try { return await fn(); } catch (e) {
    if (e && e.code === 'unavailable') { await new Promise(r => setTimeout(r, 300 + Math.random() * 500)); return fn(); }
    throw e;
  }
}
function errText(e) {
  const code = e && e.code;
  if (code === 'quota_exceeded') return 'Storage is full. Archive or delete old records, or export and remove large documents.';
  if (code === 'invalid_argument') return 'This change was refused by storage (' + (e.message || 'invalid') + ').';
  if (code === 'resource_exhausted') return 'Too many saves at once. Wait a moment and try again.';
  if (code === 'revoked' || code === 'not_granted') return 'Storage access was withdrawn for this page.';
  if (e && e.name === 'QuotaExceededError') return 'Browser storage is full. Export your data now.';
  return (e && (e.message || e.code)) || 'Unknown error';
}
/** Write one record. Resolves true only after storage confirms. */
function persist(rec) {
  if (store.broken) { notifier.toast('Not saved: storage connection is closed. Export a backup and reload.', 'bad'); return Promise.resolve(false); }
  const clean = JSON.parse(JSON.stringify(rec));
  const payload = clean.bodyDoc ? { ...clean, body: '' } : clean; // plain text is rebuilt from the document on load
  if (byteSize(payload) > MAX_DOC_BYTES) {
    notifier.toast('Not saved: "' + (rec.title || 'this record') + '" is larger than about 250 KB. Split the document into parts.', 'bad');
    return Promise.resolve(false);
  }
  store.overlay.set(rec.id, clean); store.pending++; store.emit();
  return enqueue(rec.id, async () => {
    let ok = false;
    try {
      if (store.mode === 'db') await withRetry(() => store.col.doc(rec.id).set(payload));
      else if (store.mode === 'local') { const prev = store.snap.get(rec.id); store.snap.set(rec.id, clean); try { saveLocal(); } catch (e) { if (prev) store.snap.set(rec.id, prev); else store.snap.delete(rec.id); throw e; } }
      if (store.mode !== 'local') store.snap.set(rec.id, clean);
      ok = true;
    } catch (e) { notifier.toast('Could not save this change: ' + errText(e) + ' Check the item and try again.', 'bad'); }
    finally { if (store.overlay.get(rec.id) === clean) store.overlay.delete(rec.id); store.pending--; store.emit(); }
    return ok;
  });
}
function removeDoc(id) {
  if (store.broken) { notifier.toast('Not deleted: storage connection is closed.', 'bad'); return Promise.resolve(false); }
  store.overlay.set(id, null); store.pending++; store.emit();
  return enqueue(id, async () => {
    let ok = false; const prev = store.snap.get(id);
    try {
      if (store.mode === 'db') await withRetry(() => store.col.doc(id).delete());
      store.snap.delete(id);
      if (store.mode === 'local') { try { saveLocal(); } catch (e) { if (prev) store.snap.set(id, prev); throw e; } }
      ok = true;
    } catch (e) { notifier.toast('Not deleted: ' + errText(e), 'bad'); }
    finally { if (store.overlay.get(id) === null) store.overlay.delete(id); store.pending--; store.emit(); }
    return ok;
  });
}
async function runPool(items, fn, size = 4, onProgress) {
  let i = 0, done = 0, fails = 0;
  async function worker() { while (i < items.length) { const it = items[i++]; const ok = await fn(it); if (!ok) fails++; done++; onProgress && onProgress(done, items.length); } }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
  return { done, fails };
}

/* ---------- operations ---------- */
const entry = (kind, text, extra) => ({ at: nowISO(), kind, text, ...(extra || {}) });
function withLog(rec, entries) { if (!entries.length) return rec; return { ...rec, log: [...rec.log, ...entries].slice(-LOG_CAP) }; }
function nameOf(id) { const r = id && store.get(id); return r ? r.title || 'Untitled' : null; }
function typeNoun(r) { return r.type === 'note' ? (NOTE_KINDS[r.kind] || 'Note').toLowerCase() : (TYPE_LABEL[r.type] || 'record').toLowerCase(); }

function diffLog(prev, next) {
  const out = [];
  if (prev.type !== next.type) out.push(entry('converted', `Converted from ${typeNoun(prev)} to ${typeNoun(next)}`));
  if (prev.status !== next.status && next.status) {
    if (next.type === 'task' && next.status === 'Completed') out.push(entry('completed', 'Task completed'));
    else if (next.type === 'task' && prev.status === 'Completed') out.push(entry('status', `Reopened (status ${next.status})`));
    else if (next.type === 'project') out.push(entry('project-status', `Project status: ${prev.status || '—'} → ${next.status}`));
    else if (prev.type === next.type) out.push(entry('status', `Status: ${prev.status || '—'} → ${next.status}`));
  }
  if (prev.remindAt !== next.remindAt) out.push(entry('reschedule', next.remindAt ? (prev.remindAt ? `Reminder rescheduled to ${fmtDateTime(next.remindAt)}` : `Reminder set for ${fmtDateTime(next.remindAt)}`) : 'Reminder removed'));
  if (!prev.reminderDismissed && next.reminderDismissed && prev.remindAt === next.remindAt) out.push(entry('reminder', 'Reminder dismissed'));
  if (prev.dueAt !== next.dueAt) out.push(entry('reschedule', next.dueAt ? (prev.dueAt ? `Deadline moved to ${fmtDay(next.dueAt)}` : `Deadline set: ${fmtDay(next.dueAt)}`) : 'Deadline removed'));
  if (prev.scheduledFor !== next.scheduledFor) out.push(entry('reschedule', next.scheduledFor ? `Scheduled for ${fmtDay(next.scheduledFor)}` : 'Schedule removed'));
  if (prev.priority !== next.priority && (next.type === 'task' || next.type === 'project' || next.type === 'lead')) out.push(entry('priority', `Priority: ${prev.priority} → ${next.priority}`));
  if (prev.projectId !== next.projectId) out.push(entry('moved', next.projectId ? `Assigned to project ${nameOf(next.projectId)}` : `Removed from project ${nameOf(prev.projectId) || ''}`.trim()));
  if (prev.topicId !== next.topicId) out.push(entry('moved', next.topicId ? `Assigned to topic ${nameOf(next.topicId)}` : `Removed from topic ${nameOf(prev.topicId) || ''}`.trim()));
  if (prev.parentId !== next.parentId && next.type === 'topic') out.push(entry('moved', next.parentId ? `Moved under ${nameOf(next.parentId)}` : 'Moved to top level'));
  if (prev.parentId !== next.parentId && next.type === 'task') out.push(entry('moved', next.parentId ? `Made a subtask of ${nameOf(next.parentId)}` : 'No longer a subtask'));
  if (prev.dependsOn !== next.dependsOn) out.push(entry('link', next.dependsOn ? `Now depends on ${nameOf(next.dependsOn)}` : 'Dependency removed'));
  if (prev.title !== next.title && prev.title) out.push(entry('edit', `Renamed from "${prev.title}"`));
  if (prev.archived !== next.archived) out.push(entry('status', next.archived ? 'Archived' : 'Restored from archive'));
  for (const id of next.links) if (!prev.links.includes(id)) {
    const o = store.get(id);
    out.push(entry(o && o.type === 'resource' ? 'resource' : o && o.type === 'note' ? 'note' : 'link', o && o.type === 'resource' ? `Resource attached: ${o.title}` : `Linked ${o ? typeNoun(o) : 'record'}: ${o ? o.title : id}`));
  }
  if (prev.body !== next.body || prev.url !== next.url || JSON.stringify(prev.bodyDelta) !== JSON.stringify(next.bodyDelta) || JSON.stringify(prev.bodyDoc) !== JSON.stringify(next.bodyDoc)) {
    const last = next.log[next.log.length - 1];
    const recent = last && last.kind === 'edit' && last.text === 'Content edited' && (Date.now() - new Date(last.at).getTime()) < 15 * 60 * 1000;
    if (!recent) out.push(entry('edit', 'Content edited'));
  }
  return out;
}

/** Note a new or moved record on its project/topic so their timelines are complete. */
async function noteOnContainers(rec, prev) {
  if (rec.type === 'file') return;
  const verb = rec.type === 'resource' ? 'Resource attached' : rec.type === 'note' ? `${NOTE_KINDS[rec.kind] || 'Note'} added` : rec.type === 'task' ? 'Task added' : rec.type === 'lead' ? 'Lead linked' : 'Linked';
  const kind = rec.type === 'resource' ? 'resource' : rec.type === 'note' ? 'note' : 'link';
  for (const key of ['projectId', 'topicId']) {
    const cid = rec[key];
    if (!cid || (prev && prev[key] === cid) || rec.type === 'project' || rec.type === 'topic') continue;
    const c = store.get(cid); if (!c) continue;
    await persist(withLog({ ...c }, [entry(kind, `${verb}: ${rec.title || 'Untitled'}`, { ref: rec.id })]));
  }
}
async function createRecord(partial, opts = {}) {
  const rec = normalize({ ...partial, id: partial.id || newId(partial.type ? partial.type.slice(0, 2) : 'r'), createdAt: nowISO(), updatedAt: nowISO() });
  if (rec.type === 'task' && rec.status === 'Completed' && !rec.completedAt) rec.completedAt = nowISO();
  const first = [entry('created', opts.createdText || `${TYPE_LABEL[rec.type]} created${opts.via ? ' via ' + opts.via : ''}`)];
  const r2 = withLog(rec, [...first, ...(opts.extraLog || [])]);
  const ok = await persist(r2);
  if (ok) await noteOnContainers(r2, null);
  return ok ? r2 : null;
}
async function updateRecord(id, patch, extra = []) {
  const prev = store.get(id); if (!prev) return false;
  let next = normalize({ ...prev, ...patch, id, updatedAt: nowISO() });
  if (next.type === 'task') {
    if (next.status === 'Completed' && prev.status !== 'Completed') next.completedAt = nowISO();
    if (next.status !== 'Completed' && prev.status === 'Completed') next.completedAt = null;
  }
  if (patch.remindAt !== undefined && patch.remindAt !== prev.remindAt && patch.reminderDismissed === undefined) next.reminderDismissed = false;
  next = withLog(next, [...diffLog(prev, next), ...extra]);
  const ok = await persist(next);
  if (ok) await noteOnContainers(next, prev);
  return ok;
}
async function appendLog(id, e) { const r = store.get(id); if (!r) return false; return persist(withLog({ ...r, updatedAt: nowISO() }, [e])); }
async function linkRecords(aId, bId) {
  const a = store.get(aId), b = store.get(bId); if (!a || !b || aId === bId) return false;
  if (a.links.includes(bId) || b.links.includes(aId)) return true;
  const ok = await updateRecord(aId, { links: [...a.links, bId] });
  if (ok) await appendLog(bId, entry(a.type === 'resource' ? 'resource' : 'link', `Linked ${typeNoun(a)}: ${a.title}`));
  return ok;
}
async function unlinkRecords(aId, bId) {
  const a = store.get(aId), b = store.get(bId);
  let ok = true;
  if (a && a.links.includes(bId)) ok = await persist(withLog({ ...a, links: a.links.filter(x => x !== bId), updatedAt: nowISO() }, [entry('link', `Unlinked ${b ? b.title : 'record'}`)]));
  if (b && b.links.includes(aId)) ok = (await persist(withLog({ ...b, links: b.links.filter(x => x !== aId), updatedAt: nowISO() }, [entry('link', `Unlinked ${a ? a.title : 'record'}`)]))) && ok;
  return ok;
}
/** Delete a record and clear every reference to it (nothing linked is deleted). */
async function deleteRecord(id, opts = {}) {
  const rec = store.get(id); if (!rec) return false;
  const all = [...store.all().values()];
  for (const f of all.filter(r => r.type === 'file' && r.ownerId === id)) await removeDoc(f.id);
  const label = `${TYPE_LABEL[rec.type]} "${rec.title}" was deleted`;
  for (const r of all) {
    if (r.id === id || (r.type === 'file' && r.ownerId === id)) continue;
    const patch = {}; let touched = false;
    if (r.links.includes(id)) { patch.links = r.links.filter(x => x !== id); touched = true; }
    if (r.dependsOn === id) { patch.dependsOn = null; touched = true; }
    if (r.leadId === id) { patch.leadId = null; touched = true; }
    if (r.parentId === id) { patch.parentId = rec.type === 'topic' ? (rec.parentId || null) : null; touched = true; }
    if (r.projectId === id) { patch.projectId = opts.moveTo && rec.type === 'project' ? opts.moveTo : null; touched = true; }
    if (r.topicId === id) { patch.topicId = opts.moveTo && rec.type === 'topic' ? opts.moveTo : null; touched = true; }
    if (r.source && r.source.fromId === id) { patch.source = { ...r.source, fromId: null, fromTitle: rec.title }; touched = true; }
    if (r.sequenceId === id) { patch.sequenceId = null; touched = true; }
    if (r.refDocId === id) { patch.refDocId = null; touched = true; }
    if (touched) await updateRecord(r.id, patch, [entry('link', label + '; link removed')]);
  }
  return removeDoc(id);
}
function toTaskPatch(rec) {
  const url = rec.url || findUrls(rec.body)[0] || '';
  return { type: 'task', status: 'Next', kind: null, inbox: false, url, source: { ...(rec.source || {}), url: url || (rec.source && rec.source.url) || '', convertedFrom: typeNoun(rec), convertedAt: nowISO() } };
}

/* ---------- export / import ---------- */
function exportPayload() {
  const records = [...store.all().values()];
  return { app: 'personal-work-os', schema: 1, exportedAt: nowISO(), count: records.length, records };
}
const BACKUP_APP = 'personal-work-os', BACKUP_SCHEMA = 1;
const isTs = v => typeof v === 'string' && v.length >= 10 && !isNaN(Date.parse(v));
/** Values normalize() would silently change, listed so the preview can show them. */
function importCorrections(raw, n) {
  const out = []; const show = v => v === undefined ? 'missing' : JSON.stringify(v).slice(0, 40);
  if (raw.title !== undefined && typeof raw.title !== 'string') out.push(`title ${show(raw.title)} → text`);
  if (n.type === 'task' && raw.status !== n.status) out.push(`status ${show(raw.status)} → "${n.status}"`);
  if (n.type === 'project' && raw.status !== n.status) out.push(`status ${show(raw.status)} → "${n.status}"`);
  if (n.type === 'lead' && raw.status !== n.status) out.push(`status ${show(raw.status)} → "${n.status}"`);
  if ((n.type === 'prompt' || n.type === 'sequence') && raw.status !== n.status) out.push(`status ${show(raw.status)} → "${n.status}"`);
  if (n.type === 'sequence' && JSON.stringify(raw.steps === undefined ? [] : raw.steps) !== JSON.stringify(n.steps)) out.push('sequence steps cleaned (order kept)');
  if (raw.priority !== undefined && raw.priority !== n.priority) out.push(`priority ${show(raw.priority)} → "${n.priority}"`);
  if (n.type === 'note' && raw.kind !== n.kind) out.push(`kind ${show(raw.kind)} → "${n.kind}"`);
  if (n.type === 'resource' && raw.resType !== n.resType) out.push(`resource type ${show(raw.resType)} → "${n.resType}"`);
  if (raw.tags !== undefined && JSON.stringify(raw.tags) !== JSON.stringify(n.tags)) out.push('tags list cleaned');
  if (raw.links !== undefined && JSON.stringify(raw.links) !== JSON.stringify(n.links)) out.push('links list cleaned');
  if (raw.bodyDoc && !n.bodyDoc) out.push('rich-text content was not readable and is dropped; its plain text is kept');
  if (raw.bodyDelta && !n.bodyDelta) out.push('old-format formatting was not readable and is dropped');
  if (!isTs(raw.createdAt)) out.push('created time missing; set to now');
  if (!isTs(raw.updatedAt)) out.push('updated time missing or invalid; set to now');
  return out;
}
/**
 * Checks a backup before anything is written. Rejects files that are not schema-1 Personal Work OS backups.
 * For each valid record decides what a merge would do: add it, replace an older local copy, or keep a local copy
 * that is newer, identical in time, or whose age cannot be compared (a backup copy without a valid updatedAt is
 * never assumed to be newer).
 */
function validateImport(text, existing) {
  let obj;
  try { obj = JSON.parse(text); } catch (e) { return { error: 'This is not valid JSON: ' + e.message }; }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { error: 'This is not a Personal Work OS backup. A backup is one JSON object with "app", "schema" and "records".' };
  if (obj.app !== BACKUP_APP) return { error: `This is not a Personal Work OS backup: its app is ${obj.app === undefined ? 'missing' : '"' + String(obj.app).slice(0, 40) + '"'}.` };
  if (obj.schema !== BACKUP_SCHEMA) return { error: `This backup has schema ${obj.schema === undefined ? '(missing)' : JSON.stringify(obj.schema).slice(0, 20)}. This version reads schema ${BACKUP_SCHEMA} only, so nothing can be imported from it.` };
  if (!Array.isArray(obj.records)) return { error: 'This backup has no "records" list.' };
  const valid = [], problems = [], corrections = []; const seen = new Set(); const rawTs = new Map();
  obj.records.forEach((r, i) => {
    if (!r || typeof r !== 'object' || Array.isArray(r)) return problems.push(`Item ${i + 1} is not an object`);
    if (typeof r.id !== 'string' || !ID_RE.test(r.id)) return problems.push(`Item ${i + 1} has a missing or invalid id`);
    if (!TYPE_LABEL[r.type]) return problems.push(`Item ${i + 1} (${r.id}) has an unknown type "${String(r.type).slice(0, 30)}"`);
    if (seen.has(r.id)) return problems.push(`Duplicate id ${r.id} skipped`);
    seen.add(r.id); const n = normalize(r); if (n.bodyDelta) n.bodyDelta = cleanDelta(n.bodyDelta);
    const fixes = importCorrections(r, n); if (fixes.length) corrections.push(`${r.title ? '"' + String(r.title).slice(0, 40) + '"' : r.id}: ${fixes.join('; ')}`);
    rawTs.set(r.id, isTs(r.updatedAt) ? r.updatedAt : null);
    valid.push(n);
  });
  const known = new Set([...seen, ...existing.keys()]);
  let dangling = 0;
  for (const r of valid) {
    for (const k of ['projectId', 'topicId', 'ownerId', 'parentId', 'dependsOn', 'leadId']) if (r[k] && !known.has(r[k])) { r[k] = null; dangling++; }
    const l = r.links.filter(x => known.has(x)); dangling += r.links.length - l.length; r.links = l;
  }
  const plan = new Map(); const counts = { add: 0, newer: 0, older: 0, same: 0, unknown: 0 };
  for (const r of valid) {
    const local = existing.get(r.id); let k;
    if (!local) k = 'add';
    else { const b = rawTs.get(r.id); if (!b || !isTs(local.updatedAt)) k = 'unknown'; else { const d = Date.parse(b) - Date.parse(local.updatedAt); k = d > 0 ? 'newer' : d < 0 ? 'older' : 'same'; } }
    plan.set(r.id, k); counts[k]++;
  }
  return { records: valid, plan, counts, problems, corrections, dangling, adds: counts.add, updates: counts.newer };
}
/** The records a merge writes: new ones and backup copies newer than the local copy. Local copies that are newer,
 * the same age, or of unknown age are kept unless the person explicitly allows older copies to overwrite them. */
function mergeSelection(check, allowOlder) {
  return check.records.filter(r => { const k = check.plan.get(r.id); return k === 'add' || k === 'newer' || (allowOlder && (k === 'older' || k === 'unknown')); });
}

/* ---------- sample data ---------- */
function sampleRecords() {
  const t = localDate(); const at = nowISO();
  const base = (id, o) => normalize({ ...o, id: 'sample_' + id, sample: true, createdAt: at, updatedAt: at, log: [{ at, kind: 'created', text: 'Created as sample data' }] });
  const rem = (dayOffset, h) => { const d = new Date(addDays(t, dayOffset) + 'T00:00:00'); d.setHours(h, 0, 0, 0); return d.toISOString(); };
  return [
    base('p_presence', { type: 'project', title: 'PresenceScope', body: 'Product build: monitoring a business’s online presence. Sample project.', status: 'active', priority: 'High', startDate: addDays(t, -30), targetDate: addDays(t, 45) }),
    base('p_webdev', { type: 'project', title: 'Web Development', body: 'Client websites and freelance web work.', status: 'active', priority: 'Normal', startDate: addDays(t, -90) }),
    base('p_personal', { type: 'project', title: 'Personal Projects', body: 'Side projects and small tools.', status: 'on hold', priority: 'Low' }),
    base('p_learning', { type: 'project', title: 'Learning & Experiments', body: 'Courses, tutorials and experiments.', status: 'active', priority: 'Normal' }),
    base('t_n8n', { type: 'topic', title: 'n8n', body: 'Workflow automation with n8n.' }),
    base('t_n8n_fund', { type: 'topic', title: 'Fundamentals', parentId: 'sample_t_n8n' }),
    base('t_n8n_wf', { type: 'topic', title: 'Workflows', parentId: 'sample_t_n8n' }),
    base('t_n8n_ai', { type: 'topic', title: 'AI Automation', parentId: 'sample_t_n8n' }),
    base('t_ai', { type: 'topic', title: 'Artificial Intelligence' }),
    base('t_fe', { type: 'topic', title: 'Front-end Development' }),
    base('t_next', { type: 'topic', title: 'Next.js', parentId: 'sample_t_fe' }),
    base('t_mkt', { type: 'topic', title: 'Marketing' }),
    base('t_ideas', { type: 'topic', title: 'Product Ideas' }),
    base('k_scope', { type: 'task', title: 'Define PresenceScope MVP scope', body: 'List the five checks the first version must run.', status: 'In Progress', priority: 'Urgent', projectId: 'sample_p_presence', dueAt: t, remindAt: rem(0, 17) }),
    base('k_landing', { type: 'task', title: 'Draft PresenceScope landing page copy', status: 'Next', priority: 'High', projectId: 'sample_p_presence', dependsOn: 'sample_k_scope', dueAt: addDays(t, 4) }),
    base('k_invoice', { type: 'task', title: 'Send invoice for last client site', status: 'Next', priority: 'High', projectId: 'sample_p_webdev', dueAt: addDays(t, -2) }),
    base('k_webhook', { type: 'task', title: 'Build an n8n webhook → Sheets workflow', status: 'Next', priority: 'Normal', projectId: 'sample_p_learning', topicId: 'sample_t_n8n_wf', scheduledFor: addDays(t, 1), remindAt: rem(1, 10) }),
    base('k_feedback', { type: 'task', title: 'Wait for designer feedback on logo', status: 'Waiting', priority: 'Normal', projectId: 'sample_p_presence' }),
    base('n_n8n', { type: 'note', kind: 'note', title: 'n8n: credentials and environment variables', body: 'Keep credentials in n8n’s credential store, never in node parameters.\n\n- Use environment variables for base URLs\n- Export workflows as JSON before upgrading', topicId: 'sample_t_n8n_fund', tags: ['automation'] }),
    base('n_idea', { type: 'note', kind: 'idea', title: 'Weekly presence report emailed to clients', body: 'Could reuse PresenceScope checks to send a short weekly report to web clients.', projectId: 'sample_p_presence', topicId: 'sample_t_ideas' }),
    base('r_yt', { type: 'resource', title: 'n8n beginner course (YouTube)', url: 'https://www.youtube.com/@n8n-io', resType: 'YouTube', topicId: 'sample_t_n8n', tags: ['course'] }),
    base('r_docs', { type: 'resource', title: 'Next.js documentation', url: 'https://nextjs.org/docs', resType: 'Documentation', topicId: 'sample_t_next' }),
    base('l_bakery', { type: 'lead', title: 'Corner Bakery (example lead)', url: 'https://example.com', contactName: 'Owner', status: 'Researching', priority: 'Normal', body: 'Site is not mobile friendly. Possible redesign.', nextFollowUp: addDays(t, 3) })
  ];
}
