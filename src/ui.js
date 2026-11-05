/* ===================== shared UI pieces ===================== */
const Ctx = React.createContext(null);
const useApp = () => React.useContext(Ctx);

const ICONS = {
  today: 'M8 2v2M16 2v2M3 8h18M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  steps: 'M5 4v16M5 6h.01M5 12h.01M5 18h.01M9 6h11M9 12h8M9 18h10',
  studio: 'M4 5h16v11H8l-4 4zM8 9h8M8 12h5',
  up: 'm6 14 6-6 6 6', down: 'm6 10 6 6 6-6',
  inbox: 'M3 13h5l1.5 3h5L16 13h5M5 5h14l2 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z',
  tasks: 'M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2',
  projects: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  notes: 'M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h7',
  topics: 'M6 4v16M6 8h6M6 14h6M12 6h6v4h-6zM12 12h6v4h-6z',
  resources: 'M7 3h10v18l-5-4-5 4z',
  leads: 'M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM20 19v-1a4 4 0 0 0-3-3.87M15 3.13a3.5 3.5 0 0 1 0 6.75',
  timeline: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  archive: 'M3 5h18v4H3zM5 9v10h14V9M10 13h4',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  bell: 'M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8M13.7 21a2 2 0 0 1-3.4 0',
  plus: 'M12 5v14M5 12h14',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  x: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12l5 5L19 7',
  menu: 'M4 6h16M4 12h16M4 18h16',
  chev: 'M9 6l6 6-6 6',
  chevd: 'M6 9l6 6 6-6',
  link: 'M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1',
  ext: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  back: 'M15 6l-6 6 6 6',
  /* record-type icons */
  task: 'M4 4h16v16H4zM8 12l3 3 5-6',
  note: 'M4 4h16v10l-6 6H4zM14 20v-6h6M8 9h8M8 12.5h5',
  idea: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z',
  doc: 'M6 3h9l4 4v14H6zM14 3v5h5M9 10h3M9 13h7M9 16h7M9 19h5',
  topic: 'M5 9h14M5 15h14M10 4 8 20M16 4l-2 16',
  person: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1',
  clip: 'M20 11.5l-8 8a5 5 0 0 1-7-7l8.5-8.5a3.5 3.5 0 0 1 5 5L10 17.5a2 2 0 0 1-3-3l7.5-7.5',
  play: 'M7 4.5v15l12-7.5z',
  chat: 'M4 5h16v11H9l-5 4z',
  book: 'M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zM20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z',
  article: 'M4 5h16v14H4zM8 9h8M8 13h8M8 16h5',
  cap: 'M2 9l10-5 10 5-10 5zM6 11v5c3 2 9 2 12 0v-5',
  tool: 'M14.5 6.5a4 4 0 0 0 5 5L11 20a2.1 2.1 0 0 1-3-3l8.5-8.5a4 4 0 0 1-2-2z',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
  hourglass: 'M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9'
};
function Icon({ name, size = 16 }) {
  return html`<svg width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d=${ICONS[name] || ''} /></svg>`;
}
function Chip({ kind, children, title, onClick }) {
  if (onClick) return html`<button type="button" className=${'chip ' + (kind || '')} title=${title} onClick=${e => { e.stopPropagation(); onClick(); }}>${children}</button>`;
  return html`<span className=${'chip ' + (kind || '')} title=${title}>${children}</span>`;
}
function Pri({ p }) { return html`<span className=${'pri ' + p}><i></i>${p}</span>`; }

