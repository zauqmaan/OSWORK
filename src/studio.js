/* ===================== Prompt Studio (Stage 5) =====================
 * Prompts and sequences are records of their own (types "prompt" and "sequence"); plans and reports are documents
 * (note kind "doc") with an optional category and an explicit "current master plan" mark. A sequence keeps its
 * ordered steps inside its own record: { id, promptId, status, completedAt, result, notes }.
 * Every write goes through act.update / act.create (persist with retry and failure reporting). A step is shown as
 * completed only once storage has confirmed it (store.snap), never optimistically.
 */
const isDoc = r => r.type === 'note' && r.kind === 'doc' ;
const live = r => !r.archived;
function seqStats(seq) {
  const steps = (seq && Array.isArray(seq.steps)) ? seq.steps : [];
  const done = steps.filter(s => s.status === 'Completed').length;
  const nextIdx = steps.findIndex(s => s.status !== 'Completed');
  return { total: steps.length, done, pct: steps.length ? Math.round(done / steps.length * 100) : 0, nextIdx, next: nextIdx >= 0 ? steps[nextIdx] : null };
}
/* Action steps carry their own title and a checklist of bullet points instead of a prompt (open a folder, clone a
 * repo, message a client). Prompt steps have no `kind`. */
const isAction = st => !!st && st.kind === 'action';
function stepLabel(st, byId) { if (!st) return ''; if (isAction(st)) return st.title || 'Untitled step'; const p = st.promptId && byId.get(st.promptId); return p ? p.title : 'missing prompt'; }
/** Bullet text (one per line, "-", "*", "•" or "1." prefixes removed) → items, keeping the id and tick of unchanged lines. */
function linesToItems(text, old = []) {
  const pool = [...old];
  return text.split('\n').map(l => l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trimEnd()).filter(l => l.trim()).map(t => {
    const i = pool.findIndex(o => o.text === t); const keep = i >= 0 ? pool.splice(i, 1)[0] : null;
    return { id: keep ? keep.id : newId('it'), text: t, done: keep ? keep.done : false };
  });
}
const itemsText = items => (items || []).map(x => '- ' + x.text).join('\n');
/** promptId → [{ seq, n }] (n = 1-based step number) for live sequences. */
function promptUse(recs) {
  const m = new Map();
  for (const q of recs) if (q.type === 'sequence' && !q.archived) q.steps.forEach((st, i) => { if (!st.promptId) return; if (!m.has(st.promptId)) m.set(st.promptId, []); m.get(st.promptId).push({ seq: q, n: i + 1 }); });
  return m;
}
/** Rewrites a sequence's steps from its latest stored state, so concurrent step edits build on each other. */
async function saveSteps(seqId, fn, log) {
  const s = store.get(seqId); if (!s) return false;
  const steps = fn(s.steps.map(x => ({ ...x }))); if (!steps) return false;
  return updateRecord(seqId, { steps }, log || []);
}

/* ---------- copying ---------- */
/** Markdown for a rich-text document, so a copied report keeps its headings, lists, tables and code blocks. */
function docToMarkdown(doc) {
  if (!doc || !Array.isArray(doc.content)) return '';
  const inl = nodes => (nodes || []).map(n => {
    if (n.type === 'text') {
      let t = n.text || ''; const marks = n.marks || []; const has = k => marks.some(m => m.type === k);
      if (has('code')) t = '`' + t + '`'; if (has('bold')) t = '**' + t + '**'; if (has('italic')) t = '*' + t + '*'; if (has('strike')) t = '~~' + t + '~~';
      const link = marks.find(m => m.type === 'link'); if (link && link.attrs && link.attrs.href) t = '[' + t + '](' + link.attrs.href + ')';
      return t;
    }
    if (n.type === 'hardBreak') return '\n';
    if (n.type === 'pageLink') { const r = n.attrs && store.get(n.attrs.id); return (r && r.title) || (n.attrs && n.attrs.title) || ''; }
    return inl(n.content);
  }).join('');
  const item = (li, ind, mark) => {
    const kids = li.content || []; const first = kids[0] && kids[0].type === 'paragraph' ? inl(kids[0].content) : '';
    const rest = kids.slice(first !== '' || (kids[0] && kids[0].type === 'paragraph') ? 1 : 0).map(c => block(c, ind + '  ')).filter(Boolean).map(t => t.split('\n').map(l => (l.startsWith(ind + '  ') ? l : ind + '  ' + l)).join('\n'));
    return [ind + mark + first, ...rest].join('\n');
  };
  const block = (n, ind = '') => {
    const c = n.content || [];
    switch (n.type) {
      case 'heading': return '#'.repeat(Math.min(6, (n.attrs && n.attrs.level) || 1)) + ' ' + inl(c);
      case 'paragraph': return inl(c);
      case 'codeBlock': return '```' + ((n.attrs && n.attrs.language) || '') + '\n' + c.map(t => t.text || '').join('') + '\n```';
      case 'bulletList': return c.map(li => item(li, ind, '- ')).join('\n');
      case 'orderedList': { let i = (n.attrs && n.attrs.start) || 1; return c.map(li => item(li, ind, (i++) + '. ')).join('\n'); }
      case 'taskList': return c.map(li => item(li, ind, '- [' + (li.attrs && li.attrs.checked ? 'x' : ' ') + '] ')).join('\n');
      case 'blockquote': return c.map(x => block(x)).join('\n\n').split('\n').map(l => '> ' + l).join('\n');
      case 'horizontalRule': return '---';
      case 'image': return n.attrs && n.attrs.src ? `![${(n.attrs.alt || '')}](${n.attrs.src})` : '';
      case 'table': {
        const rows = c.map(row => '| ' + (row.content || []).map(cell => (cell.content || []).map(x => block(x)).join(' ').replace(/\n/g, ' ').replace(/\|/g, '\\|')).join(' | ') + ' |');
        if (!rows.length) return '';
        const cols = ((c[0] && c[0].content) || []).length; rows.splice(1, 0, '| ' + Array(cols).fill('---').join(' | ') + ' |'); return rows.join('\n');
      }
      default: return c.map(x => block(x, ind)).filter(Boolean).join('\n\n');
    }
  };
  return doc.content.map(n => block(n)).filter(s => s !== '').join('\n\n');
}
const docCopyText = r => (r.bodyDoc ? docToMarkdown(r.bodyDoc) : r.body) || '';
/** Copy with visible feedback. When the browser blocks the clipboard, the full text is shown selected to copy by hand. */
function useCopy() {
  const { toast } = useApp(); const [fallback, setFallback] = useState(null);
  const copy = async (text, what = 'Prompt') => {
    if (!text) { toast(`${what} has no text yet.`, 'bad'); return false; }
    const ok = await copyText(text);
    if (ok) toast(`${what} copied · ${text.length.toLocaleString()} characters`); else setFallback({ text, what });
    return ok;
  };
  const modal = fallback ? html`<${Modal} title=${'Copy ' + fallback.what.toLowerCase()} onClose=${() => setFallback(null)} small>
    <div className="modal-bd"><div className="banner warn small" role="alert">Your browser blocked automatic copying. The full text is selected below: press Ctrl+C (or ⌘C on a Mac).</div>
      <textarea className="ta mono copy-fallback" id="copy-fallback" readOnly rows="12" value=${fallback.text} ref=${el => { if (el && document.activeElement !== el) { el.focus(); el.select(); } }}></textarea></div>
    <div className="modal-ft"><button className="btn" onClick=${() => setFallback(null)}>Done</button></div><//>` : null;
  return [copy, modal];
}

/* ---------- plain-text field with autosave, retry and the close/leave guard ---------- */
function AutoText({ id, value, onSave, rows = 6, placeholder, mono, label }) {
  const [v, setV] = useState(value || ''); const [state, setState] = useState('');
  const cur = useRef(value || ''); const saved = useRef(value || ''); const focused = useRef(false); const timer = useRef(null); const inflight = useRef(null);
  useEffect(() => { saved.current = value || ''; if (!focused.current && !inflight.current) { setV(value || ''); cur.current = value || ''; } }, [value]);
  const dirty = () => cur.current !== saved.current;
  const commit = () => {
    clearTimeout(timer.current);
    if (inflight.current) return inflight.current.then(ok => ok && dirty() ? commit() : ok);
    const val = cur.current; if (val === saved.current) return Promise.resolve(true);
    const prev = saved.current; saved.current = val; setState('saving');
    let r; try { r = onSave(val); } catch (e) { r = false; }
    inflight.current = Promise.resolve(r).then(ok => { inflight.current = null; if (ok === false) { saved.current = prev; setState('failed'); return false; } setState('saved'); return dirty() ? commit() : true; },
      () => { inflight.current = null; saved.current = prev; setState('failed'); return false; });
    return inflight.current;
  };
  usePendingEdit(dirty, commit);
  useEffect(() => () => { clearTimeout(timer.current); if (dirty()) commit(); }, []);
  return html`<div className="autotext">
    <textarea id=${id} className=${'ta' + (mono ? ' mono' : '') + (state === 'failed' ? ' invalid' : '')} rows=${rows} placeholder=${placeholder} aria-label=${label || null} value=${v}
      onFocus=${() => { focused.current = true; }} onBlur=${() => { focused.current = false; commit(); }}
      onChange=${e => { setV(e.target.value); cur.current = e.target.value; if (state !== 'failed') setState('typing'); clearTimeout(timer.current); timer.current = setTimeout(commit, 900); }}></textarea>
    ${state === 'failed' ? html`<div className="banner bad small autosave-err" role="alert"><span className="grow">Not saved. Your text is kept here.</span><button className="btn sm" onClick=${() => commit()}>Retry</button></div>`
      : html`<div className="autosave small muted" aria-live="polite">${state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : state === 'typing' ? 'Saves when you pause' : ''}</div>`}
  </div>`;
}

