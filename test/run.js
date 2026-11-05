const { chromium } = require('playwright-core');
const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, '..');
const FILE = 'file://' + path.join(ROOT, 'work-os.html');
const VENDOR = {
  'react.production.min.js': path.join(ROOT, 'node_modules/react/umd/react.production.min.js'),
  'react-dom.production.min.js': path.join(ROOT, 'node_modules/react-dom/umd/react-dom.production.min.js'),
  'htm.umd.js': path.join(ROOT, 'node_modules/htm/dist/htm.umd.js'),
  'quill.js': path.join(ROOT, 'node_modules/quill/dist/quill.js')
};
// A stand-in for the artifact runtime: db persisted in localStorage (survives reload), user id, downloads.
const MOCK = `(() => {
  const KEY = 'mockdb';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } };
  const save = m => localStorage.setItem(KEY, JSON.stringify(m));
  const listeners = {};
  const fire = col => setTimeout(() => { const m = load(); const docs = Object.entries(m).filter(([p]) => p.startsWith(col + '/')).map(([p, v]) => ({ id: p.slice(col.length + 1), exists: true, data: () => v, metadata: {} })); (listeners[col] || []).forEach(f => f({ docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: {} })); }, 5);
  const colRef = col => ({ path: col,
    doc: id => ({ id, path: col + '/' + id,
      set: async d => { if (window.__failWrites) throw { code: 'unavailable', message: 'simulated outage' }; if (JSON.stringify(d).length > 262144) throw { code: 'invalid_argument', message: 'too big' }; const m = load(); m[col + '/' + id] = d; save(m); window.__writes = (window.__writes || 0) + 1; fire(col); },
      delete: async () => { const m = load(); delete m[col + '/' + id]; save(m); fire(col); } }),
    onSnapshot: (next, err) => { (listeners[col] = listeners[col] || []).push(next); fire(col); return () => {}; } });
  const db = { doc: p => ({ collection: sub => colRef(p + '/' + sub) }), collection: colRef };
  window.__downloads = [];
  window.claude = { use: async name => name === 'db' ? db : name === 'user' ? { id: async () => 'u_test' } : name === 'downloads' ? { save: async r => { window.__downloads.push(r); return { status: 'saved' }; } } : name === 'assets' ? { upload: async b => ({ id: 'a' + Date.now(), url: URL.createObjectURL(b), sizeBytes: b.size, contentType: b.type }) } : null };
})();`;

const results = [];
const pass = (n, msg) => { results.push(['PASS', n, msg]); console.log('PASS', n, msg); };
const fail = (n, msg) => { results.push(['FAIL', n, msg]); console.log('FAIL', n, msg); };
async function check(n, label, fn) { try { const r = await fn(); if (r === false) fail(n, label); else pass(n, label + (typeof r === 'string' ? ' — ' + r : '')); } catch (e) { fail(n, label + ' — ' + e.message.split('\n').filter(l => /waiting for|Timeout|intercepts/.test(l)).slice(0, 4).join(' | ')); } }