/* ---------- record types (from stored fields only: type, kind, resType) ---------- */
const RES_ICON = { YouTube: 'play', ChatGPT: 'chat', Documentation: 'book', Article: 'article', Tutorial: 'cap', Tool: 'tool', Website: 'globe', Other: 'link' };
function typeIconName(r) {
  switch (r && r.type) {
    case 'task': return 'task';
    case 'project': return 'projects';
    case 'note': return r.kind === 'idea' ? 'idea' : r.kind === 'doc' ? 'doc' : 'note';
    case 'topic': return 'topic';
    case 'resource': return RES_ICON[r.resType] || 'globe';
    case 'lead': return 'person';
    case 'file': return 'clip';
    case 'prompt': return 'chat';
    case 'sequence': return 'steps';
    default: return 'notes';
  }
}
function typeLabelOf(r) { return r.type === 'note' ? NOTE_KINDS[r.kind] || 'Note' : r.type === 'resource' ? (r.resType || 'Resource') : TYPE_LABEL[r.type] || 'Record'; }
/** A record's type icon. `tile` draws the 28 px leading square used by list rows. */
function TypeIcon({ r, size = 16, tile }) {
  const icon = html`<${Icon} name=${typeIconName(r)} size=${size} />`;
  return tile ? html`<span className=${'row-lead t-' + r.type} title=${typeLabelOf(r)} aria-hidden="true">${icon}</span>` : html`<span className="ti" aria-hidden="true">${icon}</span>`;
}
function TypeLabel({ r }) { return html`<span className="tlabel"><${TypeIcon} r=${r} size=${13} />${typeLabelOf(r)}</span>`; }
function StatusIcon({ r }) {
  const s = r.status;
  if (r.type === 'task') {
    if (s === 'In Progress') return html`<svg className="st-ic" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.6" /><path d="M8 2a6 6 0 0 1 0 12z" fill="currentColor" /></svg>`;
    if (s === 'Waiting') return html`<${Icon} name="hourglass" size=${11} />`;
    if (s === 'Completed') return html`<${Icon} name="check" size=${11} />`;
    if (s === 'Cancelled') return html`<${Icon} name="x" size=${11} />`;
    if (s === 'Inbox') return html`<${Icon} name="inbox" size=${11} />`;
  }
  return null;
}
function statusKind(r) {
  if (r.type === 'task') return { Completed: 'ok', Cancelled: '', Waiting: 'warn', 'In Progress': 'prog', Inbox: '' }[r.status] || '';
  if (r.type === 'lead') return { Won: 'ok', Lost: 'bad', 'Follow-up': 'warn' }[r.status] || '';
  return '';
}
/** Status as icon + word; projects use a dot + word. `hideDefault` drops the default "Next" in compact task rows. */
function StatusChip({ r, hideDefault }) {
  if (!r.status) return null;
  if (r.type === 'project') return html`<span className=${'pstat s-' + r.status.replace(/\s+/g, '-')}><i></i>${r.status}</span>`;
  if (hideDefault && r.type === 'task' && r.status === 'Next') return null;
  return html`<span className=${'chip ' + statusKind(r)}><${StatusIcon} r=${r} />${r.status}</span>`;
}
function DueLabel({ r }) {
  const t = localDate(); const bits = [];
  if (r.dueAt) { const over = isOpenTask(r) && r.dueAt < t; bits.push(html`<span key="d" className=${'due ' + (over ? 'over' : r.dueAt === t ? 'today' : '')} title="Deadline">${over ? 'Overdue · ' + fmtDay(r.dueAt) : 'Due ' + fmtDay(r.dueAt)}</span>`); }
  if (r.scheduledFor && r.scheduledFor !== r.dueAt) bits.push(html`<span key="s" className=${'due ' + (r.scheduledFor === t ? 'today' : '')} title="Scheduled to work on">Do ${fmtDay(r.scheduledFor)}</span>`);
  if (r.remindAt) bits.push(html`<span key="r" className=${'due ' + (isReminderDue(r) ? 'today' : '')} title=${r.reminderDismissed ? 'Reminder dismissed' : 'Reminder'}>⏰ ${fmtDateTime(r.remindAt)}${r.reminderDismissed ? ' (dismissed)' : ''}</span>`);
  return bits;
}
/** Full project + topic chips — kept for detail views. */
function ContainerChips({ r, hideProject, hideTopic }) {
  const { byId, openRecord } = useApp();
  const p = !hideProject && r.projectId && byId.get(r.projectId);
  const tp = !hideTopic && r.topicId && byId.get(r.topicId);
  return html`${p ? html`<${Chip} title="Project" onClick=${() => openRecord(p.id)}>▸ ${p.title}<//>` : null}${tp ? html`<${Chip} kind="acc" title="Topic" onClick=${() => openRecord(tp.id)}>${topicPath(tp.id, byId).join(' / ')}<//>` : null}`;
}
/** One context label for compact rows: the project if there is one, otherwise the topic. */
function ContextLabel({ r, hideProject, hideTopic }) {
  const { byId, openRecord } = useApp();
  const p = !hideProject && r.projectId && byId.get(r.projectId);
  const tp = !p && !hideTopic && r.topicId && byId.get(r.topicId);
  const c = p || tp; if (!c) return null;
  const label = p ? p.title : topicPath(tp.id, byId).join(' / ');
  return html`<button type="button" className="ctxl" title=${(p ? 'Project: ' : 'Topic: ') + label} onClick=${e => { e.stopPropagation(); openRecord(c.id); }}><${Icon} name=${p ? 'projects' : 'topic'} size=${12} /><span>${label}</span></button>`;
}
function QuietTags({ tags, max = 3 }) {
  if (!tags || !tags.length) return null;
  return html`<span className="qtags" title=${tags.map(t => '#' + t).join(' ')}>${tags.slice(0, max).map(t => '#' + t).join(' ')}${tags.length > max ? ` +${tags.length - max}` : ''}</span>`;
}
function SampleMark({ r }) { return r && r.sample ? html`<span className="smark" title="Sample record. Remove all sample data from the banner or Settings.">sample</span>` : null; }