/* ---------- small pieces ---------- */
const STEP_CLASS = { 'Not started': 'todo', Ready: 'ready', 'In progress': 'doing', Completed: 'done', Blocked: 'blocked' };
function StatusPill({ s, kind = 'prompt' }) {
  const cls = kind === 'step' ? STEP_CLASS[s] || 'todo' : ({ Draft: 'todo', Ready: 'ready', 'In progress': 'doing', Completed: 'done', Active: 'doing', 'On hold': 'blocked' })[s] || 'todo';
  return html`<span className=${'spill s-' + cls}><span className="dot" aria-hidden="true"></span>${s}</span>`;
}
function SeqProgress({ seq }) {
  const st = seqStats(seq);
  return st.total ? html`<span className="progress" title=${`${st.done} of ${st.total} steps completed`}><span className="progress-track"><span className="progress-fill" style=${{ width: st.pct + '%' }}></span></span><span className="progress-txt">${st.done} of ${st.total} · ${st.pct}%</span></span>` : html`<span className="muted">No steps yet</span>`;
}
function SeqSelect({ value, onChange, className = 'sel', noneLabel = 'No sequence', id, label }) {
  const { recs } = useApp(); const seqs = recs.filter(r => r.type === 'sequence' && !r.archived).sort((a, b) => a.title.localeCompare(b.title));
  return html`<select id=${id} className=${className} aria-label=${label || 'Sequence'} value=${value || ''} onChange=${e => onChange(e.target.value || null)}><option value="">${noneLabel}</option>${seqs.map(q => html`<option key=${q.id} value=${q.id}>${q.title}</option>`)}</select>`;
}
function DocSelect({ value, onChange, projectId, className = 'sel', id }) {
  const { recs } = useApp(); const docs = recs.filter(r => isDoc(r) && !r.archived).sort((a, b) => (b.projectId === projectId) - (a.projectId === projectId) || a.title.localeCompare(b.title));
  return html`<select id=${id} className=${className} aria-label="Master plan or reference document" value=${value || ''} onChange=${e => onChange(e.target.value || null)}><option value="">No reference document</option>${docs.map(d => html`<option key=${d.id} value=${d.id}>${d.title}${d.masterPlan ? ' (master plan)' : ''}</option>`)}</select>`;
}
function ArchivedLink({ r }) { return r && r.archived ? html`<span className="chip" title="Archived">archived</span>` : null; }

/* ---------- create dialogs ---------- */
function NewPromptModal({ preset = {}, onClose, onCreated }) {
  const { act, toast } = useApp();
  const [f, setF] = useState({ title: '', summary: '', body: '', projectId: preset.projectId || null, seqId: preset.seqId || null, category: '', tags: '', status: 'Draft', notes: '', expected: '' });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const set = (k, v) => setF(o => ({ ...o, [k]: v }));
  const save = async () => {
    if (!f.title.trim()) { setErr('Give the prompt a title.'); return; }
    setBusy(true); setErr('');
    const rec = await act.create({ type: 'prompt', title: f.title.trim(), summary: f.summary.trim(), body: f.body, projectId: f.projectId, category: f.category || null, tags: parseTags(f.tags), status: f.status, notes: f.notes, expected: f.expected }, 'Prompt Studio');
    if (!rec) { setBusy(false); setErr('Not saved. Your text is kept here; try again.'); return; }
    if (f.seqId) {
      const ok = await saveSteps(f.seqId, steps => [...steps, { id: newId('st'), promptId: rec.id, status: 'Not started', completedAt: null, result: '', notes: '' }], [entry('link', `Step added: ${rec.title}`)]);
      if (!ok) toast('The prompt was saved, but adding it to the sequence failed. Add it from the sequence page.', 'bad');
    }
    setBusy(false); toast('Prompt saved'); onCreated ? onCreated(rec) : onClose();
  };
  return html`<${Modal} title=${preset.seqId ? 'Create a prompt for this step' : 'Save a prompt'} onClose=${onClose} wide>
    <div className="modal-bd ps-form">
      <label className="field"><span>Title</span><input id="np-title" className="inp" value=${f.title} onChange=${e => set('title', e.target.value)} autoFocus placeholder="e.g. Audit the existing project" /></label>
      <label className="field"><span>Purpose</span><input id="np-summary" className="inp" value=${f.summary} onChange=${e => set('summary', e.target.value)} placeholder="One line: what this prompt is for" /></label>
      <label className="field"><span>Prompt</span><textarea id="np-body" className="ta mono" rows="12" value=${f.body} onChange=${e => set('body', e.target.value)} placeholder="Paste or write the full prompt. Line breaks, lists and code are kept exactly as typed."></textarea></label>
      <div className="grid3">
        <label className="field"><span>Project</span><${ProjectSelect} id="np-project" value=${f.projectId} onChange=${v => set('projectId', v)} /></label>
        <label className="field"><span>Add to sequence</span><${SeqSelect} id="np-seq" value=${f.seqId} onChange=${v => set('seqId', v)} noneLabel="Not in a sequence" /></label>
        <label className="field"><span>Status</span><select id="np-status" className="sel" value=${f.status} onChange=${e => set('status', e.target.value)}>${PROMPT_STATUSES.map(s => html`<option key=${s}>${s}</option>`)}</select></label>
      </div>
      <div className="grid2">
        <label className="field"><span>Category</span><select id="np-category" className="sel" value=${f.category} onChange=${e => set('category', e.target.value)}><option value="">No category</option>${PROMPT_CATEGORIES.map(c => html`<option key=${c}>${c}</option>`)}</select></label>
        <label className="field"><span>Tags</span><input id="np-tags" className="inp" value=${f.tags} onChange=${e => set('tags', e.target.value)} placeholder="comma separated" /></label>
      </div>
      <label className="field"><span>Usage notes</span><textarea id="np-notes" className="ta" rows="3" value=${f.notes} onChange=${e => set('notes', e.target.value)} placeholder="When and how to use it"></textarea></label>
      <label className="field"><span>Expected output or done when</span><textarea id="np-expected" className="ta" rows="2" value=${f.expected} onChange=${e => set('expected', e.target.value)}></textarea></label>
      ${err ? html`<div className="banner bad small" role="alert" id="np-error">${err}</div>` : null}
    </div>
    <div className="modal-ft"><button className="btn ghost" onClick=${onClose}>Cancel</button><button className="btn primary" id="np-save" disabled=${busy} onClick=${save}>${busy ? 'Saving…' : 'Save prompt'}</button></div>
  <//>`;
}
function NewSequenceModal({ preset = {}, onClose }) {
  const { act, toast, setView } = useApp();
  const [f, setF] = useState({ title: '', summary: '', projectId: preset.projectId || null, refDocId: null, tags: '', status: 'Active' });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const set = (k, v) => setF(o => ({ ...o, [k]: v }));
  const save = async () => {
    if (!f.title.trim()) { setErr('Give the sequence a name.'); return; }
    setBusy(true); setErr('');
    const rec = await act.create({ type: 'sequence', title: f.title.trim(), summary: f.summary.trim(), projectId: f.projectId, refDocId: f.refDocId, tags: parseTags(f.tags), status: f.status, steps: [] }, 'Prompt Studio');
    setBusy(false);
    if (!rec) { setErr('Not saved. Your entries are kept here; try again.'); return; }
    toast('Sequence created. Now add its prompts.'); onClose(); setView({ name: 'studio', tab: 'sequences', id: rec.id });
  };
  return html`<${Modal} title="Create a prompt sequence" onClose=${onClose}>
    <div className="modal-bd ps-form">
      <label className="field"><span>Name</span><input id="ns-title" className="inp" value=${f.title} onChange=${e => set('title', e.target.value)} autoFocus placeholder="e.g. Implement a new feature" /></label>
      <label className="field"><span>Objective</span><textarea id="ns-summary" className="ta" rows="3" value=${f.summary} onChange=${e => set('summary', e.target.value)} placeholder="What this sequence should achieve"></textarea></label>
      <div className="grid2">
        <label className="field"><span>Project</span><${ProjectSelect} id="ns-project" value=${f.projectId} onChange=${v => set('projectId', v)} /></label>
        <label className="field"><span>Master plan or reference</span><${DocSelect} id="ns-doc" value=${f.refDocId} projectId=${f.projectId} onChange=${v => set('refDocId', v)} /></label>
      </div>
      <label className="field"><span>Tags</span><input id="ns-tags" className="inp" value=${f.tags} onChange=${e => set('tags', e.target.value)} placeholder="comma separated" /></label>
      ${err ? html`<div className="banner bad small" role="alert">${err}</div>` : null}
    </div>
    <div className="modal-ft"><button className="btn ghost" onClick=${onClose}>Cancel</button><button className="btn primary" id="ns-save" disabled=${busy} onClick=${save}>${busy ? 'Saving…' : 'Create sequence'}</button></div>
  <//>`;
}
function NewDocModal({ preset = {}, onClose }) {
  const { act, toast, openRecord } = useApp();
  const [f, setF] = useState({ title: '', category: preset.category || 'Task Implementation Plan', summary: '', projectId: preset.projectId || null, sequenceId: preset.sequenceId || null });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const set = (k, v) => setF(o => ({ ...o, [k]: v }));
  const save = async () => {
    if (!f.title.trim()) { setErr('Give the document a title.'); return; }
    setBusy(true); setErr('');
    const rec = await act.create({ type: 'note', kind: 'doc', title: f.title.trim(), category: f.category, summary: f.summary.trim(), projectId: f.projectId, sequenceId: f.sequenceId, inbox: false }, 'Plans & Reports');
    setBusy(false);
    if (!rec) { setErr('Not saved. Your entries are kept here; try again.'); return; }
    toast('Document created. Write or paste its content.'); onClose(); openRecord(rec.id);
  };
  return html`<${Modal} title="New plan or report" onClose=${onClose}>
    <div className="modal-bd ps-form">
      <label className="field"><span>Title</span><input id="nd-title" className="inp" value=${f.title} onChange=${e => set('title', e.target.value)} autoFocus /></label>
      <div className="grid2">
        <label className="field"><span>Category</span><select id="nd-category" className="sel" value=${f.category} onChange=${e => set('category', e.target.value)}>${DOC_CATEGORIES.map(c => html`<option key=${c}>${c}</option>`)}</select></label>
        <label className="field"><span>Project</span><${ProjectSelect} id="nd-project" value=${f.projectId} onChange=${v => set('projectId', v)} /></label>
      </div>
      <label className="field"><span>Summary</span><input id="nd-summary" className="inp" value=${f.summary} onChange=${e => set('summary', e.target.value)} placeholder="One or two lines shown on the card" /></label>
      <label className="field"><span>Related sequence</span><${SeqSelect} id="nd-seq" value=${f.sequenceId} onChange=${v => set('sequenceId', v)} /></label>
      ${err ? html`<div className="banner bad small" role="alert">${err}</div>` : null}
    </div>
    <div className="modal-ft"><button className="btn ghost" onClick=${onClose}>Cancel</button><button className="btn primary" id="nd-save" disabled=${busy} onClick=${save}>${busy ? 'Saving…' : 'Create document'}</button></div>
  <//>`;
}