const pad = n => String(n).padStart(2, '0');
const ld = (off = 0) => { const d = new Date(); d.setDate(d.getDate() + off); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

async function newPage(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(MOCK);
  await ctx.route(/cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net/, r => { const f = Object.keys(VENDOR).find(k => r.request().url().endsWith(k)); return f ? r.fulfill({ path: VENDOR[f], contentType: 'application/javascript' }) : r.abort(); });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', e => { page.errors.push(e.message); console.log('PAGEERROR', e.message); });
  page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
  await page.goto(FILE);
  await page.waitForSelector('.hdr');
  await page.waitForFunction(() => !document.body.innerText.includes('Loading your workspace'));
  return { ctx, page };
}
const nav = (page, k) => page.click('#nav-' + k);
const setEditor = (page, sel, text) => page.evaluate(([sel, text]) => { const a = document.querySelector(sel).__wos; a.editor.commands.setContent(WosEditor.textToDoc(text), { emitUpdate: true }); }, [sel, text]);
const getEditor = (page, sel) => page.evaluate(sel => document.querySelector(sel).__wos.getText(), sel);
const edEnd = async (page, sel) => { await page.click(sel + ' .ed-content'); await page.evaluate(sel => document.querySelector(sel).__wos.editor.commands.focus('end'), sel); };
const slash = async (page, cmd) => { await page.keyboard.type('/' + cmd); await page.waitForSelector('.wos-slash .wos-item'); await page.keyboard.press('Enter'); await page.waitForTimeout(60); };
const reopenNote = async (page, title) => { await closeDrawer(page); await page.reload(); await page.waitForSelector('.hdr'); await page.waitForFunction(() => !document.body.innerText.includes('Loading your workspace')); await nav(page, 'notes'); await page.locator('.row', { hasText: title }).first().click(); await page.waitForSelector('#f-body .ed-content'); };
async function capture(page, o) {
  await page.click('#hdr-capture'); await page.waitForSelector('#cap-panel', { state: 'visible' });
  await page.click('#cap-type-' + o.type);
  if (o.title) await page.fill('#cap-title', o.title);
  if (o.url) await page.fill('#cap-url', o.url);
  if (o.content) await setEditor(page, '#cap-content', o.content);
  if (o.project || o.topic) { if ((await page.getAttribute('#cap-more', 'aria-expanded')) !== 'true') await page.click('#cap-more'); }
  if (o.project) await page.selectOption('#cap-project', { label: o.project });
  if (o.topic) await page.selectOption('#cap-topic', { label: o.topic });
  if (o.remind) await page.fill('#cap-remind', o.remind);
  if (o.due) await page.fill('#cap-due', o.due);
  if (o.priority) await page.selectOption('#cap-priority', o.priority);
  await page.click('#cap-save');
  await page.waitForSelector('#cap-panel', { state: 'hidden' });
}
async function search(page, q) { await page.fill('#global-search', q); await page.waitForTimeout(100); return page.$$eval('#search-results .row-title', els => els.map(e => e.textContent)); }
const clearSearch = page => page.fill('#global-search', '');
const closeDrawer = async page => { if (await page.$('.drawer')) { await page.click('.drawer-hd button[aria-label="Close"]'); } };

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--headless=new'] });
  const { ctx, page } = await newPage(browser);

  await check(0, 'Empty workspace shows welcome, no fabricated data', async () => (await page.textContent('.main')).includes('Your workspace is empty'));

  // 1
  await check(1, 'Create topic n8n', async () => {
    await nav(page, 'topics'); await page.fill('#new-topic', 'n8n'); await page.click('text=Add topic');
    await page.waitForSelector('.tnode .nm:text-is("n8n")'); return true;
  });
  // 2
  await check(2, 'Create note linked to n8n', async () => {
    await capture(page, { type: 'note', title: 'Webhook retry pattern', content: 'Use exponential backoff when an incoming webhook fails.', topic: 'n8n' }); return true;
  });
  // 3
  await check(3, 'Save YouTube URL linked to n8n', async () => {
    await capture(page, { type: 'resource', url: 'https://www.youtube.com/watch?v=abc123', title: 'Workflow tutorial video', topic: 'n8n' });
    await nav(page, 'resources'); const t = await page.textContent('.main'); return t.includes('Workflow tutorial video') && t.includes('YouTube');
  });
  // 4
  await check(4, 'Create task linked to n8n with reminder and deadline', async () => {
    await capture(page, { type: 'task', title: 'Build lead-scoring flow', topic: 'n8n', remind: ld(1) + 'T10:00', due: ld(3), priority: 'High' });
    await nav(page, 'tasks'); const row = await page.textContent('.list'); return row.includes('Build lead-scoring flow') && row.includes('Due') && row.includes('⏰');
  });
  // 5
  await check(5, 'Search n8n returns note, resource and task', async () => {
    const titles = await search(page, 'n8n');
    const need = ['Webhook retry pattern', 'Workflow tutorial video', 'Build lead-scoring flow', 'n8n'];
    const miss = need.filter(n => !titles.some(t => t === n)); await clearSearch(page);
    return miss.length ? false : titles.join(' | ');
  });
  // 6
  await check(6, 'Topic page shows notes, resources and tasks together', async () => {
    await nav(page, 'topics'); await page.click('.tnode .nm:text-is("n8n")');
    const n = await page.textContent('#topic-notes'), t = await page.textContent('#topic-tasks'), r = await page.textContent('#topic-resources');
    return n.includes('Webhook retry pattern') && t.includes('Build lead-scoring flow') && r.includes('Workflow tutorial video');
  });
  // 7
  await check(7, 'PresenceScope project with task, note and ChatGPT URL', async () => {
    await nav(page, 'projects'); await page.click('text=New project'); await page.fill('#new-project-name', 'PresenceScope'); await page.click('text=Create project');
    await page.waitForSelector('#project-title');
    await page.fill('#project-quick', 'Implement uptime checker'); await page.press('#project-quick', 'Enter');
    await page.waitForSelector('text=Implement uptime checker');
    await capture(page, { type: 'note', title: 'Uptime checker design', content: 'Ping every 5 minutes; alert after 2 failures.', project: 'PresenceScope' });
    await capture(page, { type: 'resource', url: 'https://chatgpt.com/c/presence-uptime-plan', title: 'ChatGPT: uptime checker plan', project: 'PresenceScope' });
    await page.click('.tabs button:has-text("Notes & resources")');
    const t = await page.textContent('.main');
    return t.includes('Uptime checker design') && t.includes('ChatGPT: uptime checker plan');
  });
  // 8
  await check(8, 'Task information panel shows source and related info', async () => {
    await page.click('.tabs button:has-text("Tasks")'); await page.click('.row-title:text-is("Implement uptime checker")');
    await page.waitForSelector('.drawer');
    await page.fill('#f-url', 'https://chatgpt.com/c/presence-uptime-plan'); await page.press('#f-url', 'Enter');
    await setEditor(page, '#f-body', 'Needed so PresenceScope can report downtime. Plan agreed in ChatGPT.'); await page.waitForTimeout(1300);
    const lp = page.locator('.drawer input[aria-label="Link a record"]');
    await lp.fill('Uptime checker design'); await page.click('.picker-list .row-title:text-is("Uptime checker design")'); await page.waitForTimeout(150);
    await lp.fill('ChatGPT'); await page.click('.picker-list .row-title:text-is("ChatGPT: uptime checker plan")'); await page.waitForTimeout(150);
    await page.fill('.drawer input[aria-label="Record a decision"]', 'Use 5-minute interval to stay in free tier'); await page.click('.drawer button:has-text("Record")'); await page.waitForTimeout(150);
    const d = await page.textContent('.drawer');
    const proj = await page.$eval('#f-project', s => s.options[s.selectedIndex].text);
    const ok = proj === 'PresenceScope' && d.includes('Source URL') && d.includes('https://chatgpt.com/c/presence-uptime-plan') && d.includes('Uptime checker design') && d.includes('ChatGPT: uptime checker plan') && d.includes('Entered by you') && d.includes('Resource attached') && d.includes('Recorded automatically');
    return ok;
  });
  // 9
  await check(9, 'Completing the task updates every view', async () => {
    await page.click('#detail-complete'); await page.waitForTimeout(150);
    const st = await page.$eval('#f-status', s => s.value); const hasCompletedLog = (await page.textContent('.drawer')).includes('Task completed');
    await closeDrawer(page);
    const projText = await page.textContent('.main');
    const inCompletedSection = projText.split('Completed and cancelled')[1] || '';
    await nav(page, 'tasks'); await page.click('.tabs button:has-text("Completed")');
    const comp = await page.textContent('.list');
    await page.click('.tabs button:has-text("All open")'); const openList = await page.textContent('.main');
    const titles = await search(page, 'uptime'); const sr = await page.textContent('#search-results'); await clearSearch(page);
    return st === 'Completed' && hasCompletedLog && inCompletedSection.includes('Implement uptime checker') && comp.includes('Implement uptime checker') && !openList.includes('Implement uptime checker') && /Implement uptime checker[\s\S]*Completed/.test(sr);
  });
  // 10
  await check(10, 'Overdue task appears in Overdue section', async () => {
    await capture(page, { type: 'task', title: 'Renew domain for client', due: ld(-2), project: 'PresenceScope' });
    await nav(page, 'today'); const o = await page.textContent('#sec-overdue');
    return o.includes('Renew domain for client') && (await page.textContent('#nav-today')).match(/\d/) != null;
  });
  // 11
  await check(11, 'Unassigned note lands in Inbox, then gets assigned', async () => {
    await capture(page, { type: 'note', title: 'Pricing thought', content: 'Maybe a $9 starter tier.' });
    await nav(page, 'inbox'); const before = await page.textContent('.main'); if (!before.includes('Pricing thought')) return false;
    const card = page.locator('.card', { hasText: 'Pricing thought' });
    await card.locator('select').first().selectOption({ label: 'PresenceScope' }); await page.waitForTimeout(200);
    const after = await page.textContent('.main');
    await nav(page, 'projects'); await page.click('h3:text-is("PresenceScope")'); await page.click('.tabs button:has-text("Notes & resources")');
    return !after.includes('Pricing thought') && (await page.textContent('.main')).includes('Pricing thought');
  });
  // 12
  const LONG = Array.from({ length: 1200 }, (_, i) => `Paragraph ${i + 1}: the quick brown fox documents its n8n deployment notes in detail.`).join('\n\n');
  await check(12, 'Long document saved in full and reopened', async () => {
    await capture(page, { type: 'doc', title: 'Deployment handbook', content: LONG });
    await nav(page, 'notes'); await page.click('.row-title:text-is("Deployment handbook")'); await page.waitForSelector('.drawer');
    const v = await getEditor(page, '#f-body'); await closeDrawer(page);
    return v === LONG ? `${LONG.length.toLocaleString()} characters intact` : false;
  });
  // 13
  await check(13, 'Lead with website and follow-up task', async () => {
    await nav(page, 'leads'); await page.click('text=Add lead'); await page.fill('#lead-name', 'Riverside Dental'); await page.fill('#lead-url', 'https://riverside-dental.example'); await page.click('text=Create lead');
    await page.waitForSelector('.drawer'); await page.fill('#fu-date', ld(2)); await page.fill('#fu-time', '11:30'); await page.click('#fu-create'); await page.waitForTimeout(250);
    const d = await page.textContent('.drawer'); await closeDrawer(page);
    const tbl = await page.textContent('.tbl');
    await nav(page, 'tasks'); await page.click('.tabs button:has-text("Upcoming")'); const up = await page.textContent('.main');
    return d.includes('Follow up with Riverside Dental') && d.includes('Follow-up') && tbl.includes('riverside-dental.example') && up.includes('Follow up with Riverside Dental') && up.includes('⏰');
  });

  await check('F', 'Toolbar formatting (bold, size, color, highlight, to-do) survives reload', async () => {
    await nav(page, 'notes'); await page.locator('.row', { hasText: 'Webhook retry pattern' }).first().click(); await page.waitForSelector('#f-body .ed-content');
    await page.evaluate(() => { const e = document.querySelector('#f-body').__wos.editor; e.commands.focus(); e.commands.setTextSelection({ from: 1, to: 4 }); });
    await page.click('#f-body .tb[aria-label^="Bold"]');
    await page.selectOption('#f-body .tb-sel[aria-label="Font size"]', '22px');
    await page.click('#f-body .tb[aria-label="Text color"]'); await page.click('.wos-pop .sw[aria-label="Red"]');
    await page.click('#f-body .tb[aria-label="Highlight"]'); await page.click('.wos-pop .sw[aria-label="Yellow"]');
    await edEnd(page, '#f-body'); await page.keyboard.press('Enter'); await page.click('#f-body .tb[aria-label="To-do list"]'); await page.keyboard.type('Add retry node');
    await page.click('#f-body ul[data-type="taskList"] > li input[type=checkbox]');
    await page.waitForTimeout(1400); await closeDrawer(page);
    await reopenNote(page, 'Webhook retry pattern');
    const h = await page.$eval('#f-body .ed-content', e => e.innerHTML);
    const checks = { bold: /<strong/.test(h), size: /font-size: 22px/.test(h), color: /color: (rgb\(220, 38, 38\)|#dc2626)/.test(h), highlight: /<mark/.test(h), checked: /data-checked="true"/.test(h) };
    const bad = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k); await closeDrawer(page);
    return bad.length ? (console.log('missing', bad, h.slice(0, 500)), false) : true;
  });

  await check('P', 'Floating capture panel is non-blocking and keeps drafts', async () => {
    await nav(page, 'tasks');
    await page.click('#fab'); await page.waitForSelector('#cap-panel', { state: 'visible' });
    const backdrop = await page.$('.modal-wrap'); 
    await page.fill('#cap-title', 'Draft idea'); await setEditor(page, '#cap-content', 'Half-written thought');
    await page.click('#nav-projects'); const stillOpen = await page.isVisible('#cap-panel'); const onProjects = (await page.textContent('h1')) === 'Projects';
    await page.click('#fab'); const closed = await page.isHidden('#cap-panel');
    await page.click('#fab'); const kept = (await page.inputValue('#cap-title')) === 'Draft idea' && (await getEditor(page, '#cap-content')) === 'Half-written thought';
    const box = await page.$eval('#cap-panel', e => { const r = e.getBoundingClientRect(); return { right: innerWidth - r.right, bottom: innerHeight - r.bottom }; });
    await page.click('#cap-save'); await page.waitForSelector('#cap-panel', { state: 'hidden' });
    await nav(page, 'inbox'); const saved = (await page.textContent('.main')).includes('Draft idea');
    return !backdrop && stillOpen && onProjects && closed && kept && saved && box.right < 40 && box.bottom > 60 ? `panel ${Math.round(box.right)}px from right, ${Math.round(box.bottom)}px from bottom` : false;
  });
  await check('N', 'Notes and topics can have reminders that alert', async () => {
    const past = new Date(Date.now() - 60000); const v = `${ld(0)}T${pad(past.getHours())}:${pad(past.getMinutes())}`;
    await capture(page, { type: 'note', title: 'Check n8n release notes', remind: v });
    await page.waitForSelector('.alert-card:has-text("Check n8n release notes")'); const a = await page.textContent('.alert-card:has-text("Check n8n release notes")');
    await page.click('.alert-card:has-text("Check n8n release notes") button:has-text("Dismiss")');
    await nav(page, 'topics'); await page.click('.tnode .nm:text-is("n8n")'); await page.click('#topic-reminder'); await page.fill('#f-remind', ld(0) + `T${pad(past.getHours())}:${pad(past.getMinutes())}`); await page.waitForTimeout(300);
    await page.waitForSelector('.alert-card:has-text("n8n")'); const b = await page.textContent('.alert-card:has-text("Topic")');
    await page.click('.alert-card:has-text("Topic") button:has-text("Snooze 1h")'); await page.waitForTimeout(200);
    const topicPage = await page.textContent('.main');
    return a.includes('Note') && !a.includes('Complete') && b.includes('n8n') && /Reminder rescheduled|⏰/.test(topicPage);
  });

  await check('C', 'Context files: move description, open in popup, search, upload, cascade delete', async () => {
    await nav(page, 'tasks'); await page.locator('.row', { hasText: 'Build lead-scoring flow' }).first().click(); await page.waitForSelector('.drawer');
    const SPEC = 'Scoring spec. Leads get +10 for a company domain and +5 for opening the pricing page. Zapier fallback if webhook fails.';
    await setEditor(page, '#f-body', SPEC); await page.waitForTimeout(1300);
    await page.click('.drawer .ctx-move'); await page.waitForSelector('#file-body .ed-content');
    const fileText = await getEditor(page, '#file-body');
    await page.fill('#file-title', 'Lead scoring spec'); await page.press('#file-title', 'Enter'); await page.waitForTimeout(200);
    await page.click('.modal-hd button[aria-label="Close"]'); await page.waitForTimeout(500);
    const card = await page.textContent('.drawer .ctx-grid'); const desc = await getEditor(page, '#f-body');
    await page.click('.drawer .ctx-add'); await page.waitForSelector('#file-title'); await page.click('.modal-hd button[aria-label="Close"]'); await page.waitForTimeout(700);
    const nCards = await page.$$eval('.drawer .ctx-card', e => e.length);
    await page.setInputFiles('.drawer .ctx input[type=file]', { name: 'api-notes.md', mimeType: 'text/markdown', buffer: Buffer.from('# API notes\nRate limit is 60 requests per minute.') });
    await page.waitForFunction(() => document.querySelectorAll('.drawer .ctx-card').length === 2);
    await closeDrawer(page);
    const titles = await search(page, 'pricing page'); await page.locator('#search-results .row', { hasText: 'Lead scoring spec' }).first().click(); await page.waitForSelector('#file-body');
    const viaSearch = (await getEditor(page, '#file-body')) === SPEC; await page.click('.modal-hd button[aria-label="Close"]'); await clearSearch(page);
    const rowChip = await page.textContent('.main');
    await page.reload(); await page.waitForSelector('.hdr'); await page.waitForFunction(() => !document.body.innerText.includes('Loading your workspace'));
    await search(page, 'rate limit'); const afterReload = (await page.textContent('#search-results')).includes('api-notes'); await clearSearch(page);
    // cascade
    await capture(page, { type: 'note', title: 'Throwaway note' });
    await nav(page, 'inbox'); await page.click('button.row-title:text-is("Throwaway note")'); await page.waitForSelector('.drawer');
    await page.setInputFiles('.drawer .ctx input[type=file]', { name: 'temp.txt', mimeType: 'text/plain', buffer: Buffer.from('temporary context xyzzy') });
    await page.waitForSelector('.drawer .ctx-card');
    await page.click('.drawer-hd .btn.danger'); await page.click('#confirm-ok'); await page.waitForTimeout(400);
    await search(page, 'xyzzy'); const gone = !(await page.$('#search-results')); await clearSearch(page);
    const checks = { moved: fileText === SPEC, cardShown: card.includes('Lead scoring spec'), descCleared: desc === '', emptyDiscarded: nCards === 1, viaSearch, afterReload, gone };
    const bad = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
    return bad.length ? (console.log('ctx missing', bad), false) : 'moved, titled, popup editor, empty file discarded, .md upload, searchable after reload, deleted with owner';
  });


  // ===== block editor acceptance tests =====
  const ED = '#f-body';
  for (let i = 0; i < 3; i++) { const m = await page.$('.modal-hd button[aria-label="Close"]'); if (m) await m.click(); }
  await closeDrawer(page);
  await capture(page, { type: 'note', title: 'Editor test note', project: 'PresenceScope' });
  await nav(page, 'projects'); await page.click('h3:text-is("PresenceScope")'); await page.click('.tabs button:has-text("Notes & resources")');
  await page.locator('.row', { hasText: 'Editor test note' }).first().click(); await page.waitForSelector(ED + ' .ed-content');
  await check('E1', 'Typing / opens the block menu (not inside URLs)', async () => {
    await edEnd(page, ED); await page.keyboard.type('See https://example.com/a');
    const urlMenu = await page.$('.wos-slash'); await page.keyboard.press('Enter');
    await page.keyboard.type('/'); await page.waitForSelector('.wos-slash .wos-item'); const n = await page.$$eval('.wos-slash .wos-item', e => e.length);
    await page.keyboard.type('hea'); await page.waitForTimeout(80); const filtered = await page.$$eval('.wos-slash .wos-item b', e => e.map(x => x.textContent));
    for (let i = 0; i < 4; i++) await page.keyboard.press('Backspace');
    await page.waitForTimeout(80);
    return !urlMenu && n >= 19 && filtered.length && filtered.every(t => /heading/i.test(t)) ? `${n} blocks; “/hea” → ${filtered.join(', ')}` : false;
  });
  await check('E2', 'Heading 1 from the menu', async () => {
    await page.keyboard.type('/h1'); await page.waitForSelector('.wos-slash .wos-item'); await page.keyboard.press('Enter'); await page.keyboard.type('Implementation plan');
    return (await page.$$eval(ED + ' .ed-content h1', e => e.map(x => x.textContent))).includes('Implementation plan');
  });
  await check('E3', 'Bulleted and numbered lists; Enter on empty item exits', async () => {
    await page.keyboard.press('Enter'); await slash(page, 'bullet'); await page.keyboard.type('Alpha'); await page.keyboard.press('Enter'); await page.keyboard.type('Beta');
    await page.keyboard.press('Enter'); await page.keyboard.press('Tab'); await page.keyboard.type('Nested'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
    await slash(page, 'numbered'); await page.keyboard.type('One'); await page.keyboard.press('Enter'); await page.keyboard.type('Two'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
    const ul = await page.$$eval(ED + ' .ed-content > ul:not([data-type]) > li', e => e.length); const nested = await page.$$eval(ED + ' .ed-content ul ul li', e => e.length);
    const ol = await page.$$eval(ED + ' .ed-content ol > li', e => e.length);
    const lastIsP = await page.$eval(ED + ' .ed-content', e => e.lastElementChild.tagName === 'P');
    return ul === 2 && nested === 1 && ol === 2 && lastIsP;
  });
  await check('E4', 'Checklist: check an item, convert another to a real task, survives reload', async () => {
    await slash(page, 'todo'); await page.keyboard.type('Ship preview'); await page.keyboard.press('Enter'); await page.keyboard.type('Write claim-flow tests');
    await page.click(ED + ' ul[data-type="taskList"] > li:first-child input[type=checkbox]');
    await page.click(ED + ' ul[data-type="taskList"] > li:nth-child(2) p'); await page.click('.ed-ctx .tb:has-text("Convert to task")');
    await page.waitForSelector('#ct-title'); const tTitle = await page.inputValue('#ct-title'); const proj = await page.$eval('#ct-project', s => s.options[s.selectedIndex].text);
    await page.selectOption('#ct-priority', 'High'); await page.click('#ct-create'); await page.waitForSelector('#ct-title', { state: 'detached' }); await page.waitForTimeout(200);
    await page.click(ED + ' ul[data-type="taskList"] > li:nth-child(2) p'); const ctx = await page.textContent('.ed-ctx');
    await page.keyboard.press('End'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
    await page.waitForTimeout(1300);
    await reopenNote(page, 'Editor test note');
    const checked = await page.$$eval(ED + ' li[data-checked="true"]', e => e.length); const linked = await page.$$eval(ED + ' li[data-task-id]', e => e.length);
    await closeDrawer(page);
    await nav(page, 'tasks'); const tasksTxt = await page.textContent('.main'); const count = (tasksTxt.match(/Write claim-flow tests/g) || []).length;
    await page.locator('.row', { hasText: 'Write claim-flow tests' }).first().click(); await page.waitForSelector('.drawer'); const d = await page.textContent('.drawer'); await closeDrawer(page);
    const ok = tTitle === 'Write claim-flow tests' && proj === 'PresenceScope' && /Linked task: Write claim-flow tests/.test(ctx) && checked === 1 && linked === 1 && count === 1 && d.includes('Checklist item') && d.includes('Editor test note') && d.includes('Next');
    return ok ? 'task created once, linked both ways, ticked state kept' : (console.log({ tTitle, proj, ctx, checked, linked, count }), false);
  });
  await nav(page, 'notes'); await page.locator('.row', { hasText: 'Editor test note' }).first().click(); await page.waitForSelector(ED + ' .ed-content');
  await check('E5', 'Toggle with child content collapses and keeps content after reload', async () => {
    await edEnd(page, ED); await slash(page, 'toggle'); await page.keyboard.type('Lesson 1: triggers'); await page.keyboard.press('Enter'); await page.keyboard.type('Webhook trigger child text');
    await page.waitForTimeout(100);
    const open1 = await page.$eval(ED + ' [data-type="detailsContent"]', e => !e.hidden);
    await page.click(ED + ' [data-type="details"] > button'); await page.waitForTimeout(100);
    const hidden = await page.$eval(ED + ' [data-type="detailsContent"]', e => e.hidden || getComputedStyle(e).display === 'none');
    await page.waitForTimeout(1300);
    await reopenNote(page, 'Editor test note');
    const stillHidden = await page.$eval(ED + ' [data-type="detailsContent"]', e => e.hidden || getComputedStyle(e).display === 'none');
    const text = await getEditor(page, ED);
    await page.click(ED + ' [data-type="details"] > button'); await page.waitForTimeout(100);
    const shown = await page.$eval(ED + ' [data-type="detailsContent"]', e => !e.hidden && getComputedStyle(e).display !== 'none');
    return open1 && hidden && stillHidden && shown && text.includes('Webhook trigger child text') && text.includes('Lesson 1: triggers');
  });
  await check('E6', 'Table: edit cells, add row and column, survives reload', async () => {
    await edEnd(page, ED); await page.keyboard.press('Enter'); await slash(page, 'table');
    const cells = ['Task', 'Priority', 'Status', 'Verify preview API', 'High', 'In progress', 'Test claim flow', 'High', 'Next'];
    for (let i = 0; i < cells.length; i++) { await page.keyboard.type(cells[i]); if (i < cells.length - 1) await page.keyboard.press('Tab'); }
    await page.click('.ed-ctx .tb:has-text("+ Row below")'); await page.keyboard.type('Deploy');
    await page.click(ED + ' table tr:nth-child(2) td:last-child'); await page.click('.ed-ctx .tb:has-text("+ Col right")');
    await page.click(ED + ' table tr:first-child th:last-child'); await page.keyboard.type('Due date');
    await page.waitForTimeout(1300);
    await reopenNote(page, 'Editor test note');
    const t = await page.$$eval(ED + ' table tr', rows => rows.map(r => [...r.children].map(c => c.textContent)));
    return t.length === 4 && t[0].length === 4 && t[0][3] === 'Due date' && t[1][0] === 'Verify preview API' && t[3][0] === 'Deploy' ? JSON.stringify(t) : (console.log(t), false);
  });
  await check('E7', 'Code block keeps indentation and special characters, language + copy', async () => {
    await edEnd(page, ED); await page.keyboard.press('Enter'); await slash(page, 'code');
    await page.keyboard.type('function check(a) {'); await page.keyboard.press('Enter'); await page.keyboard.press('Tab'); await page.keyboard.type('return a < 3 && "<b>" !== \'x\';'); await page.keyboard.press('Enter'); await page.keyboard.type('}');
    await page.selectOption(ED + ' .code-lang', 'javascript'); await page.waitForTimeout(100);
    await page.click(ED + ' .code-copy'); await page.waitForTimeout(100);
    const copied = await page.evaluate(() => window.__wosLastCopy);
    const expected = 'function check(a) {\n  return a < 3 && "<b>" !== \'x\';\n}';
    const highlighted = await page.$$eval(ED + ' pre .hljs-keyword', e => e.length);
    const injected = await page.$$eval(ED + ' pre b', e => e.length);
    await page.waitForTimeout(1300);
    await reopenNote(page, 'Editor test note');
    const after = await page.$eval(ED + ' pre code', e => e.textContent); const lang = await page.$eval(ED + ' .code-lang', e => e.value);
    return copied === expected && after === expected && highlighted > 0 && injected === 0 && lang === 'javascript';
  });
  await check('E8', 'Page link to an existing topic opens it, follows renames, shows broken state', async () => {
    await edEnd(page, ED); await page.keyboard.press('Enter'); await page.keyboard.type('Related: '); await slash(page, 'page');
    await page.waitForSelector('.wos-picker .wos-in'); await page.keyboard.type('n8n'); await page.waitForTimeout(100);
    await page.locator('.wos-picker .wos-item', { hasText: 'n8n' }).first().click(); await page.waitForTimeout(100);
    await page.keyboard.type('and '); await slash(page, 'page'); await page.keyboard.type('Temp page'); await page.waitForTimeout(80); await page.locator('.wos-picker .wos-item', { hasText: 'Create note' }).click(); await page.waitForTimeout(300);
    const links = await page.$$eval(ED + ' .page-link', e => e.map(x => x.textContent));
    await page.waitForTimeout(1300);
    await page.locator(ED + ' .page-link', { hasText: 'n8n' }).click(); await page.waitForSelector('#topic-title');
    const opened = await page.inputValue('#topic-title');
    await page.fill('#topic-title', 'n8n automation'); await page.press('#topic-title', 'Enter'); await page.waitForTimeout(200);
    await nav(page, 'inbox'); await page.locator('button.row-title:text-is("Temp page")').click(); await page.click('.drawer-hd .btn.danger'); await page.click('#confirm-ok'); await page.waitForTimeout(300);
    await nav(page, 'notes'); await page.locator('.row', { hasText: 'Editor test note' }).first().click(); await page.waitForSelector(ED + ' .page-link');
    const after = await page.$$eval(ED + ' .page-link', e => e.map(x => [x.textContent, x.classList.contains('broken')]));
    await closeDrawer(page);
    await nav(page, 'topics'); await page.click('.tnode .nm:text-is("n8n automation")'); await page.fill('#topic-title', 'n8n'); await page.press('#topic-title', 'Enter'); await page.waitForTimeout(200);
    const ok = links.some(l => l.includes('n8n')) && opened === 'n8n' && after.some(([t, b]) => t.includes('n8n automation') && !b) && after.some(([t, b]) => b && /Missing page/.test(t));
    return ok ? JSON.stringify(after) : (console.log(links, opened, after), false);
  });
  await check('E9', 'Task description: heading, table, checklist and code', async () => {
    await nav(page, 'tasks'); await page.locator('.row', { hasText: 'Build lead-scoring flow' }).first().click(); await page.waitForSelector(ED + ' .ed-content');
    await edEnd(page, ED); await slash(page, 'h2'); await page.keyboard.type('Steps'); await page.keyboard.press('Enter');
    await slash(page, 'todo'); await page.keyboard.type('Map fields'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
    await slash(page, 'table'); await page.keyboard.type('Field'); await page.keyboard.press('Tab'); await page.keyboard.type('Score');
    await page.evaluate(() => document.querySelector('#f-body').__wos.editor.commands.focus('end'));
    await slash(page, 'code'); await page.keyboard.type('score += 10;');
    await page.waitForTimeout(1300); await closeDrawer(page);
    await page.reload(); await page.waitForSelector('.hdr'); await page.waitForFunction(() => !document.body.innerText.includes('Loading your workspace'));
    await nav(page, 'tasks'); await page.locator('.row', { hasText: 'Build lead-scoring flow' }).first().click(); await page.waitForSelector(ED + ' .ed-content');
    const r = await page.$eval(ED + ' .ed-content', e => ({ h2: !!e.querySelector('h2'), todo: !!e.querySelector('ul[data-type="taskList"] > li'), table: !!e.querySelector('table'), code: (e.querySelector('pre') || {}).textContent }));
    const proj = await page.$eval('#f-topic', s => s.options[s.selectedIndex].text); await closeDrawer(page);
    return r.h2 && r.todo && r.table && r.code === 'score += 10;' && /n8n/.test(proj);
  });
  await check('E10', 'Topic description uses the same editor', async () => {
    await nav(page, 'topics'); await page.click('.tnode .nm:text-is("n8n")'); await page.waitForSelector('#topic-desc-panel');
    await page.click('#topic-desc-edit'); await page.waitForSelector('#topic-desc .ed-toolbar', { state: 'visible' });
    await edEnd(page, '#topic-desc'); await slash(page, 'callout'); await page.keyboard.type('Self-hosted on Docker');
    await page.keyboard.press('Enter'); await slash(page, 'divider');
    await page.waitForTimeout(1300);
    await page.reload(); await page.waitForSelector('.hdr'); await page.waitForFunction(() => !document.body.innerText.includes('Loading your workspace'));
    await nav(page, 'topics'); await page.click('.tnode .nm:text-is("n8n")'); await page.waitForSelector('#topic-desc .ed-content');
    const r = await page.$eval('#topic-desc .ed-content', e => ({ callout: (e.querySelector('.callout') || {}).textContent || '', hr: !!e.querySelector('hr') }));
    return r.callout.includes('Self-hosted on Docker') && r.hr;
  });
  await check('E11', 'Search finds text inside a table cell and code', async () => {
    const t1 = await search(page, 'Verify preview API'); await clearSearch(page);
    const t2 = await search(page, 'score += 10'); await clearSearch(page);
    return t1.includes('Editor test note') && t2.includes('Build lead-scoring flow') ? `table cell → ${t1[0]}; code → ${t2[0]}` : (console.log(t1, t2), false);
  });
  await check('E-move', 'Blocks move up/down by keyboard and via the block menu', async () => {
    await capture(page, { type: 'note', title: 'Move test' });
    await nav(page, 'inbox'); await page.locator('button.row-title:text-is("Move test")').click(); await page.waitForSelector(ED + ' .ed-content');
    await page.click(ED + ' .ed-content'); await page.keyboard.type('First'); await page.keyboard.press('Enter'); await page.keyboard.type('Second'); await page.keyboard.press('Enter'); await page.keyboard.type('Third');
    await page.waitForTimeout(700); await page.keyboard.press('Alt+Shift+ArrowUp'); await page.keyboard.press('Alt+Shift+ArrowUp'); await page.waitForTimeout(700);
    const a = await page.$$eval(ED + ' .ed-content > p', e => e.map(x => x.textContent));
    const p = await page.$(ED + ' .ed-content > p:nth-child(2)'); const box = await p.boundingBox(); await page.mouse.move(box.x + 20, box.y + box.height / 2);
    await page.waitForSelector(ED + ' .blk-handle:not([hidden])'); await page.click(ED + ' .blk-handle'); await page.locator('.wos-pop .wos-item', { hasText: 'Move down' }).click();
    const b = await page.$$eval(ED + ' .ed-content > p', e => e.map(x => x.textContent));
    await page.keyboard.press('Control+z'); const c = await page.$$eval(ED + ' .ed-content > p', e => e.map(x => x.textContent));
    await page.waitForTimeout(1200); await closeDrawer(page);
    return a.join() === 'Third,First,Second' && b.join() === 'Third,Second,First' && c.join() === 'Third,First,Second' ? 'keyboard, menu and undo' : (console.log(a, b, c), false);
  });
  await check('E13', 'Records saved before the upgrade open intact and migrate only when edited', async () => {
    await page.evaluate(() => {
      const m = JSON.parse(localStorage.getItem('mockdb')); const at = new Date().toISOString(); const base = { tags: [], links: [], log: [{ at, kind: 'created', text: 'Note created' }], createdAt: at, updatedAt: at, priority: 'Normal', inbox: true };
      m['data/users/u_test/ws/records/legacy_q'] = { ...base, id: 'legacy_q', type: 'note', kind: 'note', title: 'Legacy quill note', body: 'Bold intro\nOld checked item\nOld open item', bodyDelta: { ops: [{ insert: 'Bold intro', attributes: { bold: true } }, { insert: '\n' }, { insert: 'Old checked item' }, { insert: '\n', attributes: { list: 'checked' } }, { insert: 'Old open item' }, { insert: '\n', attributes: { list: 'unchecked' } }] } };
      m['data/users/u_test/ws/records/legacy_p'] = { ...base, id: 'legacy_p', type: 'task', status: 'Next', title: 'Legacy plain task', body: 'Line one\nLine two' };
      localStorage.setItem('mockdb', JSON.stringify(m));
    });
    await page.reload(); await page.waitForSelector('.hdr'); await page.waitForFunction(() => !document.body.innerText.includes('Loading your workspace'));
    const found = await search(page, 'Old checked item'); await clearSearch(page);
    await nav(page, 'inbox'); await page.locator('button.row-title:text-is("Legacy quill note")').click(); await page.waitForSelector(ED + ' .ed-content');
    const h = await page.$eval(ED + ' .ed-content', e => e.innerHTML); await page.waitForTimeout(1200);
    const stored1 = await page.evaluate(() => JSON.parse(localStorage.getItem('mockdb'))['data/users/u_test/ws/records/legacy_q']);
    await edEnd(page, ED); await page.keyboard.type(' edited'); await page.waitForTimeout(1400); await closeDrawer(page);
    const stored2 = await page.evaluate(() => JSON.parse(localStorage.getItem('mockdb'))['data/users/u_test/ws/records/legacy_q']);
    await nav(page, 'tasks'); await page.locator('.row', { hasText: 'Legacy plain task' }).first().click(); await page.waitForSelector(ED + ' .ed-content');
    const t = await getEditor(page, ED); await closeDrawer(page);
    const checks = { searchable: found.includes('Legacy quill note'), bold: /<strong>Bold intro<\/strong>/.test(h), checked: /data-checked="true"/.test(h) && /Old open item/.test(h), untouched: !!stored1.bodyDelta && !stored1.bodyDoc, migrated: !!stored2.bodyDoc && stored2.bodyDelta === null && JSON.stringify(stored2.bodyDoc).includes('Old checked item'), plain: t === 'Line one\nLine two' };
    const bad = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
    return bad.length ? (console.log('legacy', bad, h.slice(0, 300)), false) : 'formatting and checklist state kept; stored copy unchanged until edited';
  });
  await check('E15', 'A failed save is visible, keeps the text, and Retry saves it', async () => {
    await nav(page, 'notes'); await page.locator('.row', { hasText: 'Editor test note' }).first().click(); await page.waitForSelector(ED + ' .ed-content');
    await page.evaluate(() => { window.__failWrites = true; });
    await edEnd(page, ED); await page.keyboard.press('Enter'); await page.keyboard.type('Written during an outage');
    await page.waitForSelector(ED + ' .ed-status.failed', { timeout: 8000 }); const st = await page.textContent(ED + ' .ed-status');
    const kept = (await getEditor(page, ED)).includes('Written during an outage');
    await page.evaluate(() => { window.__failWrites = false; });
    await page.click(ED + ' .ed-retry'); await page.waitForSelector(ED + ' .ed-status.saved', { timeout: 8000 });
    await reopenNote(page, 'Editor test note'); const after = (await getEditor(page, ED)).includes('Written during an outage'); await closeDrawer(page);
    return /Save failed/.test(st) && kept && after;
  });
  await check('E-img', 'Image upload inserts an image block', async () => {
    await nav(page, 'notes'); await page.locator('.row', { hasText: 'Editor test note' }).first().click(); await page.waitForSelector(ED + ' .ed-content');
    await edEnd(page, ED); await page.keyboard.press('Enter');
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), slash(page, 'image')]);
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    await chooser.setFiles({ name: 'dot.png', mimeType: 'image/png', buffer: png }); await page.waitForSelector(ED + ' .ed-content img');
    await page.waitForTimeout(1300); await closeDrawer(page); return true;
  });

  // reminder alert extra
  await check('R', 'Due reminder shows an in-app alert once', async () => {
    const past = new Date(Date.now() - 60000); const v = `${ld(0)}T${pad(past.getHours())}:${pad(past.getMinutes())}`;
    await capture(page, { type: 'task', title: 'Call accountant', remind: v });
    await page.waitForSelector('.alert-card'); const a = await page.textContent('.alert-card');
    const badge = await page.textContent('#bell');
    await page.click('.alert-card button:has-text("Dismiss")'); await page.waitForTimeout(150);
    return a.includes('Call accountant') && /1/.test(badge) && !(await page.$('.alert-card'));
  });

  // malformed import
  await check('I', 'Malformed import is rejected without changes', async () => {
    const before = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('mockdb'))).length);
    await page.click('#hdr-settings'); await page.fill('#import-text', '{"records": [ {broken'); await page.click('#import-check');
    const msg = await page.textContent('#import-result');
    await page.fill('#import-text', '{"records":[{"id":"x 1","type":"note"},{"id":"ok1","type":"weird"}]}'); await page.click('#import-check');
    const msg2 = await page.textContent('#import-result');
    // Stage 4B: a file without the Personal Work OS header is now rejected outright; the same bad records inside a
    // proper backup are still checked one by one and none is importable.
    await page.fill('#import-text', '{"app":"personal-work-os","schema":1,"records":[{"id":"x 1","type":"note"},{"id":"ok1","type":"weird"}]}'); await page.click('#import-check');
    const msg3 = await page.textContent('#import-result'); const mergeOff = await page.isDisabled('#import-merge');
    await page.click('.modal-hd button[aria-label="Close"]');
    const after = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('mockdb'))).length);
    return msg.includes('not valid JSON') && /not a Personal Work OS backup/.test(msg2) && /0 valid records/.test(msg3) && /2 invalid/.test(msg3) && mergeOff && before === after;
  });

  // 14
  let exported = null;
  await check(14, 'Export, import into a fresh workspace, relationships preserved', async () => {
    await page.click('#hdr-settings'); await page.click('#export-btn'); await page.waitForTimeout(200);
    const dl = await page.evaluate(() => window.__downloads[0]); await page.click('.modal-hd button[aria-label="Close"]');
    exported = JSON.parse(dl.data);
    const { ctx: c2, page: p2 } = await newPage(browser);
    await p2.click('#hdr-settings'); await p2.setInputFiles('#import-file', { name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(dl.data) }); await p2.waitForSelector('#import-result');
    const summary = await p2.textContent('#import-result');
    await p2.click('#import-merge'); await p2.waitForFunction(n => document.body.innerText.includes(`Imported ${n} records`), exported.records.length);
    console.log('step: imported'); await p2.click('.modal-hd button[aria-label="Close"]');
    await nav(p2, 'topics'); await p2.click('.tnode .nm:text-is("n8n")');
    const topicOk = (await p2.textContent('#topic-notes')).includes('Webhook retry pattern') && (await p2.textContent('#topic-tasks')).includes('Build lead-scoring flow') && (await p2.textContent('#topic-resources')).includes('Workflow tutorial video');
    console.log('step: topic ok', topicOk); const titles = await search(p2, 'uptime checker'); console.log('titles', titles); try { await p2.locator('#search-results .row', { hasText: 'Implement uptime checker' }).first().click({ timeout: 4000 }); } catch (e) { await p2.screenshot({ path: 'test/fail14.png' }); console.log(e.message.split('\n').slice(0,12).join('\n')); throw e; } await p2.waitForSelector('.drawer');
    const d = await p2.textContent('.drawer'); const proj = await p2.$eval('#f-project', s => s.options[s.selectedIndex].text);
    const relOk = proj === 'PresenceScope' && d.includes('Uptime checker design') && d.includes('ChatGPT: uptime checker plan') && d.includes('Task completed');
    await closeDrawer(p2); await nav(p2, 'notes'); await p2.locator('.row', { hasText: 'Editor test note' }).first().click(); await p2.waitForSelector('#f-body .ed-content');
    const edOk = await p2.$eval('#f-body .ed-content', e => !!e.querySelector('h1') && e.querySelectorAll('table tr').length === 4 && !!e.querySelector('[data-type="details"]') && !!e.querySelector('pre') && !!e.querySelector('li[data-task-id]') && !!e.querySelector('.page-link'));
    console.log('import editor content ok:', edOk); if (!edOk) return false;
    const n = await p2.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('mockdb'))).length);
    await c2.close();
    return topicOk && relOk && n === exported.records.length ? `${n} records; ${summary.trim().split('\n')[0]}` : false;
  });

  if (!exported) { await page.reload(); await page.waitForSelector('.hdr'); }
  // 15
  await check(15, 'Reload keeps data', async () => {
    await page.reload(); await page.waitForSelector('.hdr'); await page.waitForFunction(() => !document.body.innerText.includes('Loading your workspace'));
    const titles = await search(page, 'n8n'); await clearSearch(page);
    await nav(page, 'notes'); await page.click('.row-title:text-is("Deployment handbook")'); const v = await getEditor(page, '#f-body'); await closeDrawer(page);
    return titles.includes('Build lead-scoring flow') && v === LONG;
  });

  // sample data load/remove keeps user data
  await check('S', 'Sample data loads and removes without touching user records', async () => {
    const before = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('mockdb'))).length);
    await page.click('#hdr-settings'); await page.click('text=Load sample workspace'); await page.waitForSelector('#sample-banner'); await page.click('.modal-hd button[aria-label="Close"]');
    const mid = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('mockdb'))).length);
    await nav(page, 'today'); await page.screenshot({ path: path.join(ROOT, 'test/today-sample.png'), fullPage: false });
    await page.click('#sample-banner button'); await page.click('#confirm-ok'); await page.waitForSelector('#sample-banner', { state: 'detached' });
    const after = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('mockdb'))).length);
    return mid > before && after === before ? `${before} → ${mid} → ${after}` : false;
  });

  // screenshots for a visual look
  await nav(page, 'projects'); await page.click('h3:text-is("PresenceScope")'); await page.screenshot({ path: path.join(ROOT, 'test/project.png') });
  await page.click('.tabs button:has-text("Board")'); await page.screenshot({ path: path.join(ROOT, 'test/board.png') });
  await search(page, 'n8n'); await page.screenshot({ path: path.join(ROOT, 'test/search.png') }); await clearSearch(page);
  await nav(page, 'tasks'); await page.click('.row-title:text-is("Build lead-scoring flow")'); await page.screenshot({ path: path.join(ROOT, 'test/drawer.png') }); await closeDrawer(page);
  await page.emulateMedia({ colorScheme: 'dark' }); await nav(page, 'today'); await page.screenshot({ path: path.join(ROOT, 'test/today-dark.png') });
  await page.setViewportSize({ width: 390, height: 844 }); await page.emulateMedia({ colorScheme: 'light' }); await nav(page, 'leads').catch(() => {}); await page.screenshot({ path: path.join(ROOT, 'test/mobile.png') });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  console.log('mobile horizontal overflow:', overflow, 'page errors:', page.errors.length);
  fs.writeFileSync(path.join(ROOT, 'test/results.json'), JSON.stringify(results, null, 1));
  await browser.close();
})();