function TaskRow({ t, hideProject, hideTopic, terms, flag }) {
  const { byId, openRecord, act, fileCount, openId } = useApp();
  const done = t.status === 'Completed' || t.status === 'Cancelled';
  const blocked = isBlocked(t, byId);
  const edge = isOpenTask(t) && (t.priority === 'Urgent' || t.priority === 'High') ? ' pri-' + t.priority.toLowerCase() : '';
  return html`<div className=${'row click task-row' + edge + (openId === t.id ? ' is-open' : '')} aria-current=${openId === t.id ? 'true' : null} data-id=${t.id} data-type="task" onClick=${() => openRecord(t.id)}>
    <button type="button" className=${'check' + (t.status === 'Completed' ? ' on' : '')} aria-label=${t.status === 'Completed' ? 'Reopen task' : 'Complete task'} title=${t.status === 'Completed' ? 'Reopen' : 'Complete'}
      onClick=${e => { e.stopPropagation(); act.toggleTask(t); }}><${Icon} name="check" size=${12} /></button>
    <div className="row-main">
      <div className=${'row-title' + (done ? ' done' : '')}>${highlight(t.title || 'Untitled task', terms)}</div>
      ${terms && terms.length && t.body && terms.some(x => t.body.toLowerCase().includes(x)) ? html`<div className="row-ex">${highlight(excerpt(t.body, terms, 160), terms)}</div>` : null}
      <div className="row-meta">
        ${flag ? html`<span className="flag">${flag}</span>` : null}
        <${StatusChip} r=${t} hideDefault />
        ${blocked ? html`<span className="blocked" title="Waiting on another task">⛓ Blocked by ${byId.get(t.dependsOn).title}</span>` : null}
        <${DueLabel} r=${t} />
        <${ContextLabel} r=${t} hideProject=${hideProject} hideTopic=${hideTopic} />
        ${fileCount(t.id) ? html`<span className="fg2" title="Context files">📄 ${fileCount(t.id)}</span>` : null}
        <${SampleMark} r=${t} />
      </div>
    </div>
    <div className="row-side"><${Pri} p=${t.priority} /></div>
  </div>`;
}
function TaskList({ tasks, empty, hideProject, hideTopic, limit, flags }) {
  const [more, setMore] = useState(false);
  if (!tasks.length) return empty === null ? null : html`<div className="empty">${empty || 'Nothing here.'}</div>`;
  const shown = limit && !more ? tasks.slice(0, limit) : tasks;
  return html`<div className="list">${shown.map(t => html`<${TaskRow} key=${t.id} t=${t} hideProject=${hideProject} hideTopic=${hideTopic} flag=${flags && flags[t.id]} />`)}
    ${limit && tasks.length > limit && !more ? html`<div className="row"><button className="linklike small" onClick=${() => setMore(true)}>Show ${tasks.length - limit} more</button></div>` : null}</div>`;
}
/* ---------- typed rows on one shared shell ---------- */
function RowShell({ r, lead, cls = '', children, trailing }) {
  const { openRecord, openId } = useApp();
  return html`<div className=${'row click typed-row ' + cls + (openId === r.id ? ' is-open' : '')} aria-current=${openId === r.id ? 'true' : null} data-id=${r.id} data-type=${r.type} onClick=${() => openRecord(r.id)}>
    ${lead}<div className="row-main">${children}</div>${trailing ? html`<div className="row-side">${trailing}</div>` : null}
  </div>`;
}
function MetaTail({ r, extra }) {
  return html`${hasReminder(r) ? html`<span className=${'due ' + (isReminderDue(r) ? 'today' : '')} title="Reminder">⏰ ${fmtDateTime(r.remindAt)}</span>` : null}
    <span className="muted">Updated ${relTime(r.updatedAt)}</span><${SampleMark} r=${r} />${extra}`;
}
function DocRow({ r, terms, extra }) {
  const { byId, fileCount } = useApp();
  const owner = r.type === 'file' && r.ownerId && byId.get(r.ownerId);
  const ex = excerpt(r.type === 'prompt' || r.type === 'sequence' ? (r.summary || r.body) : r.body, terms, 260);
  return html`<${RowShell} r=${r} cls="doc-row" lead=${html`<${TypeIcon} r=${r} tile />`}>
    <div className="row-title">${highlight(r.title || 'Untitled', terms)}</div>
    ${ex ? html`<div className="row-ex long">${highlight(ex, terms)}</div>` : null}
    <div className="row-meta">
      <${TypeLabel} r=${r} />
      ${owner ? html`<span className="fg2">in ${TYPE_LABEL[owner.type].toLowerCase()} “${owner.title}”</span>` : html`<${ContextLabel} r=${r} />`}
      ${fileCount(r.id) ? html`<span className="fg2" title="Context files">📄 ${fileCount(r.id)}</span>` : null}
      <${QuietTags} tags=${r.tags} />
      <${MetaTail} r=${r} extra=${extra} />
    </div>
  <//>`;
}
function siteLetter(url) { const h = hostOf(url).replace(/^(www|docs|m|app|en)\./, ''); return (h.match(/[a-z0-9]/i) || ['?'])[0].toUpperCase(); }
/** True only for a parseable http(s) address with a host name; nothing is fetched. */
function urlOk(u) { if (!safeHref(u)) return false; try { const x = new URL(u); return !!x.hostname && !/\s/.test(u); } catch (e) { return false; } }
/** The stored address, shown as text so it can be inspected without opening it. */
function ResUrl({ r }) {
  if (!r.url) return html`<div className="res-url warn-txt small">No link saved. Open the record to add one.</div>`;
  if (!urlOk(r.url)) return html`<div className="res-url warn-txt small" title=${r.url}>Link looks malformed: <span className="mono">${r.url}</span></div>`;
  return html`<div className="res-url small muted mono" title=${r.url}>${r.url.replace(/^https?:\/\//i, '')}</div>`;
}
function ResourceRow({ r, terms, extra }) {
  const href = urlOk(r.url) ? r.url : null;
  const lead = html`<span className="row-lead mono-tile t-resource" title=${typeLabelOf(r)} aria-hidden="true">${siteLetter(r.url)}<span className="badge-ic"><${Icon} name=${typeIconName(r)} size=${10} /></span></span>`;
  const open = href ? html`<a className="btn sm open-link" href=${href} target="_blank" rel="noopener noreferrer" onClick=${e => e.stopPropagation()} title=${'Open ' + r.url}>Open <${Icon} name="ext" size=${12} /></a>` : null;
  const ex = r.body ? excerpt(r.body, terms, 160) : '';
  return html`<${RowShell} r=${r} cls="res-row" lead=${lead} trailing=${open}>
    <div className="row-title">${highlight(r.title || 'Untitled', terms)}</div>
    <div className="row-sub"><span className="host">${urlOk(r.url) ? hostOf(r.url) : 'No valid link'}</span><span className="tlabel">${typeLabelOf(r)}</span></div>
    <${ResUrl} r=${r} />
    ${ex ? html`<div className="row-ex">${highlight(ex, terms)}</div>` : null}
    <div className="row-meta"><${ContextLabel} r=${r} /><${QuietTags} tags=${r.tags} /><${MetaTail} r=${r} extra=${extra} /></div>
  <//>`;
}
function TopicRow({ r, terms, extra }) {
  const { byId, recs } = useApp();
  const n = recs.filter(x => x.topicId === r.id && !x.archived).length;
  return html`<${RowShell} r=${r} cls="topic-row" lead=${html`<${TypeIcon} r=${r} tile />`}>
    <div className="row-title">${highlight(r.title || 'Untitled', terms)}</div>
    ${r.parentId && byId.get(r.parentId) ? html`<div className="row-sub fg2">in ${topicPath(r.parentId, byId).join(' / ')}</div>` : null}
    ${r.body ? html`<div className="row-ex">${highlight(excerpt(r.body, terms), terms)}</div>` : null}
    <div className="row-meta"><span className="tlabel"><${TypeIcon} r=${r} size=${13} />Topic · ${n} item${n === 1 ? '' : 's'}</span><${MetaTail} r=${r} extra=${extra} /></div>
  <//>`;
}
function projectProgress(p, tasks) {
  const pt = tasks.filter(t => t.projectId === p.id && !t.archived && t.status !== 'Cancelled');
  const done = pt.filter(t => t.status === 'Completed').length;
  return { done, total: pt.length, open: pt.length - done };
}
function ProgressBar({ done, total }) {
  if (!total) return null;
  const pct = Math.round(done / total * 100);
  return html`<span className="progress" title=${`${done} of ${total} tasks done`}><span className="progress-track"><span className="progress-fill" style=${{ width: pct + '%' }}></span></span><span className="progress-txt">${done} of ${total} done</span></span>`;
}
function ProjectRow({ r, terms, extra }) {
  const { tasks } = useApp(); const pr = projectProgress(r, tasks);
  return html`<${RowShell} r=${r} cls="project-row" lead=${html`<${TypeIcon} r=${r} tile />`}>
    <div className="row-title">${highlight(r.title || 'Untitled', terms)}</div>
    ${r.body ? html`<div className="row-ex">${highlight(excerpt(r.body, terms), terms)}</div>` : null}
    <div className="row-meta"><${StatusChip} r=${r} /><${ProgressBar} done=${pr.done} total=${pr.total} />${pr.total ? null : html`<span className="muted">No tasks yet</span>`}<${MetaTail} r=${r} extra=${extra} /></div>
  <//>`;
}
function LeadRow({ r, terms, extra }) {
  const t = localDate();
  return html`<${RowShell} r=${r} cls="lead-row" lead=${html`<${TypeIcon} r=${r} tile />`}>
    <div className="row-title">${highlight(r.title || 'Untitled', terms)}</div>
    <div className="row-sub">${r.url ? html`<span className="host">${hostOf(r.url)}</span>` : null}${r.contactName ? html`<span className="fg2">${r.contactName}</span>` : null}</div>
    <div className="row-meta"><${StatusChip} r=${r} />${r.nextFollowUp ? html`<span className=${'due ' + (r.nextFollowUp < t ? 'over' : r.nextFollowUp === t ? 'today' : '')}>Follow up ${fmtDay(r.nextFollowUp)}</span>` : null}<${MetaTail} r=${r} extra=${extra} /></div>
  <//>`;
}
/** Picks the row presentation from the record's stored type. */
function RecordRow({ r, terms, extra }) {
  switch (r.type) {
    case 'task': return html`<${TaskRow} t=${r} terms=${terms} />`;
    case 'resource': return html`<${ResourceRow} r=${r} terms=${terms} extra=${extra} />`;
    case 'topic': return html`<${TopicRow} r=${r} terms=${terms} extra=${extra} />`;
    case 'project': return html`<${ProjectRow} r=${r} terms=${terms} extra=${extra} />`;
    case 'lead': return html`<${LeadRow} r=${r} terms=${terms} extra=${extra} />`;
    default: return html`<${DocRow} r=${r} terms=${terms} extra=${extra} />`;
  }
}
function Section({ title, count, children, action, id }) {
  return html`<section className="sec" id=${id}>
    <div className="sec-hd"><h2>${title}</h2>${count != null ? html`<span className="n">${count}</span>` : null}<span className="grow"></span>${action}</div>
    ${children}
  </section>`;
}
function ProjectSelect({ value, onChange, className = 'sel', allowNone = true, noneLabel = 'No project', id }) {
  const { projects } = useApp();
  return html`<select id=${id} className=${className} value=${value || ''} onChange=${e => onChange(e.target.value || null)}>
    ${allowNone ? html`<option value="">${noneLabel}</option>` : null}
    ${projects.filter(p => !p.archived).map(p => html`<option key=${p.id} value=${p.id}>${p.title}${p.status !== 'active' ? ' (' + p.status + ')' : ''}</option>`)}
  </select>`;
}
function topicOptions(topics, exclude) {
  const kids = new Map(); topics.forEach(t => { const k = t.parentId || ''; if (!kids.has(k)) kids.set(k, []); kids.get(k).push(t); });
  const out = []; const walk = (pid, d) => (kids.get(pid) || []).sort((a, b) => a.title.localeCompare(b.title)).forEach(t => { if (exclude && exclude.has(t.id)) return; out.push([t, d]); walk(t.id, d + 1); });
  walk('', 0);
  const placed = new Set(out.map(([t]) => t.id));
  topics.forEach(t => { if (!placed.has(t.id) && !(exclude && exclude.has(t.id))) out.push([t, 0]); });
  return out;
}
function TopicSelect({ value, onChange, className = 'sel', noneLabel = 'No topic', exclude, id }) {
  const { topics } = useApp();
  const opts = useMemo(() => topicOptions(topics.filter(t => !t.archived), exclude), [topics, exclude]);
  return html`<select id=${id} className=${className} value=${value || ''} onChange=${e => onChange(e.target.value || null)}>
    <option value="">${noneLabel}</option>
    ${opts.map(([t, d]) => html`<option key=${t.id} value=${t.id}>${'  '.repeat(d) + (d ? '└ ' : '') + t.title}</option>`)}
  </select>`;
}
/* ---------- pending-edit guard ----------
 * Field editors register here so a close, navigation or page exit can save what is typed but not yet committed.
 * flush() resolves false when a save was refused; the editor then keeps its text and shows why. */
