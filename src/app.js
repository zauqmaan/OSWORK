/* ===================== detail drawer, capture, settings, app shell ===================== */
function Modal({ title, onClose, children, small, wide, head }) {
  useEffect(() => { const k = e => { if (e.key === 'Escape' && !window.__wosPopupOpen) { e.stopPropagation(); onClose(); } }; window.addEventListener('keydown', k, true); return () => window.removeEventListener('keydown', k, true); }, [onClose]);
  return html`<div className="modal-wrap" role="dialog" aria-modal="true" aria-label=${title}>
    <div className="backdrop" onClick=${onClose}></div>
    <div className=${'modal' + (small ? ' sm' : '') + (wide ? ' wide' : '')}>
      <div className="modal-hd">${head || html`<h2>${title}</h2>`}<button className="btn icon ghost" aria-label="Close" onClick=${onClose}><${Icon} name="x" /></button></div>
      ${children}
    </div>
  </div>`;
}
function ConfirmModal({ c, onClose }) {
  const [busy, setBusy] = useState(false);
  return html`<${Modal} title=${c.title} onClose=${onClose} small>
    <div className="modal-bd"><p style=${{ margin: 0 }}>${c.body}</p></div>
    <div className="modal-ft"><button className="btn ghost" onClick=${onClose}>Cancel</button>
      <button className=${'btn ' + (c.danger ? 'danger' : 'primary')} disabled=${busy} id="confirm-ok" onClick=${async () => { setBusy(true); try { await c.onConfirm(); } finally { setBusy(false); onClose(); } }}>${busy ? 'Working…' : c.confirmLabel || 'Confirm'}</button></div>
  <//>`;
}

/* ---------- link picker ---------- */
function LinkPicker({ rec, placeholder = 'Link a note, task, resource or lead…' }) {
  const { recs, byId } = useApp();
  const [q, setQ] = useState(''); const [open, setOpen] = useState(false);
  const res = useMemo(() => q.trim() ? runSearch(q, recs, byId, { types: ['note', 'task', 'resource', 'lead', 'topic'], archived: false }).results.filter(x => x.r.id !== rec.id).slice(0, 8) : [], [q, recs]);
  return html`<div className="picker">
    <input className="inp sm" style=${{ width: '100%' }} placeholder=${placeholder} value=${q} onChange=${e => { setQ(e.target.value); setOpen(true); }} onFocus=${() => setOpen(true)} onBlur=${() => setTimeout(() => setOpen(false), 150)} aria-label="Link a record" />
    ${open && res.length ? html`<div className="picker-list">${res.map(({ r }) => html`<div key=${r.id} className="row click" onMouseDown=${e => e.preventDefault()} onClick=${async () => { await linkRecords(rec.id, r.id); setQ(''); setOpen(false); }}>
      <${TypeIcon} r=${r} tile /><div className="row-main"><div className="row-title">${r.title}</div><div className="row-meta"><${TypeLabel} r=${r} /></div></div></div>`)}</div>` : null}
  </div>`;
}

