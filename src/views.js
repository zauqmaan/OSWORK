/* ===================== main views ===================== */
function collectEvents(recs, filter) {
  const out = [];
  for (const r of recs) { if (filter && !filter(r)) continue; for (const e of r.log) out.push({ ...e, rec: r }); }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}
function bucketOf(iso) {
  const d = localDate(new Date(iso)), t = localDate();
  if (d === t) return 'Today'; if (d === addDays(t, -1)) return 'Yesterday';
  const now = new Date(); const dow = (now.getDay() + 6) % 7; const weekStart = addDays(t, -dow);
  if (d >= weekStart) return 'This week'; return 'Earlier';
}
function TimelineList({ events, showRecord = true, limit = 200 }) {
  const { openRecord } = useApp();
  const [n, setN] = useState(limit);
  if (!events.length) return html`<div className="empty">No recorded activity yet. Activity appears here as you create and change records.</div>`;
  const groups = []; let cur = null;
  events.slice(0, n).forEach(e => { const b = bucketOf(e.at); if (!cur || cur.b !== b) { cur = { b, items: [] }; groups.push(cur); } cur.items.push(e); });
  return html`<div className="stack">${groups.map(g => html`<div key=${g.b} className="tl-group"><div className="eyebrow">${g.b}</div>
    <div className="list">${g.items.map((e, i) => html`<div key=${i} className="tl">
      <time dateTime=${e.at} title=${new Date(e.at).toLocaleString()}>${g.b === 'Today' || g.b === 'Yesterday' ? fmtTime(e.at) : fmtDateTime(e.at)}</time>
      <div className="what"><div><span className=${'kind' + (e.manual ? ' manual' : '')}>${e.manual ? 'Entered by you' : e.kind}</span>${e.text}</div>
        ${showRecord ? html`<div className="on"><${TypeLabel} r=${e.rec} /> · <a onClick=${() => openRecord(e.rec.id)} role="button" tabIndex="0">${e.rec.title || 'Untitled'}</a></div>` : null}</div>
    </div>`)}</div></div>`)}
    ${events.length > n ? html`<button className="btn sm" onClick=${() => setN(n + 200)}>Show older activity</button>` : null}
  </div>`;
}