const pendingEdits = new Set();
function usePendingEdit(dirty, flush) {
  const r = useRef({ dirty, flush }); r.current.dirty = dirty; r.current.flush = flush;
  useEffect(() => { const e = { dirty: () => r.current.dirty(), flush: () => r.current.flush() }; pendingEdits.add(e); return () => pendingEdits.delete(e); }, []);
}
function hasPendingEdits() { for (const e of pendingEdits) { try { if (e.dirty()) return true; } catch (x) { } } return false; }
async function flushPendingEdits() {
  let ok = true;
  for (const e of [...pendingEdits]) { try { if (e.dirty() && (await e.flush()) === false) ok = false; } catch (x) { ok = false; } }
  return ok;
}
/* Leaving the page: start saving anything typed but not yet committed, and ask the browser to warn while any
 * save is unconfirmed. Browsers may skip the warning (no recent interaction, embedded frames, mobile) and may end
 * the page before an asynchronous write finishes, so this narrows the window; it cannot guarantee the save. */
window.addEventListener('pagehide', () => { if (hasPendingEdits()) flushPendingEdits(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && hasPendingEdits()) flushPendingEdits(); });
window.addEventListener('beforeunload', e => {
  const typing = hasPendingEdits();
  if (!typing && !(store.pending > 0)) return; // nothing pending: no warning
  if (typing) flushPendingEdits();
  e.preventDefault(); e.returnValue = ''; return '';
});
/** Text input that saves on blur / Enter, and before its drawer or page closes. A refused save keeps the text. */
function EditText({ value, onSave, className = 'inp', placeholder, id, type = 'text' }) {
  const [v, setV] = useState(value || ''); const [err, setErr] = useState(false);
  const focused = useRef(false); const cur = useRef(value || ''); const saved = useRef(value || ''); const inflight = useRef(null);
  cur.current = v;
  useEffect(() => { saved.current = value || ''; if (!focused.current && !inflight.current) { setV(value || ''); cur.current = value || ''; } }, [value]);
  const dirty = () => cur.current !== saved.current;
  const commit = () => {
    if (inflight.current) return inflight.current;
    const val = cur.current; if (val === saved.current) return Promise.resolve(true);
    const prev = saved.current; saved.current = val; // marks it committed so blur, Enter and close cannot save it twice
    let r; try { r = onSave(val); } catch (e) { r = false; }
    inflight.current = Promise.resolve(r).then(ok => { inflight.current = null; if (ok === false) { saved.current = prev; setErr(true); return false; } setErr(false); return true; }, () => { inflight.current = null; saved.current = prev; setErr(true); return false; });
    return inflight.current;
  };
  usePendingEdit(dirty, commit);
  useEffect(() => () => { if (dirty()) commit(); }, []); // last resort when unmounted mid-edit; the write is queued at once
  return html`<${React.Fragment}><input id=${id} type=${type} className=${className + (err ? ' invalid' : '')} value=${v} placeholder=${placeholder} aria-invalid=${err ? 'true' : null}
    onFocus=${() => { focused.current = true; }} onChange=${e => { setV(e.target.value); cur.current = e.target.value; }} onBlur=${() => { focused.current = false; commit(); }}
    onKeyDown=${e => { if (e.key === 'Enter') { e.preventDefault(); if (err) commit(); else e.target.blur(); } }} />
    ${err ? html`<div className="field-err small" role="alert">Not saved. Your text is kept here; press Enter to try again.</div>` : null}<//>`;
}
/** Textarea that saves after a pause in typing and on blur. */
function EditArea({ value, onSave, className = 'ta', rows = 4, placeholder, id }) {
  const [v, setV] = useState(value || ''); const focused = useRef(false); const timer = useRef(null); const last = useRef(value || '');
  useEffect(() => { if (!focused.current) { setV(value || ''); last.current = value || ''; } }, [value]);
  const flush = val => { clearTimeout(timer.current); if (val !== last.current) { last.current = val; onSave(val); } };
  useEffect(() => () => clearTimeout(timer.current), []);
  return html`<textarea id=${id} className=${className} rows=${rows} value=${v} placeholder=${placeholder}
    onFocus=${() => { focused.current = true; }}
    onChange=${e => { const val = e.target.value; setV(val); clearTimeout(timer.current); timer.current = setTimeout(() => flush(val), 1200); }}
    onBlur=${e => { focused.current = false; flush(e.target.value); }}></textarea>`;
}
function TagEditor({ tags, onSave }) {
  const [v, setV] = useState(''); const [err, setErr] = useState(false); const cur = useRef(''); const inflight = useRef(null); const tagsRef = useRef(tags);
  cur.current = v; tagsRef.current = tags;
  const add = () => {
    if (inflight.current) return inflight.current;
    const n = parseTags(cur.current); if (!n.length) { setV(''); cur.current = ''; return Promise.resolve(true); }
    let r; try { r = onSave([...new Set([...tagsRef.current, ...n])]); } catch (e) { r = false; }
    inflight.current = Promise.resolve(r).then(ok => { inflight.current = null; if (ok === false) { setErr(true); return false; } setErr(false); setV(''); cur.current = ''; return true; }, () => { inflight.current = null; setErr(true); return false; });
    return inflight.current;
  };
  usePendingEdit(() => parseTags(cur.current).length > 0, add);
  useEffect(() => () => { if (parseTags(cur.current).length) add(); }, []);
  return html`<div className="row-wrap">
    ${tags.map(t => html`<span key=${t} className="chip tag">${t} <button type="button" className="linklike" aria-label=${'Remove tag ' + t} onClick=${() => onSave(tags.filter(x => x !== t))}>×</button></span>`)}
    <input className=${'inp sm' + (err ? ' invalid' : '')} style=${{ width: '140px' }} placeholder="Add tag, Enter" value=${v} aria-invalid=${err ? 'true' : null} onChange=${e => { setV(e.target.value); cur.current = e.target.value; }}
      onKeyDown=${e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } }} onBlur=${() => cur.current && add()} />
    ${err ? html`<span className="field-err small" role="alert">Tag not saved; press Enter to retry.</span>` : null}
  </div>`;
}