/* ---------- prompt card + detail ---------- */
function PromptCard({ p, use, terms, copy }) {
  const { openRecord, byId, act, toast } = useApp();
  const proj = p.projectId && byId.get(p.projectId);
  const ex = excerpt(p.summary || p.body, terms, 150);
  return html`<article className="card ps-card" data-id=${p.id} data-type="prompt">
    <div className="ps-card-hd"><${StatusPill} s=${p.status} />${p.category ? html`<span className="tlabel">${p.category}</span>` : null}<span className="grow"></span><span className="small muted" title=${new Date(p.updatedAt).toLocaleString()}>${relTime(p.updatedAt)}</span></div>
    <h3><button type="button" className="linklike ps-title" onClick=${() => openRecord(p.id)}>${highlight(p.title || 'Untitled prompt', terms)}</button></h3>
    ${ex ? html`<p className="desc">${highlight(ex, terms)}</p>` : html`<p className="desc muted">No text yet.</p>`}
    <div className="row-meta">
      ${proj ? html`<span className="ctxl-static"><${Icon} name="projects" size=${12} />${proj.title}</span>` : null}
      ${(use || []).slice(0, 2).map(u => html`<span key=${u.seq.id} className="seqref"><${Icon} name="steps" size=${12} />${u.seq.title} · Step ${u.n}</span>`)}
      ${(use || []).length > 2 ? html`<span className="muted">+${use.length - 2}</span>` : null}
      <${QuietTags} tags=${p.tags} /><${SampleMark} r=${p} />
    </div>
    <div className="ps-card-ft">
      <button className="btn sm primary ps-copy" onClick=${() => copy(p.body)} aria-label=${'Copy prompt: ' + p.title}><${Icon} name="copy" size=${14} /> Copy prompt</button>
      <button className="btn sm" onClick=${() => openRecord(p.id)}>Open</button>
      <span className="grow"></span>
      <button className="btn sm ghost" onClick=${async () => { if (await act.update(p.id, { archived: true })) toast('Prompt archived. Restore it from Archived.'); }}>Archive</button>
    </div>
  </article>`;
}
function PromptDetail({ rec }) {
  const { act, recs, setView } = useApp(); const [copy, copyModal] = useCopy();
  const use = promptUse(recs).get(rec.id) || [];
  const docs = recs.filter(r => isDoc(r) && !r.archived && (r.links.includes(rec.id) || rec.links.includes(r.id) || use.some(u => u.seq.refDocId === r.id || r.sequenceId === u.seq.id)));
  const lines = rec.body ? rec.body.split('\n').length : 0;
  return html`<div className="stack" style=${{ gap: '18px' }}>
    <div className="ps-copybar"><button className="btn primary" id="prompt-copy" onClick=${() => copy(rec.body)}><${Icon} name="copy" size=${15} /> Copy prompt</button>
      <span className="small muted">${rec.body.length.toLocaleString()} characters · ${lines} line${lines === 1 ? '' : 's'}. Copying does not change the prompt or its status.</span></div>
    <div className="grid3">
      <label className="field"><span>Status</span><select id="prompt-status" className="sel" value=${rec.status} onChange=${e => act.update(rec.id, { status: e.target.value })}>${PROMPT_STATUSES.map(s => html`<option key=${s}>${s}</option>`)}</select></label>
      <label className="field"><span>Category</span><select className="sel" id="prompt-category" value=${rec.category || ''} onChange=${e => act.update(rec.id, { category: e.target.value || null })}><option value="">No category</option>${PROMPT_CATEGORIES.map(c => html`<option key=${c}>${c}</option>`)}${rec.category && !PROMPT_CATEGORIES.includes(rec.category) ? html`<option>${rec.category}</option>` : null}</select></label>
      <label className="field"><span>Project</span><${ProjectSelect} id="f-project" value=${rec.projectId} onChange=${v => act.update(rec.id, { projectId: v })} /></label>
    </div>
    <label className="field"><span>Purpose</span><${EditText} id="prompt-summary" value=${rec.summary} placeholder="One line: what this prompt is for" onSave=${v => act.update(rec.id, { summary: v.trim() })} /></label>
    <div className="field"><span>Prompt</span><${AutoText} id="prompt-body" mono rows=${16} label="Prompt text" value=${rec.body} placeholder="The full prompt. Saved exactly as typed." onSave=${v => act.update(rec.id, { body: v })} /></div>
    <div className="field"><span>Usage notes</span><${AutoText} id="prompt-notes" rows=${3} label="Usage notes" value=${rec.notes} onSave=${v => act.update(rec.id, { notes: v })} /></div>
    <div className="field"><span>Expected output or done when</span><${AutoText} id="prompt-expected" rows=${2} label="Expected output" value=${rec.expected} onSave=${v => act.update(rec.id, { expected: v })} /></div>
    <div><div className="sub-hd">Used in sequences</div>${use.length ? html`<div className="list">${use.map(u => html`<div key=${u.seq.id + u.n} className="row click" onClick=${() => setView({ name: 'studio', tab: 'sequences', id: u.seq.id })}><${TypeIcon} r=${u.seq} tile /><div className="row-main"><div className="row-title">${u.seq.title}</div><div className="row-meta"><span>Step ${u.n}: <${StatusPill} s=${u.seq.steps[u.n - 1].status} kind="step" /></span><${SeqProgress} seq=${u.seq} /></div></div></div>`)}</div>
      ${use.length > 1 ? html`<div className="small muted" style=${{ marginTop: '4px' }}>Edits to this prompt's text show in all ${use.length} places; each sequence keeps its own step progress.</div>` : null}` : html`<div className="small muted">Not used in a sequence. Add it from a sequence page.</div>`}</div>
    ${docs.length ? html`<div><div className="sub-hd">Related plans and reports</div><div className="list">${docs.map(d => html`<${RecordRow} key=${d.id} r=${d} />`)}</div></div>` : null}
    <${Related} rec=${rec} />
    <div><div className="sub-hd">Tags</div><${TagEditor} tags=${rec.tags} onSave=${tags => act.update(rec.id, { tags })} /></div>
    <${DatesBlock} rec=${rec} />
    <${History} rec=${rec} />
    ${copyModal}
  </div>`;
}