/* ---------- Today ---------- */
/** Puts every open task into at most one Today group, in priority order. Pure: no dates, states or reminders are invented. */
function todayPlan(tasks, projects, byId, t = localDate()) {
  const open = tasks.filter(isOpenTask); const shown = new Set(); const take = list => { const out = list.filter(x => !shown.has(x.id)); out.forEach(x => shown.add(x.id)); return out; };
  const overdue = take(sortTasks(open.filter(x => isOverdue(x, t)), 'priority', t));
  const today = take(sortTasks(open.filter(x => isToday(x, t)), 'smart', t));
  const waiting = take(sortTasks(open.filter(x => x.status === 'Waiting' || isBlocked(x, byId)), 'updated', t));
  const upcoming = take(sortTasks(open.filter(x => isUpcoming(x, t, 7)), 'deadline', t).sort((a, b) => (nextDate(a) || '').localeCompare(nextDate(b) || '')));
  const active = projects.filter(p => p.status === 'active' && !p.archived);
  const projNext = active.map(p => sortTasks(open.filter(x => x.projectId === p.id && !isBlocked(x, byId) && x.status !== 'Waiting'), 'smart', t)[0]).filter(Boolean);
  const pri = sortTasks(open.filter(x => (x.priority === 'Urgent' || x.priority === 'High') && !isBlocked(x, byId) && x.status !== 'Waiting'), 'priority', t);
  const next = take(sortTasks([...new Map([...pri, ...projNext].map(x => [x.id, x])).values()], 'priority', t));
  const done = sortTasks(tasks.filter(x => !x.archived && x.status === 'Completed' && x.completedAt && localDate(new Date(x.completedAt)) === t), 'completed', t);
  done.forEach(x => shown.add(x.id));
  const first = overdue[0] || today[0] || next[0] || upcoming[0] || null;
  return { overdue, today, waiting, upcoming, next, done, shown, first, active };
}
function TodayView() {
  const { recs, tasks, byId, projects, openRecord, openCapture, act, setView, inboxItems, now } = useApp();
  const t = localDate();
  const plan = todayPlan(tasks, projects, byId, t);
  const { overdue, today, waiting, upcoming, next, done, shown, first, active } = plan;
  const dueRem = recs.filter(x => isReminderDue(x, now));
  const upcomingRem = recs.filter(x => hasReminder(x) && new Date(x.remindAt).getTime() > now && !shown.has(x.id)).sort((a, b) => a.remindAt.localeCompare(b.remindAt)).slice(0, 6);
  const recent = recs.filter(r => (r.type === 'note' || r.type === 'project' || r.type === 'resource') && !r.archived).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5);
  const inboxRest = inboxItems.filter(r => !shown.has(r.id));
  const [quick, setQuick] = useState(''); const [showDone, setShowDone] = useState(false);
  const addQuick = async () => { const v = quick.trim(); if (!v) return; const ok = await act.create({ type: 'task', title: v, status: 'Next', scheduledFor: t }, 'Today'); if (ok) setQuick(''); };
  const dateLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const flags = first ? { [first.id]: 'Start here' } : {};

  if (recs.length === 0) return html`<div className="page">
    <div className="page-hd"><h1>Today</h1><div className="sub">${dateLabel}</div></div>
    <div className="card welcome">
      <h2>Capture anything. Find it anytime. Know what to do next.</h2>
      <p>Your workspace is empty. Paste a note, a link or a task to start; anything without a project or topic lands in the Inbox for sorting later. You can also load a small sample workspace to see how projects, topics, tasks and links fit together, and remove it again in one click.</p>
      <div className="row-wrap">
        <button className="btn primary" onClick=${() => openCapture('note')}><${Icon} name="plus" /> Capture something</button>
        <button className="btn" onClick=${() => openCapture('task')}>New task</button>
        <button className="btn" onClick=${() => openCapture('resource')}>Save a URL</button>
        <button className="btn ghost" onClick=${act.loadSample}>Load sample workspace</button>
      </div>
    </div>
  </div>`;
  const nothingDated = !overdue.length && !today.length;
  const summary = [overdue.length ? `${overdue.length} overdue` : '', today.length ? `${today.length} for today` : '', waiting.length ? `${waiting.length} waiting` : ''].filter(Boolean).join(' · ');

  return html`<div className="page today-page">
    <div className="page-hd"><h1>Today</h1><div className="sub">${dateLabel}${summary ? ' · ' + summary : ''}</div></div>
    <div className="quick-bar">
      <input id="today-quick" className="inp" placeholder="Add a task for today, press Enter" value=${quick} onChange=${e => setQuick(e.target.value)} onKeyDown=${e => e.key === 'Enter' && addQuick()} />
      <button className="btn" onClick=${addQuick}>Add task</button>
      <button className="btn" onClick=${() => openCapture('note')}>Capture note</button>
      <button className="btn" onClick=${() => openCapture('resource')}>Save URL</button>
    </div>
    ${dueRem.length ? html`<div className="banner warn" id="today-due-reminders"><${Icon} name="bell" /><span className="grow">${dueRem.length} reminder${dueRem.length > 1 ? 's are' : ' is'} due: ${dueRem.map((x, i) => html`<${React.Fragment} key=${x.id}>${i ? ', ' : ''}<button className="linklike" onClick=${() => openRecord(x.id)}>${x.title}</button><//>`)}</span></div>` : null}
    <div className="today-cols">
      <div className="today-main">
        ${overdue.length ? html`<${Section} id="sec-overdue" title="Overdue" count=${overdue.length}><${TaskList} tasks=${overdue} flags=${flags} /><//>` : html`<section className="sec" id="sec-overdue" hidden></section>`}
        <${Section} id="sec-today" title="Due or scheduled today" count=${today.length}>
          <${TaskList} tasks=${today} flags=${flags} empty=${nothingDated ? 'Nothing is due, scheduled or reminded for today. Pick something from Next actions, or add a task above.' : 'Nothing else is due or scheduled today.'} /><//>
        <${Section} id="sec-next" title="Next actions" count=${next.length}>
          <div className="sec-note small muted">Urgent and high-priority tasks, and the next open task of each active project, that have no date today.</div>
          <${TaskList} tasks=${next} flags=${flags} limit=${8} empty="No undated priority work. Set a task to High or Urgent, or add tasks to an active project." /><//>
        <${Section} id="sec-upcoming" title="Next 7 days" count=${upcoming.length}>
          <${TaskList} tasks=${upcoming} flags=${flags} limit=${8} empty="Nothing due, scheduled or reminded in the next 7 days." /><//>
        <${Section} id="sec-waiting" title="Waiting or blocked" count=${waiting.length}>
          <${TaskList} tasks=${waiting} limit=${6} empty="Nothing is waiting on someone else or blocked by another task." /><//>
        ${done.length ? html`<section className="sec" id="sec-done"><div className="sec-hd"><h2>Completed today</h2><span className="n">${done.length}</span><span className="grow"></span><button className="linklike small" onClick=${() => setShowDone(v => !v)} aria-expanded=${showDone}>${showDone ? 'Hide' : 'Show'}</button></div>
          ${showDone ? html`<${TaskList} tasks=${done} />` : null}</section>` : null}
      </div>
      <aside className="today-side">
        <${Section} id="sec-reminders" title="Upcoming reminders" count=${upcomingRem.length}>
          ${upcomingRem.length ? html`<div className="list">${upcomingRem.map(x => html`<div key=${x.id} className="row click" data-id=${x.id} data-type=${x.type} onClick=${() => openRecord(x.id)}><${TypeIcon} r=${x} tile /><div className="row-main"><div className="row-title">${x.title}</div><div className="row-meta"><span className="due">⏰ ${fmtDateTime(x.remindAt)}</span><${ContextLabel} r=${x} /></div></div></div>`)}</div>` : html`<div className="empty small">No other reminders. Any record can have one: open it and use Reminder.</div>`}
        <//>
        <${Section} id="sec-projects" title="Active projects" count=${active.length} action=${html`<button className="linklike small" onClick=${() => setView({ name: 'projects' })}>All projects</button>`}>
          ${active.length ? html`<div className="list">${active.map(p => { const pr = projectProgress(p, tasks); return html`<div key=${p.id} className="row click" data-id=${p.id} data-type="project" onClick=${() => openRecord(p.id)}><${TypeIcon} r=${p} tile /><div className="row-main"><div className="row-title">${p.title}</div><div className="row-meta">${pr.total ? html`<${ProgressBar} done=${pr.done} total=${pr.total} />` : html`<span className="muted">No tasks yet</span>`}</div></div></div>`; })}</div>` : html`<div className="empty small">No active projects. Set a project's status to active to see it here.</div>`}
        <//>
        <${Section} id="sec-recent" title="Recently changed" count=${null}>
          ${recent.length ? html`<div className="list">${recent.map(r => html`<div key=${r.id} className="row click" data-id=${r.id} data-type=${r.type} onClick=${() => openRecord(r.id)}><${TypeIcon} r=${r} tile /><div className="row-main"><div className="row-title">${r.title || 'Untitled'}</div><div className="row-meta"><${TypeLabel} r=${r} /><span className="muted">${relTime(r.updatedAt)}</span></div></div></div>`)}</div>` : html`<div className="empty small">No notes, projects or links yet.</div>`}
        <//>
        <${Section} id="sec-inbox" title="Unprocessed Inbox" count=${inboxItems.length} action=${inboxItems.length ? html`<button className="linklike small" onClick=${() => setView({ name: 'inbox' })}>Process Inbox</button>` : null}>
          ${inboxRest.length ? html`<div className="list">${inboxRest.slice(0, 4).map(r => html`<${RecordRow} key=${r.id} r=${r} />`)}</div>` : html`<div className="empty small">${inboxItems.length ? 'Inbox tasks are listed in the groups on the left.' : 'Inbox is empty.'}</div>`}
        <//>
      </aside>
    </div>
  </div>`;
}

/* ---------- Inbox ---------- */
/** The conversions an inbox item supports. Each is an in-place update of the same record, so repeating or retrying never creates a copy. */
function inboxTargets(r, url) {
  const isNote = k => r.type === 'note' && (r.kind || 'note') === k;
  const toNote = k => ({ type: 'note', kind: k, status: null, inbox: false });
  return [
    ['task', 'Task', r.type === 'task' ? { inbox: false, status: r.status === 'Inbox' ? 'Next' : r.status } : toTaskPatch(r), r.type === 'task' ? 'Moved to your task list' : 'Converted to a task'],
    ['note', 'Note', toNote('note'), isNote('note') ? 'Kept as a note' : 'Converted to a note'],
    ['idea', 'Idea', toNote('idea'), isNote('idea') ? 'Kept as an idea' : 'Converted to an idea'],
    ['doc', 'Document', toNote('doc'), isNote('doc') ? 'Kept as a document' : 'Converted to a document'],
    ['resource', 'Bookmark', url ? { type: 'resource', kind: null, url, resType: r.type === 'resource' && r.resType ? r.resType : guessResType(url), status: null, inbox: false } : null, r.type === 'resource' ? 'Kept as a bookmark' : 'Saved as a bookmark'],
    ['project', 'Project', { type: 'project', kind: null, status: 'active', inbox: false }, 'Converted to a project']
  ];
}
function InboxItem({ r, hold, onError, error }) {
  const { act, openRecord, confirm, toast } = useApp();
  const url = r.url || findUrls(r.body)[0] || '';
  const [busy, setBusy] = useState(false);
  const cur = r.type === 'note' ? (r.kind || 'note') : r.type;
  const run = async (patch, msg) => {
    if (busy) return; setBusy(true); onError(r.id, '');
    const ok = await hold(r, () => act.update(r.id, patch));
    setBusy(false);
    if (!ok) onError(r.id, 'Not saved. The item is still in your Inbox with its text and link unchanged. Try again.');
    else if (msg) toast(msg);
  };
  return html`<div className=${'card inbox-item' + (busy ? ' busy' : '')} data-id=${r.id} aria-busy=${busy}>
    <div className="ib-hd">
      <${TypeIcon} r=${r} tile />
      <div className="row-main">
        <button className="linklike row-title ib-title" onClick=${() => openRecord(r.id)} title="Open and edit">${r.title || 'Untitled'}</button>
        <div className="row-meta"><${TypeLabel} r=${r} /><span className="muted">Captured ${relTime(r.createdAt)}</span><${SampleMark} r=${r} />${busy ? html`<span className="muted">Saving…</span>` : null}</div>
      </div>
    </div>
    ${r.body ? html`<div className="row-ex">${excerpt(r.body)}</div>` : null}
    ${url ? html`<div className="host ib-url"><a href=${safeHref(url) || undefined} target="_blank" rel="noopener noreferrer">${url}</a></div>` : null}
    ${error ? html`<div className="banner bad small" role="alert">${error}</div>` : null}
    <div className="ib-actions">
      <${ProjectSelect} className="sel sm" value=${r.projectId} noneLabel="Link to project…" onChange=${v => v && run({ projectId: v, inbox: false }, 'Linked to ' + ((nameOf(v)) || 'project'))} />
      <${TopicSelect} className="sel sm" value=${r.topicId} noneLabel="Assign topic…" onChange=${v => v && run({ topicId: v, inbox: false }, 'Filed under ' + ((nameOf(v)) || 'topic'))} />
      <span className="ib-sep" aria-hidden="true"></span>
      <span className="small muted">Make it a</span>
      <div className="seg ib-convert" role="group" aria-label="Convert">${inboxTargets(r, url).map(([k, l, patch, msg]) => html`<button key=${k} type="button" id=${'ib-' + k + '-' + r.id} disabled=${busy} aria-pressed=${cur === k}
        title=${patch ? (cur === k ? 'Keep as ' + l.toLowerCase() + ' and remove from Inbox' : 'Convert to ' + l.toLowerCase() + '; title, text, link and tags are kept') : 'No link found. Open the item and add a URL first.'}
        className=${cur === k ? 'on' : ''} onClick=${() => patch ? run(patch, msg) : (onError(r.id, 'No link found in this item. Open it and add a URL first.'))}>${l}</button>`)}</div>
      <span className="grow"></span>
      <${TagEditor} tags=${r.tags} onSave=${tags => act.update(r.id, { tags })} />
      <button className="btn sm ghost" disabled=${busy} onClick=${() => run({ archived: true, inbox: false }, 'Archived. Find it under Archive.')}>Archive</button>
      <button className="btn sm ghost danger-txt" disabled=${busy} onClick=${() => confirm({ title: 'Delete this item?', body: `"${r.title}" will be deleted permanently. Export a backup first if you might need it.`, confirmLabel: 'Delete', danger: true, onConfirm: () => act.remove(r.id) })}>Delete</button>
    </div>
  </div>`;
}
function InboxView() {
  const { inboxItems, openCapture } = useApp();
  // items with a save in flight stay visible (from their last saved state) until storage confirms the change
  const [held, setHeld] = useState({}); const [errors, setErrors] = useState({});
  const hold = async (r, fn) => { setHeld(h => ({ ...h, [r.id]: r })); let ok = false; try { ok = await fn(); } catch (e) { ok = false; } setHeld(h => { const n = { ...h }; delete n[r.id]; return n; }); return ok; };
  const onError = (id, msg) => setErrors(e => ({ ...e, [id]: msg }));
  const ids = new Set(inboxItems.map(r => r.id));
  const list = [...inboxItems, ...Object.values(held).filter(r => !ids.has(r.id))].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return html`<div className="page">
    <div className="page-hd"><h1>Inbox</h1><span className="chip">${inboxItems.length} unprocessed</span><span className="grow"></span><button className="btn" onClick=${() => openCapture('note')}><${Icon} name="plus" /> Capture</button>
      <div className="sub">Everything captured without a project or topic. Link, file, convert or archive each item; it leaves the Inbox once the change is saved. Converting keeps the title, text, link and tags.</div></div>
    ${list.length ? html`<div className="stack" id="inbox-list">${list.map(r => html`<${InboxItem} key=${r.id} r=${held[r.id] || r} hold=${hold} onError=${onError} error=${errors[r.id]} />`)}</div>` : html`<div className="empty">Inbox zero. New captures without a project or topic land here.</div>`}
  </div>`;
}

/* ---------- All tasks ---------- */
const TASK_TABS = [['today', 'Today'], ['overdue', 'Overdue'], ['upcoming', 'Upcoming'], ['urgent', 'Urgent'], ['waiting', 'Waiting'], ['blocked', 'Blocked'], ['open', 'All open'], ['completed', 'Completed'], ['all', 'Everything']];
function TasksView({ initialTab }) {
  const { tasks, byId, act } = useApp();
  const [tab, setTab] = useState(initialTab || 'open');
  const [f, setF] = useState({ status: '', priority: '', project: '', topic: '', reminder: '', from: '', to: '', sort: 'smart' });
  const [quick, setQuick] = useState('');
  const t = localDate();
  const live = tasks.filter(x => !x.archived);
  const tabFn = {
    today: x => isToday(x, t) || isOverdue(x, t), overdue: x => isOverdue(x, t), upcoming: x => isUpcoming(x, t), urgent: x => isOpenTask(x) && x.priority === 'Urgent',
    waiting: x => isOpenTask(x) && x.status === 'Waiting', blocked: x => isOpenTask(x) && isBlocked(x, byId), open: isOpenTask, completed: x => x.status === 'Completed', all: () => true
  };
  const counts = Object.fromEntries(TASK_TABS.map(([k]) => [k, live.filter(tabFn[k]).length]));
  const topicSet = useMemo(() => f.topic ? topicDescendants(f.topic, tasks.concat([...byId.values()].filter(r => r.type === 'topic'))) : null, [f.topic, byId]);
  let list = live.filter(tabFn[tab]).filter(x =>
    (!f.status || x.status === f.status) && (!f.priority || x.priority === f.priority) && (!f.project || (f.project === '__none' ? !x.projectId : x.projectId === f.project)) &&
    (!topicSet || topicSet.has(x.topicId)) && (!f.reminder || (f.reminder === 'with' ? !!x.remindAt : !x.remindAt)) &&
    (!f.from || (x.dueAt && x.dueAt >= f.from)) && (!f.to || (x.dueAt && x.dueAt <= f.to)));
  list = sortTasks(list, tab === 'completed' && f.sort === 'smart' ? 'completed' : f.sort, t);
  const set = (k, v) => setF(o => ({ ...o, [k]: v }));
  const addQuick = async () => { const v = quick.trim(); if (!v) return; const ok = await act.create({ type: 'task', title: v, status: 'Next', projectId: f.project && f.project !== '__none' ? f.project : null, topicId: f.topic || null, priority: f.priority || (tab === 'urgent' ? 'Urgent' : 'Normal'), scheduledFor: tab === 'today' ? t : null }, 'task list'); if (ok) setQuick(''); };
  const filtered = Object.entries(f).some(([k, v]) => k !== 'sort' && v);
  const [grouped, setGrouped] = useState(true);
  const canGroup = !['overdue', 'upcoming', 'completed'].includes(tab);
  const groups = canGroup && grouped ? taskDateGroups(list, t) : null;
  return html`<div className="page">
    <div className="page-hd"><h1>All Tasks</h1></div>
    <div className="tabs" role="tablist">${TASK_TABS.map(([k, l]) => html`<button key=${k} role="tab" aria-selected=${tab === k} className=${tab === k ? 'on' : ''} onClick=${() => setTab(k)}>${l}<span className="n">${counts[k]}</span></button>`)}</div>
    <div className="filters">
      <select className="sel sm" aria-label="Status" value=${f.status} onChange=${e => set('status', e.target.value)}><option value="">Any status</option>${TASK_STATUSES.map(s => html`<option key=${s}>${s}</option>`)}</select>
      <select className="sel sm" aria-label="Priority" value=${f.priority} onChange=${e => set('priority', e.target.value)}><option value="">Any priority</option>${PRIORITIES.map(s => html`<option key=${s}>${s}</option>`)}</select>
      <${ProjectSelectFilter} value=${f.project} onChange=${v => set('project', v)} />
      <${TopicSelect} className="sel sm" value=${f.topic} noneLabel="Any topic" onChange=${v => set('topic', v || '')} />
      <select className="sel sm" aria-label="Reminder" value=${f.reminder} onChange=${e => set('reminder', e.target.value)}><option value="">Reminder: any</option><option value="with">Has reminder</option><option value="without">No reminder</option></select>
      <label className="small fg2 row-wrap" style=${{ gap: '4px' }}>Deadline <input type="date" className="inp sm" value=${f.from} onChange=${e => set('from', e.target.value)} aria-label="Deadline from" /> – <input type="date" className="inp sm" value=${f.to} onChange=${e => set('to', e.target.value)} aria-label="Deadline to" /></label>
      <select className="sel sm" aria-label="Sort" value=${f.sort} onChange=${e => set('sort', e.target.value)}>
        <option value="smart">Sort: smart</option><option value="priority">Priority</option><option value="deadline">Deadline</option><option value="reminder">Reminder</option><option value="created">Newest</option><option value="updated">Recently updated</option><option value="title">Title</option></select>
      ${canGroup ? html`<select className="sel sm" id="tasks-group" aria-label="Grouping" value=${grouped ? 'date' : 'none'} onChange=${e => setGrouped(e.target.value === 'date')}><option value="date">Group by date</option><option value="none">No grouping</option></select>` : null}
      ${filtered ? html`<button className="btn sm ghost" id="tasks-reset" onClick=${() => setF({ status: '', priority: '', project: '', topic: '', reminder: '', from: '', to: '', sort: f.sort })}>Reset filters</button>` : null}
    </div>
    <div className="small muted" id="tasks-count">${list.length} task${list.length === 1 ? '' : 's'}${filtered ? ' match the filters' : ''}${groups && list.length ? ' · sorted within each date group' : ''}</div>
    <div className="quick-bar"><input id="tasks-quick" className="inp" placeholder=${'Add a task' + (f.project && f.project !== '__none' ? ' to ' + (byId.get(f.project) || {}).title : '') + ', press Enter'} value=${quick} onChange=${e => setQuick(e.target.value)} onKeyDown=${e => e.key === 'Enter' && addQuick()} /><button className="btn" onClick=${addQuick}>Add</button></div>
    ${groups && list.length ? html`<div className="task-groups">${groups.map(g => html`<${Section} key=${g.k} id=${'tg-' + g.k} title=${g.l} count=${g.items.length}><${TaskList} tasks=${g.items} /><//>`)}</div>`
      : html`<${TaskList} tasks=${list} empty=${filtered ? 'No tasks match these filters. Use Reset filters to see everything in this tab.' : 'No tasks in this view.'} />`}
  </div>`;
}
/** Splits a sorted task list into date groups; each task lands in exactly one, and undated tasks are never overdue. */
function taskDateGroups(list, t = localDate()) {
  const defs = [['overdue', 'Overdue'], ['today', 'Today'], ['upcoming', 'Next 14 days'], ['later', 'Later'], ['past', 'Scheduled earlier, no deadline'], ['none', 'No date'], ['closed', 'Completed or cancelled']];
  const by = Object.fromEntries(defs.map(([k]) => [k, []]));
  for (const x of list) {
    const k = !isOpenTask(x) ? 'closed' : isOverdue(x, t) ? 'overdue' : isToday(x, t) ? 'today' : isUpcoming(x, t) ? 'upcoming' : [x.dueAt, x.scheduledFor, remindDay(x)].some(d => d && d > t) ? 'later' : [x.dueAt, x.scheduledFor, x.remindAt].some(Boolean) ? 'past' : 'none';
    by[k].push(x);
  }
  return defs.map(([k, l]) => ({ k, l, items: by[k] })).filter(g => g.items.length);
}
function ProjectSelectFilter({ value, onChange }) {
  const { projects } = useApp();
  return html`<select className="sel sm" aria-label="Project" value=${value} onChange=${e => onChange(e.target.value)}><option value="">Any project</option><option value="__none">No project</option>${projects.map(p => html`<option key=${p.id} value=${p.id}>${p.title}</option>`)}</select>`;
}

/* ---------- Projects ---------- */
function ProjectsView() {
  const { projects, tasks, recs, byId, openRecord, act } = useApp();
  const [show, setShow] = useState('active');
  const [name, setName] = useState(''); const [desc, setDesc] = useState({ body: '', bodyDoc: null }); const [adding, setAdding] = useState(false);
  const list = projects.filter(p => show === 'all' ? true : show === 'active' ? (p.status === 'active' || p.status === 'on hold') && !p.archived : p.status === show).sort((a, b) => (a.status === 'active' ? 0 : 1) - (b.status === 'active' ? 0 : 1) || PRI_RANK[a.priority] - PRI_RANK[b.priority] || a.title.localeCompare(b.title));
  const create = async () => { if (!name.trim()) return; const r = await act.create({ type: 'project', title: name.trim(), body: desc.body, bodyDoc: desc.body.trim() ? desc.bodyDoc : null, status: 'active', startDate: localDate() }); if (r) { setName(''); setDesc({ body: '', bodyDoc: null }); setAdding(false); openRecord(r.id); } };
  return html`<div className="page">
    <div className="page-hd"><h1>Projects</h1><span className="grow"></span>
      <div className="seg">${[['active', 'Active & on hold'], ['completed', 'Completed'], ['archived', 'Archived'], ['all', 'All']].map(([k, l]) => html`<button key=${k} className=${show === k ? 'on' : ''} onClick=${() => setShow(k)}>${l}</button>`)}</div>
      <button className="btn primary" onClick=${() => setAdding(!adding)}><${Icon} name="plus" /> New project</button></div>
    ${adding ? html`<div className="panel" style=${{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <input id="new-project-name" className="inp" placeholder="Project name" value=${name} onChange=${e => setName(e.target.value)} onKeyDown=${e => e.key === 'Enter' && create()} autoFocus />
      <${RichEditor} compact minHeight=${90} placeholder="Description (optional)" onChange=${setDesc} />
      <div className="row-wrap"><button className="btn" onClick=${create}>Create project</button><button className="btn ghost" onClick=${() => setAdding(false)}>Cancel</button></div></div>` : null}
    ${list.length ? html`<div className="cards">${list.map(p => {
      const pt = tasks.filter(x => x.projectId === p.id && !x.archived); const open = pt.filter(isOpenTask);
      const nx = sortTasks(open.filter(x => !isBlocked(x, byId) && x.status !== 'Waiting'), 'smart')[0];
      const notes = recs.filter(r => r.projectId === p.id && r.type === 'note' && !r.archived).length;
      const res = recs.filter(r => r.projectId === p.id && r.type === 'resource' && !r.archived).length;
      return html`<div key=${p.id} className="card pcard" role="button" tabIndex="0" onClick=${() => openRecord(p.id)} onKeyDown=${e => e.key === 'Enter' && openRecord(p.id)}>
        <div className="pcard-hd"><span className="proj-tile" aria-hidden="true">${(p.title || '?').trim().charAt(0).toUpperCase()}</span><div className="pcard-id"><h3>${p.title}</h3><div className="row-wrap"><${StatusChip} r=${p} /><${Pri} p=${p.priority} /><${SampleMark} r=${p} /></div></div></div>
        ${p.body ? html`<div className="desc">${p.body}</div>` : null}
        ${(() => { const pr = projectProgress(p, tasks); return pr.total ? html`<${ProgressBar} done=${pr.done} total=${pr.total} />` : html`<span className="small muted">No tasks yet</span>`; })()}
        <div className="stat-line"><span>${open.length} open</span><span>${notes} notes</span><span>${res} resources</span>${p.targetDate ? html`<span>Target ${fmtDay(p.targetDate)}</span>` : null}</div>
        <div className="nx">${nx ? html`Next: <b>${nx.title}</b>` : 'No next action set'}</div>
      </div>`; })}</div>` : html`<div className="empty">No projects in this view.</div>`}
  </div>`;
}
function ProjectPage({ id }) {
  const { byId, recs, tasks, act, openRecord, openCapture, setView } = useApp();
  const p = byId.get(id);
  const [tab, setTab] = useState('overview');
  const [quick, setQuick] = useState('');
  const [delOpen, setDelOpen] = useState(false);
  if (!p) return html`<div className="page"><div className="empty">This project no longer exists. <button className="linklike" onClick=${() => setView({ name: 'projects' })}>Back to projects</button></div></div>`;
  const pt = tasks.filter(x => x.projectId === id && !x.archived);
  const open = sortTasks(pt.filter(isOpenTask), 'smart');
  const doneT = sortTasks(pt.filter(x => !isOpenTask(x)), 'completed');
  const notes = recs.filter(r => r.projectId === id && r.type === 'note' && !r.archived).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const res = recs.filter(r => r.projectId === id && r.type === 'resource' && !r.archived);
  const leads = recs.filter(r => r.projectId === id && r.type === 'lead');
  const topicIds = new Set([...recs.filter(r => r.projectId === id && r.topicId).map(r => r.topicId), ...p.links.filter(l => (byId.get(l) || {}).type === 'topic'), ...recs.filter(r => r.type === 'topic' && r.links.includes(id)).map(r => r.id)]);
  const topics = [...topicIds].map(x => byId.get(x)).filter(Boolean);
  const events = collectEvents(recs, r => r.id === id || r.projectId === id);
  const nx = open.filter(x => !isBlocked(x, byId) && x.status !== 'Waiting')[0];
  const pr = projectProgress(p, tasks);
  const addTask = async () => { const v = quick.trim(); if (!v) return; const ok = await act.create({ type: 'task', title: v, status: 'Next', projectId: id }); if (ok) setQuick(''); };
  const TABS = [['overview', 'Overview'], ['tasks', 'Tasks', open.length], ['board', 'Board'], ['notes', 'Notes & resources', notes.length + res.length], ['studio', 'Prompts & plans', recs.filter(r => r.projectId === id && !r.archived && (r.type === 'sequence' || r.type === 'prompt' || (r.type === 'note' && r.kind === 'doc'))).length], ['timeline', 'Timeline', events.length]];
  const daysLeft = p.targetDate ? Math.round((new Date(p.targetDate + 'T00:00:00') - new Date(localDate() + 'T00:00:00')) / 86400000) : null;
  const remLabel = hasReminder(p) ? '⏰ ' + fmtDateTime(p.remindAt) : 'Reminder';
  return html`<div className="page ws-page">
    <header className="ws-head" id="project-head">
      <nav className="crumbs" aria-label="Breadcrumb"><button className="linklike" onClick=${() => setView({ name: 'projects' })}>Projects</button><span aria-hidden="true">/</span><span className="fg2">${p.title}</span><${SampleMark} r=${p} /></nav>
      <div className="ws-title"><span className="proj-tile" aria-hidden="true">${(p.title || '?').trim().charAt(0).toUpperCase()}</span>
        <${EditText} id="project-title" className="inp title-inp" value=${p.title} onSave=${v => v.trim() && act.update(id, { title: v.trim() })} /></div>
      <div className="ws-meta">
        <label className="ws-field"><span className=${'pstat s-' + p.status.replace(/\s+/g, '-')}><i></i></span><select className="sel sm" aria-label="Project status" id="project-status" value=${p.status} onChange=${e => act.update(id, { status: e.target.value, archived: e.target.value === 'archived' })}>${PROJECT_STATUSES.map(s => html`<option key=${s} value=${s}>${s}</option>`)}</select></label>
        <label className="ws-field"><span className="small fg2">Priority</span><select className="sel sm" aria-label="Priority" value=${p.priority} onChange=${e => act.update(id, { priority: e.target.value })}>${PRIORITIES.map(s => html`<option key=${s}>${s}</option>`)}</select></label>
        <label className="ws-field"><span className="small fg2">Target</span><input type="date" className="inp sm" aria-label="Target date" value=${p.targetDate || ''} onChange=${e => act.update(id, { targetDate: e.target.value || null })} />${daysLeft != null && p.status === 'active' ? html`<span className=${'small ' + (daysLeft < 0 ? 'due over' : 'fg2')}>${daysLeft < 0 ? Math.abs(daysLeft) + ' d late' : daysLeft === 0 ? 'today' : daysLeft + ' d left'}</span>` : null}</label>
        ${pr.total ? html`<span className="ws-progress" id="project-progress"><${ProgressBar} done=${pr.done} total=${pr.total} /></span>` : html`<span className="small muted" id="project-progress">No tasks yet</span>`}
        <span className="grow"></span>
        <${Pop} id="project-reminder" title="Reminder" label=${remLabel} btnClass=${'btn sm' + (isReminderDue(p) ? ' warn-btn' : '')} align="right">${html`<div className="pop-body"><div className="sub-hd">Remind me about this project</div><${ReminderControls} rec=${p} /></div>`}<//>
        <${Pop} id="project-more" title="More project actions" label="⋯" btnClass="btn sm icon" align="right">${close => html`<div className="pop-body">
          <label className="field"><span>Start date</span><input type="date" className="inp sm" aria-label="Start date" value=${p.startDate || ''} onChange=${e => act.update(id, { startDate: e.target.value || null })} /></label>
          <button className="btn sm danger" id="project-delete" onClick=${() => { close(); setDelOpen(true); }}>Delete project…</button></div>`}<//>
      </div>
    </header>
    <div className="tabs" role="tablist">${TABS.map(([k, l, n]) => html`<button key=${k} role="tab" className=${tab === k ? 'on' : ''} onClick=${() => setTab(k)}>${l}${n != null ? html`<span className="n">${n}</span>` : null}</button>`)}</div>
    ${tab === 'overview' ? html`<div className="ws-grid">
      <div className="ws-main">
        ${nx ? html`<div className="card next-up" id="project-next"><button type="button" className="check" aria-label="Complete" onClick=${() => act.toggleTask(nx)}><${Icon} name="check" size=${12} /></button><div className="body"><div className="lbl">Next action</div><div className="t" onClick=${() => openRecord(nx.id)}>${nx.title}</div><div className="row-meta"><${Pri} p=${nx.priority} /><${DueLabel} r=${nx} /></div></div></div>` : html`<div className="empty">No next action. Add a task below.</div>`}
        <div className="quick-bar"><input id="project-quick" className="inp" placeholder="Add a task to this project, press Enter" value=${quick} onChange=${e => setQuick(e.target.value)} onKeyDown=${e => e.key === 'Enter' && addTask()} /><button className="btn" onClick=${addTask}>Add task</button><button className="btn" onClick=${() => openCapture('note', { projectId: id })}>Add note</button><button className="btn" onClick=${() => openCapture('resource', { projectId: id })}>Add URL</button></div>
        <${Section} id="project-open" title="Open tasks" count=${open.length}><${TaskList} tasks=${open} hideProject limit=${8} empty="No open tasks." /><//>
        <${Section} title="Recent activity" count=${null}><${TimelineList} events=${events.slice(0, 8)} limit=${8} /><//>
      </div>
      <aside className="ws-side">
        <${AboutPanel} rec=${p} id="project-desc" placeholder="What is this project and why does it matter?" />
        <${ContextFiles} rec=${p} />
        ${topics.length ? html`<${Section} id="project-topics" title="Topics" count=${topics.length}><div className="list">${topics.map(tp => html`<${RecordRow} key=${tp.id} r=${tp} />`)}</div><//>` : null}
        ${notes.length ? html`<${Section} title="Latest notes" count=${notes.length} action=${notes.length > 3 ? html`<button className="linklike small" onClick=${() => setTab('notes')}>All</button>` : null}><div className="list">${notes.slice(0, 3).map(r => html`<${RecordRow} key=${r.id} r=${r} />`)}</div><//>` : null}
        ${res.length ? html`<${Section} id="project-resources" title="Resources" count=${res.length} action=${res.length > 4 ? html`<button className="linklike small" onClick=${() => setTab('notes')}>All</button>` : null}><div className="list">${res.slice(0, 4).map(r => html`<${RecordRow} key=${r.id} r=${r} />`)}</div><//>` : null}
        ${leads.length ? html`<${Section} title="Leads" count=${leads.length}><div className="list">${leads.map(r => html`<${RecordRow} key=${r.id} r=${r} />`)}</div><//>` : null}
      </aside>
    </div>` : null}
    ${tab === 'tasks' ? html`<div className="stack">
      <div className="quick-bar"><input className="inp" placeholder="Add a task to this project, press Enter" value=${quick} onChange=${e => setQuick(e.target.value)} onKeyDown=${e => e.key === 'Enter' && addTask()} /><button className="btn" onClick=${addTask}>Add task</button></div>
      <${Section} title="Open" count=${open.length}><${TaskList} tasks=${open} hideProject empty="No open tasks." /><//>
      <${Section} title="Completed and cancelled" count=${doneT.length}><${TaskList} tasks=${doneT} hideProject limit=${10} empty="None yet." /><//>
    </div>` : null}
    ${tab === 'board' ? html`<${Board} tasks=${pt} />` : null}
    ${tab === 'notes' ? html`<div className="stack">
      <div className="row-wrap"><button className="btn" onClick=${() => openCapture('note', { projectId: id })}>Add note</button><button className="btn" onClick=${() => openCapture('doc', { projectId: id })}>Add document</button><button className="btn" onClick=${() => openCapture('resource', { projectId: id })}>Add URL</button></div>
      <${Section} title="Notes" count=${notes.length}>${notes.length ? html`<div className="list">${notes.map(r => html`<${RecordRow} key=${r.id} r=${r} />`)}</div>` : html`<div className="empty">No notes in this project.</div>`}<//>
      <${Section} title="Resources" count=${res.length}>${res.length ? html`<div className="list">${res.map(r => html`<${RecordRow} key=${r.id} r=${r} />`)}</div>` : html`<div className="empty">No saved links in this project.</div>`}<//>
    </div>` : null}
    ${tab === 'studio' ? html`<${ProjectStudio} project=${p} />` : null}
    ${tab === 'timeline' ? html`<${TimelineList} events=${events} />` : null}
    ${delOpen ? html`<${ContainerDeleteModal} rec=${p} onClose=${() => setDelOpen(false)} onDone=${() => setView({ name: 'projects' })} />` : null}
  </div>`;
}
function Board({ tasks }) {
  const { act, openRecord, byId } = useApp();
  const [over, setOver] = useState(null);
  const cols = ['Inbox', 'Next', 'In Progress', 'Waiting', 'Completed'];
  return html`<div className="board">${cols.map(s => {
    const items = sortTasks(tasks.filter(x => x.status === s), s === 'Completed' ? 'completed' : 'priority');
    return html`<div key=${s} className=${'col' + (over === s ? ' drop' : '')} onDragOver=${e => { e.preventDefault(); setOver(s); }} onDragLeave=${() => setOver(null)}
      onDrop=${e => { e.preventDefault(); setOver(null); const tid = e.dataTransfer.getData('text/plain'); const t = byId.get(tid); if (t && t.status !== s) act.update(tid, { status: s }); }}>
      <div className="col-hd"><span>${s}</span><span>${items.length}</span></div>
      ${items.map(t => html`<div key=${t.id} className="bcard" draggable="true" onDragStart=${e => e.dataTransfer.setData('text/plain', t.id)}>
        <div className=${'row-title' + (t.status === 'Completed' ? ' done' : '')} onClick=${() => openRecord(t.id)}>${t.title}</div>
        <div className="row-meta"><${Pri} p=${t.priority} /><${DueLabel} r=${t} />${isBlocked(t, byId) ? html`<span className="blocked">⛓ Blocked</span>` : null}</div>
        <select className="sel sm" aria-label="Move to status" value=${t.status} onChange=${e => act.update(t.id, { status: e.target.value })}>${TASK_STATUSES.map(x => html`<option key=${x}>${x}</option>`)}</select>
      </div>`)}
    </div>`; })}</div>`;
}
/** Deleting a project or topic never deletes what is in it. */
function ContainerDeleteModal({ rec, onClose, onDone }) {
  const { recs, act, toast } = useApp();
  const key = rec.type === 'project' ? 'projectId' : 'topicId';
  const inside = recs.filter(r => r[key] === rec.id);
  const kids = rec.type === 'topic' ? recs.filter(r => r.type === 'topic' && r.parentId === rec.id) : [];
  const [mode, setMode] = useState('unassign'); const [target, setTarget] = useState(null); const [busy, setBusy] = useState(false);
  const exclude = useMemo(() => rec.type === 'topic' ? topicDescendants(rec.id, recs) : null, [rec.id]);
  const go = async () => {
    if (mode === 'move' && !target) return toast('Choose where to move the linked items.', 'bad');
    setBusy(true); const ok = await deleteRecord(rec.id, { moveTo: mode === 'move' ? target : null }); setBusy(false);
    if (ok) { toast(`${TYPE_LABEL[rec.type]} deleted. ${inside.length} linked item${inside.length === 1 ? '' : 's'} kept.`); onClose(); onDone && onDone(); }
  };
  return html`<${Modal} title=${`Delete ${rec.type} "${rec.title}"?`} onClose=${onClose} small>
    <div className="modal-bd">
      <p style=${{ margin: 0 }}>${inside.length} item${inside.length === 1 ? ' is' : 's are'} linked to this ${rec.type}${kids.length ? ` and it has ${kids.length} child topic${kids.length > 1 ? 's' : ''}` : ''}. Nothing linked will be deleted.</p>
      <label className="row-wrap"><input type="radio" name="delmode" checked=${mode === 'unassign'} onChange=${() => setMode('unassign')} /> Remove only the link. Items stay, without a ${rec.type}.${kids.length ? ' Child topics move up one level.' : ''}</label>
      <label className="row-wrap"><input type="radio" name="delmode" checked=${mode === 'move'} onChange=${() => setMode('move')} /> Move linked items to another ${rec.type}:</label>
      ${mode === 'move' ? (rec.type === 'project' ? html`<${ProjectSelect} value=${target} onChange=${setTarget} noneLabel="Choose a project" />` : html`<${TopicSelect} value=${target} onChange=${setTarget} noneLabel="Choose a topic" exclude=${exclude} />`) : null}
    </div>
    <div className="modal-ft"><button className="btn ghost" onClick=${onClose}>Cancel</button><button className="btn danger" disabled=${busy} onClick=${go}>${busy ? 'Deleting…' : 'Delete ' + rec.type}</button></div>
  <//>`;
}