/* ---------- text helpers ---------- */
function excerpt(text, terms, len = 170) {
  text = (text || '').replace(/\s+/g, ' ').trim(); if (!text) return '';
  let idx = -1;
  if (terms && terms.length) { const low = text.toLowerCase(); for (const t of terms) { const i = low.indexOf(t); if (i >= 0 && (idx < 0 || i < idx)) idx = i; } }
  if (idx < 0) return text.length > len ? text.slice(0, len) + '…' : text;
  const start = Math.max(0, idx - 60);
  return (start > 0 ? '…' : '') + text.slice(start, start + len) + (start + len < text.length ? '…' : '');
}
function highlight(text, terms) {
  if (!terms || !terms.length || !text) return text;
  const esc = terms.filter(Boolean).map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!esc.length) return text;
  const re = new RegExp('(' + esc.join('|') + ')', 'ig');
  return String(text).split(re).map((part, i) => i % 2 ? html`<mark key=${i}>${part}</mark>` : part);
}
function inline(text, key) {
  const parts = []; let rest = text, k = 0;
  const re = /(https?:\/\/[^\s<>"'`)\]]+)|`([^`]+)`|\*\*([^*]+)\*\*/;
  while (rest) {
    const m = rest.match(re);
    if (!m) { parts.push(rest); break; }
    if (m.index) parts.push(rest.slice(0, m.index));
    if (m[1]) { const u = m[1].replace(/[.,;:!?]+$/, ''); parts.push(html`<a key=${key + '-' + k++} href=${u} target="_blank" rel="noopener noreferrer">${u}</a>`); rest = rest.slice(m.index + u.length); continue; }
    if (m[2]) parts.push(html`<code key=${key + '-' + k++}>${m[2]}</code>`);
    if (m[3]) parts.push(html`<strong key=${key + '-' + k++}>${m[3]}</strong>`);
    rest = rest.slice(m.index + m[0].length);
  }
  return parts;
}
/** Small, safe renderer for readable documents: headings, lists, quotes, code fences, links. */
function Rich({ text }) {
  const blocks = []; const lines = (text || '').split('\n'); let i = 0, k = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (/^```/.test(l)) { const buf = []; i++; while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]); i++; blocks.push(html`<pre key=${k++}>${buf.join('\n')}</pre>`); continue; }
    if (/^#{1,6}\s/.test(l)) { const lvl = l.match(/^#+/)[0].length; const Tag = lvl <= 2 ? 'h3' : 'h4'; blocks.push(html`<${Tag} key=${k++}>${inline(l.replace(/^#+\s/, ''), k)}<//>`); i++; continue; }
    if (/^\s*[-*]\s+/.test(l)) { const items = []; while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*]\s+/, '')); blocks.push(html`<ul key=${k++}>${items.map((it, j) => html`<li key=${j}>${inline(it, k + '-' + j)}</li>`)}</ul>`); continue; }
    if (/^\s*\d+[.)]\s+/.test(l)) { const items = []; while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, '')); blocks.push(html`<ol key=${k++}>${items.map((it, j) => html`<li key=${j}>${inline(it, k + '-' + j)}</li>`)}</ol>`); continue; }
    if (/^>\s?/.test(l)) { const buf = []; while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, '')); blocks.push(html`<blockquote key=${k++}>${inline(buf.join(' '), k)}</blockquote>`); continue; }
    if (!l.trim()) { i++; continue; }
    const buf = []; while (i < lines.length && lines[i].trim() && !/^(```|#{1,6}\s|\s*[-*]\s+|\s*\d+[.)]\s+|>)/.test(lines[i])) buf.push(lines[i++]);
    blocks.push(html`<p key=${k++}>${buf.map((b, j) => html`<${React.Fragment} key=${j}>${j ? html`<br />` : null}${inline(b, k + '-' + j)}<//>`)}</p>`);
  }
  return html`<div className="rich">${blocks.length ? blocks : html`<p className="muted">No content yet.</p>`}</div>`;
}

/* ---------- search ---------- */
/** promptId → names of the sequences that use it (built once per search). */
function promptSeqIndex(recs) { const m = new Map(); for (const q of recs) if (q.type === 'sequence' && Array.isArray(q.steps)) for (const st of q.steps) if (st.promptId) { if (!m.has(st.promptId)) m.set(st.promptId, []); m.get(st.promptId).push(q.title || ''); } return m; }
function buildHaystack(r, byId, seqIdx) {
  const p = r.projectId && byId.get(r.projectId);
  const tp = r.topicId ? topicPath(r.topicId, byId) : [];
  const parentTopic = r.type === 'topic' && r.parentId ? topicPath(r.parentId, byId) : [];
  const lead = r.leadId && byId.get(r.leadId);
  const owner = r.ownerId && byId.get(r.ownerId);
  return {
    title: (r.title || '').toLowerCase(),
    tags: r.tags.join(' ').toLowerCase(),
    rel: [p ? p.title : '', ...tp, ...parentTopic, lead ? lead.title : '', owner ? owner.title : '', r.source && r.source.fromTitle].filter(Boolean).join(' ').toLowerCase(),
    body: [r.body, r.url, r.contactName, r.contact, r.resType, r.source && r.source.url, r.type, r.type === 'note' ? r.kind : '', r.status,
      r.summary, r.notes, r.expected, r.category, r.type === 'sequence' && Array.isArray(r.steps) ? r.steps.map(st => { const p = st.promptId && byId.get(st.promptId); return (p ? p.title : '') + ' ' + (st.title || '') + ' ' + (Array.isArray(st.items) ? st.items.map(x => x.text).join(' ') : '') + ' ' + (st.result || '') + ' ' + (st.notes || ''); }).join(' ') : '',
      r.type === 'prompt' && seqIdx ? (seqIdx.get(r.id) || []).join(' ') : '', r.sequenceId && byId.get(r.sequenceId) ? byId.get(r.sequenceId).title : ''].filter(Boolean).join(' ').toLowerCase()
  };
}
const SEARCH_GROUPS = [['task', 'Tasks'], ['project', 'Projects'], ['note', 'Notes, ideas & documents'], ['prompt', 'Prompts'], ['sequence', 'Prompt sequences'], ['resource', 'Bookmarks & resources'], ['topic', 'Topics'], ['lead', 'Leads'], ['file', 'Context files']];
/** Orders results into type groups (the group with the best match first) so keyboard order matches what is shown. */
function groupSearch(results) {
  const by = new Map(); for (const x of results) { const k = x.r.type; if (!by.has(k)) by.set(k, []); by.get(k).push(x); }
  const groups = [...by.entries()].map(([k, items]) => ({ k, l: (SEARCH_GROUPS.find(g => g[0] === k) || [k, TYPE_LABEL[k] || k])[1], items }))
    .sort((a, b) => b.items[0].score - a.items[0].score || SEARCH_GROUPS.findIndex(g => g[0] === a.k) - SEARCH_GROUPS.findIndex(g => g[0] === b.k));
  return { groups, flat: groups.flatMap(g => g.items) };
}
function runSearch(q, recs, byId, f) {
  const terms = q.toLowerCase().split(/\s+/).map(t => t.replace(/^#(?=.)/, '')).filter(Boolean); // "#tag" finds the tag
  if (!terms.length) return { terms, results: [] };
  const results = [];
  const topicSet = f.topic ? topicDescendants(f.topic, recs) : null;
  const since = f.days ? Date.now() - f.days * 86400000 : 0; const seqIdx = promptSeqIndex(recs);
  for (const r of recs) {
    if (!f.archived && r.archived) continue;
    if (f.types.length && !f.types.includes(r.type)) continue;
    if (f.project && r.projectId !== f.project && r.id !== f.project) continue;
    if (topicSet && !topicSet.has(r.topicId) && !topicSet.has(r.id)) continue;
    if (f.status && r.status !== f.status) continue;
    if (since && new Date(r.updatedAt).getTime() < since) continue;
    const h = buildHaystack(r, byId, seqIdx);
    let score = 0, ok = true, via = null; const where = new Set();
    for (const t of terms) {
      let s = 0;
      if (h.title.includes(t)) { s += h.title.startsWith(t) ? 14 : 10; where.add('title'); }
      if (h.tags.includes(t)) { s += 5; where.add('tag'); }
      if (h.rel.includes(t)) { s += 3; if (!via) via = t; where.add('linked'); }
      if (h.body.includes(t)) { s += 1; where.add(r.url && r.url.toLowerCase().includes(t) && !(r.body || '').toLowerCase().includes(t) ? 'link' : 'content'); }
      if (!s) { ok = false; break; }
      score += s;
    }
    if (!ok) continue;
    if (r.type === 'task' && !isOpenTask(r)) score -= 1;
    results.push({ r, score, where: [...where] });
  }
  results.sort((a, b) => b.score - a.score || b.r.updatedAt.localeCompare(a.r.updatedAt));
  return { terms, results };
}

/* ---------- block editor (Tiptap bundle, window.WosEditor) ---------- */
/** Keeps only text inserts from legacy Quill content, so imported content can't carry embeds. */
function cleanDelta(d) {
  if (!d || !Array.isArray(d.ops)) return null;
  const ops = d.ops.filter(o => o && typeof o.insert === 'string').map(o => (o.attributes && typeof o.attributes === 'object') ? { insert: o.insert, attributes: o.attributes } : { insert: o.insert });
  return ops.length ? { ops } : null;
}
/**
 * The one editor used for every long-text field. Content is a structured document (bodyDoc);
 * legacy Quill content (delta) and plain text are converted when opened, nothing is discarded.
 * onSave(payload) must resolve true once storage confirms; failures keep the text and offer Retry.
 */
function RichEditor({ id, doc, delta, text, onSave, onChange, placeholder, minHeight = 140, autoFocus, ownerId, compact, mode, onStatus, apiRef, className }) {
  const host = useRef(null); const api = useRef(null); const timer = useRef(null);
  const st = useRef({ dirty: false, saving: false, again: false, lastSig: null, gen: 0, quiet: true });
  const saveRef = useRef(onSave); const changeRef = useRef(onChange); saveRef.current = onSave; changeRef.current = onChange;
  const statusRef = useRef(onStatus); statusRef.current = onStatus;
  const [failed, setFailed] = useState(false);
  const setStatus = (state, retry) => { const a = api.current; a && a.setStatus(state, retry); statusRef.current && statusRef.current(state, retry); };
  const payload = () => ({ bodyDoc: api.current.getJSON(), bodyDelta: null, body: api.current.getText() });
  const flush = async () => {
    clearTimeout(timer.current); const a = api.current; const s = st.current;
    if (!a || !saveRef.current || !s.dirty) return true;
    if (s.saving) { s.again = true; return s.pending || true; }
    const p = payload(); const sig = JSON.stringify(p.bodyDoc); const gen = s.gen;
    s.saving = true; setStatus('saving');
    let resolve; s.pending = new Promise(r => { resolve = r; });
    let ok = false; try { ok = (await saveRef.current(p)) !== false; } catch (e) { ok = false; }
    s.saving = false;
    if (ok) { s.lastSig = sig; if (s.gen === gen) { s.dirty = false; setStatus('saved'); } else setStatus('unsaved'); }
    else setStatus('failed', () => { s.dirty = true; flush(); });
    resolve(ok); s.pending = null;
    if (s.again) { s.again = false; if (s.dirty && ok) return flush(); }
    return ok && !s.dirty;
  };
  // a close or page exit waits until the latest text is stored (a save already running is followed by one for newer typing)
  usePendingEdit(() => !!saveRef.current && (st.current.dirty || st.current.saving), async () => { // editors without onSave (capture drafts) keep their own text
    for (let i = 0; i < 4; i++) { const ok = await flush(); if (ok === false) return false; if (!(st.current.dirty || st.current.saving)) return true; if (st.current.pending) await st.current.pending; }
    return !(st.current.dirty || st.current.saving);
  });
  useEffect(() => {
    if (!window.WosEditor) { setFailed(true); return; }
    const s = st.current;
    const a = WosEditor.create(host.current, {
      content: doc, delta, text, placeholder, minHeight, ownerId, compact,
      editable: mode !== 'read', modes: mode ? false : undefined,
      onUpdate: () => {
        const ed = api.current; if (!ed) return; // updates fired while the editor is still being created
        if (s.quiet) { s.lastSig = JSON.stringify(ed.getJSON()); return; }
        s.dirty = true; s.gen++;
        if (changeRef.current) changeRef.current(payload());
        if (saveRef.current) { setStatus('unsaved'); clearTimeout(timer.current); timer.current = setTimeout(flush, 1000); }
      },
      onBlur: () => flush()
    });
    api.current = a; s.lastSig = JSON.stringify(a.getJSON());
    if (apiRef) apiRef.current = { flush, isDirty: () => s.dirty || s.saving, focus: () => a.focus(), setMode: m => a.setMode(m) };
    setTimeout(() => { s.quiet = false; s.lastSig = JSON.stringify(a.getJSON()); }, 0);
    if (autoFocus) setTimeout(() => a.focus(), 30);
    // on unmount, queue the latest content even if an earlier save is still running (that write is ordered after it)
    return () => { clearTimeout(timer.current); if (s.dirty && saveRef.current) { const p = payload(); s.dirty = false; Promise.resolve(saveRef.current(p)).then(ok => { if (ok === false) s.dirty = true; }); } a.destroy(); api.current = null; };
  }, []);
  // controlled Read/Edit mode (project and topic descriptions); content and pending changes are kept across switches
  useEffect(() => { const a = api.current; if (!a || !mode || a.getMode() === mode) return; a.setMode(mode); if (mode === 'edit') setTimeout(() => a.focus(), 20); }, [mode]);
  // take in changes made elsewhere (another device, an import) only when nothing local is pending
  useEffect(() => {
    const a = api.current; const s = st.current; if (!a) return;
    if (s.dirty || s.saving || a.editor.isFocused) return;
    const incoming = WosEditor.validDoc(doc) ? doc : (delta ? WosEditor.deltaToDoc(delta) : WosEditor.textToDoc(text || ''));
    const sig = JSON.stringify(incoming);
    if (sig === s.lastSig || sig === JSON.stringify(a.getJSON())) return;
    s.quiet = true; a.setContent(incoming); s.lastSig = JSON.stringify(a.getJSON()); setTimeout(() => { s.quiet = false; }, 0);
  }, [doc, delta, text]);
  if (failed) return html`<${EditArea} id=${id} value=${text} rows=${6} placeholder=${placeholder} onSave=${v => onSave && onSave({ bodyDoc: null, bodyDelta: null, body: v })} onChange=${onChange} />`;
  return html`<div className=${'ed-host' + (className ? ' ' + className : '')} id=${id} ref=${host}></div>`;
}
/** A small popover anchored to its button. Escape and outside clicks close it without closing the drawer or page behind. */
function Pop({ label, title, id, btnClass = 'btn sm', children, align = 'left', panelClass = '' }) {
  const [open, setOpen] = useState(false); const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const out = e => { if (ref.current && !ref.current.contains(e.target) && !(e.target.closest && e.target.closest('.wos-pop'))) setOpen(false); };
    const esc = e => { if (e.key === 'Escape' && !window.__wosPopupOpen) { e.stopPropagation(); e.preventDefault(); setOpen(false); } };
    document.addEventListener('mousedown', out); window.addEventListener('keydown', esc, true);
    return () => { document.removeEventListener('mousedown', out); window.removeEventListener('keydown', esc, true); };
  }, [open]);
  return html`<span className="pop-wrap" ref=${ref}>
    <button type="button" id=${id} className=${btnClass} title=${title} aria-haspopup="dialog" aria-expanded=${open} onClick=${() => setOpen(!open)}>${label}</button>
    ${open ? html`<div className=${'pop-panel ' + align + ' ' + panelClass} role="dialog" aria-label=${title}>${typeof children === 'function' ? children(() => setOpen(false)) : children}</div>` : null}
  </span>`;
}
/**
 * Project/topic description: Read mode by default, Edit on demand, through the same editor and autosave path.
 * "Done" waits for the save; if it fails the editor stays open with Retry, so nothing is lost silently.
 */
function AboutPanel({ rec, id, placeholder }) {
  const { act } = useApp();
  const [mode, setMode] = useState('read'); const [status, setStatus] = useState(''); const retryRef = useRef(null); const edRef = useRef(null);
  const empty = !(rec.body || '').trim();
  const done = async () => { const ok = edRef.current ? await edRef.current.flush() : true; if (ok) setMode('read'); };
  return html`<section className="about" id=${id + '-panel'}>
    <div className="sub-hd">About<span className="grow"></span>
      ${status === 'saving' ? html`<span className="small muted">Saving…</span>` : status === 'saved' && mode === 'read' ? html`<span className="small muted">Saved</span>` : null}
      ${mode === 'read' ? html`<button className="btn sm" id=${id + '-edit'} onClick=${() => setMode('edit')}>${empty ? 'Add description' : 'Edit'}</button>` : html`<button className="btn sm" id=${id + '-done'} onClick=${done}>Done</button>`}</div>
    ${status === 'failed' ? html`<div className="banner bad small" role="alert"><span className="grow">The description didn't save. Your text is kept here.</span><button className="btn sm" onClick=${() => retryRef.current && retryRef.current()}>Retry</button></div>` : null}
    ${empty && mode === 'read' ? html`<div className="small muted about-empty">No description yet.</div>` : null}
    <div hidden=${empty && mode === 'read'}>
      <${RichEditor} id=${id} className=${'about-ed' + (mode === 'read' ? ' is-read' : '')} mode=${mode} apiRef=${edRef} doc=${rec.bodyDoc} delta=${rec.bodyDelta} text=${rec.body} ownerId=${rec.id} minHeight=${mode === 'read' ? 0 : 120} placeholder=${placeholder}
        onStatus=${(s, retry) => { setStatus(s); retryRef.current = retry || null; }} onSave=${v => act.update(rec.id, v)} />
    </div>
  </section>`;
}