/* ---------- detail parts ---------- */
function Related({ rec }) {
  const { recs, byId, openRecord } = useApp();
  const rel = relatedOf(rec, recs, byId);
  return html`<div><div className="sub-hd">Related records <span className="n">${rel.length}</span></div>
    <div className="stack" style=${{ gap: '8px' }}>
      ${rel.length ? html`<div className="list">${rel.map(r => html`<div key=${r.id} className="row click" onClick=${() => openRecord(r.id)}>
        <${TypeIcon} r=${r} tile /><div className="row-main"><div className="row-title">${r.title || 'Untitled'}</div><div className="row-meta"><${TypeLabel} r=${r} />${r.type === 'task' ? html`<${StatusChip} r=${r} />` : null}${r.url ? html`<span className="host">${hostOf(r.url)}</span>` : null}</div></div>
        ${(rec.links.includes(r.id) || r.links.includes(rec.id)) ? html`<button className="btn sm ghost" onClick=${e => { e.stopPropagation(); unlinkRecords(rec.id, r.id); }}>Unlink</button>` : null}
      </div>`)}</div>` : null}
      <${LinkPicker} rec=${rec} />
    </div></div>`;
}
function History({ rec }) {
  const [d, setD] = useState('');
  const add = async () => { const v = d.trim(); if (!v) return; const ok = await appendLog(rec.id, entry('decision', 'Decision: ' + v, { manual: true })); if (ok) setD(''); };
  const items = [...rec.log].reverse();
  return html`<div><div className="sub-hd">Activity history <span className="n">${rec.log.length}</span></div>
    <div className="quick-bar" style=${{ marginBottom: '8px' }}><input className="inp sm" placeholder="Record a decision or note about this record" value=${d} onChange=${e => setD(e.target.value)} onKeyDown=${e => e.key === 'Enter' && add()} aria-label="Record a decision" /><button className="btn sm" onClick=${add}>Record</button></div>
    ${items.length ? html`<div className="list">${items.map((e, i) => html`<div key=${i} className="tl"><time dateTime=${e.at} title=${new Date(e.at).toLocaleString()}>${fmtDateTime(e.at)}</time><div className="what"><div><span className=${'kind' + (e.manual ? ' manual' : '')}>${e.manual ? 'Entered by you' : e.kind}</span>${e.text}</div></div></div>`)}</div>` : html`<div className="empty">No activity recorded.</div>`}
    <p className="small muted" style=${{ margin: '6px 0 0' }}>Times are recorded automatically when a change is saved. Only events the app actually recorded are shown.</p>
  </div>`;
}
function DatesBlock({ rec }) {
  const set = [['Deadline', rec.dueAt && fmtDay(rec.dueAt)], ['Scheduled for', rec.scheduledFor && fmtDay(rec.scheduledFor)], ['Reminder', rec.remindAt && fmtDateTime(rec.remindAt) + (rec.reminderDismissed ? ' (dismissed)' : '')],
    ['Start date', rec.startDate && fmtDay(rec.startDate)], ['Target date', rec.targetDate && fmtDay(rec.targetDate)], ['Last contact', rec.lastContact && fmtDay(rec.lastContact)], ['Next follow-up', rec.nextFollowUp && fmtDay(rec.nextFollowUp)]].filter(x => x[1]);
  const auto = [['Created', fmtDateTime(rec.createdAt)], ['Last updated', fmtDateTime(rec.updatedAt)], ['Completed', rec.completedAt && fmtDateTime(rec.completedAt)], ['Converted', rec.source && rec.source.convertedAt && fmtDateTime(rec.source.convertedAt)]].filter(x => x[1]);
  return html`<div className="grid2">
    <div><div className="sub-hd">Dates you set</div>${set.length ? html`<dl className="kv">${set.map(([k, v]) => html`<${React.Fragment} key=${k}><dt>${k}</dt><dd>${v}</dd><//>`)}</dl>` : html`<div className="small muted">None</div>`}</div>
    <div><div className="sub-hd">Recorded automatically</div><dl className="kv">${auto.map(([k, v]) => html`<${React.Fragment} key=${k}><dt>${k}</dt><dd>${v}</dd><//>`)}</dl></div>
  </div>`;
}
function SourceBlock({ rec }) {
  const { byId, openRecord } = useApp();
  const s = rec.source || {}; const from = s.fromId && byId.get(s.fromId);
  const url = rec.url || s.url;
  if (!url && !from && !s.convertedFrom && !s.fromTitle && !s.blockId) return null;
  return html`<div><div className="sub-hd">Source</div><dl className="kv">
    ${url ? html`<dt>Source URL</dt><dd>${safeHref(url) ? html`<a href=${url} target="_blank" rel="noopener noreferrer">${url}</a>` : url}</dd>` : null}
    ${from ? html`<dt>Created from</dt><dd><button className="linklike" onClick=${() => openRecord(from.id)}>${TYPE_LABEL[from.type]}: ${from.title}</button></dd>` : s.fromTitle ? html`<dt>Created from</dt><dd>${s.fromTitle} (deleted)</dd>` : null}
    ${s.blockId ? html`<dt>Checklist item</dt><dd>“${s.blockText || ''}”</dd>` : null}
    ${s.convertedFrom ? html`<dt>Converted from</dt><dd>${s.convertedFrom}${s.convertedAt ? ', ' + fmtDateTime(s.convertedAt) : ''}</dd>` : null}
  </dl></div>`;
}
function ReminderControls({ rec }) {
  const { act } = useApp();
  const due = isReminderDue(rec);
  const tomorrow9 = () => { const d = new Date(addDays(localDate(), 1) + 'T09:00:00'); return d.toISOString(); };
  return html`<div className="row-wrap">
    <input type="datetime-local" id="f-remind" className="inp sm" value=${isoToLocalInput(rec.remindAt)} onChange=${e => act.update(rec.id, { remindAt: localInputToIso(e.target.value) })} aria-label="Reminder" />
    <button className="btn sm ghost" onClick=${() => act.snooze(rec.id, 60)}>+1 hour</button>
    <button className="btn sm ghost" onClick=${() => act.update(rec.id, { remindAt: tomorrow9() })}>Tomorrow 9:00</button>
    ${due ? html`<button className="btn sm" onClick=${() => act.dismissReminder(rec.id)}>Dismiss</button>` : null}
    ${rec.remindAt ? html`<button className="btn sm ghost" onClick=${() => act.update(rec.id, { remindAt: null })}>Clear</button>` : null}
  </div>`;
}
function TaskDetail({ rec }) {
  const { act, byId, tasks, openRecord } = useApp();
  const [sub, setSub] = useState('');
  const blocked = isBlocked(rec, byId);
  const subtasks = sortTasks(tasks.filter(t => t.parentId === rec.id), 'smart');
  const desc = useMemo(() => { const s = new Set([rec.id]); let added = true; while (added) { added = false; tasks.forEach(t => { if (t.parentId && s.has(t.parentId) && !s.has(t.id)) { s.add(t.id); added = true; } }); } return s; }, [tasks, rec.id]);
  const depChain = id => { const seen = new Set(); let cur = byId.get(id); while (cur && cur.dependsOn && !seen.has(cur.id)) { seen.add(cur.id); if (cur.dependsOn === rec.id) return true; cur = byId.get(cur.dependsOn); } return false; };
  const depOptions = tasks.filter(t => t.id !== rec.id && !t.archived && (isOpenTask(t) || t.id === rec.dependsOn) && !depChain(t.id));
  const lead = rec.leadId && byId.get(rec.leadId);
  const addSub = async () => { const v = sub.trim(); if (!v) return; const ok = await act.create({ type: 'task', title: v, status: 'Next', parentId: rec.id, projectId: rec.projectId, topicId: rec.topicId }); if (ok) setSub(''); };
  return html`<div className="stack" style=${{ gap: '18px' }}>
    <div className="row-wrap">
      <button className=${'btn ' + (rec.status === 'Completed' ? '' : 'primary')} onClick=${() => act.toggleTask(rec)} id="detail-complete">${rec.status === 'Completed' ? 'Reopen task' : 'Complete task'}</button>
      ${blocked ? html`<span className="blocked small">⛓ Blocked until “${byId.get(rec.dependsOn).title}” is done</span>` : null}
    </div>
    <div className="grid2">
      <label className="field"><span>Status</span><select id="f-status" className="sel" value=${rec.status} onChange=${e => act.update(rec.id, { status: e.target.value })}>${TASK_STATUSES.map(s => html`<option key=${s}>${s}</option>`)}</select></label>
      <label className="field"><span>Priority</span><select id="f-priority" className="sel" value=${rec.priority} onChange=${e => act.update(rec.id, { priority: e.target.value })}>${PRIORITIES.map(s => html`<option key=${s}>${s}</option>`)}</select></label>
      <label className="field"><span>Project</span><${ProjectSelect} id="f-project" value=${rec.projectId} onChange=${v => act.update(rec.id, { projectId: v, inbox: v ? false : rec.inbox })} /></label>
      <label className="field"><span>Topic</span><${TopicSelect} id="f-topic" value=${rec.topicId} onChange=${v => act.update(rec.id, { topicId: v, inbox: v ? false : rec.inbox })} /></label>
      <label className="field"><span>Deadline</span><div className="row-wrap"><input type="date" id="f-due" className="inp sm" value=${rec.dueAt || ''} onChange=${e => act.update(rec.id, { dueAt: e.target.value || null })} />
        <button className="btn sm ghost" onClick=${() => act.update(rec.id, { dueAt: addDays(rec.dueAt && rec.dueAt > localDate() ? rec.dueAt : localDate(), 1) })}>+1 day</button>
        <button className="btn sm ghost" onClick=${() => act.update(rec.id, { dueAt: addDays(rec.dueAt && rec.dueAt > localDate() ? rec.dueAt : localDate(), 7) })}>+1 week</button></div><span className="hint">When it must be finished.</span></label>
      <label className="field"><span>Do on</span><div className="row-wrap"><input type="date" id="f-sched" className="inp sm" value=${rec.scheduledFor || ''} onChange=${e => act.update(rec.id, { scheduledFor: e.target.value || null })} />
        <button className="btn sm ghost" onClick=${() => act.update(rec.id, { scheduledFor: localDate() })}>Today</button></div><span className="hint">The day you plan to work on it.</span></label>
    </div>
    <label className="field"><span>Reminder</span><${ReminderControls} rec=${rec} /><span className="hint">Shown in the app when it comes due. No push notifications or email.</span></label>
    <div className="field"><span>Description</span><${RichEditor} id="f-body" doc=${rec.bodyDoc} delta=${rec.bodyDelta} text=${rec.body} ownerId=${rec.id} minHeight=${120} placeholder="Why this task exists, details, steps, acceptance criteria…" onSave=${v => act.update(rec.id, v)} /></div>
    <label className="field"><span>Source URL</span><${EditText} id="f-url" value=${rec.url} placeholder="https://" onSave=${v => act.update(rec.id, { url: v.trim() })} /></label>
    <div className="grid2">
      <label className="field"><span>Depends on</span><select id="f-dep" className="sel" value=${rec.dependsOn || ''} onChange=${e => act.update(rec.id, { dependsOn: e.target.value || null })}><option value="">No dependency</option>${depOptions.map(t => html`<option key=${t.id} value=${t.id}>${t.title}</option>`)}</select><span className="hint">This task is blocked until the other is completed.</span></label>
      <label className="field"><span>Parent task</span><select className="sel" value=${rec.parentId || ''} onChange=${e => act.update(rec.id, { parentId: e.target.value || null })}><option value="">None</option>${tasks.filter(t => !desc.has(t.id) && !t.archived).map(t => html`<option key=${t.id} value=${t.id}>${t.title}</option>`)}</select></label>
    </div>
    ${rec.parentId && byId.get(rec.parentId) ? html`<div className="small">Subtask of <button className="linklike" onClick=${() => openRecord(rec.parentId)}>${byId.get(rec.parentId).title}</button></div>` : null}
    ${lead ? html`<div className="small">Follow-up for lead <button className="linklike" onClick=${() => openRecord(lead.id)}>${lead.title}</button></div>` : null}
    <div><div className="sub-hd">Subtasks <span className="n">${subtasks.length}</span></div>
      ${subtasks.length ? html`<${TaskList} tasks=${subtasks} hideProject hideTopic />` : null}
      <div className="quick-bar" style=${{ marginTop: '8px' }}><input className="inp sm" placeholder="Add a subtask" value=${sub} onChange=${e => setSub(e.target.value)} onKeyDown=${e => e.key === 'Enter' && addSub()} /><button className="btn sm" onClick=${addSub}>Add</button></div></div>
    <${SourceBlock} rec=${rec} />
    <${ContextFiles} rec=${rec} />
    <${Related} rec=${rec} />
    <div><div className="sub-hd">Tags</div><${TagEditor} tags=${rec.tags} onSave=${tags => act.update(rec.id, { tags })} /></div>
    <${DatesBlock} rec=${rec} />
    <${History} rec=${rec} />
  </div>`;
}
function NoteDetail({ rec }) {
  const { act, openRecord, toast } = useApp();
  const words = (rec.body.match(/\S+/g) || []).length;
  const makeTask = async () => {
    const url = rec.url || findUrls(rec.body)[0] || '';
    const t = await act.create({ type: 'task', title: 'Follow up: ' + (rec.title || 'note'), status: 'Next', projectId: rec.projectId, topicId: rec.topicId, url, links: [rec.id], source: { fromId: rec.id, fromTitle: rec.title, url } }, null, [entry('created', `Created from ${typeNoun(rec)} “${rec.title}”`)]);
    if (t) { await appendLog(rec.id, entry('link', `Task created from this ${typeNoun(rec)}: ${t.title}`)); toast('Task created and linked'); openRecord(t.id, true); }
  };
  return html`<div className="stack" style=${{ gap: '18px' }}>
    <div className="grid3">
      <label className="field"><span>Kind</span><select className="sel" value=${rec.kind} onChange=${e => act.update(rec.id, { kind: e.target.value })}>${Object.entries(NOTE_KINDS).map(([k, l]) => html`<option key=${k} value=${k}>${l}</option>`)}</select></label>
      <label className="field"><span>Project</span><${ProjectSelect} id="f-project" value=${rec.projectId} onChange=${v => act.update(rec.id, { projectId: v, inbox: v ? false : rec.inbox })} /></label>
      <label className="field"><span>Topic</span><${TopicSelect} id="f-topic" value=${rec.topicId} onChange=${v => act.update(rec.id, { topicId: v, inbox: v ? false : rec.inbox })} /></label>
    </div>
    ${rec.kind === 'doc' ? html`<${DocMetaFields} rec=${rec} />` : null}
    <div className="field"><span>Reminder</span><${ReminderControls} rec=${rec} /><span className="hint">Remind me about this. Shown in the app when it comes due.</span></div>
    <div className="row-wrap">
      <button className="btn sm" onClick=${async () => toast((await copyText(rec.body)) ? 'Content copied' : 'Copy was blocked. Select the text in the editor instead.', 'info')}><${Icon} name="copy" size=${14} /> Copy content</button>
      <button className="btn sm" onClick=${makeTask} id="note-make-task">Create task from this</button>
      <span className="wordcount">${words.toLocaleString()} words · ${rec.body.length.toLocaleString()} characters</span>
    </div>
    <${RichEditor} id="f-body" doc=${rec.bodyDoc} delta=${rec.bodyDelta} text=${rec.body} ownerId=${rec.id} minHeight=${360} placeholder="Write, paste, or type '/' for headings, tables, toggles, code, checklists and more…" onSave=${v => act.update(rec.id, v)} />
    <label className="field"><span>Source URL</span><${EditText} id="f-url" value=${rec.url} placeholder="https://" onSave=${v => act.update(rec.id, { url: v.trim() })} /></label>
    <${SourceBlock} rec=${rec} />
    <${ContextFiles} rec=${rec} />
    <${Related} rec=${rec} />
    <div><div className="sub-hd">Tags</div><${TagEditor} tags=${rec.tags} onSave=${tags => act.update(rec.id, { tags })} /></div>
    <${DatesBlock} rec=${rec} />
    <${History} rec=${rec} />
  </div>`;
}
function ResourceDetail({ rec }) {
  const { act, openRecord, toast } = useApp();
  const makeTask = async () => { const t = await act.create({ type: 'task', title: 'Review: ' + rec.title, status: 'Next', projectId: rec.projectId, topicId: rec.topicId, url: rec.url, links: [rec.id], source: { fromId: rec.id, fromTitle: rec.title, url: rec.url } }); if (t) { toast('Task created and linked'); openRecord(t.id, true); } };
  return html`<div className="stack" style=${{ gap: '18px' }}>
    <label className="field"><span>URL</span><div className="row-wrap"><div style=${{ flex: 1, minWidth: '200px' }}><${EditText} id="f-url" className="inp" value=${rec.url} placeholder="https://" onSave=${v => act.update(rec.id, { url: v.trim() })} /></div>
      ${safeHref(rec.url) ? html`<a className="btn" href=${rec.url} target="_blank" rel="noopener noreferrer"><${Icon} name="ext" size=${14} /> Open</a>` : null}
      <button className="btn" onClick=${async () => toast((await copyText(rec.url)) ? 'Link copied' : 'Copy was blocked. Select the URL instead.')}>Copy</button></div></label>
    <div className="grid3">
      <label className="field"><span>Type</span><select className="sel" value=${rec.resType} onChange=${e => act.update(rec.id, { resType: e.target.value })}>${RES_TYPES.map(s => html`<option key=${s}>${s}</option>`)}</select></label>
      <label className="field"><span>Project</span><${ProjectSelect} id="f-project" value=${rec.projectId} onChange=${v => act.update(rec.id, { projectId: v, inbox: v ? false : rec.inbox })} /></label>
      <label className="field"><span>Topic</span><${TopicSelect} id="f-topic" value=${rec.topicId} onChange=${v => act.update(rec.id, { topicId: v, inbox: v ? false : rec.inbox })} /></label>
    </div>
    <div className="field"><span>Description and notes</span><${RichEditor} id="f-body" doc=${rec.bodyDoc} delta=${rec.bodyDelta} text=${rec.body} ownerId=${rec.id} minHeight=${120} placeholder="What is this and why did you save it?" onSave=${v => act.update(rec.id, v)} /></div>
    <div className="field"><span>Reminder</span><${ReminderControls} rec=${rec} /><span className="hint">Remind me about this. Shown in the app when it comes due.</span></div>
    <div className="row-wrap"><button className="btn sm" onClick=${makeTask}>Create task from this</button></div>
    <${ContextFiles} rec=${rec} />
    <${Related} rec=${rec} />
    <div><div className="sub-hd">Tags</div><${TagEditor} tags=${rec.tags} onSave=${tags => act.update(rec.id, { tags })} /></div>
    <${DatesBlock} rec=${rec} />
    <${History} rec=${rec} />
  </div>`;
}
function LeadDetail({ rec }) {
  const { act, tasks, openRecord, toast } = useApp();
  const [fu, setFu] = useState({ date: addDays(localDate(), 2), time: '10:00', note: '' });
  const [contactNote, setContactNote] = useState('');
  const lt = sortTasks(tasks.filter(t => t.leadId === rec.id), 'smart');
  const schedule = async () => {
    if (!fu.date) return toast('Choose a follow-up date.', 'bad');
    const remindAt = localInputToIso(fu.date + 'T' + (fu.time || '09:00'));
    const t = await act.create({ type: 'task', title: 'Follow up with ' + rec.title, body: fu.note, status: 'Next', priority: rec.priority, leadId: rec.id, projectId: rec.projectId, dueAt: fu.date, remindAt, url: rec.url, links: [rec.id], source: { fromId: rec.id, fromTitle: rec.title, url: rec.url } });
    if (t) {
      await act.update(rec.id, { nextFollowUp: fu.date, status: ['New', 'Researching', 'Contacted'].includes(rec.status) ? 'Follow-up' : rec.status }, [entry('link', `Follow-up task scheduled for ${fmtDay(fu.date)}`)]);
      setFu({ ...fu, note: '' }); toast('Follow-up task created with a reminder');
    }
  };
  const logContact = async () => { const ok = await act.update(rec.id, { lastContact: localDate(), status: rec.status === 'New' || rec.status === 'Researching' ? 'Contacted' : rec.status }, [entry('contact', 'Contacted' + (contactNote.trim() ? ': ' + contactNote.trim() : ''), { manual: true })]); if (ok) setContactNote(''); };
  return html`<div className="stack" style=${{ gap: '18px' }}>
    <div className="grid2">
      <label className="field"><span>Website</span><div className="row-wrap"><div style=${{ flex: 1, minWidth: '160px' }}><${EditText} id="f-url" value=${rec.url} placeholder="https://" onSave=${v => act.update(rec.id, { url: v.trim() })} /></div>${safeHref(rec.url) ? html`<a className="btn sm" href=${rec.url} target="_blank" rel="noopener noreferrer">Open ↗</a>` : null}</div></label>
      <label className="field"><span>Status</span><select className="sel" value=${rec.status} onChange=${e => act.update(rec.id, { status: e.target.value })}>${LEAD_STATUSES.map(s => html`<option key=${s}>${s}</option>`)}</select></label>
      <label className="field"><span>Contact name</span><${EditText} value=${rec.contactName} onSave=${v => act.update(rec.id, { contactName: v })} /></label>
      <label className="field"><span>Contact details</span><${EditText} value=${rec.contact} placeholder="Email or phone" onSave=${v => act.update(rec.id, { contact: v })} /></label>
      <label className="field"><span>Priority</span><select className="sel" value=${rec.priority} onChange=${e => act.update(rec.id, { priority: e.target.value })}>${PRIORITIES.map(s => html`<option key=${s}>${s}</option>`)}</select></label>
      <label className="field"><span>Project</span><${ProjectSelect} value=${rec.projectId} onChange=${v => act.update(rec.id, { projectId: v })} /></label>
      <label className="field"><span>Last contact</span><input type="date" className="inp" value=${rec.lastContact || ''} onChange=${e => act.update(rec.id, { lastContact: e.target.value || null })} /></label>
      <label className="field"><span>Next follow-up</span><input type="date" className="inp" value=${rec.nextFollowUp || ''} onChange=${e => act.update(rec.id, { nextFollowUp: e.target.value || null })} /></label>
    </div>
    <div className="field"><span>Notes</span><${RichEditor} id="f-body" doc=${rec.bodyDoc} delta=${rec.bodyDelta} text=${rec.body} ownerId=${rec.id} minHeight=${120} placeholder="What they need, what you noticed on their site…" onSave=${v => act.update(rec.id, v)} /></div>
    <div className="field"><span>Reminder</span><${ReminderControls} rec=${rec} /><span className="hint">Remind me about this. Shown in the app when it comes due.</span></div>
    <div className="panel" style=${{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div className="sub-hd" style=${{ margin: 0 }}>Schedule a follow-up</div>
      <div className="row-wrap"><input type="date" id="fu-date" className="inp sm" value=${fu.date} onChange=${e => setFu({ ...fu, date: e.target.value })} aria-label="Follow-up date" /><input type="time" id="fu-time" className="inp sm" value=${fu.time} onChange=${e => setFu({ ...fu, time: e.target.value })} aria-label="Reminder time" />
        <input className="inp sm" style=${{ flex: 1, minWidth: '160px' }} placeholder="What to follow up about (optional)" value=${fu.note} onChange=${e => setFu({ ...fu, note: e.target.value })} />
        <button className="btn sm" id="fu-create" onClick=${schedule}>Create follow-up task</button></div>
      <span className="small muted">Creates a real task with that deadline and an in-app reminder at the chosen time.</span>
    </div>
    <div className="quick-bar"><input className="inp sm" placeholder="Log a contact (optional note)" value=${contactNote} onChange=${e => setContactNote(e.target.value)} onKeyDown=${e => e.key === 'Enter' && logContact()} /><button className="btn sm" onClick=${logContact}>Log contact today</button></div>
    <div><div className="sub-hd">Tasks for this lead <span className="n">${lt.length}</span></div><${TaskList} tasks=${lt} empty="No tasks yet. Schedule a follow-up above." /></div>
    <${ContextFiles} rec=${rec} />
    <${Related} rec=${rec} />
    <${DatesBlock} rec=${rec} />
    <${History} rec=${rec} />
  </div>`;
}
function RecordDetail({ id, onClose, onBack, canBack, docked }) {
  const { byId, act, confirm, toast, openRecord } = useApp();
  const rec = byId.get(id);
  // close only after typed-but-uncommitted edits are saved; a refused save keeps the drawer open with the text
  const closing = useRef(false);
  const guarded = fn => async () => {
    if (closing.current) return;
    if (!hasPendingEdits()) return fn(); // nothing typed and unsaved: close at once, as before
    closing.current = true; const ok = await flushPendingEdits(); closing.current = false;
    if (ok) fn(); else toast('Not closed: a change here could not be saved. Your text is kept; try again.', 'bad');
  };
  const safeClose = guarded(onClose); const safeBack = guarded(onBack || (() => {}));
  useEffect(() => { const k = e => { if (e.key === 'Escape' && !document.querySelector('.modal-wrap') && !window.__wosPopupOpen) safeClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  if (!rec) return html`<div className=${'drawer' + (docked ? ' docked' : '')}><div className="drawer-hd"><span className="grow">This record no longer exists.</span><button className="btn icon ghost" aria-label="Close" onClick=${onClose}><${Icon} name="x" /></button></div></div>`;
  const label = rec.type === 'note' ? NOTE_KINDS[rec.kind] : rec.type === 'resource' ? 'Resource · ' + rec.resType : TYPE_LABEL[rec.type];
  const duplicate = async () => { const { id: _i, log, createdAt, updatedAt, completedAt, ...rest } = rec; const t = await act.create({ ...rest, title: rec.title + ' (copy)', status: rec.type === 'task' ? 'Next' : rec.status, sample: false, reminderDismissed: false }, null, [entry('created', `Duplicated from “${rec.title}”`)]); if (t) { toast('Duplicated'); openRecord(t.id, true); } };
  const copyAll = async () => toast((await copyText((rec.title ? rec.title + '\n\n' : '') + rec.body + (rec.url ? '\n\n' + rec.url : ''))) ? 'Copied' : 'Copy was blocked by the browser.');
  return html`<${React.Fragment}>
    ${docked ? null : html`<div className="backdrop" onClick=${safeClose}></div>`}
    <aside className=${'drawer' + (docked ? ' docked' : '')} role=${docked ? 'complementary' : 'dialog'} aria-label=${rec.title} data-id=${rec.id}>
      <div className="drawer-hd">
        ${canBack ? html`<button className="btn icon ghost" aria-label="Back" onClick=${safeBack}><${Icon} name="back" /></button>` : null}
        <span className="chip type"><${TypeIcon} r=${rec} size=${12} />${label}</span>${rec.inbox ? html`<${Chip} kind="warn">Inbox<//>` : null}${rec.archived ? html`<${Chip}>Archived<//>` : null}${rec.sample ? html`<${Chip} kind="sample">Sample<//>` : null}
        <span className="grow"></span>
        <button className="btn sm ghost hide-sm" onClick=${copyAll}>Copy</button>
        ${rec.type === 'task' ? html`<button className="btn sm ghost" onClick=${duplicate}>Duplicate</button>` : null}
        <button className="btn sm ghost" onClick=${() => act.update(rec.id, { archived: !rec.archived, inbox: false })}>${rec.archived ? 'Restore' : 'Archive'}</button>
        <button className="btn sm danger" onClick=${() => confirm({ title: `Delete this ${typeNoun(rec)}?`, body: `“${rec.title}” will be deleted permanently. Records linked to it are kept; only the links are removed.`, confirmLabel: 'Delete', danger: true, onConfirm: async () => { const ok = await act.remove(rec.id); if (ok) onClose(); } })}>Delete</button>
        <button className="btn icon ghost" aria-label="Close" onClick=${safeClose}><${Icon} name="x" /></button>
      </div>
      <div className="drawer-bd">
        <${EditText} id="f-title" className="inp title-inp" value=${rec.title} placeholder="Title" onSave=${v => act.update(rec.id, { title: v.trim() || rec.title })} />
        ${rec.type === 'task' ? html`<${TaskDetail} rec=${rec} />` : rec.type === 'note' ? html`<${NoteDetail} key=${rec.id} rec=${rec} />` : rec.type === 'resource' ? html`<${ResourceDetail} rec=${rec} />` : rec.type === 'lead' ? html`<${LeadDetail} rec=${rec} />` : rec.type === 'prompt' ? html`<${PromptDetail} key=${rec.id} rec=${rec} />`
          : html`<div><button className="btn" onClick=${() => openRecord(rec.id)}>Open ${typeNoun(rec)} page</button></div>`}
      </div>
    </aside>
  <//>`;
}

/* ---------- checklist item → task ---------- */
const PAGE_ICON = { note: '📄', topic: '🏷', project: '📁', task: '☑', file: '📎', resource: '🔗', lead: '👤' };
function ConvertTodoModal({ info, onDone }) {
  const { byId, act, toast } = useApp();
  let owner = info.ownerId && byId.get(info.ownerId);
  const doc = owner; if (owner && owner.type === 'file' && owner.ownerId) owner = byId.get(owner.ownerId) || owner;
  const [title, setTitle] = useState(info.text || '');
  const [projectId, setProjectId] = useState(owner ? (owner.type === 'project' ? owner.id : owner.projectId) : null);
  const [topicId, setTopicId] = useState(owner ? (owner.type === 'topic' ? owner.id : owner.topicId) : null);
  const [priority, setPriority] = useState('Normal'); const [remind, setRemind] = useState(''); const [due, setDue] = useState(''); const [busy, setBusy] = useState(false);
  const create = async () => {
    if (!title.trim() || busy) return; setBusy(true);
    const t = await act.create({ type: 'task', title: title.trim(), status: 'Next', priority, projectId: projectId || null, topicId: topicId || null, remindAt: localInputToIso(remind), dueAt: due || null, links: doc ? [doc.id] : [],
      source: { fromId: doc ? doc.id : null, fromTitle: doc ? doc.title : '', blockId: info.blockId, blockText: info.text } }, 'checklist item');
    setBusy(false);
    if (t) { if (doc) await appendLog(doc.id, entry('link', `Checklist item converted to task: ${t.title}`)); toast('Task created and linked to the checklist item'); onDone(t.id); }
  };
  return html`<${Modal} title="Convert checklist item to task" onClose=${() => onDone(null)} small>
    <div className="modal-bd">
      <label className="field"><span>Task title</span><input id="ct-title" className="inp" value=${title} onChange=${e => setTitle(e.target.value)} autoFocus /></label>
      <div className="grid2">
        <label className="field"><span>Project</span><${ProjectSelect} id="ct-project" value=${projectId} onChange=${setProjectId} /></label>
        <label className="field"><span>Topic</span><${TopicSelect} id="ct-topic" value=${topicId} onChange=${setTopicId} /></label>
        <label className="field"><span>Priority</span><select id="ct-priority" className="sel" value=${priority} onChange=${e => setPriority(e.target.value)}>${PRIORITIES.map(p => html`<option key=${p}>${p}</option>`)}</select></label>
        <label className="field"><span>Deadline</span><input id="ct-due" type="date" className="inp" value=${due} onChange=${e => setDue(e.target.value)} /></label>
      </div>
      <label className="field"><span>Reminder (optional)</span><input id="ct-remind" type="datetime-local" className="inp" value=${remind} onChange=${e => setRemind(e.target.value)} /></label>
      <p className="small muted" style=${{ margin: 0 }}>The task links back to ${doc ? '“' + doc.title + '”' : 'this document'}. Ticking the checklist item later does not complete the task.</p>
    </div>
    <div className="modal-ft"><button className="btn ghost" onClick=${() => onDone(null)}>Cancel</button><button className="btn primary" id="ct-create" disabled=${busy || !title.trim()} onClick=${create}>${busy ? 'Creating…' : 'Create task'}</button></div>
  <//>`;
}

/* ---------- context files (long text kept beside a record, like project knowledge files) ---------- */
const wordCount = t => ((t || '').match(/\S+/g) || []).length;
function ContextFiles({ rec }) {
  const { recs, act, openFile, toast } = useApp();
  const files = recs.filter(r => r.type === 'file' && r.ownerId === rec.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const upRef = useRef(null);
  const add = async (extra = {}) => { const f = await act.create({ type: 'file', title: 'Untitled context', ownerId: rec.id, ...extra }, null); if (f) { await appendLog(rec.id, entry('note', `Context file added: ${f.title}`)); openFile(f.id, !extra.body); } return f; };
  const moveDesc = async () => {
    if (!rec.body.trim()) return;
    const f = await act.create({ type: 'file', title: (rec.title ? rec.title + ' — ' : '') + 'description', ownerId: rec.id, body: rec.body, bodyDoc: rec.bodyDoc, bodyDelta: rec.bodyDelta }, null, [entry('created', 'Moved here from the description')]);
    if (!f) return;
    const ok = await act.update(rec.id, { body: '', bodyDoc: null, bodyDelta: null }, [entry('note', `Description moved to context file “${f.title}”`)]);
    if (ok) { toast('Description moved into a context file'); openFile(f.id); }
  };
  const onUpload = e => {
    const list = [...(e.target.files || [])]; e.target.value = '';
    list.forEach(file => {
      if (file.size > 200000) { toast(`${file.name} is larger than 200 KB. Split it into smaller files.`, 'bad'); return; }
      const fr = new FileReader();
      fr.onload = async () => { const f = await act.create({ type: 'file', title: file.name.replace(/\.(md|markdown|txt)$/i, ''), ownerId: rec.id, body: String(fr.result) }, null, [entry('created', `Uploaded from ${file.name}`)]); if (f) { await appendLog(rec.id, entry('note', `Context file uploaded: ${f.title}`)); toast(`Added ${file.name}`); } };
      fr.onerror = () => toast(`Could not read ${file.name}`, 'bad'); fr.readAsText(file);
    });
  };
  return html`<div className="ctx" data-ctx=${rec.id}>
    <div className="sub-hd">Context files <span className="n">${files.length}</span><span className="grow"></span>
      ${rec.body && rec.body.trim() ? html`<button className="btn sm ghost ctx-move" onClick=${moveDesc} title="Move the description text into its own file">Move description into a file</button>` : null}
      <input ref=${upRef} type="file" className="sr" accept=".md,.markdown,.txt,text/plain,text/markdown" multiple onChange=${onUpload} />
      <button className="btn sm ghost" onClick=${() => upRef.current && upRef.current.click()}>Upload .md / .txt</button>
      <button className="btn sm ctx-add" onClick=${() => add()}><${Icon} name="plus" size=${14} /> Add file</button></div>
    ${files.length ? html`<div className="ctx-grid">${files.map(f => html`<button key=${f.id} className="ctx-card" onClick=${() => openFile(f.id)} title=${'Open ' + f.title}>
        <span className="ctx-ico"><${Icon} name="notes" size=${18} /></span>
        <span className="ctx-t">${f.title || 'Untitled context'}</span>
        <span className="ctx-x">${excerpt(f.body, null, 90) || 'Empty'}</span>
        <span className="ctx-m">${wordCount(f.body).toLocaleString()} words · ${relTime(f.updatedAt)}</span>
      </button>`)}</div>`
      : html`<div className="empty small">Keep long reference text here: specs, briefs, transcripts, research. Each file opens in its own window and is searchable.</div>`}
  </div>`;
}
function FileModal({ id, onClose, focusTitle }) {
  const { byId, act, confirm, toast, openRecord } = useApp();
  const f = byId.get(id);
  const owner = f && f.ownerId && byId.get(f.ownerId);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => { if (focusTitle) setTimeout(() => { const el = document.getElementById('file-title'); el && (el.focus(), el.select()); }, 50); }, []);
  if (!f) return null;
  const close = () => {
    onClose();
    setTimeout(() => { const cur = store.get(id); if (cur && cur.title === 'Untitled context' && !cur.body.trim()) deleteRecord(id); }, 400);
  };
  const download = async () => {
    const name = (f.title || 'context').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 80) + '.md';
    let dl = null; try { dl = window.claude && await window.claude.use('downloads'); } catch (e) { }
    if (!dl) return toast('Download is not available here. Use Copy instead.', 'bad');
    try { await dl.save({ filename: name, data: (f.title ? '# ' + f.title + '\n\n' : '') + f.body }); } catch (e) { if (!e || e.code !== 'cancelled') toast('Download failed.', 'bad'); }
  };
  const head = html`<div style=${{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
    <div className="eyebrow">Context file${owner ? html` · ${TYPE_LABEL[owner.type]} <button className="linklike" onClick=${() => { onClose(); openRecord(owner.id); }}>${owner.title}</button>` : ' · not attached'}</div>
    <${EditText} id="file-title" className="inp title-inp" value=${f.title} placeholder="Context title" onSave=${v => act.update(id, { title: v.trim() || 'Untitled context' })} /></div>`;
  return html`<${Modal} title=${f.title || 'Context file'} onClose=${close} wide head=${head}>
    <div className="modal-bd" style=${{ paddingTop: '8px' }}>
      <div className="row-wrap small fg2"><span>${wordCount(f.body).toLocaleString()} words · ${f.body.length.toLocaleString()} characters</span><span>·</span><span>Updated ${relTime(f.updatedAt)}</span>
        <span style=${{ flex: 1 }}></span>
        <button className="btn sm ghost" onClick=${async () => toast((await copyText(f.body)) ? 'Copied' : 'Copy was blocked. Select the text instead.')}><${Icon} name="copy" size=${14} /> Copy</button>
        <button className="btn sm ghost" onClick=${download}>Download .md</button>
        <button className="btn sm danger" onClick=${() => confirm({ title: 'Delete this context file?', body: `“${f.title}” will be deleted permanently.`, confirmLabel: 'Delete file', danger: true, onConfirm: async () => { const ok = await deleteRecord(id); if (ok) { if (owner) appendLog(owner.id, entry('note', `Context file deleted: ${f.title}`)); toast('Context file deleted'); onClose(); } } })}>Delete</button></div>
      <${RichEditor} id="file-body" doc=${f.bodyDoc} delta=${f.bodyDelta} text=${f.body} ownerId=${f.id} minHeight=${380} placeholder="Paste or write the context here. Long text is saved in full." onSave=${v => act.update(id, v)} />
    </div>
  <//>`;
}

/* ---------- quick capture ---------- */
const CAPTURE_TYPES = [['note', 'Note'], ['task', 'Task'], ['resource', 'Bookmark'], ['idea', 'Idea'], ['doc', 'Document']];
/** Floating, non-blocking capture panel anchored to the button in the bottom-right corner. Drafts survive closing. */
function CapturePanel({ open, preset, onClose }) {
  const { act, recs, byId, toast, openRecord } = useApp();
  const [type, setType] = useState('note');
  const [title, setTitle] = useState(''); const [content, setContent] = useState(''); const [contentDoc, setContentDoc] = useState(null); const [url, setUrl] = useState('');
  const [projectId, setProjectId] = useState(null); const [topicId, setTopicId] = useState(null);
  const [tags, setTags] = useState(''); const [priority, setPriority] = useState('Normal'); const [remind, setRemind] = useState(''); const [due, setDue] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [more, setMore] = useState(false); const [ek, setEk] = useState(0);
  const panelRef = useRef(null);
  useEffect(() => {
    if (!preset) return;
    if (preset.type) setType(preset.type);
    if (preset.projectId !== undefined) setProjectId(preset.projectId || null);
    if (preset.topicId !== undefined) setTopicId(preset.topicId || null);
    if (preset.projectId || preset.topicId) setMore(true);
  }, [preset && preset.n]);
  useEffect(() => { if (open) setTimeout(() => { const e = panelRef.current && panelRef.current.querySelector('#cap-content [contenteditable="true"]'); e && e.focus(); }, 40); }, [open, preset && preset.n]);
  useEffect(() => { if (!open) return; const k = e => { if (e.key === 'Escape' && !window.__wosPopupOpen && !document.querySelector('.modal-wrap')) { e.stopPropagation(); onClose(); } }; window.addEventListener('keydown', k, true); return () => window.removeEventListener('keydown', k, true); }, [open, onClose]);
  const reset = () => { setTitle(''); setContent(''); setContentDoc(null); setUrl(''); setTags(''); setPriority('Normal'); setRemind(''); setDue(''); setErr(''); setEk(k => k + 1); };
  const urls = findUrls(content);
  const effUrl = type === 'resource' ? (url.trim() || urls[0] || '') : url.trim();
  const dup = effUrl && recs.find(r => r.type === 'resource' && r.url && r.url.replace(/\/$/, '') === effUrl.replace(/\/$/, ''));
  const save = async () => {
    setErr('');
    if (type === 'resource' && !effUrl) { setErr('Add a URL to save a bookmark, or switch to Note.'); return; }
    if (type === 'resource' && effUrl && !/^https?:\/\//i.test(effUrl)) { setErr('The URL must start with http:// or https://'); return; }
    const t = title.trim() || firstLine(content) || (effUrl ? hostOf(effUrl) : '');
    if (!t) { setErr('Add a title or some content.'); return; }
    const onlyUrl = type === 'resource' && content.trim() === effUrl;
    const hasText = content.trim().length > 0 && !onlyUrl;
    const base = { title: t, body: hasText ? content : '', bodyDoc: hasText ? contentDoc : null, bodyDelta: null, tags: parseTags(tags), projectId, topicId, inbox: !projectId && !topicId, remindAt: localInputToIso(remind) };
    let rec;
    if (type === 'task') rec = { ...base, type: 'task', status: 'Next', priority, dueAt: due || null, url: effUrl || urls[0] || '', source: (effUrl || urls[0]) ? { url: effUrl || urls[0] } : null };
    else if (type === 'resource') rec = { ...base, type: 'resource', url: effUrl, resType: guessResType(effUrl) };
    else rec = { ...base, type: 'note', kind: type === 'note' ? 'note' : type, url: effUrl || urls[0] || '' };
    setBusy(true);
    const created = await act.create(rec, 'Quick Capture');
    setBusy(false);
    if (!created) { setErr('Not saved. Check the message at the bottom of the screen and try again.'); return; }
    const where = projectId ? byId.get(projectId).title : topicId ? byId.get(topicId).title : 'Inbox';
    toast(`Saved to ${where}${created.remindAt ? ' · reminder ' + fmtDateTime(created.remindAt) : ''}`);
    reset(); onClose();
  };
  const in1h = () => { const d = new Date(Date.now() + 3600000); setRemind(isoToLocalInput(d.toISOString())); };
  const tom9 = () => setRemind(addDays(localDate(), 1) + 'T09:00');
  return html`<section className="cap-panel" ref=${panelRef} hidden=${!open} role="dialog" aria-label="Quick capture" id="cap-panel"
      onKeyDown=${e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); save(); } }}>
    <div className="cap-hd">
      <div className="seg" role="radiogroup" aria-label="Type">${CAPTURE_TYPES.map(([k, l]) => html`<button key=${k} role="radio" aria-checked=${type === k} className=${type === k ? 'on' : ''} onClick=${() => setType(k)} id=${'cap-type-' + k}>${l}</button>`)}</div>
      <span className="grow"></span>
      <button className="btn icon ghost sm" aria-label="Close quick capture (draft is kept)" title="Close (draft is kept)" onClick=${onClose}><${Icon} name="x" size=${14} /></button>
    </div>
    <div className="cap-bd">
      <input id="cap-title" className="inp" placeholder=${type === 'resource' ? 'Title (optional, uses the site name)' : 'Title (optional, uses the first line)'} value=${title} onChange=${e => setTitle(e.target.value)} />
      ${type === 'resource' ? html`<input id="cap-url" className="inp" placeholder="https://" value=${url} onChange=${e => setUrl(e.target.value)} />` : null}
      <${RichEditor} key=${ek} id="cap-content" minHeight=${type === 'doc' ? 220 : 110} placeholder=${type === 'resource' ? 'Description or notes (optional)' : type === 'task' ? 'Details (optional)' : 'Write a quick note…'} compact onChange=${v => { setContent(v.body); setContentDoc(v.bodyDoc); }} />
      ${type !== 'resource' && urls.length ? html`<div className="detect"><${Icon} name="link" size=${14} /><span style=${{ flex: 1, minWidth: '140px' }}>Link found: <span className="host">${hostOf(urls[0])}</span></span>
        <button className="btn sm" id="cap-as-bookmark" onClick=${() => { setType('resource'); setUrl(urls[0]); }}>Save as bookmark</button></div>` : null}
      ${dup ? html`<div className="banner warn"><span className="grow">Already saved as “${dup.title}”.</span><button className="btn sm" onClick=${() => openRecord(dup.id)}>Open it</button></div>` : null}
      <div className="field"><span>Remind me (optional)</span>
        <div className="row-wrap"><input id="cap-remind" type="datetime-local" className="inp sm" value=${remind} onChange=${e => setRemind(e.target.value)} aria-label="Reminder" />
          <button className="btn sm ghost" onClick=${in1h}>In 1 hour</button><button className="btn sm ghost" onClick=${tom9}>Tomorrow 9:00</button>
          ${remind ? html`<button className="btn sm ghost" onClick=${() => setRemind('')}>Clear</button>` : null}</div></div>
      ${type === 'task' ? html`<div className="grid2">
        <label className="field"><span>Priority</span><select id="cap-priority" className="sel" value=${priority} onChange=${e => setPriority(e.target.value)}>${PRIORITIES.map(p => html`<option key=${p}>${p}</option>`)}</select></label>
        <label className="field"><span>Deadline</span><input id="cap-due" type="date" className="inp" value=${due} onChange=${e => setDue(e.target.value)} /></label>
      </div>` : null}
      <button className="linklike small" onClick=${() => setMore(!more)} aria-expanded=${more} id="cap-more">${more ? 'Hide' : 'Add'} project, topic and tags${!more && (projectId || topicId) ? ' (set)' : ''}</button>
      <div className="grid2" hidden=${!more}>
        <label className="field"><span>Project</span><${ProjectSelect} id="cap-project" value=${projectId} onChange=${setProjectId} noneLabel="None (Inbox)" /></label>
        <label className="field"><span>Topic</span><${TopicSelect} id="cap-topic" value=${topicId} onChange=${setTopicId} noneLabel="None" /></label>
        <label className="field" style=${{ gridColumn: '1 / -1' }}><span>Tags</span><input id="cap-tags" className="inp" placeholder="comma, separated" value=${tags} onChange=${e => setTags(e.target.value)} /></label>
      </div>
      ${err ? html`<div className="banner bad" role="alert">${err}</div>` : null}
    </div>
    <div className="cap-ft"><span className="grow">${!projectId && !topicId ? 'Goes to Inbox · ' : ''}Ctrl/⌘+Enter</span>
      <button className="btn ghost sm" onClick=${() => { reset(); }}>Clear</button>
      <button className="btn primary" id="cap-save" disabled=${busy} onClick=${save}>${busy ? 'Saving…' : 'Save'}</button></div>
  </section>`;
}

/* ---------- settings & backup ---------- */
function ThemeSetting() {
  const [t, setT] = useState(window.__wosTheme || 'system'); const [warn, setWarn] = useState(false);
  const pick = v => { applyTheme(v); setT(v); setWarn(!saveThemePref(v)); };
  return html`<div id="theme-setting"><div className="sub-hd">Appearance</div>
    <div className="seg" role="radiogroup" aria-label="Theme">${[['system', 'System'], ['light', 'Light'], ['dark', 'Dark']].map(([k, l]) => html`<button key=${k} id=${'theme-' + k} role="radio" aria-checked=${t === k} className=${t === k ? 'on' : ''} onClick=${() => pick(k)}>${l}</button>`)}</div>
    <p className="small muted" style=${{ margin: '6px 0 0' }}>${t === 'system' ? 'Follows your device or claude.ai theme.' : `Always ${t}, whatever your device uses.`} Saved in this browser only.</p>
    ${warn ? html`<p className="small" role="status" style=${{ margin: '4px 0 0', color: 'var(--warn)' }}>This browser blocked saving the choice. It applies until you reload.</p>` : null}
  </div>`;
}
function SettingsModal({ onClose }) {
  const { recs, act, toast, confirm } = useApp();
  const [text, setText] = useState(''); const [check, setCheck] = useState(null); const [busy, setBusy] = useState(''); const [progress, setProgress] = useState('');
  const fileRef = useRef(null);
  const sampleCount = recs.filter(r => r.sample).length;
  const modeText = { db: window.WOS_HOST ? 'Saved to your own Supabase database. Only your login can read it, and it syncs across your devices.' : 'Saved to your private Artifact storage. It is tied to your claude.ai account and kept across reloads and devices. Only you can read it.', local: 'Artifact storage is not available in this view, so data is saved in this browser only. It will not appear on other devices and is lost if site data is cleared. Export a backup regularly.', memory: 'No storage is available in this view. Nothing is saved after you close the page. Export your data before leaving.', connecting: 'Connecting…' }[store.mode];
  const doExport = async () => {
    const data = JSON.stringify(exportPayload(), null, 2);
    const name = `work-os-backup-${localDate()}.json`;
    let dl = null; try { dl = window.claude && await window.claude.use('downloads'); } catch (e) { }
    if (dl) { try { const r = await dl.save({ filename: name, data }); toast(r && r.status === 'saved' ? 'Backup saved' : 'Backup handed to your device'); return; } catch (e) { if (e && e.code === 'cancelled') return; toast('Download unavailable here. Use Copy JSON instead.', 'bad'); return; } }
    toast('Download is not available in this view. Use Copy JSON and paste it into a file.', 'bad');
  };
  const doCopy = async () => toast((await copyText(JSON.stringify(exportPayload(), null, 2))) ? `Copied ${recs.length} records as JSON` : 'Copy was blocked by the browser.', 'info');
  const runCheck = t => { const res = validateImport(t, store.all()); setCheck(res); setReport(null); setAllowOlder(false); };
  const onFile = e => { const f = e.target.files && e.target.files[0]; if (!f) return; const fr = new FileReader(); fr.onload = () => { setText(String(fr.result)); runCheck(String(fr.result)); }; fr.onerror = () => setCheck({ error: 'Could not read that file.' }); fr.readAsText(f); e.target.value = ''; };
  const [allowOlder, setAllowOlder] = useState(false); const [report, setReport] = useState(null);
  const importLog = () => ({ at: nowISO(), kind: 'import', text: 'Imported from backup' });
  /** Merge: adds new records and replaces only local copies the backup proves older. Never deletes anything. */
  const doMerge = async () => {
    if (!check || check.error) return;
    const list = mergeSelection(check, allowOlder);
    if (!list.length) { setReport({ ok: true, text: 'Nothing to import: every record in the backup is already here in the same or a newer version.' }); return; }
    setBusy('merge'); setReport(null); const at = importLog();
    const res = await runPool(list, r => persist(withLog({ ...r }, [at])), 4, (d, n) => setProgress(`Importing ${d} of ${n}…`));
    setBusy(''); setProgress('');
    if (res.fails) setReport({ ok: false, text: `Merge finished with problems: ${res.done - res.fails} of ${res.done} records were saved and ${res.fails} were not (see the messages at the bottom of the screen). Nothing was deleted. You can run the same merge again; records already saved are skipped as the same version.` });
    else { toast(`Imported ${res.done} records`); setReport({ ok: true, text: `Imported ${res.done} records. Nothing was deleted.` }); setCheck(null); setText(''); }
  };
  /**
   * Replace: storage has no transactions, so this is not atomic. To make sure no record can go missing it
   * (1) saves a safety copy of the whole workspace to your device first, and stops if that is declined,
   * (2) writes every backup record without deleting anything,
   * (3) if any write fails, writes the earlier versions back and deletes nothing,
   * (4) only when every write succeeded, removes records that are not in the backup.
   */
  const doReplace = async () => {
    if (!check || check.error || !check.records.length) return;
    setBusy('replace'); setReport(null);
    const before = exportPayload(); const prev = new Map(before.records.map(r => [r.id, r]));
    setProgress('Saving a safety copy of your current workspace…');
    let dl = null; try { dl = window.claude && await window.claude.use('downloads'); } catch (e) { }
    let copied = false;
    if (dl) { try { await dl.save({ filename: `work-os-before-replace-${localDate()}.json`, data: JSON.stringify(before, null, 2) }); copied = true; } catch (e) { copied = false; } }
    if (!copied) { setBusy(''); setProgress(''); setReport({ ok: false, text: 'Replace stopped before changing anything: the safety copy of your current workspace was not saved. Nothing was written or deleted.' }); return; }
    const at = importLog(); const written = [];
    const w = await runPool(check.records, async r => { const ok = await persist(withLog({ ...r }, [at])); if (ok) written.push(r.id); return ok; }, 4, (d, n) => setProgress(`Writing ${d} of ${n} backup records…`));
    if (w.fails) {
      setProgress('A write failed. Putting your earlier records back…');
      const undo = await runPool(written, id => prev.has(id) ? persist(prev.get(id)) : removeDoc(id), 4);
      setBusy(''); setProgress('');
      setReport({ ok: false, text: `Replace stopped: ${w.fails} of ${check.records.length} backup records could not be written, so nothing was deleted. ${undo.fails ? `${undo.fails} of ${written.length} records could not be put back as they were; your safety copy file has their earlier versions.` : `The ${written.length} records already written were put back as they were.`} Your current records are all still here.` });
      return;
    }
    const keep = new Set(check.records.map(r => r.id)); const extra = [...prev.keys()].filter(id => !keep.has(id));
    setProgress(extra.length ? `Removing ${extra.length} records that are not in the backup…` : '');
    const d = extra.length ? await runPool(extra, id => removeDoc(id), 4, (x, n) => setProgress(`Removing ${x} of ${n}…`)) : { fails: 0, done: 0 };
    setBusy(''); setProgress('');
    if (d.fails) setReport({ ok: false, text: `All ${check.records.length} backup records were written. ${d.fails} of ${extra.length} records that are not in the backup could not be removed and are still in your workspace; nothing is missing. You can delete them yourself or run Replace again.` });
    else { toast(`Workspace replaced with ${check.records.length} records`); setReport({ ok: true, text: `Workspace replaced: ${check.records.length} records written${extra.length ? `, ${extra.length} removed` : ''}. A safety copy of the previous workspace was saved to your device.` }); setCheck(null); setText(''); }
  };
  const [canReplace, setCanReplace] = useState(null);
  useEffect(() => { let on = true; (async () => { let dl = null; try { dl = window.claude && await window.claude.use('downloads'); } catch (e) { } if (on) setCanReplace(!!dl); })(); return () => { on = false; }; }, []);
  return html`<${Modal} title="Settings and backup" onClose=${onClose}>
    <div className="modal-bd">
      <${ThemeSetting} />
      <div><div className="sub-hd">Storage</div><p className="small" style=${{ margin: 0 }}><span className=${'dot ' + (store.mode === 'db' ? '' : store.mode === 'local' ? 'warn' : 'bad')}></span> ${modeText}</p>
        ${window.WOS_HOST ? html`<div className="row-wrap" id="host-account" style=${{ marginTop: '6px' }}><span className="small">Signed in as <b>${window.WOS_HOST.email()}</b></span><button className="btn sm" id="sign-out" onClick=${() => window.WOS_HOST.signOut()}>Sign out</button></div>` : null}
        <p className="small muted" style=${{ margin: '4px 0 0' }}>${recs.length} records. Each record holds about 250 KB of document data, roughly 15,000–30,000 words depending on formatting. Put longer material in context files; each file has its own 250 KB. Images and file attachments are not stored; save a link instead.</p></div>
      <div><div className="sub-hd">Export a backup</div><div className="row-wrap"><button className="btn" id="export-btn" onClick=${doExport}>Download JSON</button><button className="btn" id="copy-json" onClick=${doCopy}>Copy JSON</button></div>
        <p className="small muted" style=${{ margin: '4px 0 0' }}>Includes every record with its links, dates and activity history.</p></div>
      <div><div className="sub-hd">Restore from a backup</div>
        <div className="row-wrap"><input ref=${fileRef} type="file" accept=".json,application/json" className="sr" id="import-file" onChange=${onFile} /><button className="btn" onClick=${() => fileRef.current && fileRef.current.click()}>Choose file…</button><span className="small muted">or paste JSON below</span></div>
        <textarea id="import-text" className="ta mono" rows="4" style=${{ marginTop: '8px' }} placeholder='{"app":"personal-work-os","records":[…]}' value=${text} onChange=${e => { setText(e.target.value); setCheck(null); }}></textarea>
        <div className="row-wrap" style=${{ marginTop: '8px' }}><button className="btn sm" id="import-check" disabled=${!text.trim()} onClick=${() => runCheck(text)}>Check backup</button></div>
        ${check ? check.error ? html`<div className="banner bad" style=${{ marginTop: '8px' }} id="import-result">${check.error} Nothing was changed.</div>` : html`<div className="banner" style=${{ marginTop: '8px', flexDirection: 'column', alignItems: 'flex-start' }} id="import-result">
          <div><b>${check.records.length}</b> valid records in this backup.</div>
          <ul className="imp-counts small" id="import-counts">
            <li data-k="add">${check.counts.add} new</li>
            <li data-k="newer">${check.counts.newer} newer than yours (will replace yours)</li>
            <li data-k="older">${check.counts.older} older than yours (yours kept${allowOlder ? ' unless overwritten below' : ''})</li>
            <li data-k="same">${check.counts.same} same version (skipped)</li>
            <li data-k="unknown">${check.counts.unknown} with no usable date to compare (yours kept${allowOlder ? ' unless overwritten below' : ''})</li>
            <li data-k="invalid">${check.problems.length} invalid (skipped)</li>
            <li data-k="corrected">${check.corrections.length} with values that will be corrected</li>
            ${check.dangling ? html`<li data-k="dangling">${check.dangling} links to records that are not here will be cleared</li>` : null}
          </ul>
          ${check.problems.length ? html`<details className="small"><summary>Invalid items</summary><div className="muted">${check.problems.slice(0, 20).join('; ')}${check.problems.length > 20 ? '…' : ''}</div></details>` : null}
          ${check.corrections.length ? html`<details className="small" id="import-corrections"><summary>Values that will be corrected</summary><ul className="muted">${check.corrections.slice(0, 30).map((c, i) => html`<li key=${i}>${c}</li>`)}</ul>${check.corrections.length > 30 ? html`<div className="muted">and ${check.corrections.length - 30} more</div>` : null}</details>` : null}
          ${check.counts.older + check.counts.unknown ? html`<label className="small row-wrap" style=${{ gap: '6px' }}><input type="checkbox" id="import-allow-older" checked=${allowOlder} onChange=${e => setAllowOlder(e.target.checked)} /> Also overwrite my ${check.counts.older + check.counts.unknown} newer or undated records with the backup's copies</label>` : null}
          <div className="row-wrap"><button className="btn sm" id="import-merge" disabled=${!!busy || !check.records.length} onClick=${doMerge}>${busy === 'merge' ? 'Importing…' : `Merge ${mergeSelection(check, allowOlder).length} records`}</button>
            <button className="btn sm danger" id="import-replace" disabled=${!!busy || !check.records.length || canReplace === false} title=${canReplace === false ? 'Replace needs to save a safety copy to your device first, and downloads are not available here.' : ''} onClick=${() => confirm({ title: 'Replace the whole workspace?', body: `Your workspace will be made to match this backup (${check.records.length} records). First a safety copy of all ${recs.length} current records is saved to your device; if you decline it, nothing changes. Backup records are then written; only when every write succeeds are records that are not in the backup removed. Storage has no transactions, so a failure part-way is reported and undone as far as possible rather than guaranteed.`, confirmLabel: 'Save safety copy and replace', danger: true, onConfirm: doReplace })}>Replace workspace</button></div>
          ${canReplace === false ? html`<div className="small muted" id="replace-disabled">Replace is off here: it must save a safety copy of your workspace to your device first, and downloads are not available in this view. Merge is still available.</div>` : null}
          ${progress ? html`<div className="small">${progress}</div>` : null}
        </div>` : null}
        ${report ? html`<div className=${'banner ' + (report.ok ? '' : 'bad')} style=${{ marginTop: '8px' }} id="import-report" role=${report.ok ? 'status' : 'alert'}>${report.text}</div>` : null}</div>
      <div><div className="sub-hd">Sample data</div><div className="row-wrap">
        <button className="btn" onClick=${act.loadSample}>Load sample workspace</button>
        <button className="btn" disabled=${!sampleCount} onClick=${() => confirm({ title: 'Remove sample data?', body: `${sampleCount} sample records will be deleted. Your own records are kept; any links from them to sample records are cleared.`, confirmLabel: 'Remove sample data', danger: true, onConfirm: act.removeSample })}>Remove sample data (${sampleCount})</button></div></div>
      <div><div className="sub-hd">How reminders work</div><p className="small" style=${{ margin: 0 }}>Reminders are saved with each record and checked every 30 seconds while this page is open. When one comes due, a card appears at the bottom right once per session, and the bell shows how many are due until you dismiss, snooze or complete them. There are no push, email or phone notifications: a closed page cannot alert you. The data keeps an exact reminder time so a server could send notifications later.</p></div>
      <div><div className="sub-hd">Danger zone</div><button className="btn danger" disabled=${!recs.length} onClick=${() => confirm({ title: 'Delete everything?', body: `All ${recs.length} records will be permanently deleted. Export a backup first.`, confirmLabel: 'Delete all records', danger: true, onConfirm: async () => { const r = await runPool([...store.all().keys()], id => removeDoc(id), 4); toast(r.fails ? `${r.fails} records could not be deleted.` : 'Workspace cleared', r.fails ? 'bad' : 'info'); } })}>Delete all records</button></div>
    </div>
  <//>`;
}

/* ---------- reminders ---------- */
function ReminderBell({ dueList, upcoming }) {
  const { openRecord, act } = useApp();
  const [open, setOpen] = useState(false); const ref = useRef(null);
  useEffect(() => { if (!open) return; const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, [open]);
  return html`<div className="rel" ref=${ref}>
    <button className="btn icon ghost" id="bell" aria-label=${dueList.length + ' reminders due'} title="Reminders" onClick=${() => setOpen(!open)} style=${{ width: 'auto', padding: '0 8px' }}><${Icon} name="bell" />${dueList.length ? html`<span className="badge">${dueList.length}</span>` : null}</button>
    ${open ? html`<div className="popover">
      <div className="ph">Due now (${dueList.length})</div>
      ${dueList.length ? dueList.map(t => html`<div key=${t.id} className="row"><div className="row-main"><button className="linklike row-title" style=${{ color: 'var(--fg)' }} onClick=${() => { setOpen(false); openRecord(t.id); }}>${t.title}</button><div className="row-meta"><${TypeLabel} r=${t} /><span className="due today">⏰ ${fmtDateTime(t.remindAt)}</span></div>
        <div className="row-wrap">${t.type === 'task' ? html`<button className="btn sm" onClick=${() => act.toggleTask(t)}>Complete</button>` : null}<button className="btn sm ghost" onClick=${() => act.snooze(t.id, 60)}>Snooze 1h</button><button className="btn sm ghost" onClick=${() => act.dismissReminder(t.id)}>Dismiss</button></div></div></div>`) : html`<div className="row small muted">Nothing due.</div>`}
      <div className="ph">Upcoming</div>
      ${upcoming.length ? upcoming.slice(0, 8).map(t => html`<div key=${t.id} className="row click" onClick=${() => { setOpen(false); openRecord(t.id); }}><div className="row-main"><div className="row-title">${t.title}</div><div className="row-meta"><${TypeLabel} r=${t} /><span className="due">⏰ ${fmtDateTime(t.remindAt)}</span></div></div></div>`) : html`<div className="row small muted">No upcoming reminders.</div>`}
      <div className="ph small">In-app only: reminders show while this page is open.</div>
    </div>` : null}
  </div>`;
}

/* ---------- app ---------- */
const NAV = [['today', 'Today', 'today'], ['inbox', 'Inbox', 'inbox'], ['tasks', 'All Tasks', 'tasks'], ['projects', 'Projects', 'projects'], ['notes', 'Notes', 'notes'], ['studio', 'Prompt Studio', 'studio'], ['topics', 'Topics', 'topics'], ['resources', 'Bookmarks & Resources', 'resources'], ['leads', 'Leads', 'leads'], ['timeline', 'Timeline', 'timeline'], ['archive', 'Archive', 'archive']];
const subscribe = fn => { store.listeners.add(fn); return () => store.listeners.delete(fn); };
function App() {
  const version = useSyncExternalStore(subscribe, () => store.version);
  const all = store.all();
  const recs = useMemo(() => [...all.values()], [version]);
  const byId = all;
  const tasks = useMemo(() => recs.filter(isTask), [recs]);
  const projects = useMemo(() => recs.filter(r => r.type === 'project').sort((a, b) => a.title.localeCompare(b.title)), [recs]);
  const topics = useMemo(() => recs.filter(r => r.type === 'topic'), [recs]);
  const inboxItems = useMemo(() => recs.filter(r => r.inbox && !r.archived).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [recs]);
  const [view, setViewRaw] = useState({ name: 'today' });
  const [stack, setStack] = useState([]);
  const [capture, setCapture] = useState(null); const [settings, setSettings] = useState(false); const [conf, setConf] = useState(null); const [fileView, setFileView] = useState(null); const [convert, setConvert] = useState(null);
  const [toasts, setToasts] = useState([]); const [alerts, setAlerts] = useState([]); const [navOpen, setNavOpen] = useState(false);
  const [q, setQ] = useState(''); const [filters, setFilters] = useState({ types: [], project: null, topic: null, status: '', days: 0, archived: false }); const [cursor, setCursor] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [wide, setWide] = useState(() => { try { return window.matchMedia('(min-width: 1200px)').matches; } catch (e) { return false; } });
  useEffect(() => { let mq; try { mq = window.matchMedia('(min-width: 1200px)'); } catch (e) { return; } const h = e => setWide(e.matches); mq.addEventListener ? mq.addEventListener('change', h) : mq.addListener(h); return () => { mq.removeEventListener ? mq.removeEventListener('change', h) : mq.removeListener(h); }; }, []);
  const searchRef = useRef(null); const shown = useRef(new Set()); const mainRef = useRef(null);

  const toast = useCallback((text, kind = 'info') => { const id = Math.random(); setToasts(t => [...t.slice(-3), { id, text, kind }]); setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), kind === 'bad' ? 8000 : 3200); }, []);
  notifier.toast = toast;
  const setView = useCallback(v => { setViewRaw(v); setNavOpen(false); setQ(''); if (mainRef.current) mainRef.current.scrollTop = 0; }, []);
  const openRecord = useCallback((id, push) => {
    const r = store.get(id); if (!r) return;
    if (r.type === 'file') { setFileView({ id }); return; }
    if (r.type === 'project' || r.type === 'topic') { setStack([]); setView({ name: r.type, id }); return; }
    if (r.type === 'sequence') { setStack([]); setView({ name: 'studio', tab: 'sequences', id }); return; }
    setStack(s => push && s.length ? [...s, id] : (s.length && s[s.length - 1] !== id ? [...s, id] : [id]));
  }, [setView]);
  const closeDrawer = useCallback(() => setStack([]), []);
  const openRef = useRef(openRecord); openRef.current = openRecord;
  useEffect(() => {
    if (!window.WosEditor) return;
    WosEditor.setHooks({
      resolvePage: id => { const r = id && store.get(id); return r ? { title: r.title || 'Untitled', type: r.type, typeLabel: TYPE_LABEL[r.type], icon: PAGE_ICON[r.type] } : null; },
      openPage: id => openRef.current(id),
      searchPages: (q, ownerId) => {
        const pool = [...store.all().values()].filter(r => !r.archived && r.id !== ownerId && ['note', 'topic', 'project', 'task', 'file', 'resource', 'lead'].includes(r.type));
        const list = q ? runSearch(q, pool, store.all(), { types: [] }).results.map(x => x.r) : pool.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        return list.slice(0, 8).map(r => ({ id: r.id, title: r.title || 'Untitled', typeLabel: TYPE_LABEL[r.type], icon: PAGE_ICON[r.type] }));
      },
      createPage: async title => { const r = await createRecord({ type: 'note', title, inbox: true }, { via: 'a page link' }); return r ? r.id : null; },
      uploadImage: async file => {
        let a = null; try { a = window.claude && await window.claude.use('assets'); } catch (e) { }
        if (!a) throw new Error('image storage is not available in this view');
        if (file.size > 15 * 1024 * 1024) throw new Error('the image is larger than 15 MB');
        const r = await a.upload(file); return r.url;
      },
      convertTodo: info => new Promise(resolve => setConvert({ ...info, resolve })),
      taskInfo: id => { const t = id && store.get(id); return t && t.type === 'task' ? { title: t.title, status: t.status } : null; },
      toast: (m, k) => notifier.toast(m, k)
    });
  }, []);
  useEffect(() => { window.WosEditor && WosEditor.repaintAllLinks(); }, [version]);
  // the capture panel leaves room for reminder cards and toasts, which move above it while it is open
  const toastsRef = useRef(null);
  useEffect(() => { const el = toastsRef.current; if (!el || !window.ResizeObserver) return; const ro = new ResizeObserver(() => document.documentElement.style.setProperty('--toasts-h', el.offsetHeight + 'px')); ro.observe(el); return () => ro.disconnect(); }, []);
  const capN = useRef(0);
  const openCapture = useCallback((type, extra) => setCapture({ type: type || 'note', projectId: null, topicId: null, ...(extra || {}), n: ++capN.current }), []);
  const [capOpen, setCapOpen] = useState(false);
  useEffect(() => { if (capture) setCapOpen(true); }, [capture]);
  const confirm = useCallback(c => setConf(c), []);

  const act = useMemo(() => ({
    create: (p, via, extraLog) => createRecord(p, { via, extraLog }),
    update: (id, patch, extra) => updateRecord(id, patch, extra),
    remove: async id => { const ok = await deleteRecord(id); if (ok) { toast('Deleted'); setStack(s => s.filter(x => x !== id)); } return ok; },
    toggleTask: async t => { const done = t.status === 'Completed'; const ok = await updateRecord(t.id, { status: done ? 'Next' : 'Completed' }); if (ok) toast(done ? 'Task reopened' : `Completed: ${t.title}`); },
    dismissReminder: id => { setAlerts(a => a.filter(x => x !== id)); return updateRecord(id, { reminderDismissed: true }); },
    snooze: (id, min) => { setAlerts(a => a.filter(x => x !== id)); return updateRecord(id, { remindAt: new Date(Date.now() + min * 60000).toISOString(), reminderDismissed: false }); },
    loadSample: async () => {
      const existing = store.all(); const list = sampleRecords().filter(r => !existing.has(r.id));
      if (!list.length) return toast('Sample data is already loaded.');
      const r = await runPool(list, rec => persist(rec), 4);
      toast(r.fails ? `${r.fails} sample records could not be saved.` : `Loaded ${list.length} sample records. Remove them any time in Settings.`, r.fails ? 'bad' : 'info');
    },
    removeSample: async () => {
      const ids = new Set([...store.all().values()].filter(r => r.sample).map(r => r.id));
      for (const r of [...store.all().values()]) {
        if (ids.has(r.id)) continue; const patch = {};
        if (r.links.some(x => ids.has(x))) patch.links = r.links.filter(x => !ids.has(x));
        for (const k of ['projectId', 'topicId', 'parentId', 'dependsOn', 'leadId']) if (r[k] && ids.has(r[k])) patch[k] = null;
        if (Object.keys(patch).length) { await updateRecord(r.id, patch, [entry('link', 'Sample data removed; links to it cleared')]); }
      }
      const res = await runPool([...ids], id => removeDoc(id), 4);
      setStack([]); toast(res.fails ? `${res.fails} sample records could not be removed.` : `Removed ${ids.size} sample records`, res.fails ? 'bad' : 'info');
    }
  }), [toast]);

  // reminders: check every 30 s while open; alert once per reminder time per session
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(i); }, []);
  const dueList = useMemo(() => recs.filter(r => isReminderDue(r, now)).sort((a, b) => a.remindAt.localeCompare(b.remindAt)), [recs, now]);
  const upcoming = useMemo(() => recs.filter(r => hasReminder(r) && new Date(r.remindAt).getTime() > now).sort((a, b) => a.remindAt.localeCompare(b.remindAt)), [recs, now]);
  useEffect(() => {
    if (!store.loaded) return;
    const fresh = dueList.filter(t => !shown.current.has(t.id + '|' + t.remindAt));
    if (fresh.length) { fresh.forEach(t => shown.current.add(t.id + '|' + t.remindAt)); setAlerts(a => [...new Set([...a, ...fresh.map(t => t.id)])].slice(-4)); }
  }, [dueList]);

  const search = useMemo(() => { const s = runSearch(q, recs, byId, filters); const g = groupSearch(s.results); return { terms: s.terms, results: g.flat, groups: g.groups }; }, [q, recs, filters]);
  useEffect(() => setCursor(0), [q, filters]);

  useEffect(() => {
    const k = e => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); searchRef.current && (searchRef.current.focus(), searchRef.current.select()); }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'j' || e.key === 'J')) { e.preventDefault(); setCapOpen(o => !o); }
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, []);
  const onSearchKey = e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, search.results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
    else if (e.key === 'Enter') { const r = search.results[cursor]; if (r) { openRecord(r.r.id); } }
    else if (e.key === 'Escape') { setQ(''); e.target.blur(); }
  };
  useEffect(() => { const el = document.querySelector('#search-results .kbd-on'); el && el.scrollIntoView({ block: 'nearest' }); }, [cursor]);

  const t = localDate();
  const counts = {
    today: tasks.filter(x => isOverdue(x, t)).length, inbox: inboxItems.length, tasks: tasks.filter(isOpenTask).length,
    projects: projects.filter(p => p.status === 'active').length, notes: recs.filter(r => r.type === 'note' && !r.archived).length,
    topics: topics.length, resources: recs.filter(r => r.type === 'resource' && !r.archived).length, leads: recs.filter(r => r.type === 'lead' && !r.archived).length,
    archive: recs.filter(r => r.archived).length,
    studio: recs.filter(r => r.type === 'sequence' && !r.archived && r.status === 'Active' && r.steps.some(s => s.status !== 'Completed')).length
  };
  const sampleN = recs.filter(r => r.sample).length;
  const filesByOwner = useMemo(() => { const m = new Map(); recs.forEach(r => { if (r.type === 'file' && r.ownerId) m.set(r.ownerId, (m.get(r.ownerId) || 0) + 1); }); return m; }, [recs]);
  const fileCount = useCallback(id => filesByOwner.get(id) || 0, [filesByOwner]);
  const openFile = useCallback((id, focusTitle) => setFileView({ id, focusTitle }), []);
  const ctx = { recs, byId, tasks, projects, topics, inboxItems, act, openRecord, openCapture, setView, confirm, toast, now, fileCount, openFile, openId: stack[stack.length - 1] || null };
  const saveState = store.broken ? ['bad', 'Not saving'] : store.pending ? ['busy', 'Saving…'] : store.mode === 'db' ? ['', 'Saved'] : store.mode === 'local' ? ['warn', 'This browser only'] : store.mode === 'memory' ? ['bad', 'Not saved'] : ['busy', 'Connecting…'];
  const searching = q.trim().length > 0;
  const top = stack[stack.length - 1];
  const docked = wide && !!top;

  let main;
  if (!store.loaded) main = html`<div className="page"><div className="empty">Loading your workspace…</div></div>`;
  else if (searching) main = html`<${SearchView} q=${q} filters=${filters} setFilters=${setFilters} results=${search.results} groups=${search.groups} terms=${search.terms} cursor=${cursor} setCursor=${setCursor} />`;
  else main = {
    today: () => html`<${TodayView} />`, inbox: () => html`<${InboxView} />`, tasks: () => html`<${TasksView} key=${view.tab || 'x'} initialTab=${view.tab} />`, projects: () => html`<${ProjectsView} />`,
    project: () => html`<${ProjectPage} key=${view.id} id=${view.id} />`, notes: () => html`<${NotesView} />`, topics: () => html`<${TopicsView} />`, topic: () => html`<${TopicPage} key=${view.id} id=${view.id} />`,
    resources: () => html`<${ResourcesView} />`, leads: () => html`<${LeadsView} />`, timeline: () => html`<${TimelineView} />`, studio: () => html`<${StudioView} tab=${view.tab || 'overview'} id=${view.id} />`, archive: () => html`<${ArchiveView} />`
  }[view.name]();
  const activeNav = view.name === 'project' ? 'projects' : view.name === 'topic' ? 'topics' : view.name;

  return html`<${Ctx.Provider} value=${ctx}>
    <div className=${'app' + (docked ? ' drawer-docked' : '') + (capOpen ? ' cap-open' : '')}>
      <header className="hdr">
        <button className="btn icon ghost menu-btn" aria-label="Menu" onClick=${() => setNavOpen(!navOpen)}><${Icon} name="menu" /></button>
        <div className="brand"><span className="brand-mark">OS</span><span className="brand-name">Personal Work OS</span></div>
        <div className="search"><span className="ico"><${Icon} name="search" /></span>
          <input ref=${searchRef} id="global-search" type="search" placeholder="Search everything" aria-label="Search everything" value=${q} onChange=${e => setQ(e.target.value)} onKeyDown=${onSearchKey} autoComplete="off" />
          ${!q ? html`<span className="kbd">Ctrl K</span>` : null}</div>
        <div className="hdr-actions">
          <span className="save-state hide-sm" title=${store.mode === 'db' ? (window.WOS_HOST ? 'Saved to your Supabase database' : 'Saved to your private Artifact storage') : ''}><span className=${'dot ' + saveState[0]}></span>${saveState[1]}</span>
          <${ReminderBell} dueList=${dueList} upcoming=${upcoming} />
          <button className="btn hide-sm" id="hdr-new-task" onClick=${() => openCapture('task')}>New task</button>
          <button className="btn primary" id="hdr-capture" onClick=${() => openCapture('note')}><${Icon} name="plus" /><span className="hide-sm">Capture</span></button>
          <button className="btn icon ghost" aria-label="Settings and backup" title="Settings and backup" id="hdr-settings" onClick=${() => setSettings(true)}><${Icon} name="gear" /></button>
        </div>
      </header>
      <div className="shell">
        <nav className=${'side' + (navOpen ? ' open' : '')} aria-label="Sections">
          ${NAV.map(([k, l, ic], i) => html`<${React.Fragment} key=${k}>${k === 'timeline' ? html`<div className="side-sep"></div>` : null}<button className=${'nav' + (activeNav === k && !searching ? ' on' : '')} id=${'nav-' + k} onClick=${async () => { if (hasPendingEdits() && !(await flushPendingEdits())) { toast('A change on this page could not be saved. Your text is kept; try again before leaving.', 'bad'); return; } setView({ name: k }); }}>
            <${Icon} name=${ic} /> ${l}${counts[k] ? html`<span className=${'n' + (k === 'today' ? ' alert' : '')} title=${k === 'today' ? 'Overdue tasks' : ''}>${counts[k]}</span>` : null}</button><//>`)}
          <div className="side-foot">${store.mode === 'db' ? 'Private to your account' : store.mode === 'local' ? 'Saved in this browser' : ''}</div>
        </nav>
        <main className="main" ref=${mainRef}>
          <div className="page" style=${{ gap: '12px', marginBottom: (store.error || store.mode === 'local' || store.mode === 'memory' || sampleN) ? '16px' : 0 }}>
            ${store.error ? html`<div className="banner bad" role="alert"><span className="grow">${store.error}</span><button className="btn sm" onClick=${() => setSettings(true)}>Export</button></div>` : null}
            ${store.mode === 'local' ? html`<div className="banner warn"><span className="grow">Artifact storage isn’t available in this view, so your data is saved in this browser only. Export backups regularly.</span><button className="btn sm" onClick=${() => setSettings(true)}>Backup</button></div>` : null}
            ${store.mode === 'memory' ? html`<div className="banner bad"><span className="grow">No storage is available here. Nothing will be kept after you close this page. Export before leaving.</span><button className="btn sm" onClick=${() => setSettings(true)}>Export</button></div>` : null}
            ${sampleN ? html`<div className="banner" id="sample-banner"><span className="chip sample">Sample</span><span className="grow">${sampleN} sample records are loaded so you can try things out. Each shows a small “sample” label.</span><button className="btn sm" onClick=${() => confirm({ title: 'Remove sample data?', body: `${sampleN} sample records will be deleted. Your own records are kept.`, confirmLabel: 'Remove sample data', danger: true, onConfirm: act.removeSample })}>Remove sample data</button></div>` : null}
          </div>
          ${main}
        </main>
      </div>
      ${top ? html`<${RecordDetail} key=${top} id=${top} docked=${docked} onClose=${closeDrawer} canBack=${stack.length > 1} onBack=${() => setStack(s => s.slice(0, -1))} />` : null}
      <${CapturePanel} open=${capOpen} preset=${capture} onClose=${() => setCapOpen(false)} />
      <button className=${'fab' + (capOpen ? ' on' : '')} id="fab" aria-label=${capOpen ? 'Close quick capture' : 'Quick capture'} title=${capOpen ? 'Close quick capture' : 'Quick note (Ctrl/⌘+J)'} aria-expanded=${capOpen} onClick=${() => capOpen ? setCapOpen(false) : setCapOpen(true)}><${Icon} name=${capOpen ? 'x' : 'plus'} size=${22} /></button>
      ${settings ? html`<${SettingsModal} onClose=${() => setSettings(false)} />` : null}
      ${convert ? html`<${ConvertTodoModal} info=${convert} onDone=${id => { convert.resolve(id); setConvert(null); }} />` : null}
      ${fileView ? html`<${FileModal} key=${fileView.id} id=${fileView.id} focusTitle=${fileView.focusTitle} onClose=${() => setFileView(null)} />` : null}
      ${conf ? html`<${ConfirmModal} c=${conf} onClose=${() => setConf(null)} />` : null}
      <div className="toasts" aria-live="polite" ref=${toastsRef}>
        ${alerts.map(id => { const r = byId.get(id); if (!r || !hasReminder(r)) return null; return html`<div key=${'a' + id} className="alert-card" role="alert">
          <div className="eyebrow">Reminder · ${TYPE_LABEL[r.type]} · ${fmtDateTime(r.remindAt)}</div><div className="t">${r.title}</div>
          <div className="row-wrap"><button className="btn sm" onClick=${() => { setAlerts(a => a.filter(x => x !== id)); openRecord(id); }}>Open</button>${r.type === 'task' ? html`<button className="btn sm" onClick=${() => { setAlerts(a => a.filter(x => x !== id)); act.toggleTask(r); }}>Complete</button>` : null}<button className="btn sm ghost" onClick=${() => act.snooze(id, 60)}>Snooze 1h</button><button className="btn sm ghost" onClick=${() => act.dismissReminder(id)}>Dismiss</button><button className="btn sm ghost" aria-label="Hide" onClick=${() => setAlerts(a => a.filter(x => x !== id))}>Hide</button></div>
        </div>`; })}
        ${toasts.map(x => html`<div key=${x.id} className=${'toast ' + (x.kind === 'bad' ? 'bad' : '')} role=${x.kind === 'bad' ? 'alert' : 'status'}>${x.text}</div>`)}
      </div>
    </div>
  <//>`;
}

ReactDOM.createRoot(document.getElementById('app')).render(html`<${App} />`);
initStore();
