let base = require('fs').readFileSync(__dirname + '/run.js', 'utf8').split('(async () => {')[0];
eval(base + `
const R = []; const ok = (n, c, info) => { R.push([c ? 'PASS' : 'FAIL', n, info || '']); console.log(c ? 'PASS' : 'FAIL', n, info || ''); };
async function boot(browser, opts = {}) {
  const DC = require(__dirname + '/dataset-clock.js'); const ds = DC.datasetJSON(); // dates relative to the run time
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1280, height: 900 }, colorScheme: opts.scheme || 'light', ...DC.contextOptions() }); await DC.prepareContext(ctx);
  await ctx.addInitScript(d => { if (!localStorage.getItem('mockdb')) localStorage.setItem('mockdb', d); }, ds);
  if (opts.blockTheme) await ctx.addInitScript(() => { const g = Storage.prototype.getItem, s = Storage.prototype.setItem, r = Storage.prototype.removeItem; Storage.prototype.getItem = function (k) { if (/theme/.test(k)) throw new Error('blocked'); return g.call(this, k); }; Storage.prototype.setItem = function (k, v) { if (/theme/.test(k)) throw new Error('blocked'); return s.call(this, k, v); }; Storage.prototype.removeItem = function (k) { if (/theme/.test(k)) throw new Error('blocked'); return r.call(this, k); }; });
  await ctx.addInitScript(MOCK);
  await ctx.route(/cdnjs\\.cloudflare\\.com|cdn\\.jsdelivr\\.net/, r => { const f = Object.keys(VENDOR).find(k => r.request().url().endsWith(k)); return f ? r.fulfill({ path: VENDOR[f], contentType: 'application/javascript' }) : r.abort(); });
  await ctx.route(/fonts\\.(googleapis|gstatic)\\.com/, r => r.abort());
  const page = await ctx.newPage(); page.errs = []; page.on('pageerror', e => page.errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) page.errs.push(m.text()); });
  await page.goto(FILE); await page.waitForSelector('.hdr'); await page.waitForFunction(() => !document.body.innerText.includes('Loading your workspace'));
  return { ctx, page };
}
const bodyBg = page => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const LIGHT = 'rgb(247, 247, 245)', DARK = 'rgb(11, 11, 14)';
const reload = async page => { await page.reload(); await page.waitForSelector('.hdr'); await page.waitForFunction(() => !document.body.innerText.includes('Loading your workspace')); };

// ---- Stage 4B helpers ----
const DC = require(__dirname + '/dataset-clock.js');
const INJECT = () => { const use = window.claude.use; window.claude.use = async n => {
  if (n === 'downloads' && window.__noDownloads) return null;
  if (n === 'downloads' && window.__declineDownload) return { save: async () => { throw { code: 'cancelled', message: 'declined' }; } };
  const x = await use(n); if (n !== 'db') return x;
  const fail = k => { if (window[k] == null) return false; window[k]--; if (window[k] >= 0) return false; const t = k + 'Times'; if (window[t] == null) return true; if (window[t] <= 0) return false; window[t]--; return true; }; // after N successes, fail (optionally only M times)
  const wrapCol = c => ({ ...c, onSnapshot: c.onSnapshot, doc: id => { const d = c.doc(id); return { ...d,
    set: async v => { if (fail('__failSetAfter')) throw { code: 'invalid_argument', message: 'injected write failure' }; return d.set(v); },
    delete: async () => { if (fail('__failDelAfter')) throw { code: 'invalid_argument', message: 'injected delete failure' }; return d.delete(); } }; } });
  return { doc: p => ({ collection: s => wrapCol(x.doc(p).collection(s)) }), collection: s => wrapCol(x.collection(s)) }; }; };
async function boot4(browser, opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1280, height: 900 }, ...DC.contextOptions() }); await DC.prepareContext(ctx);
  const ds = opts.empty ? '{}' : DC.datasetJSON();
  await ctx.addInitScript(d => { if (!localStorage.getItem('mockdb')) localStorage.setItem('mockdb', d); }, ds);
  await ctx.addInitScript(MOCK); await ctx.addInitScript(INJECT);
  await ctx.route(/cdnjs\\.cloudflare\\.com|cdn\\.jsdelivr\\.net/, r => { const f = Object.keys(VENDOR).find(k => r.request().url().endsWith(k)); return f ? r.fulfill({ path: VENDOR[f], contentType: 'application/javascript' }) : r.abort(); });
  await ctx.route(/fonts\\.(googleapis|gstatic)\\.com/, r => r.abort());
  const page = await ctx.newPage(); page.errs = []; page.on('pageerror', e => page.errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) page.errs.push(m.text()); });
  page.dialogs = []; page.on('dialog', d => { page.dialogs.push(d.type()); d.accept().catch(() => {}); });
  await page.goto(FILE); await page.waitForSelector('.hdr'); await page.waitForFunction(() => !document.body.innerText.includes('Loading your workspace'));
  return { ctx, page };
}
const DB = page => page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('mockdb'))));
const dbBy = async (page, f) => (await DB(page)).find(f);
const reload4 = async page => { await page.reload(); await page.waitForSelector('.hdr'); await page.waitForFunction(() => !document.body.innerText.includes('Loading your workspace')); };
const NOTE = 'n8n: credentials and environment variables', NOTE_ID = 'sample_n_creds';
const openNote = async page => { await nav(page, 'notes'); await page.click('#notes-list .row:has-text("n8n: credentials") .row-title'); await page.waitForSelector('.drawer #f-title'); };
// Tiptap applies focus('end') asynchronously: wait until the editor really has focus before typing
const focusEnd = async (page, sel) => { await page.evaluate(sel => document.querySelector(sel).__wos.editor.commands.focus('end'), sel); await page.waitForFunction(sel => document.activeElement && !!document.activeElement.closest(sel), sel); };
const toasts = page => page.$$eval('.toast', t => t.map(x => x.textContent));
const settingsImport = async (page, json) => { if (!(await page.$('#import-text'))) await page.click('#hdr-settings'); await page.fill('#import-text', json); await page.click('#import-check'); await page.waitForSelector('#import-result'); };
const exportNow = page => page.evaluate(() => JSON.parse(JSON.stringify(exportPayload())));
const sameRecords = (a, b) => { const m = new Map(a.map(r => [r.id, JSON.stringify(r)])); return a.length === b.length && b.every(r => m.get(r.id) === JSON.stringify(r)); };
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--headless=new'] });
  const noteId = async page => (await dbBy(page, r => r.title === NOTE)).id;
  // ================= Phase 1: drawer fields =================
  { const { ctx, page } = await boot4(browser); const id = await noteId(page);
    await openNote(page); await page.click('#f-title'); await page.keyboard.press('End'); await page.keyboard.type(' (renamed)');
    await page.keyboard.press('Escape'); await page.waitForSelector('.drawer', { state: 'detached' }); await page.waitForTimeout(300);
    await reload4(page); const r = await dbBy(page, x => x.id === id);
    ok('F1 Title typed then Escape: drawer closes and the new title is saved', r.title === NOTE + ' (renamed)', r.title);
    const renames = r.log.filter(e => /Renamed from/.test(e.text)).length;
    await openNote(page); const w0 = await page.evaluate(() => window.__writes || 0);
    await page.click('#f-title'); await page.keyboard.press('End'); await page.keyboard.type('!'); await page.keyboard.press('Enter'); await page.keyboard.press('Escape');
    await page.waitForSelector('.drawer', { state: 'detached' }); await page.waitForTimeout(400); const w1 = await page.evaluate(() => window.__writes || 0);
    const r2 = await dbBy(page, x => x.id === id);
    ok('F2 Enter then Escape commits the title exactly once', r2.title.endsWith('(renamed)!') && w1 - w0 === 1 && r2.log.filter(e => /Renamed from/.test(e.text)).length === renames + 1, 'writes ' + (w1 - w0));
    await openNote(page); await page.fill('.drawer input[placeholder="Add tag, Enter"]', 'escape-tag'); await page.keyboard.press('Escape');
    await page.waitForSelector('.drawer', { state: 'detached' }); await page.waitForTimeout(300); await reload4(page);
    ok('F3 Tag typed (no Enter) then Escape is saved', (await dbBy(page, x => x.id === id)).tags.includes('escape-tag'));
    // failure: drawer must stay open, text kept, error shown; then retry succeeds
    await openNote(page); await page.evaluate(() => { window.__failWrites = true; });
    await page.click('#f-title'); await page.keyboard.press('End'); await page.keyboard.type(' FAILCASE'); await page.keyboard.press('Escape');
    await page.waitForSelector('.drawer .field-err', { timeout: 10000 });
    const stillOpen = !!(await page.$('.drawer')); const kept = (await page.inputValue('#f-title')).endsWith(' FAILCASE'); const notStored = !(await dbBy(page, x => x.id === id)).title.includes('FAILCASE');
    const t = await toasts(page);
    await page.evaluate(() => { window.__failWrites = false; }); await page.click('#f-title'); await page.keyboard.press('Enter'); await page.waitForTimeout(400);
    const errGone = !(await page.$('.drawer .field-err')); await page.keyboard.press('Escape'); await page.waitForSelector('.drawer', { state: 'detached' }); await page.waitForTimeout(200);
    ok('F4 Title save fails on Escape: drawer stays, text kept, error shown; Enter retries and saves', stillOpen && kept && notStored && t.some(x => /Not closed/.test(x)) && errGone && (await dbBy(page, x => x.id === id)).title.endsWith(' FAILCASE'), t.join(' | ').slice(0, 160));
    await openNote(page); await page.evaluate(() => { window.__failWrites = true; });
    await page.fill('.drawer input[placeholder="Add tag, Enter"]', 'fail-tag'); await page.keyboard.press('Escape');
    await page.waitForSelector('.drawer .field-err', { timeout: 10000 });
    const tagKept = (await page.inputValue('.drawer input[placeholder="Add tag, Enter"]')) === 'fail-tag' && !!(await page.$('.drawer'));
    await page.evaluate(() => { window.__failWrites = false; }); await page.focus('.drawer input[placeholder="Add tag, Enter"]'); await page.keyboard.press('Enter'); await page.waitForTimeout(400);
    await page.keyboard.press('Escape'); await page.waitForSelector('.drawer', { state: 'detached' });
    ok('F5 Tag save fails on Escape: drawer stays with the tag text; retry saves it', tagKept && (await dbBy(page, x => x.id === id)).tags.includes('fail-tag'));
    await nav(page, 'tasks'); await page.click('.tabs button:has-text("All open")');
    const rows = page.locator('.main .task-row .row-title'); await rows.nth(0).click(); await page.waitForSelector('.drawer #f-title');
    const firstId = await page.getAttribute('.drawer', 'data-id');
    await page.click('#f-title'); await page.keyboard.press('End'); await page.keyboard.type(' SWITCH'); await rows.nth(1).click(); await page.waitForTimeout(400);
    ok('F6 Docked drawer: switching to another record saves the typed title', (await dbBy(page, x => x.id === firstId)).title.endsWith(' SWITCH'));
    ok('F7 No console errors (phase 1)', page.errs.length === 0, page.errs.slice(0, 2).join('; '));
    await ctx.close(); }
  // ================= Phase 2: rich text and page exit =================
  { const { ctx, page } = await boot4(browser); const id = await noteId(page);
    await reload4(page); ok('X1 Reload with nothing pending shows no leave warning', page.dialogs.length === 0);
    await openNote(page); await focusEnd(page, '#f-body'); await page.keyboard.type(' QUICKRELOAD');
    await page.waitForTimeout(150); const d0 = page.dialogs.length; await reload4(page);
    const kept = JSON.stringify((await dbBy(page, x => x.id === id)).bodyDoc).includes('QUICKRELOAD'); const warned = page.dialogs.length > d0;
    ok('X2 Typing then reloading at once: the text is saved, or the browser leave warning appears', kept || warned, \`saved=\${kept} warned=\${warned} dialogs=\${page.dialogs.join(',')}\`);
    console.log('INFO X2 saved', kept, 'warned', warned);
    await openNote(page); await focusEnd(page, '#f-body'); await page.keyboard.type(' NAVAWAY');
    await page.click('#nav-projects'); await page.waitForTimeout(500);
    ok('X3 Navigating away from the editor saves the text', JSON.stringify((await dbBy(page, x => x.id === id)).bodyDoc).includes('NAVAWAY') && (await page.textContent('h1')) === 'Projects');
    await openNote(page); await page.evaluate(() => { window.__failWrites = true; });
    await focusEnd(page, '#f-body'); await page.keyboard.type(' OUTAGE');
    await page.keyboard.press('Escape'); await page.waitForTimeout(2500);
    const open1 = !!(await page.$('.drawer')); const txt = open1 ? await getEditor(page, '#f-body') : ''; if (!open1) console.log('DIAG X4 drawer closed; toasts:', JSON.stringify(await toasts(page)), 'stored has OUTAGE:', JSON.stringify((await dbBy(page, x => x.id === id)).bodyDoc).includes('OUTAGE')); const failedUi = !!(await page.$('#f-body .ed-status.failed, #f-body [data-state="failed"], .drawer .banner.bad')) || /not saved|didn.t save|Retry/i.test(await page.textContent('.drawer'));
    await page.click('#nav-tasks'); await page.waitForTimeout(2500); const stayed = (await page.textContent('h1')) !== 'All Tasks' || !!(await page.$('.drawer'));
    await page.evaluate(() => { window.__failWrites = false; });
    if (await page.$('.drawer')) { await page.keyboard.press('Escape'); await page.waitForSelector('.drawer', { state: 'detached', timeout: 10000 }); } await page.waitForTimeout(300);
    const saved = JSON.stringify((await dbBy(page, x => x.id === id)).bodyDoc).includes('OUTAGE');
    ok('X4 Save failure: drawer stays open with the text and a failed state; leaving is refused; retry then closes and saves', open1 && txt.includes('OUTAGE') && failedUi && stayed && saved, JSON.stringify({ open1, failedUi, stayed, saved }));
    await page.evaluate(() => { window.__failWrites = true; }); await page.evaluate(async () => { const r = [...store.all().values()].find(x => x.type === 'project'); await updateRecord(r.id, { priority: r.priority === 'Low' ? 'High' : 'Low' }); });
    const t = await toasts(page); await page.evaluate(() => { window.__failWrites = false; });
    ok('M1 Failed-save message does not promise the change was undone', t.some(x => /Could not save this change/.test(x)) && !t.some(x => /undone/.test(x)), t.join(' | ').slice(0, 160));
    const pending = await page.evaluate(() => hasPendingEdits() || store.pending > 0);
    await reload4(page);
    ok('X5 No leave warning once everything is saved', !pending && page.errs.length === 0, page.errs.slice(0, 2).join('; '));
    await ctx.close(); }
  // ================= Phase 3: restore =================
  { const { ctx, page } = await boot4(browser);
    const backup = await exportNow(page); const P = 'sample_p_presence';
    // local edits after the backup was taken
    await page.evaluate(async () => { await new Promise(r => setTimeout(r, 20)); return updateRecord('sample_p_presence', { title: 'PresenceScope NEWER', body: 'newer local body', bodyDoc: WosEditor.textToDoc('newer local body') }); });
    await settingsImport(page, JSON.stringify(backup));
    const counts = await page.$$eval('#import-counts li', l => Object.fromEntries(l.map(x => [x.dataset.k, parseInt(x.textContent)])));
    const mergeLabel = await page.textContent('#import-merge');
    await page.click('#import-merge'); await page.waitForSelector('#import-report');
    const p1 = await dbBy(page, x => x.id === P);
    ok('I1 Older backup never overwrites a newer local title or body by default (probe F)', p1.title === 'PresenceScope NEWER' && JSON.stringify(p1.bodyDoc).includes('newer local body') && counts.older === 1 && counts.same === backup.records.length - 1 && counts.add === 0, JSON.stringify(counts) + ' ' + mergeLabel);
    const nb = JSON.parse(JSON.stringify(backup)); const bp = nb.records.find(r => r.id === P); bp.title = 'PresenceScope FROM BACKUP'; bp.updatedAt = new Date((await page.evaluate(() => Date.now())) + 3600e3).toISOString(); // page clock, not the test runner's
    const nu = nb.records.find(r => r.id === 'sample_p_webdev'); delete nu.updatedAt; nu.title = 'Web Dev NO DATE';
    nb.records.push({ ...nb.records.find(r => r.type === 'note'), id: 'imp_new_1', title: 'Brand new from backup' });
    await settingsImport(page, JSON.stringify(nb));
    const c2 = await page.$$eval('#import-counts li', l => Object.fromEntries(l.map(x => [x.dataset.k, parseInt(x.textContent)])));
    await page.click('#import-merge'); await page.waitForSelector('#import-report');
    ok('I2 Newer backup copy replaces; undated copy is not assumed newer; new record added', (await dbBy(page, x => x.id === P)).title === 'PresenceScope FROM BACKUP' && (await dbBy(page, x => x.id === 'sample_p_webdev')).title !== 'Web Dev NO DATE' && !!(await dbBy(page, x => x.id === 'imp_new_1')) && c2.newer === 1 && c2.unknown === 1 && c2.add === 1, JSON.stringify(c2));
    await settingsImport(page, JSON.stringify(nb)); await page.check('#import-allow-older'); await page.click('#import-merge'); await page.waitForSelector('#import-report');
    ok('I3 Overwriting newer local records needs the explicit option', (await dbBy(page, x => x.id === 'sample_p_webdev')).title === 'Web Dev NO DATE');
    const n0 = (await DB(page)).length; const msgs = [];
    for (const bad of [JSON.stringify({ ...backup, app: 'other-app' }), JSON.stringify({ ...backup, schema: 2 }), JSON.stringify({ records: backup.records }), JSON.stringify(backup.records), JSON.stringify({ app: 'personal-work-os', schema: 1 })]) {
      await settingsImport(page, bad); msgs.push(await page.textContent('#import-result')); }
    ok('I4 Wrong app, unsupported schema, missing header, bare list and missing records are rejected before any write', msgs.every(m => /Nothing was changed/.test(m)) && !(await page.$('#import-merge')) && (await DB(page)).length === n0, msgs.map(m => m.slice(0, 50)).join(' | '));
    const cb = { app: 'personal-work-os', schema: 1, records: [{ id: 'imp_fix_1', type: 'task', title: 'Fix me', status: 'Bogus', priority: 'Mega', tags: 'nope', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }, { id: 'bad id!', type: 'note' }] };
    await settingsImport(page, JSON.stringify(cb)); const prev = await page.textContent('#import-result');
    const corr = await page.$eval('#import-corrections', e => e.textContent);
    ok('I5 Corrected values and invalid items are listed in the preview', /status "Bogus" → "Next"/.test(corr) && /priority "Mega" → "Normal"/.test(corr) && /tags list cleaned/.test(corr) && /1 invalid/.test(prev) && /1 with values that will be corrected/.test(prev), corr.slice(0, 120));
    await page.click('.modal-hd button[aria-label="Close"]'); await ctx.close(); }
  // Replace: success
  { const { ctx, page } = await boot4(browser);
    const before = await exportNow(page); const target = JSON.parse(JSON.stringify(before));
    const dropped = target.records.filter(r => r.type === 'resource').map(r => r.id); target.records = target.records.filter(r => r.type !== 'resource');
    target.records.push({ ...target.records.find(r => r.type === 'note'), id: 'rep_new_1', title: 'Only in backup' });
    await settingsImport(page, JSON.stringify(target)); await page.click('#import-replace'); await page.click('#confirm-ok'); await page.waitForSelector('#import-report', { timeout: 20000 });
    const ids = new Set((await DB(page)).map(r => r.id)); const dl = await page.evaluate(() => window.__downloads.map(d => d.filename));
    ok('R1 Replace succeeds: safety copy saved first, backup written, then extra records removed', target.records.every(r => ids.has(r.id)) && dropped.every(id => !ids.has(id)) && ids.size === target.records.length && dl.some(f => /before-replace/.test(f)), \`\${ids.size} records; downloads \${dl.join(',')}\`);
    await ctx.close(); }
  // Replace: write failure part-way
  { const { ctx, page } = await boot4(browser);
    const before = await exportNow(page); const target = JSON.parse(JSON.stringify(before)); const pageNow = await page.evaluate(() => Date.now());
    target.records = target.records.filter(r => r.type !== 'resource').map(r => ({ ...r, title: r.title + ' [B]', updatedAt: new Date(pageNow + 1e6).toISOString() }));
    await settingsImport(page, JSON.stringify(target)); await page.evaluate(() => { window.__failSetAfter = 6; window.__failSetAfterTimes = 3; }); // a short outage
    await page.click('#import-replace'); await page.click('#confirm-ok'); await page.waitForSelector('#import-report', { timeout: 30000 });
    await page.evaluate(() => { window.__failSetAfter = null; });
    const rep = await page.textContent('#import-report'); const after = await DB(page);
    const allThere = before.records.every(r => after.some(x => x.id === r.id)); const restored = before.records.every(r => { const x = after.find(y => y.id === r.id); return x && x.title === r.title; });
    ok('R2 Write fails part-way: nothing deleted, every record still present and put back as it was, failure reported', allThere && restored && after.length === before.records.length && /could not be written/.test(rep), rep.slice(0, 160));
    await ctx.close(); }
  // Replace: write failure that also breaks the undo
  { const { ctx, page } = await boot4(browser);
    const before = await exportNow(page); const target = JSON.parse(JSON.stringify(before)); target.records = target.records.map(r => ({ ...r, title: r.title + ' [B]' }));
    await settingsImport(page, JSON.stringify(target)); await page.evaluate(() => { window.__failSetAfter = 5; });
    await page.click('#import-replace'); await page.click('#confirm-ok'); await page.waitForSelector('#import-report', { timeout: 30000 });
    await page.evaluate(() => { window.__failSetAfter = null; });
    const rep = await page.textContent('#import-report'); const after = await DB(page);
    ok('R3 Write and undo both fail: no record is missing, and the report points to the safety copy', before.records.every(r => after.some(x => x.id === r.id)) && /safety copy/.test(rep) && (await page.evaluate(() => window.__downloads.length)) >= 1, rep.slice(0, 160));
    await ctx.close(); }
  // Replace: delete failure part-way
  { const { ctx, page } = await boot4(browser);
    const before = await exportNow(page); const target = JSON.parse(JSON.stringify(before)); target.records = target.records.filter(r => r.type !== 'task');
    const extra = before.records.filter(r => r.type === 'task').map(r => r.id);
    await settingsImport(page, JSON.stringify(target)); await page.evaluate(() => { window.__failDelAfter = 2; });
    await page.click('#import-replace'); await page.click('#confirm-ok'); await page.waitForSelector('#import-report', { timeout: 30000 });
    await page.evaluate(() => { window.__failDelAfter = null; });
    const rep = await page.textContent('#import-report'); const ids = new Set((await DB(page)).map(r => r.id));
    const removed = extra.filter(id => !ids.has(id)).length;
    ok('R4 Delete fails part-way: every backup record is present, leftover records stay, nothing is missing, report says so', target.records.every(r => ids.has(r.id)) && removed >= 1 && removed < extra.length && /could not be removed/.test(rep) && /nothing is missing/.test(rep), \`removed \${removed}/\${extra.length}; \${rep.slice(0, 120)}\`);
    await ctx.close(); }
  // Replace: safety copy declined, or downloads unavailable
  { const { ctx, page } = await boot4(browser);
    const before = await exportNow(page); const target = { ...before, records: before.records.slice(0, 3) };
    await page.evaluate(() => { window.__declineDownload = true; });
    await settingsImport(page, JSON.stringify(target)); await page.click('#import-replace'); await page.click('#confirm-ok'); await page.waitForSelector('#import-report');
    const rep = await page.textContent('#import-report'); const after = await exportNow(page);
    ok('R5 Safety copy declined: Replace stops before writing or deleting anything', /Nothing was written or deleted/.test(rep) && sameRecords(before.records, after.records));
    await page.click('.modal-hd button[aria-label="Close"]'); await page.evaluate(() => { window.__declineDownload = false; window.__noDownloads = true; });
    await settingsImport(page, JSON.stringify(target));
    ok('R6 Without downloads, Replace is disabled with an explanation; Merge stays available', await page.isDisabled('#import-replace') && /Replace is off here/.test(await page.textContent('#replace-disabled')) && !(await page.isDisabled('#import-merge')));
    ok('R7 No console errors (restore)', page.errs.length === 0, page.errs.slice(0, 2).join('; '));
    await ctx.close(); }
  // ================= Phase 4: reminder alert vs capture panel =================
  for (const vp of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    const { ctx, page } = await boot4(browser, { viewport: vp });
    await page.evaluate(async () => { await createRecord({ type: 'task', title: 'Due reminder probe', status: 'Next', remindAt: new Date(Date.now() - 60000).toISOString() }); });
    await page.waitForSelector('.alert-card', { timeout: 40000 });
    await page.click('#hdr-capture'); await page.waitForSelector('#cap-panel', { state: 'visible' });
    await page.click('#cap-more', { timeout: 5000 }); const more = (await page.getAttribute('#cap-more', 'aria-expanded')) === 'true';
    const overlap = await page.evaluate(() => { const a = document.querySelector('.toasts').getBoundingClientRect(), c = document.querySelector('#cap-panel').getBoundingClientRect(); return !(a.bottom <= c.top || a.top >= c.bottom || a.right <= c.left || a.left >= c.right); });
    await page.fill('#cap-title', 'Captured with alert visible'); await page.click('#cap-save', { timeout: 5000 }); await page.waitForSelector('#cap-panel', { state: 'hidden' });
    const saved = !!(await dbBy(page, r => r.title === 'Captured with alert visible'));
    await page.click('#hdr-capture'); await page.waitForSelector('#cap-panel', { state: 'visible' });
    await page.click('.alert-card button:has-text("Dismiss")', { timeout: 5000 }); await page.waitForTimeout(200);
    const dismissed = !(await page.$('.alert-card')); const capStill = await page.isVisible('#cap-panel');
    await page.keyboard.press('Escape'); const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    ok(\`A\${vp.width} Due reminder and capture panel at \${vp.width}px: all capture controls clickable, no overlap, reminder dismissable\`, more && !overlap && saved && dismissed && capStill && !overflow && page.errs.length === 0, JSON.stringify({ more, overlap, saved, dismissed, capStill, overflow }));
    await ctx.close(); }
  console.log('TOTAL', R.filter(r => r[0] === 'PASS').length, 'pass,', R.filter(r => r[0] === 'FAIL').length, 'fail');
  await browser.close();
})();`);