/* ---------- Notes ---------- */
function NotesView() {
  const { recs, openCapture } = useApp();
  const [q, setQ] = useState(''); const [kind, setKind] = useState(''); const [project, setProject] = useState(''); const [topic, setTopic] = useState(''); const [sort, setSort] = useState('updated');
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const topicSet = useMemo(() => topic ? topicDescendants(topic, recs) : null, [topic, recs]);
  const byId = useMemo(() => new Map(recs.map(r => [r.id, r])), [recs]);
  // kind counts follow the other filters so they always add up to what the list can show
  let base = recs.filter(r => r.type === 'note' && !r.archived && (!project || (project === '__none' ? !r.projectId : r.projectId === project)) && (!topicSet || topicSet.has(r.topicId)));
  if (terms.length) base = base.filter(r => { const h = buildHaystack(r, byId); const all = h.title + ' ' + h.tags + ' ' + h.rel + ' ' + h.body; return terms.every(t => all.includes(t.replace(/^#/, ''))); });
  const counts = { '': base.length }; for (const k of Object.keys(NOTE_KINDS)) counts[k] = base.filter(r => (r.kind || 'note') === k).length;
  const list = base.filter(r => !kind || (r.kind || 'note') === kind);
  list.sort(sort === 'created' ? (a, b) => b.createdAt.localeCompare(a.createdAt) : sort === 'title' ? (a, b) => a.title.localeCompare(b.title) : (a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const filtered = !!(terms.length || kind || project || topic);
  const reset = () => { setQ(''); setKind(''); setProject(''); setTopic(''); };
  return html`<div className="page">
    <div className="page-hd"><h1>Notes</h1><span className="grow"></span><button className="btn" onClick=${() => openCapture('doc')}>New document</button><button className="btn primary" onClick=${() => openCapture('note')}><${Icon} name="plus" /> New note</button></div>
    <div className="seg kind-seg" role="group" aria-label="Kind" id="notes-kinds">${[['', 'All'], ...Object.entries(NOTE_KINDS).map(([k, l]) => [k, l + 's'])].map(([k, l]) => html`<button key=${k || 'all'} type="button" data-kind=${k || 'all'} className=${kind === k ? 'on' : ''} aria-pressed=${kind === k} onClick=${() => setKind(k)}>${l}<span className="n">${counts[k]}</span></button>`)}</div>
    <div className="filters">
      <input className="inp sm" id="notes-q" style=${{ minWidth: '200px' }} placeholder="Filter by text, tag, project or topic" value=${q} onChange=${e => setQ(e.target.value)} aria-label="Filter notes" />
      <${ProjectSelectFilter} value=${project} onChange=${setProject} />
      <${TopicSelect} className="sel sm" value=${topic} noneLabel="Any topic" onChange=${v => setTopic(v || '')} />
      <select className="sel sm" value=${sort} onChange=${e => setSort(e.target.value)} aria-label="Sort"><option value="updated">Recently updated</option><option value="created">Newest</option><option value="title">Title</option></select>
      ${filtered ? html`<button className="btn sm ghost" id="notes-reset" onClick=${reset}>Reset filters</button>` : null}
    </div>
    <div className="small muted" id="notes-count">${list.length} ${list.length === 1 ? 'item' : 'items'}${filtered ? ' match' : ''}</div>
    ${list.length ? html`<div className="list" id="notes-list">${list.map(r => html`<${RecordRow} key=${r.id} r=${r} terms=${terms} />`)}</div>` : html`<div className="empty">${filtered ? html`No notes match. <button className="linklike" onClick=${reset}>Reset filters</button>` : 'No notes yet. Use New note or Capture.'}</div>`}
  </div>`;
}

/* ---------- Topics ---------- */
function TopicsView() {
  const { topics, recs, openRecord, act } = useApp();
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [name, setName] = useState(''); const [parent, setParent] = useState(null);
  const counts = useMemo(() => { const m = new Map(); recs.forEach(r => { if (r.topicId && !r.archived) m.set(r.topicId, (m.get(r.topicId) || 0) + 1); }); return m; }, [recs]);
  const kids = useMemo(() => { const m = new Map(); topics.filter(t => !t.archived).forEach(t => { const k = t.parentId || ''; if (!m.has(k)) m.set(k, []); m.get(k).push(t); }); m.forEach(v => v.sort((a, b) => a.title.localeCompare(b.title))); return m; }, [topics]);
  const total = id => { let n = counts.get(id) || 0; (kids.get(id) || []).forEach(c => { n += total(c.id); }); return n; };
  const create = async () => { if (!name.trim()) return; const r = await act.create({ type: 'topic', title: name.trim(), parentId: parent }); if (r) { setName(''); } };
  const Node = ({ t, depth }) => {
    const ch = kids.get(t.id) || []; const isCol = collapsed.has(t.id);
    return html`<div>
      <div className="tnode" style=${{ paddingLeft: 8 + depth * 18 + 'px' }} onClick=${() => openRecord(t.id)} data-id=${t.id}>
        <button className="tw" aria-label=${isCol ? 'Expand' : 'Collapse'} style=${{ visibility: ch.length ? 'visible' : 'hidden' }} onClick=${e => { e.stopPropagation(); setCollapsed(s => { const n = new Set(s); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n; }); }}><${Icon} name=${isCol ? 'chev' : 'chevd'} size=${14} /></button>
        <span className="tnode-ic"><${Icon} name="topic" size=${14} /></span><span className="nm">${t.title}</span>${hasReminder(t) ? html`<span className=${'due small ' + (isReminderDue(t) ? 'today' : '')} title="Reminder">⏰ ${fmtDateTime(t.remindAt)}</span>` : null}<${SampleMark} r=${t} />
        <span className="ct" title="Items in this topic and its subtopics">${total(t.id)}</span>
      </div>
      ${!isCol ? ch.map(c => html`<${Node} key=${c.id} t=${c} depth=${depth + 1} />`) : null}
    </div>`;
  };
  const roots = (kids.get('') || []).concat(topics.filter(t => !t.archived && t.parentId && !topics.some(x => x.id === t.parentId)));
  return html`<div className="page">
    <div className="page-hd"><h1>Topics</h1><div className="sub">Knowledge areas, separate from projects. Searching a topic name finds everything filed under it and its subtopics.</div></div>
    <div className="quick-bar">
      <input id="new-topic" className="inp" placeholder="New topic name" value=${name} onChange=${e => setName(e.target.value)} onKeyDown=${e => e.key === 'Enter' && create()} />
      <${TopicSelect} className="sel" value=${parent} noneLabel="Top level" onChange=${setParent} />
      <button className="btn" onClick=${create}>Add topic</button>
      <button className="btn ghost" onClick=${() => setCollapsed(new Set())}>Expand all</button>
      <button className="btn ghost" onClick=${() => setCollapsed(new Set(topics.map(t => t.id)))}>Collapse all</button>
    </div>
    ${roots.length ? html`<div className="panel tree">${roots.map(t => html`<${Node} key=${t.id} t=${t} depth=${0} />`)}</div>` : html`<div className="empty">No topics yet. Add one above, for example "n8n".</div>`}
  </div>`;
}
/** A related-records group on the topic hub: first `n` rows, then a working "Show all". */
function HubGroup({ id, title, items, render, n = 5, footer }) {
  const [all, setAll] = useState(false);
  if (!items.length && !footer) return null;
  const shown = all ? items : items.slice(0, n);
  return html`<${Section} id=${id} title=${title} count=${items.length} action=${items.length > n ? html`<button className="linklike small hub-more" onClick=${() => setAll(!all)}>${all ? 'Show fewer' : `Show all ${items.length}`}</button>` : null}>
    ${items.length ? html`<div className="list">${shown.map(render)}</div>` : null}${footer}
  <//>`;
}
function TopicPage({ id }) {
  const { byId, recs, topics, act, openRecord, openCapture, setView } = useApp();
  const t = byId.get(id);
  const [sub, setSub] = useState(true); const [tab, setTab] = useState('all'); const [delOpen, setDelOpen] = useState(false); const [childName, setChildName] = useState('');
  const exclude = useMemo(() => topicDescendants(id, recs), [id, recs]);
  if (!t) return html`<div className="page"><div className="empty">This topic no longer exists. <button className="linklike" onClick=${() => setView({ name: 'topics' })}>Back to topics</button></div></div>`;
  const set = sub ? topicDescendants(id, recs) : new Set([id]);
  const inTopic = recs.filter(r => r.topicId && set.has(r.topicId) && !r.archived);
  const linked = recs.filter(r => (t.links.includes(r.id) || r.links.includes(id)) && !inTopic.includes(r));
  const all = [...inTopic, ...linked];
  const notes = all.filter(r => r.type === 'note').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const ts = sortTasks(all.filter(r => r.type === 'task'), 'smart');
  const res = all.filter(r => r.type === 'resource').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const projIds = new Set([...all.filter(r => r.projectId).map(r => r.projectId), ...all.filter(r => r.type === 'project').map(r => r.id)]);
  const projs = [...projIds].map(x => byId.get(x)).filter(Boolean);
  const children = topics.filter(x => x.parentId === id && !x.archived).sort((a, b) => a.title.localeCompare(b.title));
  const events = collectEvents(recs, r => r.id === id || (r.topicId && set.has(r.topicId)));
  const addChild = async () => { if (!childName.trim()) return; const r = await act.create({ type: 'topic', title: childName.trim(), parentId: id }); if (r) setChildName(''); };
  const ancestors = []; { let cur = t.parentId && byId.get(t.parentId), g = 0; while (cur && g++ < 50) { ancestors.unshift(cur); cur = cur.parentId && byId.get(cur.parentId); } }
  const counts = [[notes.length, 'note'], [ts.length, 'task'], [res.length, 'resource'], [projs.length, 'project'], [children.length, 'child topic']].filter(([n]) => n).map(([n, w]) => `${n} ${w}${n === 1 ? '' : 's'}`);
  const nothing = !notes.length && !ts.length && !res.length && !projs.length;
  const remLabel = hasReminder(t) ? '⏰ ' + fmtDateTime(t.remindAt) : 'Reminder';
  return html`<div className="page ws-page">
    <header className="ws-head" id="topic-head">
      <nav className="crumbs" aria-label="Breadcrumb"><button className="linklike" onClick=${() => setView({ name: 'topics' })}>Topics</button>
        ${ancestors.map(a => html`<${React.Fragment} key=${a.id}><span aria-hidden="true">/</span><button className="linklike" onClick=${() => openRecord(a.id)}>${a.title}</button><//>`)}
        <span aria-hidden="true">/</span><span className="fg2">${t.title}</span><${SampleMark} r=${t} /></nav>
      <div className="ws-title"><span className="row-lead t-topic hub-tile" aria-hidden="true"><${Icon} name="topic" size=${18} /></span>
        <${EditText} id="topic-title" className="inp title-inp" value=${t.title} onSave=${v => v.trim() && act.update(id, { title: v.trim() })} /></div>
      <div className="ws-meta">
        <span className="hub-counts" id="topic-counts">${counts.length ? counts.join(' · ') : 'Nothing filed here yet'}</span>
        <span className="grow"></span>
        <button className="btn sm" onClick=${() => openCapture('note', { topicId: id })}>Add note</button>
        <button className="btn sm" onClick=${() => openCapture('task', { topicId: id })}>Add task</button>
        <button className="btn sm" onClick=${() => openCapture('resource', { topicId: id })}>Add URL</button>
        <${Pop} id="topic-reminder" title="Reminder" label=${remLabel} btnClass=${'btn sm' + (isReminderDue(t) ? ' warn-btn' : '')} align="right">${html`<div className="pop-body"><div className="sub-hd">Remind me about this topic</div><${ReminderControls} rec=${t} /></div>`}<//>
        <${Pop} id="topic-more" title="More topic actions" label="⋯" btnClass="btn sm icon" align="right">${close => html`<div className="pop-body">
          <label className="field"><span>Parent topic</span><${TopicSelect} className="sel sm" value=${t.parentId} noneLabel="Top level" exclude=${exclude} onChange=${v => act.update(id, { parentId: v })} /></label>
          <button className="btn sm danger" id="topic-delete" onClick=${() => { close(); setDelOpen(true); }}>Delete topic…</button></div>`}<//>
      </div>
    </header>
    <div className="tabs">${[['all', 'Everything', all.length], ['timeline', 'Timeline', events.length]].map(([k, l, n]) => html`<button key=${k} className=${tab === k ? 'on' : ''} onClick=${() => setTab(k)}>${l}<span className="n">${n}</span></button>`)}
      <span className="grow"></span><label className="small fg2 row-wrap tabs-opt" style=${{ gap: '6px' }}><input type="checkbox" checked=${sub} onChange=${e => setSub(e.target.checked)} /> Include subtopics</label></div>
    ${tab === 'all' ? html`<div className="ws-grid">
      <div className="ws-main">
        ${nothing ? html`<div className="empty">Nothing is filed under “${t.title}” yet. Use Add note, Add task or Add URL above, or set this topic on any existing record.</div>` : null}
        <${HubGroup} id="topic-notes" title="Notes" items=${notes} render=${r => html`<${RecordRow} key=${r.id} r=${r} />`} />
        <${HubGroup} id="topic-tasks" title="Tasks" items=${ts} render=${r => html`<${TaskRow} key=${r.id} t=${r} hideTopic=${!sub} />`} />
        <${HubGroup} id="topic-resources" title="Resources" items=${res} render=${r => html`<${RecordRow} key=${r.id} r=${r} />`} />
        <${HubGroup} id="topic-projects" title="Projects" items=${projs} render=${r => html`<${RecordRow} key=${r.id} r=${r} />`} />
        <${HubGroup} id="topic-children" title="Child topics" items=${children} render=${r => html`<${RecordRow} key=${r.id} r=${r} />`}
          footer=${html`<div className="quick-bar" style=${{ marginTop: '8px' }}><input className="inp sm" placeholder="Add a child topic" value=${childName} onChange=${e => setChildName(e.target.value)} onKeyDown=${e => e.key === 'Enter' && addChild()} /><button className="btn sm" onClick=${addChild}>Add</button></div>`} />
      </div>
      <aside className="ws-side">
        <${AboutPanel} rec=${t} id="topic-desc" placeholder="Describe this topic" />
        <${ContextFiles} rec=${t} />
      </aside>
    </div>` : html`<${TimelineList} events=${events} />`}
    ${delOpen ? html`<${ContainerDeleteModal} rec=${t} onClose=${() => setDelOpen(false)} onDone=${() => setView({ name: 'topics' })} />` : null}
  </div>`;
}

/* ---------- Resources ---------- */
function ResourcesView() {
  const { recs, openCapture, openRecord } = useApp();
  const [mode, setMode] = useState('list'); const [type, setType] = useState(''); const [project, setProject] = useState(''); const [topic, setTopic] = useState(''); const [q, setQ] = useState(''); const [sort, setSort] = useState('created');
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const topicSet = useMemo(() => topic ? topicDescendants(topic, recs) : null, [topic, recs]);
  const byId = useMemo(() => new Map(recs.map(r => [r.id, r])), [recs]);
  let list = recs.filter(r => r.type === 'resource' && !r.archived && (!type || r.resType === type) && (!project || (project === '__none' ? !r.projectId : r.projectId === project)) && (!topicSet || topicSet.has(r.topicId)));
  if (terms.length) list = list.filter(r => { const h = buildHaystack(r, byId); const all = h.title + ' ' + h.tags + ' ' + h.rel + ' ' + h.body + ' ' + hostOf(r.url).toLowerCase(); return terms.every(t => all.includes(t.replace(/^#/, ''))); });
  const cmp = { created: (a, b) => b.createdAt.localeCompare(a.createdAt), updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt), title: (a, b) => a.title.localeCompare(b.title), site: (a, b) => hostOf(a.url).localeCompare(hostOf(b.url)) || a.title.localeCompare(b.title) }[sort];
  list.sort(cmp);
  const filtered = !!(type || project || topic || terms.length);
  const reset = () => { setType(''); setProject(''); setTopic(''); setQ(''); };
  return html`<div className="page">
    <div className="page-hd"><h1>Bookmarks & Resources</h1><span className="grow"></span>
      <div className="seg"><button className=${mode === 'list' ? 'on' : ''} onClick=${() => setMode('list')}>List</button><button className=${mode === 'cards' ? 'on' : ''} onClick=${() => setMode('cards')}>Cards</button></div>
      <button className="btn primary" onClick=${() => openCapture('resource')}><${Icon} name="plus" /> Save URL</button></div>
    <div className="filters">
      <input className="inp sm" id="res-q" style=${{ minWidth: '200px' }} placeholder="Filter by title, site, URL or tag" value=${q} onChange=${e => setQ(e.target.value)} aria-label="Filter resources" />
      <select className="sel sm" value=${type} onChange=${e => setType(e.target.value)} aria-label="Type"><option value="">All types</option>${RES_TYPES.map(x => html`<option key=${x}>${x}</option>`)}</select>
      <${ProjectSelectFilter} value=${project} onChange=${setProject} />
      <${TopicSelect} className="sel sm" value=${topic} noneLabel="Any topic" onChange=${v => setTopic(v || '')} />
      <select className="sel sm" value=${sort} onChange=${e => setSort(e.target.value)} aria-label="Sort" id="res-sort"><option value="created">Newest saved</option><option value="updated">Recently updated</option><option value="title">Title</option><option value="site">Site</option></select>
      ${filtered ? html`<button className="btn sm ghost" id="res-reset" onClick=${reset}>Reset filters</button>` : null}
    </div>
    <div className="small muted" id="res-count">${list.length} resource${list.length === 1 ? '' : 's'}${filtered ? ' match' : ''}</div>
    ${!list.length ? html`<div className="empty">${filtered ? html`No saved resources match. <button className="linklike" onClick=${reset}>Reset filters</button>` : 'No saved resources yet. Use Save URL or paste a link into Capture.'}</div>` : mode === 'list'
      ? html`<div className="list" id="res-list">${list.map(r => html`<${RecordRow} key=${r.id} r=${r} terms=${terms} />`)}</div>`
      : html`<div className="cards res-cards">${list.map(r => { const href = urlOk(r.url) ? r.url : null; return html`<div key=${r.id} className="card rcard" data-id=${r.id} data-type="resource" role="button" tabIndex="0" onClick=${() => openRecord(r.id)} onKeyDown=${e => e.key === 'Enter' && openRecord(r.id)}>
          <div className="rcard-site"><span className="mono-tile big" aria-hidden="true">${siteLetter(r.url)}</span><div className="rcard-src"><span className="host">${urlOk(r.url) ? hostOf(r.url) : 'No valid link'}</span><span className="tlabel"><${TypeIcon} r=${r} size=${13} />${r.resType}</span></div></div>
          <h3>${highlight(r.title, terms)}</h3>${r.body ? html`<div className="desc">${r.body}</div>` : null}
          <${ResUrl} r=${r} />
          <div className="row-meta"><${ContextLabel} r=${r} /><${SampleMark} r=${r} /></div>
          ${href ? html`<a className="btn sm open-link" href=${href} target="_blank" rel="noopener noreferrer" onClick=${e => e.stopPropagation()}>Open <${Icon} name="ext" size=${12} /></a>` : null}
        </div>`; })}</div>`}
  </div>`;
}

/* ---------- Leads ---------- */
function LeadsView() {
  const { recs, tasks, act, openRecord } = useApp();
  const [q, setQ] = useState(''); const [status, setStatus] = useState(''); const [sort, setSort] = useState({ k: 'nextFollowUp', d: 1 });
  const [adding, setAdding] = useState(false); const [form, setForm] = useState({ title: '', url: '', contactName: '', contact: '' });
  const leads = recs.filter(r => r.type === 'lead' && !r.archived);
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  let list = leads.filter(r => (!status || r.status === status) && (!terms.length || terms.every(t => (r.title + ' ' + r.url + ' ' + r.contactName + ' ' + r.contact + ' ' + r.body).toLowerCase().includes(t))));
  const openCount = id => tasks.filter(t => t.leadId === id && isOpenTask(t)).length;
  const val = (r, k) => k === 'tasks' ? openCount(r.id) : k === 'priority' ? PRI_RANK[r.priority] : k === 'status' ? LEAD_STATUSES.indexOf(r.status) : (r[k] || (k === 'nextFollowUp' || k === 'lastContact' ? '9999' : ''));
  list.sort((a, b) => { const x = val(a, sort.k), y = val(b, sort.k); return (x > y ? 1 : x < y ? -1 : 0) * sort.d; });
  const th = (k, l) => html`<th onClick=${() => setSort(s => ({ k, d: s.k === k ? -s.d : 1 }))} aria-sort=${sort.k === k ? (sort.d > 0 ? 'ascending' : 'descending') : 'none'}>${l}${sort.k === k ? (sort.d > 0 ? ' ↑' : ' ↓') : ''}</th>`;
  const create = async () => { if (!form.title.trim()) return; const r = await act.create({ type: 'lead', ...form, title: form.title.trim(), status: 'New' }); if (r) { setForm({ title: '', url: '', contactName: '', contact: '' }); setAdding(false); openRecord(r.id); } };
  const t = localDate();
  return html`<div className="page">
    <div className="page-hd"><h1>Leads</h1><span className="grow"></span><button className="btn primary" onClick=${() => setAdding(!adding)}><${Icon} name="plus" /> Add lead</button>
      <div className="sub">Client and website leads for web development work. Use it only when you have leads.</div></div>
    ${adding ? html`<div className="panel" style=${{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div className="grid2">
        <label className="field"><span>Business or client name</span><input id="lead-name" className="inp" value=${form.title} onChange=${e => setForm({ ...form, title: e.target.value })} autoFocus /></label>
        <label className="field"><span>Website URL</span><input id="lead-url" className="inp" value=${form.url} placeholder="https://" onChange=${e => setForm({ ...form, url: e.target.value })} /></label>
        <label className="field"><span>Contact name</span><input className="inp" value=${form.contactName} onChange=${e => setForm({ ...form, contactName: e.target.value })} /></label>
        <label className="field"><span>Contact details</span><input className="inp" value=${form.contact} placeholder="Email or phone, if you have it" onChange=${e => setForm({ ...form, contact: e.target.value })} /></label>
      </div>
      <div className="row-wrap"><button className="btn" onClick=${create}>Create lead</button><button className="btn ghost" onClick=${() => setAdding(false)}>Cancel</button></div></div>` : null}
    <div className="filters">
      <input className="inp sm" style=${{ minWidth: '200px' }} placeholder="Search leads" value=${q} onChange=${e => setQ(e.target.value)} aria-label="Search leads" />
      <select className="sel sm" value=${status} onChange=${e => setStatus(e.target.value)} aria-label="Status"><option value="">All statuses</option>${LEAD_STATUSES.map(s => html`<option key=${s}>${s}</option>`)}</select>
    </div>
    ${list.length ? html`<div className="tbl-wrap"><table className="tbl"><thead><tr>${th('title', 'Client')}${th('url', 'Website')}${th('status', 'Status')}${th('priority', 'Priority')}${th('lastContact', 'Last contact')}${th('nextFollowUp', 'Next follow-up')}${th('tasks', 'Open tasks')}${th('createdAt', 'Created')}</tr></thead>
      <tbody>${list.map(r => html`<tr key=${r.id} onClick=${() => openRecord(r.id)} data-id=${r.id}>
        <td><div style=${{ fontWeight: 500 }}>${r.title}</div>${r.contactName ? html`<div className="small fg2">${r.contactName}</div>` : null}<${SampleMark} r=${r} /></td>
        <td>${safeHref(r.url) ? html`<a className="host" href=${r.url} target="_blank" rel="noopener noreferrer" onClick=${e => e.stopPropagation()}>${hostOf(r.url)}</a>` : html`<span className="muted">${r.url || '—'}</span>`}</td>
        <td><${StatusChip} r=${r} /></td><td><${Pri} p=${r.priority} /></td>
        <td className="num">${r.lastContact ? fmtDay(r.lastContact) : '—'}</td>
        <td className=${'num ' + (r.nextFollowUp && r.nextFollowUp < t ? 'due over' : r.nextFollowUp === t ? 'due today' : '')}>${r.nextFollowUp ? fmtDay(r.nextFollowUp) : '—'}</td>
        <td className="num">${openCount(r.id)}</td><td className="num">${fmtDay(localDate(new Date(r.createdAt)))}</td>
      </tr>`)}</tbody></table></div>` : html`<div className="empty">${leads.length ? 'No leads match.' : 'No leads yet. Add one when you have a prospect.'}</div>`}
  </div>`;
}

/* ---------- Timeline ---------- */
function TimelineView() {
  const { recs } = useApp();
  const [type, setType] = useState(''); const [kind, setKind] = useState(''); const [project, setProject] = useState(''); const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  let events = collectEvents(recs, r => (!type || r.type === type) && (!project || r.projectId === project || r.id === project));
  if (kind) events = events.filter(e => kind === 'manual' ? e.manual : e.kind === kind);
  if (from) events = events.filter(e => localDate(new Date(e.at)) >= from);
  if (to) events = events.filter(e => localDate(new Date(e.at)) <= to);
  const KINDS = [['created', 'Created'], ['status', 'Status changes'], ['completed', 'Completed'], ['reschedule', 'Reschedules'], ['note', 'Notes added'], ['resource', 'Resources attached'], ['decision', 'Decisions'], ['project-status', 'Project status'], ['converted', 'Conversions'], ['contact', 'Lead contact'], ['edit', 'Edits'], ['manual', 'Entered by you']];
  return html`<div className="page">
    <div className="page-hd"><h1>Timeline</h1><div className="sub">Everything the app has recorded, newest first. Times are recorded automatically when a change is saved; entries marked “Entered by you” are decisions and contact logs you wrote.</div></div>
    <div className="filters">
      <select className="sel sm" value=${type} onChange=${e => setType(e.target.value)} aria-label="Record type"><option value="">All records</option>${Object.entries(TYPE_LABEL).map(([k, l]) => html`<option key=${k} value=${k}>${l}s</option>`)}</select>
      <select className="sel sm" value=${kind} onChange=${e => setKind(e.target.value)} aria-label="Event"><option value="">All events</option>${KINDS.map(([k, l]) => html`<option key=${k} value=${k}>${l}</option>`)}</select>
      <${ProjectSelectFilter} value=${project} onChange=${v => setProject(v === '__none' ? '' : v)} />
      <label className="small fg2 row-wrap" style=${{ gap: '4px' }}>From <input type="date" className="inp sm" value=${from} onChange=${e => setFrom(e.target.value)} /></label>
      <label className="small fg2 row-wrap" style=${{ gap: '4px' }}>To <input type="date" className="inp sm" value=${to} onChange=${e => setTo(e.target.value)} /></label>
    </div>
    <${TimelineList} events=${events} />
  </div>`;
}

/* ---------- Archive ---------- */
function ArchiveView() {
  const { recs, act, confirm, openRecord } = useApp();
  const list = recs.filter(r => r.archived).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return html`<div className="page">
    <div className="page-hd"><h1>Archive</h1><div className="sub">Archived records are hidden from active views but still searchable with the “Include archived” filter. Restore or delete them here.</div></div>
    ${list.length ? html`<div className="list">${list.map(r => html`<div key=${r.id} className="row">
      <div className="row-main"><button className="linklike row-title" style=${{ color: 'var(--fg)' }} onClick=${() => openRecord(r.id)}>${r.title || 'Untitled'}</button>
        <div className="row-meta"><${TypeLabel} r=${r} /><span className="muted">Archived ${relTime(r.updatedAt)}</span></div></div>
      <div className="row-side"><button className="btn sm" onClick=${() => act.update(r.id, { archived: false, status: r.type === 'project' && r.status === 'archived' ? 'active' : r.status })}>Restore</button>
        <button className="btn sm danger" onClick=${() => confirm({ title: 'Delete permanently?', body: `"${r.title}" will be removed. Links to it are cleared; linked items are kept.`, confirmLabel: 'Delete', danger: true, onConfirm: () => act.remove(r.id) })}>Delete</button></div>
    </div>`)}</div>` : html`<div className="empty">Nothing archived.</div>`}
  </div>`;
}

/* ---------- Search ---------- */
const MATCH_WORDS = { title: 'title', tag: 'tag', linked: 'project or topic name', content: 'content', link: 'URL' };
function SearchView({ q, filters, setFilters, results, groups, terms, cursor, setCursor }) {
  const toggleType = k => setFilters(f => ({ ...f, types: f.types.includes(k) ? f.types.filter(x => x !== k) : [...f.types, k] }));
  const statuses = [...new Set([...TASK_STATUSES, ...PROJECT_STATUSES, ...LEAD_STATUSES])];
  const anyFilter = filters.types.length || filters.project || filters.topic || filters.status || filters.days || filters.archived;
  const clear = () => setFilters({ types: [], project: null, topic: null, status: '', days: 0, archived: false });
  let i = -1;
  return html`<div className="page">
    <div className="page-hd"><h1>Search</h1><span className="chip" id="search-count" role="status">${results.length} result${results.length === 1 ? '' : 's'} for “${q}”</span>
      <div className="sub">Searches titles, full content, task descriptions, URLs and sites, tags (with or without #), contacts, and the names of linked projects and topics. Use ↑ ↓ and Enter in the search box; Escape clears it.</div></div>
    <div className="filters">
      <div className="seg">${Object.entries(TYPE_LABEL).map(([k, l]) => html`<button key=${k} className=${filters.types.includes(k) ? 'on' : ''} onClick=${() => toggleType(k)} aria-pressed=${filters.types.includes(k)}>${l}s</button>`)}</div>
      <${ProjectSelect} className="sel sm" value=${filters.project} noneLabel="Any project" onChange=${v => setFilters(f => ({ ...f, project: v }))} />
      <${TopicSelect} className="sel sm" value=${filters.topic} noneLabel="Any topic" onChange=${v => setFilters(f => ({ ...f, topic: v }))} />
      <select className="sel sm" value=${filters.status} onChange=${e => setFilters(f => ({ ...f, status: e.target.value }))} aria-label="Status"><option value="">Any status</option>${statuses.map(s => html`<option key=${s} value=${s}>${s}</option>`)}</select>
      <select className="sel sm" value=${filters.days} onChange=${e => setFilters(f => ({ ...f, days: Number(e.target.value) }))} aria-label="Updated"><option value="0">Any date</option><option value="1">Updated today</option><option value="7">Past 7 days</option><option value="30">Past 30 days</option><option value="365">Past year</option></select>
      <label className="small fg2 row-wrap" style=${{ gap: '6px' }}><input type="checkbox" checked=${filters.archived} onChange=${e => setFilters(f => ({ ...f, archived: e.target.checked }))} /> Include archived</label>
      ${anyFilter ? html`<button className="btn sm ghost" id="search-reset" onClick=${clear}>Clear filters</button>` : null}
    </div>
    ${results.length ? html`<div id="search-results">${groups.map(g => html`<section key=${g.k} className="sgroup" data-group=${g.k}>
        <div className="sgroup-hd"><h2>${g.l}</h2><span className="n">${g.items.length}</span></div>
        <div className="list">${g.items.map(x => { i++; const idx = i; return html`<div key=${x.r.id} className=${'sres' + (idx === cursor ? ' kbd-on' : '')} data-idx=${idx}>
          <${RecordRow} r=${x.r} terms=${terms} />
          ${x.where && x.where.length && !x.where.includes('title') ? html`<div className="match-why small muted">Matched in ${x.where.map(w => MATCH_WORDS[w] || w).join(', ')}</div>` : null}</div>`; })}</div>
      </section>`)}</div>`
      : html`<div className="empty" id="search-empty">No records match “${q}”.${anyFilter ? html` Filters are on. <button className="linklike" onClick=${clear}>Clear filters</button>` : ' Try fewer or shorter words.'}</div>`}
  </div>`;
}