/* ---------- Prompt Library ---------- */
function PromptLibrary() {
  const { recs, projects } = useApp(); const [copy, copyModal] = useCopy();
  const [f, setF] = useState({ q: '', project: '', status: '', seq: '', tag: '', category: '', sort: 'updated' }); const [creating, setCreating] = useState(false);
  const set = (k, v) => setF(o => ({ ...o, [k]: v }));
  const use = useMemo(() => promptUse(recs), [recs]);
  const all = recs.filter(r => r.type === 'prompt' && !r.archived);
  const terms = f.q.toLowerCase().split(/\s+/).map(t => t.replace(/^#(?=.)/, '')).filter(Boolean);
  const byId = useMemo(() => new Map(recs.map(r => [r.id, r])), [recs]); const sIdx = useMemo(() => promptSeqIndex(recs), [recs]);
  let list = all.filter(p => (!f.project || (f.project === '__none' ? !p.projectId : p.projectId === f.project)) && (!f.status || p.status === f.status) && (!f.category || p.category === f.category) &&
    (!f.tag || p.tags.includes(f.tag)) && (!f.seq || (use.get(p.id) || []).some(u => u.seq.id === f.seq)));
  if (terms.length) list = list.filter(p => { const h = buildHaystack(p, byId, sIdx); const a = [h.title, h.tags, h.rel, h.body].join(' '); return terms.every(t => a.includes(t)); });
  const cmp = { updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt), title: (a, b) => a.title.localeCompare(b.title), status: (a, b) => PROMPT_STATUSES.indexOf(a.status) - PROMPT_STATUSES.indexOf(b.status) || a.title.localeCompare(b.title) }[f.sort];
  list = [...list].sort(cmp);
  const tags = [...new Set(all.flatMap(p => p.tags))].sort();
  const filtered = !!(f.q || f.project || f.status || f.seq || f.tag || f.category);
  const reset = () => setF(o => ({ q: '', project: '', status: '', seq: '', tag: '', category: '', sort: o.sort }));
  return html`<div className="stack">
    <div className="filters">
      <input className="inp sm" id="pl-q" style=${{ minWidth: '220px' }} placeholder="Search titles, prompt text, tags, projects, sequences" value=${f.q} onChange=${e => set('q', e.target.value)} aria-label="Search prompts" />
      <${ProjectSelectFilter} value=${f.project} onChange=${v => set('project', v)} />
      <select className="sel sm" id="pl-status" aria-label="Status" value=${f.status} onChange=${e => set('status', e.target.value)}><option value="">Any status</option>${PROMPT_STATUSES.map(s => html`<option key=${s}>${s}</option>`)}</select>
      <select className="sel sm" id="pl-category" aria-label="Category" value=${f.category} onChange=${e => set('category', e.target.value)}><option value="">Any category</option>${PROMPT_CATEGORIES.map(s => html`<option key=${s}>${s}</option>`)}</select>
      <${SeqSelect} className="sel sm" id="pl-seq" value=${f.seq} noneLabel="Any sequence" onChange=${v => set('seq', v || '')} />
      ${tags.length ? html`<select className="sel sm" id="pl-tag" aria-label="Tag" value=${f.tag} onChange=${e => set('tag', e.target.value)}><option value="">Any tag</option>${tags.map(t => html`<option key=${t} value=${t}>#${t}</option>`)}</select>` : null}
      <select className="sel sm" id="pl-sort" aria-label="Sort" value=${f.sort} onChange=${e => set('sort', e.target.value)}><option value="updated">Recently updated</option><option value="title">Title</option><option value="status">Status</option></select>
      ${filtered ? html`<button className="btn sm ghost" id="pl-reset" onClick=${reset}>Reset filters</button>` : null}
      <span className="grow"></span><button className="btn primary" id="pl-new" onClick=${() => setCreating(true)}><${Icon} name="plus" /> Save a prompt</button>
    </div>
    <div className="small muted" id="pl-count">${list.length} prompt${list.length === 1 ? '' : 's'}${filtered ? ' match' : ''}</div>
    ${list.length ? html`<div className="ps-grid" id="pl-grid">${list.map(p => html`<${PromptCard} key=${p.id} p=${p} use=${use.get(p.id)} terms=${terms} copy=${copy} />`)}</div>`
      : html`<div className="empty">${filtered ? html`No prompts match. <button className="linklike" onClick=${reset}>Reset filters</button>` : html`No saved prompts yet. <button className="linklike" onClick=${() => setCreating(true)}>Save a prompt</button> to reuse it later.`}</div>`}
    ${creating ? html`<${NewPromptModal} onClose=${() => setCreating(false)} />` : null}
    ${copyModal}
  </div>`;
}

/* ---------- Sequences ---------- */
function SequenceCard({ q }) {
  const { setView, byId } = useApp(); const st = seqStats(q); const nx = st.next && st.next.promptId && byId.get(st.next.promptId);
  const proj = q.projectId && byId.get(q.projectId);
  return html`<article className="card pcard ps-seq" data-id=${q.id} data-type="sequence" role="button" tabIndex="0" onClick=${() => setView({ name: 'studio', tab: 'sequences', id: q.id })} onKeyDown=${e => e.key === 'Enter' && setView({ name: 'studio', tab: 'sequences', id: q.id })}>
    <div className="ps-card-hd"><${StatusPill} s=${q.status} kind="seq" /><span className="grow"></span><span className="small muted">${relTime(q.updatedAt)}</span></div>
    <h3>${q.title}</h3>
    ${q.summary ? html`<div className="desc">${q.summary}</div>` : null}
    <${SeqProgress} seq=${q} />
    <div className="nx">${st.total === 0 ? 'Add steps to start' : st.next ? html`Next: <b>Step ${st.nextIdx + 1} — ${stepLabel(st.next, byId)}</b>` : html`<b>All steps completed</b>`}</div>
    ${proj ? html`<div className="row-meta"><span className="ctxl-static"><${Icon} name="projects" size=${12} />${proj.title}</span></div>` : null}
  </article>`;
}
function SequencesList() {
  const { recs } = useApp(); const [creating, setCreating] = useState(false); const [f, setF] = useState({ q: '', project: '', status: '' });
  const set = (k, v) => setF(o => ({ ...o, [k]: v }));
  const terms = f.q.toLowerCase().split(/\s+/).filter(Boolean); const byId = useMemo(() => new Map(recs.map(r => [r.id, r])), [recs]);
  let list = recs.filter(r => r.type === 'sequence' && !r.archived && (!f.project || (f.project === '__none' ? !r.projectId : r.projectId === f.project)) && (!f.status || r.status === f.status));
  if (terms.length) list = list.filter(q => { const h = buildHaystack(q, byId); const a = [h.title, h.tags, h.rel, h.body].join(' '); return terms.every(t => a.includes(t)); });
  list.sort((a, b) => (a.status === 'Active' ? 0 : 1) - (b.status === 'Active' ? 0 : 1) || b.updatedAt.localeCompare(a.updatedAt));
  const filtered = !!(f.q || f.project || f.status);
  return html`<div className="stack">
    <div className="filters">
      <input className="inp sm" id="sq-q" style=${{ minWidth: '200px' }} placeholder="Search sequences and their prompts" value=${f.q} onChange=${e => set('q', e.target.value)} aria-label="Search sequences" />
      <${ProjectSelectFilter} value=${f.project} onChange=${v => set('project', v)} />
      <select className="sel sm" aria-label="Status" value=${f.status} onChange=${e => set('status', e.target.value)}><option value="">Any status</option>${SEQ_STATUSES.map(s => html`<option key=${s}>${s}</option>`)}</select>
      ${filtered ? html`<button className="btn sm ghost" onClick=${() => setF({ q: '', project: '', status: '' })}>Reset filters</button>` : null}
      <span className="grow"></span><button className="btn primary" id="sq-new" onClick=${() => setCreating(true)}><${Icon} name="plus" /> Create sequence</button>
    </div>
    ${list.length ? html`<div className="ps-grid" id="sq-grid">${list.map(q => html`<${SequenceCard} key=${q.id} q=${q} />`)}</div>`
      : html`<div className="empty">${filtered ? 'No sequences match.' : html`No sequences yet. <button className="linklike" onClick=${() => setCreating(true)}>Create your first sequence</button> for work that needs several prompts in order.`}</div>`}
    ${creating ? html`<${NewSequenceModal} onClose=${() => setCreating(false)} />` : null}
  </div>`;
}
function AddPromptsModal({ seq, onClose }) {
  const { recs, toast } = useApp(); const [q, setQ] = useState(''); const [picked, setPicked] = useState([]); const [busy, setBusy] = useState(false);
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const list = recs.filter(r => r.type === 'prompt' && !r.archived && (!terms.length || terms.every(t => (r.title + ' ' + r.summary + ' ' + r.tags.join(' ')).toLowerCase().includes(t)))).sort((a, b) => (b.projectId === seq.projectId) - (a.projectId === seq.projectId) || b.updatedAt.localeCompare(a.updatedAt));
  const toggle = id => setPicked(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const add = async () => {
    if (!picked.length) return; setBusy(true);
    const ok = await saveSteps(seq.id, steps => [...steps, ...picked.map(pid => ({ id: newId('st'), promptId: pid, status: 'Not started', completedAt: null, result: '', notes: '' }))], [entry('link', `${picked.length} step${picked.length > 1 ? 's' : ''} added`)]);
    setBusy(false); if (ok) { toast(`Added ${picked.length} step${picked.length > 1 ? 's' : ''}`); onClose(); }
  };
  return html`<${Modal} title="Add existing prompts" onClose=${onClose}>
    <div className="modal-bd">
      <input className="inp" id="ap-q" placeholder="Search prompts" value=${q} onChange=${e => setQ(e.target.value)} autoFocus />
      <div className="small muted">Picked prompts are added as new steps at the end, in the order you pick them.</div>
      <div className="list ap-list">${list.length ? list.map(p => { const i = picked.indexOf(p.id); return html`<label key=${p.id} className="row click ap-row"><input type="checkbox" checked=${i >= 0} onChange=${() => toggle(p.id)} /><div className="row-main"><div className="row-title">${p.title}${i >= 0 ? html` <span className="chip">#${i + 1}</span>` : null}</div>${p.summary ? html`<div className="row-meta">${p.summary}</div>` : null}</div></label>`; }) : html`<div className="empty">No prompts found. Use “Create prompt for this step” instead.</div>`}</div>
    </div>
    <div className="modal-ft"><button className="btn ghost" onClick=${onClose}>Cancel</button><button className="btn primary" id="ap-add" disabled=${!picked.length || busy} onClick=${add}>${busy ? 'Adding…' : `Add ${picked.length || ''} step${picked.length === 1 ? '' : 's'}`}</button></div>
  <//>`;
}
function DuplicateSeqModal({ seq, onClose }) {
  const { act, toast, setView, byId } = useApp(); const [name, setName] = useState(seq.title + ' (copy)'); const [copyPrompts, setCopyPrompts] = useState(false); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const run = async () => {
    setBusy(true); setErr(''); const map = new Map();
    if (copyPrompts) {
      for (const st of seq.steps) {
        const p = st.promptId && byId.get(st.promptId); if (!p || map.has(p.id)) continue;
        const { id: _i, log, createdAt, updatedAt, ...rest } = p;
        const c = await act.create({ ...rest, title: p.title + ' (copy)', sample: false }, null, [entry('created', `Copied from prompt “${p.title}”`)]);
        if (!c) { setBusy(false); setErr(`Stopped: a prompt copy could not be saved. ${map.size} copies were made; no sequence was created.`); return; }
        map.set(p.id, c.id);
      }
    }
    const steps = seq.steps.map(st => ({ id: newId('st'), ...(isAction(st) ? { kind: 'action', title: st.title, items: (st.items || []).map(x => ({ ...x, id: newId('it'), done: false })) } : {}),
      promptId: st.promptId ? (map.get(st.promptId) || st.promptId) : null, status: 'Not started', completedAt: null, result: '', notes: st.notes || '' }));
    const rec = await act.create({ type: 'sequence', title: name.trim() || seq.title + ' (copy)', summary: seq.summary, projectId: seq.projectId, refDocId: seq.refDocId, tags: seq.tags, status: 'Active', notes: seq.notes, steps }, null, [entry('created', `Duplicated from sequence “${seq.title}”`)]);
    setBusy(false);
    if (!rec) { setErr('The duplicate could not be saved. Nothing else changed.'); return; }
    toast('Sequence duplicated with fresh progress'); onClose(); setView({ name: 'studio', tab: 'sequences', id: rec.id });
  };
  return html`<${Modal} title="Duplicate sequence" onClose=${onClose} small>
    <div className="modal-bd">
      <label className="field"><span>Name</span><input id="dup-name" className="inp" value=${name} onChange=${e => setName(e.target.value)} /></label>
      <label className="row-wrap small" style=${{ gap: '6px' }}><input type="checkbox" id="dup-copy-prompts" checked=${copyPrompts} onChange=${e => setCopyPrompts(e.target.checked)} /> Also make separate copies of the prompts</label>
      <div className="small muted">${copyPrompts ? 'Each prompt is copied, so editing the copies will not change the original sequence.' : 'Steps point to the same saved prompts (editing a prompt shows in both). Progress always starts fresh.'}</div>
      ${err ? html`<div className="banner bad small" role="alert">${err}</div>` : null}
    </div>
    <div className="modal-ft"><button className="btn ghost" onClick=${onClose}>Cancel</button><button className="btn primary" id="dup-go" disabled=${busy} onClick=${run}>${busy ? 'Duplicating…' : 'Duplicate'}</button></div>
  <//>`;
}
/** Add or edit an action step: a title and bullet points, one per line. */
function ActionStepModal({ seq, step, onClose }) {
  const { toast, byId } = useApp(); const editing = !!step;
  const [title, setTitle] = useState(step ? step.title : ''); const [text, setText] = useState(step ? (step.items || []).map(x => x.text).join('\n') : '');
  const [pos, setPos] = useState('end'); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const preview = linesToItems(text, step ? step.items : []);
  const save = async () => {
    if (!title.trim()) { setErr('Give the step a short title, e.g. “Set up the project”.'); return; }
    setBusy(true); setErr('');
    const ok = editing
      ? await saveSteps(seq.id, steps => steps.map(x => x.id === step.id ? { ...x, title: title.trim(), items: linesToItems(text, x.items) } : x), [entry('edit', `Step edited: ${title.trim()}`)])
      : await saveSteps(seq.id, steps => { const ns = { id: newId('st'), kind: 'action', title: title.trim(), items: linesToItems(text), promptId: null, status: 'Not started', completedAt: null, result: '', notes: '' }; const a = [...steps]; const at = pos === 'end' ? a.length : a.findIndex(x => x.id === pos) + 1; a.splice(at < 1 && pos !== 'end' ? a.length : at, 0, ns); return a; }, [entry('link', `Action step added: ${title.trim()}`)]);
    setBusy(false);
    if (!ok) { setErr('Not saved. Your text is kept here; try again.'); return; }
    toast(editing ? 'Step updated' : 'Step added'); onClose();
  };
  return html`<${Modal} title=${editing ? 'Edit step' : 'Add an action step'} onClose=${onClose}>
    <div className="modal-bd ps-form">
      <div className="small muted">For steps that are not a prompt: things to do, such as opening a folder, cloning a repo, or messaging a client.</div>
      <label className="field"><span>Step title</span><input id="as-title" className="inp" value=${title} onChange=${e => setTitle(e.target.value)} autoFocus placeholder="e.g. Set up the project" /></label>
      <label className="field"><span>What to do, one bullet per line</span><textarea id="as-items" className="ta" rows="7" value=${text} onChange=${e => setText(e.target.value)} placeholder=${'Go to ~/projects/presencescope\ngit clone https://github.com/me/presencescope.git\nOpen Claude Code in the terminal'}></textarea></label>
      ${preview.length ? html`<div className="small muted">${preview.length} bullet${preview.length === 1 ? '' : 's'}${editing ? '; ticks are kept for lines you did not change' : ''}</div>` : null}
      ${editing ? null : html`<label className="field"><span>Position</span><select id="as-pos" className="sel" value=${pos} onChange=${e => setPos(e.target.value)}><option value="end">At the end (step ${seq.steps.length + 1})</option>${seq.steps.map((x, i) => html`<option key=${x.id} value=${x.id}>After step ${i + 1}: ${stepLabel(x, byId)}</option>`)}</select></label>`}
      ${err ? html`<div className="banner bad small" role="alert">${err}</div>` : null}
    </div>
    <div className="modal-ft"><button className="btn ghost" onClick=${onClose}>Cancel</button><button className="btn primary" id="as-save" disabled=${busy} onClick=${save}>${busy ? 'Saving…' : editing ? 'Save step' : 'Add step'}</button></div>
  <//>`;
}
/** The bullet checklist of an action step. Each bullet can be ticked and copied (handy for commands and paths). */
function StepItems({ seq, st, copy, idx }) {
  const items = st.items || []; const done = items.filter(x => x.done).length; const [busy, setBusy] = useState(null);
  const toggle = async it => { setBusy(it.id); await saveSteps(seq.id, steps => steps.map(x => x.id === st.id ? { ...x, items: (x.items || []).map(y => y.id === it.id ? { ...y, done: !y.done } : y) } : x)); setBusy(null); };
  if (!items.length) return html`<div className="small muted">No bullet points yet. Use Edit step to add what to do.</div>`;
  return html`<div className="ps-items-wrap">
    <ul className="ps-items" aria-label=${'What to do in step ' + (idx + 1)}>${items.map(it => html`<li key=${it.id} className=${it.done ? 'done' : ''} data-item=${it.id}>
      <input type="checkbox" checked=${!!it.done} disabled=${busy === it.id} onChange=${() => toggle(it)} aria-label=${(it.done ? 'Untick: ' : 'Tick: ') + it.text} />
      <span className="ps-item-text">${it.text}</span>
      <button type="button" className="btn icon ghost sm ps-item-copy" aria-label=${'Copy: ' + it.text} title="Copy this line" onClick=${() => copy(it.text, 'Line')}><${Icon} name="copy" size=${13} /></button>
    </li>`)}</ul>
    <div className="small muted ps-items-count">${done} of ${items.length} ticked${items.length > 1 ? html` · <button type="button" className="linklike small" onClick=${() => copy(itemsText(items), 'List')}>Copy list</button>` : null}</div>
  </div>`;
}
function StepItem({ seq, st, idx, confirmed, total, earlierOpen, copy, onRelink, onEdit }) {
  const { byId, openRecord, confirm, toast } = useApp();
  const action = isAction(st); const p = !action && st.promptId && byId.get(st.promptId);
  const [busy, setBusy] = useState('');
  const cStatus = confirmed ? confirmed.status : (st.status === 'Completed' ? 'Not started' : st.status); // completion is shown only once storage confirmed it
  const pending = !confirmed || JSON.stringify(confirmed) !== JSON.stringify(st);
  const done = cStatus === 'Completed';
  const patch = (fn, log, label) => async () => { setBusy(label); const ok = await saveSteps(seq.id, steps => steps.map(x => x.id === st.id ? fn(x) : x), log); setBusy(''); return ok; };
  const complete = async () => { const ok = await patch(x => ({ ...x, status: 'Completed', completedAt: nowISO() }), [entry('completed', `Step ${idx + 1} completed: ${stepLabel(st, byId)}`)], 'complete')(); if (ok) toast(`Step ${idx + 1} completed`); };
  const reopen = () => {
    const go = async () => { const ok = await patch(x => ({ ...x, status: 'In progress', completedAt: null }), [entry('status', `Step ${idx + 1} reopened`)], 'reopen')(); if (ok) toast(`Step ${idx + 1} reopened`); };
    if (st.completedAt || st.result) confirm({ title: `Reopen step ${idx + 1}?`, body: `Its completion time (${st.completedAt ? fmtDateTime(st.completedAt) : 'none'}) will be cleared. The result note is kept.`, confirmLabel: 'Reopen step', onConfirm: go });
    else go();
  };
  const setStatus = v => patch(x => ({ ...x, status: v, completedAt: v === 'Completed' ? (x.completedAt || nowISO()) : null }), [entry('status', `Step ${idx + 1}: ${v}`)], 'status')();
  const move = d => async () => { setBusy('move'); await saveSteps(seq.id, steps => { const i = steps.findIndex(x => x.id === st.id); const j = i + d; if (i < 0 || j < 0 || j >= steps.length) return null; const a = [...steps]; [a[i], a[j]] = [a[j], a[i]]; return a; }, [entry('edit', `Step moved ${d < 0 ? 'up' : 'down'}`)]); setBusy(''); };
  const remove = () => confirm({ title: `Remove step ${idx + 1} from this sequence?`, body: `${action ? `“${st.title}” and its bullet points are removed.` : p ? `The prompt “${p.title}” stays in your library.` : 'The missing prompt reference is removed.'} Only this step and its progress are removed.`, confirmLabel: 'Remove step', danger: true, onConfirm: () => saveSteps(seq.id, steps => steps.filter(x => x.id !== st.id), [entry('edit', `Step ${idx + 1} removed`)]) });
  return html`<li className=${'ps-step s-' + STEP_CLASS[cStatus] + (done ? ' is-done' : '') + (action ? ' is-action' : '')} data-step=${st.id} data-status=${cStatus} data-kind=${action ? 'action' : 'prompt'}>
    <div className="ps-step-num" aria-hidden="true">${done ? html`<${Icon} name="check" size=${14} />` : idx + 1}</div>
    <div className="ps-step-body">
      <div className="ps-step-hd">
        <span className="sr">Step ${idx + 1} of ${total}. </span>
        ${action ? html`<span className="ps-step-title">${st.title || 'Untitled step'}</span><span className="kind-tag" title="A step to do, not a prompt">Action</span>`
          : p ? html`<button type="button" className="linklike ps-step-title" onClick=${() => openRecord(p.id)}>${p.title}</button><span className="kind-tag prompt">Prompt</span>` : html`<span className="ps-step-title missing" role="alert">Prompt missing (deleted or not in this workspace)</span>`}
        <${ArchivedLink} r=${p} />
        <span className="grow"></span>
        <${StatusPill} s=${cStatus} kind="step" />
        ${pending && busy ? html`<span className="small muted">Saving…</span>` : null}
      </div>
      ${p && p.summary ? html`<div className="fg2 small">${p.summary}</div>` : null}
      ${action ? html`<${StepItems} seq=${seq} st=${st} copy=${copy} idx=${idx} />` : null}
      ${earlierOpen.length && (cStatus === 'In progress' || done) ? html`<div className="small warn-txt">Earlier step${earlierOpen.length > 1 ? 's' : ''} ${earlierOpen.join(', ')} not finished yet.</div>` : null}
      ${p && p.expected ? html`<div className="small"><span className="muted">Expected: </span>${p.expected}</div>` : null}
      ${done && st.completedAt ? html`<div className="small muted">Completed ${fmtDateTime(st.completedAt)}</div>` : null}
      <div className="ps-step-actions">
        ${action ? null : html`<button className="btn sm primary ps-copy" disabled=${!p || !p.body} onClick=${() => p && copy(p.body)} aria-label=${'Copy prompt for step ' + (idx + 1)}><${Icon} name="copy" size=${14} /> Copy prompt</button>`}
        ${done ? html`<button className="btn sm" onClick=${reopen} disabled=${!!busy}>Reopen</button>`
          : html`<button className="btn sm ps-complete" onClick=${complete} disabled=${!!busy}><${Icon} name="check" size=${13} /> ${busy === 'complete' ? 'Saving…' : 'Mark complete'}</button>
            <select className="sel sm" aria-label=${'Status of step ' + (idx + 1)} value=${cStatus} disabled=${!!busy} onChange=${e => setStatus(e.target.value)}>${STEP_STATUSES.filter(s => s !== 'Completed').map(s => html`<option key=${s}>${s}</option>`)}</select>`}
        ${action ? html`<button className="btn sm ghost ps-edit-step" onClick=${() => onEdit(st)}>Edit step</button>` : p ? html`<button className="btn sm ghost" onClick=${() => openRecord(p.id)}>Open / edit</button>` : html`<button className="btn sm" onClick=${() => onRelink(st)}>Choose a prompt</button>`}
        <span className="grow"></span>
        <button className="btn sm ghost icon" aria-label=${'Move step ' + (idx + 1) + ' up'} disabled=${idx === 0 || !!busy} onClick=${move(-1)}><${Icon} name="up" size=${14} /></button>
        <button className="btn sm ghost icon" aria-label=${'Move step ' + (idx + 1) + ' down'} disabled=${idx === total - 1 || !!busy} onClick=${move(1)}><${Icon} name="down" size=${14} /></button>
        <button className="btn sm ghost danger-txt" onClick=${remove}>Remove</button>
      </div>
      <details className="ps-step-more" open=${!!(st.result || st.notes) || null}>
        <summary className="small">Result and notes</summary>
        <div className="field"><span>Result, decision or output</span><${AutoText} id=${'step-result-' + st.id} rows=${2} label=${'Result of step ' + (idx + 1)} value=${st.result} onSave=${v => saveSteps(seq.id, steps => steps.map(x => x.id === st.id ? { ...x, result: v } : x))} /></div>
        <div className="field"><span>Step notes</span><${AutoText} id=${'step-notes-' + st.id} rows=${2} label=${'Notes for step ' + (idx + 1)} value=${st.notes} onSave=${v => saveSteps(seq.id, steps => steps.map(x => x.id === st.id ? { ...x, notes: v } : x))} /></div>
      </details>
    </div>
  </li>`;
}
function RelinkModal({ seq, step, onClose }) {
  const { recs } = useApp(); const [pid, setPid] = useState('');
  const prompts = recs.filter(r => r.type === 'prompt' && !r.archived).sort((a, b) => a.title.localeCompare(b.title));
  return html`<${Modal} title="Choose a prompt for this step" onClose=${onClose} small>
    <div className="modal-bd"><select className="sel" id="relink-sel" value=${pid} onChange=${e => setPid(e.target.value)}><option value="">Pick a prompt…</option>${prompts.map(p => html`<option key=${p.id} value=${p.id}>${p.title}</option>`)}</select></div>
    <div className="modal-ft"><button className="btn ghost" onClick=${onClose}>Cancel</button><button className="btn primary" disabled=${!pid} onClick=${async () => { if (await saveSteps(seq.id, steps => steps.map(x => x.id === step.id ? { ...x, promptId: pid } : x), [entry('link', 'Step prompt replaced')])) onClose(); }}>Use this prompt</button></div>
  <//>`;
}
function SequencePage({ id }) {
  const { byId, act, setView, toast, confirm } = useApp(); const [copy, copyModal] = useCopy();
  const seq = byId.get(id); const [modal, setModal] = useState(null); const [nextBusy, setNextBusy] = useState(false);
  if (!seq || seq.type !== 'sequence') return html`<div className="page"><div className="empty">This sequence no longer exists. <button className="linklike" onClick=${() => setView({ name: 'studio', tab: 'sequences' })}>Back to sequences</button></div></div>`;
  const confirmedSeq = store.snap.get(seq.id); const confirmedSteps = new Map(((confirmedSeq && confirmedSeq.steps) || []).map(x => [x.id, x]));
  const shownStatus = st => { const c = confirmedSteps.get(st.id); return c ? c.status : (st.status === 'Completed' ? 'Not started' : st.status); };
  const total = seq.steps.length; const doneN = seq.steps.filter(st => shownStatus(st) === 'Completed').length; const pct = total ? Math.round(doneN / total * 100) : 0;
  const nextIdx = seq.steps.findIndex(st => shownStatus(st) !== 'Completed'); const next = nextIdx >= 0 ? seq.steps[nextIdx] : null; const nextP = next && !isAction(next) && next.promptId && byId.get(next.promptId);
  const completeNext = async () => { setNextBusy(true); const ok = await saveSteps(seq.id, steps => steps.map(x => x.id === next.id ? { ...x, status: 'Completed', completedAt: nowISO() } : x), [entry('completed', `Step ${nextIdx + 1} completed: ${stepLabel(next, byId)}`)]); setNextBusy(false); if (ok) toast(`Step ${nextIdx + 1} completed`); };
  const proj = seq.projectId && byId.get(seq.projectId); const ref = seq.refDocId && byId.get(seq.refDocId);
  const open = []; // unfinished earlier steps, by position
  return html`<div className="page ws-page" id="seq-page" data-id=${seq.id}>
    <header className="ws-head">
      <nav className="crumbs" aria-label="Breadcrumb"><button className="linklike" onClick=${() => setView({ name: 'studio', tab: 'overview' })}>Prompt Studio</button><span aria-hidden="true">/</span><button className="linklike" onClick=${() => setView({ name: 'studio', tab: 'sequences' })}>Sequences</button><span aria-hidden="true">/</span><span className="fg2">${seq.title}</span>${seq.archived ? html`<span className="chip">archived</span>` : null}</nav>
      <div className="ws-title"><span className="proj-tile" aria-hidden="true"><${Icon} name="steps" size=${18} /></span><${EditText} id="seq-title" className="inp title-inp" value=${seq.title} placeholder="Sequence name" onSave=${v => act.update(seq.id, { title: v.trim() || seq.title })} /></div>
      <div className="ws-meta">
        <label className="ws-field"><span className="sr">Status</span><select className="sel sm" id="seq-status" value=${seq.status} onChange=${e => act.update(seq.id, { status: e.target.value })}>${SEQ_STATUSES.map(s => html`<option key=${s}>${s}</option>`)}</select></label>
        <label className="ws-field"><span className="muted small">Project</span><${ProjectSelect} className="sel sm" id="seq-project" value=${seq.projectId} onChange=${v => act.update(seq.id, { projectId: v })} /></label>
        <label className="ws-field"><span className="muted small">Plan</span><${DocSelect} className="sel sm" id="seq-doc" value=${seq.refDocId} projectId=${seq.projectId} onChange=${v => act.update(seq.id, { refDocId: v })} /></label>
        <span className="ws-progress" id="seq-progress">${total ? html`<span className="progress"><span className="progress-track"><span className="progress-fill" style=${{ width: pct + '%' }}></span></span><span className="progress-txt">${doneN} of ${total} steps · ${pct}%</span></span>` : html`<span className="muted">No steps yet</span>`}</span>
        <span className="grow"></span>
        <button className="btn sm" id="seq-dup" onClick=${() => setModal({ k: 'dup' })}>Duplicate</button>
        <button className="btn sm ghost" id="seq-archive" onClick=${async () => { if (await act.update(seq.id, { archived: !seq.archived })) toast(seq.archived ? 'Sequence restored' : 'Sequence archived. Restore it from Archived.'); }}>${seq.archived ? 'Restore' : 'Archive'}</button>
      </div>
    </header>
    ${total ? html`<div className="card next-up ps-next" id="seq-next">${next ? html`
      <div className="body"><div className="lbl">Next · ${isAction(next) ? 'action' : 'prompt'}</div><div className="t">Step ${nextIdx + 1} — ${stepLabel(next, byId)}</div>${nextP && nextP.summary ? html`<div className="fg2 small">${nextP.summary}</div>` : null}
        ${isAction(next) ? html`<${StepItems} seq=${seq} st=${next} copy=${copy} idx=${nextIdx} />` : null}</div>
      <div className="row-wrap ps-next-actions">${isAction(next) ? null : html`<button className="btn primary" id="seq-copy-next" disabled=${!nextP || !nextP.body} onClick=${() => nextP && copy(nextP.body)}><${Icon} name="copy" size=${15} /> Copy next prompt</button>`}
        <button className=${'btn' + (isAction(next) ? ' primary' : '')} id="seq-complete-next" disabled=${nextBusy} onClick=${completeNext}><${Icon} name="check" size=${14} /> ${nextBusy ? 'Saving…' : `Mark step ${nextIdx + 1} complete`}</button></div>`
      : html`<div className="body"><div className="lbl">Done</div><div className="t">All ${total} steps completed</div></div>${seq.status !== 'Completed' ? html`<button className="btn" onClick=${() => act.update(seq.id, { status: 'Completed' })}>Mark sequence completed</button>` : null}`}</div>` : null}
    <div className="ws-grid">
      <div className="ws-main">
        <div className="row-wrap">
          <button className="btn" id="seq-add-existing" onClick=${() => setModal({ k: 'add' })}><${Icon} name="plus" /> Add existing prompt</button>
          <button className="btn" id="seq-add-new" onClick=${() => setModal({ k: 'new' })}>Create prompt for this step</button>
          <button className="btn" id="seq-add-action" onClick=${() => setModal({ k: 'action' })}><${Icon} name="steps" /> Add action step</button>
        </div>
        ${total ? html`<ol className="ps-timeline" id="seq-steps">${seq.steps.map((st, i) => { const earlier = open.slice(); if (shownStatus(st) !== 'Completed') open.push(i + 1); return html`<${StepItem} key=${st.id} seq=${seq} st=${st} idx=${i} total=${total} confirmed=${confirmedSteps.get(st.id)} earlierOpen=${earlier} copy=${copy} onRelink=${step => setModal({ k: 'relink', step })} onEdit=${step => setModal({ k: 'action', step })} />`; })}</ol>`
          : html`<div className="empty">No steps yet. Add saved prompts, create new ones, or add action steps for things to do without a prompt. Each becomes a numbered card.</div>`}
      </div>
      <aside className="ws-side">
        <section className="about"><div className="sub-hd">Objective</div><${AutoText} id="seq-objective" rows=${3} label="Objective" value=${seq.summary} onSave=${v => act.update(seq.id, { summary: v })} /></section>
        <section className="about"><div className="sub-hd">Notes</div><${AutoText} id="seq-notes" rows=${4} label="Sequence notes" value=${seq.notes} onSave=${v => act.update(seq.id, { notes: v })} /></section>
        ${proj ? html`<${Section} title="Project"><div className="list"><${RecordRow} r=${proj} /></div><//>` : null}
        ${ref ? html`<${Section} title="Plan or reference"><div className="list"><${RecordRow} r=${ref} /></div><//>` : seq.refDocId ? html`<div className="small muted">The reference document is missing.</div>` : null}
        <div><div className="sub-hd">Tags</div><${TagEditor} tags=${seq.tags} onSave=${tags => act.update(seq.id, { tags })} /></div>
        <${Section} title="Activity" count=${null}><${TimelineList} events=${collectEvents([seq])} limit=${10} /><//>
      </aside>
    </div>
    ${modal && modal.k === 'add' ? html`<${AddPromptsModal} seq=${seq} onClose=${() => setModal(null)} />` : null}
    ${modal && modal.k === 'new' ? html`<${NewPromptModal} preset=${{ seqId: seq.id, projectId: seq.projectId }} onClose=${() => setModal(null)} />` : null}
    ${modal && modal.k === 'dup' ? html`<${DuplicateSeqModal} seq=${seq} onClose=${() => setModal(null)} />` : null}
    ${modal && modal.k === 'relink' ? html`<${RelinkModal} seq=${seq} step=${modal.step} onClose=${() => setModal(null)} />` : null}
    ${modal && modal.k === 'action' ? html`<${ActionStepModal} seq=${seq} step=${modal.step && seq.steps.find(x => x.id === modal.step.id)} onClose=${() => setModal(null)} />` : null}
    ${copyModal}
  </div>`;
}

/* ---------- Plans & Reports ---------- */
function DocCard({ d, terms, copy }) {
  const { openRecord, byId, act, toast } = useApp(); const proj = d.projectId && byId.get(d.projectId); const sq = d.sequenceId && byId.get(d.sequenceId);
  const ex = d.summary || excerpt(d.body, terms, 180);
  return html`<article className="card ps-card ps-doc" data-id=${d.id} data-type="doc">
    <div className="ps-card-hd"><span className="tlabel"><${Icon} name="doc" size=${13} />${d.category || 'Other'}</span>${d.masterPlan ? html`<span className="chip master" title="Current master plan for its project">Master plan</span>` : null}<span className="grow"></span><span className="small muted" title=${new Date(d.updatedAt).toLocaleString()}>${relTime(d.updatedAt)}</span></div>
    <h3><button type="button" className="linklike ps-title" onClick=${() => openRecord(d.id)}>${highlight(d.title || 'Untitled', terms)}</button></h3>
    ${ex ? html`<p className="desc">${highlight(ex, terms)}</p>` : html`<p className="desc muted">Empty document.</p>`}
    <div className="row-meta">${proj ? html`<span className="ctxl-static"><${Icon} name="projects" size=${12} />${proj.title}</span>` : null}${sq ? html`<span className="seqref"><${Icon} name="steps" size=${12} />${sq.title}</span>` : null}<${QuietTags} tags=${d.tags} /><${SampleMark} r=${d} /></div>
    <div className="ps-card-ft">
      <button className="btn sm" onClick=${() => openRecord(d.id)}>Open</button>
      <button className="btn sm" onClick=${() => copy(docCopyText(d), 'Document')}><${Icon} name="copy" size=${14} /> Copy content</button>
      <${Pop} label="Link" title="Link to a project or sequence" id=${'doc-link-' + d.id}>${() => html`<div className="pop-body">
        <label className="field"><span>Project</span><${ProjectSelect} className="sel sm" value=${d.projectId} onChange=${v => act.update(d.id, { projectId: v, inbox: v ? false : d.inbox })} /></label>
        <label className="field"><span>Sequence</span><${SeqSelect} className="sel sm" value=${d.sequenceId} onChange=${v => act.update(d.id, { sequenceId: v })} /></label></div>`}<//>
      <span className="grow"></span>
      <button className="btn sm ghost" onClick=${async () => { if (await act.update(d.id, { archived: true })) toast('Document archived. Restore it from Archived.'); }}>Archive</button>
    </div>
  </article>`;
}
function PlansReports() {
  const { recs } = useApp(); const [copy, copyModal] = useCopy(); const [creating, setCreating] = useState(false);
  const [f, setF] = useState({ q: '', category: '', project: '', seq: '', tag: '', master: false, sort: 'updated' });
  const set = (k, v) => setF(o => ({ ...o, [k]: v }));
  const all = recs.filter(r => isDoc(r) && !r.archived); const byId = useMemo(() => new Map(recs.map(r => [r.id, r])), [recs]);
  const terms = f.q.toLowerCase().split(/\s+/).map(t => t.replace(/^#(?=.)/, '')).filter(Boolean);
  let list = all.filter(d => (!f.category || (d.category || 'Other') === f.category) && (!f.project || (f.project === '__none' ? !d.projectId : d.projectId === f.project)) && (!f.seq || d.sequenceId === f.seq) && (!f.tag || d.tags.includes(f.tag)) && (!f.master || d.masterPlan));
  if (terms.length) list = list.filter(d => { const h = buildHaystack(d, byId); const a = [h.title, h.tags, h.rel, h.body].join(' '); return terms.every(t => a.includes(t)); });
  list = [...list].sort({ updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt), title: (a, b) => a.title.localeCompare(b.title), category: (a, b) => (a.category || 'Other').localeCompare(b.category || 'Other') || b.updatedAt.localeCompare(a.updatedAt) }[f.sort]);
  const tags = [...new Set(all.flatMap(d => d.tags))].sort(); const filtered = !!(f.q || f.category || f.project || f.seq || f.tag || f.master);
  const reset = () => setF(o => ({ q: '', category: '', project: '', seq: '', tag: '', master: false, sort: o.sort }));
  return html`<div className="stack">
    <div className="filters">
      <input className="inp sm" id="pr-q" style=${{ minWidth: '220px' }} placeholder="Search titles, content, summaries, tags" value=${f.q} onChange=${e => set('q', e.target.value)} aria-label="Search plans and reports" />
      <select className="sel sm" id="pr-category" aria-label="Category" value=${f.category} onChange=${e => set('category', e.target.value)}><option value="">All categories</option>${DOC_CATEGORIES.map(c => html`<option key=${c}>${c}</option>`)}</select>
      <${ProjectSelectFilter} value=${f.project} onChange=${v => set('project', v)} />
      <${SeqSelect} className="sel sm" id="pr-seq" value=${f.seq} noneLabel="Any sequence" onChange=${v => set('seq', v || '')} />
      ${tags.length ? html`<select className="sel sm" aria-label="Tag" value=${f.tag} onChange=${e => set('tag', e.target.value)}><option value="">Any tag</option>${tags.map(t => html`<option key=${t} value=${t}>#${t}</option>`)}</select>` : null}
      <label className="small fg2 row-wrap" style=${{ gap: '6px' }}><input type="checkbox" id="pr-master" checked=${f.master} onChange=${e => set('master', e.target.checked)} /> Master plans only</label>
      <select className="sel sm" aria-label="Sort" id="pr-sort" value=${f.sort} onChange=${e => set('sort', e.target.value)}><option value="updated">Recently updated</option><option value="title">Title</option><option value="category">Category</option></select>
      ${filtered ? html`<button className="btn sm ghost" id="pr-reset" onClick=${reset}>Reset filters</button>` : null}
      <span className="grow"></span><button className="btn primary" id="pr-new" onClick=${() => setCreating(true)}><${Icon} name="plus" /> New plan or report</button>
    </div>
    <div className="small muted" id="pr-count">${list.length} document${list.length === 1 ? '' : 's'}${filtered ? ' match' : ''}. Every document is listed; existing ones show as “Other” until you give them a category.</div>
    ${list.length ? html`<div className="ps-grid" id="pr-grid">${list.map(d => html`<${DocCard} key=${d.id} d=${d} terms=${terms} copy=${copy} />`)}</div>`
      : html`<div className="empty">${filtered ? html`No documents match. <button className="linklike" onClick=${reset}>Reset filters</button>` : html`No plans or reports yet. <button className="linklike" onClick=${() => setCreating(true)}>Create one</button> for a project plan, audit or report.`}</div>`}
    ${creating ? html`<${NewDocModal} onClose=${() => setCreating(false)} />` : null}
    ${copyModal}
  </div>`;
}
/** Extra fields shown in a document's drawer: category, summary, sequence and the master-plan mark. */
function DocMetaFields({ rec }) {
  const { act, recs, confirm, toast } = useApp(); const [copy, copyModal] = useCopy();
  const current = rec.projectId ? recs.find(r => isDoc(r) && r.masterPlan && r.projectId === rec.projectId && r.id !== rec.id && !r.archived) : null;
  const toggleMaster = () => {
    if (rec.masterPlan) { act.update(rec.id, { masterPlan: false }); return; }
    if (!rec.projectId) { toast('Link this document to a project first; a master plan belongs to a project.', 'bad'); return; }
    const go = async () => { if (current && !(await act.update(current.id, { masterPlan: false }))) return; if (await act.update(rec.id, { masterPlan: true })) toast('Marked as the current master plan. Older plans are kept.'); };
    if (current) confirm({ title: 'Make this the current master plan?', body: `“${current.title}” is the current master plan for this project. It stays as a separate document; only the “current” mark moves to this one.`, confirmLabel: 'Make current', onConfirm: go });
    else go();
  };
  return html`<div className="stack doc-meta" style=${{ gap: '12px' }}>
    <div className="grid3">
      <label className="field"><span>Category</span><select className="sel" id="doc-category" value=${rec.category || 'Other'} onChange=${e => act.update(rec.id, { category: e.target.value })}>${DOC_CATEGORIES.map(c => html`<option key=${c}>${c}</option>`)}${rec.category && !DOC_CATEGORIES.includes(rec.category) ? html`<option>${rec.category}</option>` : null}</select></label>
      <label className="field"><span>Related sequence</span><${SeqSelect} id="doc-seq" value=${rec.sequenceId} onChange=${v => act.update(rec.id, { sequenceId: v })} /></label>
      <div className="field"><span>Master plan</span><button className=${'btn' + (rec.masterPlan ? ' primary' : '')} id="doc-master" aria-pressed=${!!rec.masterPlan} onClick=${toggleMaster}>${rec.masterPlan ? 'Current master plan' : 'Make current master plan'}</button></div>
    </div>
    <label className="field"><span>Summary</span><${EditText} id="doc-summary" value=${rec.summary || ''} placeholder="One or two lines shown on the card" onSave=${v => act.update(rec.id, { summary: v.trim() })} /></label>
    <div className="row-wrap"><button className="btn sm" id="doc-copy-md" onClick=${() => copy(docCopyText(rec), 'Document')}><${Icon} name="copy" size=${14} /> Copy as Markdown</button><span className="small muted">Keeps headings, lists, tables and code blocks.</span></div>
    ${copyModal}
  </div>`;
}

/* ---------- Overview, Archived, shell ---------- */
function StudioOverview({ go }) {
  const { recs, byId, setView, openRecord } = useApp(); const [copy, copyModal] = useCopy(); const [modal, setModal] = useState(null);
  const seqs = recs.filter(r => r.type === 'sequence' && !r.archived); const active = seqs.filter(q => q.status === 'Active');
  const prompts = recs.filter(r => r.type === 'prompt' && !r.archived); const docs = recs.filter(r => isDoc(r) && !r.archived);
  const steps = active.flatMap(q => q.steps);
  const sc = s => steps.filter(x => x.status === s).length; const pc = s => prompts.filter(p => p.status === s).length;
  const cont = [...active].filter(q => seqStats(q).next).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const cs = cont && seqStats(cont); const cp = cs && !isAction(cs.next) && cs.next.promptId && byId.get(cs.next.promptId);
  const recentSeq = [...seqs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4);
  const recentDocs = [...docs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5);
  const projIds = [...new Set(active.filter(q => seqStats(q).next && q.projectId).map(q => q.projectId))];
  const empty = !seqs.length && !prompts.length;
  return html`<div className="stack" id="studio-overview">
    ${empty ? html`<div className="card welcome"><h2>Save prompts once. Run them in order. Know what comes next.</h2>
      <p>Keep the prompts you reuse, group them into ordered sequences for multi-step work, and keep plans and reports beside the projects they belong to. Copy each prompt with one click, then mark the step complete when the work is really done.</p>
      <div className="row-wrap"><button className="btn primary" id="ov-new-seq" onClick=${() => setModal('seq')}>Create your first sequence</button><button className="btn" id="ov-new-prompt" onClick=${() => setModal('prompt')}>Save a prompt</button><button className="btn" onClick=${() => setModal('doc')}>New plan or report</button></div></div>` : null}
    ${cont ? html`<div className="card next-up ps-next" id="ov-continue"><div className="body"><div className="lbl">Continue · ${cont.title}</div><div className="t">Step ${cs.nextIdx + 1} — ${stepLabel(cs.next, byId)}</div>${isAction(cs.next) ? html`<${StepItems} seq=${cont} st=${cs.next} copy=${copy} idx=${cs.nextIdx} />` : null}<div className="row-meta"><${SeqProgress} seq=${cont} /></div></div>
      <div className="row-wrap">${isAction(cs.next) ? null : html`<button className="btn primary" id="ov-copy-next" disabled=${!cp || !cp.body} onClick=${() => cp && copy(cp.body)}><${Icon} name="copy" size=${15} /> Copy next prompt</button>`}<button className=${'btn' + (isAction(cs.next) ? ' primary' : '')} onClick=${() => setView({ name: 'studio', tab: 'sequences', id: cont.id })}>Open sequence</button></div></div>` : null}
    ${empty ? null : html`<div className="ps-stats" id="ov-stats">
      <button className="ps-stat" onClick=${() => go('sequences')}><b data-k="active">${active.length}</b><span>Active sequences</span></button>
      <div className="ps-stat"><b data-k="ready">${sc('Ready')}</b><span>Steps ready</span></div>
      <div className="ps-stat"><b data-k="doing">${sc('In progress')}</b><span>Steps in progress</span></div>
      <div className="ps-stat"><b data-k="done">${sc('Completed')}</b><span>Steps completed</span></div>
      <button className="ps-stat" onClick=${() => go('library')}><b data-k="prompts">${prompts.length}</b><span>Saved prompts · ${pc('Ready')} ready</span></button>
    </div>`}
    <div className="ps-two">
      <${Section} id="ov-seqs" title="Recently worked on" count=${seqs.length || null} action=${seqs.length ? html`<button className="linklike small" onClick=${() => go('sequences')}>All sequences</button>` : null}>
        ${recentSeq.length ? html`<div className="list">${recentSeq.map(q => { const st = seqStats(q); return html`<div key=${q.id} className="row click" data-id=${q.id} onClick=${() => setView({ name: 'studio', tab: 'sequences', id: q.id })}><${TypeIcon} r=${q} tile /><div className="row-main"><div className="row-title">${q.title}</div><div className="row-meta"><${StatusPill} s=${q.status} kind="seq" /><${SeqProgress} seq=${q} />${st.next ? html`<span className="fg2">Next: step ${st.nextIdx + 1}</span>` : null}</div></div></div>`; })}</div>` : html`<div className="empty small">No sequences yet.</div>`}
      <//>
      <${Section} id="ov-docs" title="Recently updated plans and reports" count=${docs.length || null} action=${docs.length ? html`<button className="linklike small" onClick=${() => go('docs')}>All documents</button>` : null}>
        ${recentDocs.length ? html`<div className="list">${recentDocs.map(d => html`<div key=${d.id} className="row click" onClick=${() => openRecord(d.id)}><${TypeIcon} r=${d} tile /><div className="row-main"><div className="row-title">${d.title}</div><div className="row-meta"><span className="tlabel">${d.category || 'Other'}</span>${d.masterPlan ? html`<span className="chip master">Master plan</span>` : null}<span className="muted">${relTime(d.updatedAt)}</span></div></div></div>`)}</div>` : html`<div className="empty small">No plans or reports yet.</div>`}
      <//>
    </div>
    ${projIds.length ? html`<${Section} id="ov-projects" title="Projects with unfinished sequences" count=${projIds.length}><div className="list">${projIds.map(pid => { const p = byId.get(pid); if (!p) return null; const qs = active.filter(q => q.projectId === pid && seqStats(q).next); return html`<div key=${pid} className="row click" onClick=${() => setView({ name: 'project', id: pid })}><${TypeIcon} r=${p} tile /><div className="row-main"><div className="row-title">${p.title}</div><div className="row-meta">${qs.map(q => html`<span key=${q.id} className="seqref"><${Icon} name="steps" size=${12} />${q.title} · ${seqStats(q).done}/${q.steps.length}</span>`)}</div></div></div>`; })}</div><//>` : null}
    ${modal === 'seq' ? html`<${NewSequenceModal} onClose=${() => setModal(null)} />` : null}
    ${modal === 'prompt' ? html`<${NewPromptModal} onClose=${() => setModal(null)} />` : null}
    ${modal === 'doc' ? html`<${NewDocModal} onClose=${() => setModal(null)} />` : null}
    ${copyModal}
  </div>`;
}
function StudioArchived() {
  const { recs, act, toast } = useApp();
  const list = recs.filter(r => r.archived && (r.type === 'prompt' || r.type === 'sequence' || isDoc(r))).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return html`<div className="stack" id="studio-archived">
    <div className="small muted">Archived prompts, sequences and documents keep all their content and links. Restore puts them back where they were.</div>
    ${list.length ? html`<div className="list">${list.map(r => html`<${RecordRow} key=${r.id} r=${r} extra=${html`<button className="btn sm" onClick=${async e => { e.stopPropagation(); if (await act.update(r.id, { archived: false })) toast('Restored'); }}>Restore</button>`} />`)}</div>` : html`<div className="empty">Nothing archived.</div>`}
  </div>`;
}
const STUDIO_TABS = [['overview', 'Overview'], ['library', 'Prompt Library'], ['sequences', 'Sequences'], ['docs', 'Plans & Reports'], ['archived', 'Archived']];
function StudioView({ tab = 'overview', id }) {
  const { recs, setView } = useApp();
  if (tab === 'sequences' && id) return html`<${SequencePage} key=${id} id=${id} />`;
  const n = { library: recs.filter(r => r.type === 'prompt' && !r.archived).length, sequences: recs.filter(r => r.type === 'sequence' && !r.archived).length, docs: recs.filter(r => isDoc(r) && !r.archived).length, archived: recs.filter(r => r.archived && (r.type === 'prompt' || r.type === 'sequence' || isDoc(r))).length };
  const go = k => setView({ name: 'studio', tab: k });
  return html`<div className="page" id="studio">
    <div className="page-hd"><h1>Prompt Studio</h1><div className="sub">Saved prompts, ordered prompt sequences, and the plans and reports behind your projects.</div></div>
    <div className="tabs" role="tablist" id="studio-tabs">${STUDIO_TABS.map(([k, l]) => html`<button key=${k} role="tab" id=${'studio-tab-' + k} aria-selected=${tab === k} className=${tab === k ? 'on' : ''} onClick=${() => go(k)}>${l}${n[k] != null ? html`<span className="n">${n[k]}</span>` : null}</button>`)}</div>
    ${tab === 'overview' ? html`<${StudioOverview} go=${go} />` : tab === 'library' ? html`<${PromptLibrary} />` : tab === 'sequences' ? html`<${SequencesList} />` : tab === 'docs' ? html`<${PlansReports} />` : html`<${StudioArchived} />`}
  </div>`;
}

/* ---------- project integration ---------- */
function ProjectStudio({ project }) {
  const { recs, byId, setView, openRecord } = useApp(); const [copy, copyModal] = useCopy(); const [modal, setModal] = useState(null);
  const seqs = recs.filter(r => r.type === 'sequence' && !r.archived && r.projectId === project.id).sort((a, b) => (a.status === 'Active' ? 0 : 1) - (b.status === 'Active' ? 0 : 1) || b.updatedAt.localeCompare(a.updatedAt));
  const prompts = recs.filter(r => r.type === 'prompt' && !r.archived && r.projectId === project.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const docs = recs.filter(r => isDoc(r) && !r.archived && r.projectId === project.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const master = docs.find(d => d.masterPlan);
  const cont = seqs.filter(q => q.status === 'Active' && seqStats(q).next)[0]; const cs = cont && seqStats(cont); const cp = cs && !isAction(cs.next) && cs.next.promptId && byId.get(cs.next.promptId);
  return html`<div className="stack" id="project-studio">
    <div className="row-wrap"><button className="btn" id="pj-new-seq" onClick=${() => setModal('seq')}>New sequence</button><button className="btn" id="pj-new-prompt" onClick=${() => setModal('prompt')}>Save a prompt</button><button className="btn" id="pj-new-doc" onClick=${() => setModal('doc')}>New plan or report</button></div>
    ${cont ? html`<div className="card next-up ps-next" id="pj-next"><div className="body"><div className="lbl">Current next action · ${cont.title}</div><div className="t">Step ${cs.nextIdx + 1} — ${stepLabel(cs.next, byId)}</div>${isAction(cs.next) ? html`<${StepItems} seq=${cont} st=${cs.next} copy=${copy} idx=${cs.nextIdx} />` : null}<div className="row-meta"><${SeqProgress} seq=${cont} /></div></div>
      <div className="row-wrap">${isAction(cs.next) ? null : html`<button className="btn primary" id="pj-copy-next" disabled=${!cp || !cp.body} onClick=${() => cp && copy(cp.body)}><${Icon} name="copy" size=${15} /> Copy next prompt</button>`}<button className=${'btn' + (isAction(cs.next) ? ' primary' : '')} onClick=${() => setView({ name: 'studio', tab: 'sequences', id: cont.id })}>Open sequence</button></div></div>` : null}
    <div className="ws-grid">
      <div className="ws-main">
        <${Section} id="pj-seqs" title="Prompt sequences" count=${seqs.length}>${seqs.length ? html`<div className="ps-grid">${seqs.map(q => html`<${SequenceCard} key=${q.id} q=${q} />`)}</div>` : html`<div className="empty small">No sequences for this project yet.</div>`}<//>
        <${Section} id="pj-prompts" title="Saved prompts" count=${prompts.length}>${prompts.length ? html`<div className="list">${prompts.map(p => html`<div key=${p.id} className="row click" data-id=${p.id} onClick=${() => openRecord(p.id)}><${TypeIcon} r=${p} tile /><div className="row-main"><div className="row-title">${p.title}</div><div className="row-meta"><${StatusPill} s=${p.status} />${p.summary ? html`<span className="fg2">${p.summary}</span>` : null}</div></div><div className="row-side"><button className="btn sm ps-copy" onClick=${e => { e.stopPropagation(); copy(p.body); }}><${Icon} name="copy" size=${13} /> Copy</button></div></div>`)}</div>` : html`<div className="empty small">No prompts linked to this project.</div>`}<//>
      </div>
      <aside className="ws-side">
        <${Section} id="pj-master" title="Current master plan">${master ? html`<div className="list"><${RecordRow} r=${master} /></div>` : html`<div className="empty small">None marked. Open a plan and choose “Make current master plan”.</div>`}<//>
        <${Section} id="pj-docs" title="Plans and reports" count=${docs.length}>${docs.length ? html`<div className="list">${docs.slice(0, 8).map(d => html`<div key=${d.id} className="row click" onClick=${() => openRecord(d.id)}><${TypeIcon} r=${d} tile /><div className="row-main"><div className="row-title">${d.title}</div><div className="row-meta"><span className="tlabel">${d.category || 'Other'}</span><span className="muted">${relTime(d.updatedAt)}</span></div></div></div>`)}</div>` : html`<div className="empty small">No plans or reports for this project.</div>`}<//>
      </aside>
    </div>
    ${modal === 'seq' ? html`<${NewSequenceModal} preset=${{ projectId: project.id }} onClose=${() => setModal(null)} />` : null}
    ${modal === 'prompt' ? html`<${NewPromptModal} preset=${{ projectId: project.id }} onClose=${() => setModal(null)} />` : null}
    ${modal === 'doc' ? html`<${NewDocModal} preset=${{ projectId: project.id }} onClose=${() => setModal(null)} />` : null}
    ${copyModal}
  </div>`;
}
