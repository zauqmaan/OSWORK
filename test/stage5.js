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
// ---- Stage 5 helpers ----
const DC = require(__dirname + '/dataset-clock.js');
const INJECT = () => { const use = window.claude.use; window.claude.use = async n => {
  const x = await use(n); if (n !== 'db') return x;
  const fail = k => { if (window[k] == null) return false; window[k]--; return window[k] < 0; };
  const wrapCol = c => ({ ...c, onSnapshot: c.onSnapshot, doc: id => { const d = c.doc(id); return { ...d,
    set: async v => { if (fail('__failSetAfter')) throw { code: 'invalid_argument', message: 'injected write failure' }; return d.set(v); } }; } });
  return { doc: p => ({ collection: s => wrapCol(x.doc(p).collection(s)) }), collection: s => wrapCol(x.collection(s)) }; }; };
// clipboard stand-in: records exactly what the app copies; __clipFail makes it refuse (and execCommand fall back fails too)
const CLIP = () => { window.__clip = []; const w = t => { if (window.__clipFail) return Promise.reject(new Error('NotAllowedError')); window.__clip.push(t); return Promise.resolve(); };
  try { Object.defineProperty(navigator, 'clipboard', { value: { writeText: w, readText: async () => window.__clip[window.__clip.length - 1] || '' }, configurable: true }); } catch (e) { }
  const ex = document.execCommand.bind(document); document.execCommand = (c, ...a) => c === 'copy' ? (window.__clipFail ? false : (window.__clip.push((document.activeElement && document.activeElement.value) || ''), true)) : ex(c, ...a); };
async function boot5(browser, opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1280, height: 900 }, ...DC.contextOptions() }); await DC.prepareContext(ctx);
  const ds = opts.empty ? '{}' : DC.datasetJSON();
  await ctx.addInitScript(d => { if (!localStorage.getItem('mockdb')) localStorage.setItem('mockdb', d); }, ds);
  await ctx.addInitScript(MOCK); await ctx.addInitScript(INJECT); await ctx.addInitScript(CLIP);
  await ctx.route(/cdnjs\\.cloudflare\\.com|cdn\\.jsdelivr\\.net/, r => { const f = Object.keys(VENDOR).find(k => r.request().url().endsWith(k)); return f ? r.fulfill({ path: VENDOR[f], contentType: 'application/javascript' }) : r.abort(); });
  await ctx.route(/fonts\\.(googleapis|gstatic)\\.com/, r => r.abort());
  const page = await ctx.newPage(); page.errs = []; page.on('pageerror', e => page.errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) page.errs.push(m.text()); });
  page.on('dialog', d => d.accept().catch(() => {}));
  await page.goto(FILE); await page.waitForSelector('.hdr'); await page.waitForFunction(() => !document.body.innerText.includes('Loading your workspace'));
  return { ctx, page };
}
const DB = page => page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('mockdb'))));
const dbBy = async (page, f) => (await DB(page)).find(f);
// The stand-in storage lives in localStorage, which headless Chromium occasionally loses across a reload (seen in 1 of 12
// probe runs, together with unrelated marker keys). Re-seed it with exactly what was stored, like a durable server store.
const reload5 = async page => { const snap = await page.evaluate(() => localStorage.getItem('mockdb')); await page.addInitScript(x => { if (x) localStorage.setItem('mockdb', x); }, snap); await page.reload(); await page.waitForSelector('.hdr'); await page.waitForFunction(() => !document.body.innerText.includes('Loading your workspace')); };
const studio = async (page, tab) => { await page.click('#nav-studio'); await page.waitForSelector('#studio-tabs'); if (tab) { await page.click('#studio-tab-' + tab); await page.waitForTimeout(80); } };
const clip = page => page.evaluate(() => window.__clip[window.__clip.length - 1]);
const mk = (page, rec) => page.evaluate(async r => { const x = await createRecord(r); return x && x.id; }, rec);
const overflow = page => page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
const LONG_BODY = ['You are auditing a codebase.', '', 'Steps:', '1. Read \`src/core.js\` and list every exported function.', '2. For each function:', '   - describe inputs', '   - describe outputs', '', '\`\`\`js', 'function example(a, b) {', '  return a + b; // keep indentation', '}', '\`\`\`', '', 'Tabs\\there and unicode: café — “quotes” ✓'].join('\\n') + '\\n\\n' + Array.from({ length: 400 }, (_, i) => \`Detail line \${i + 1}: \${'x'.repeat(40)}\`).join('\\n');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--headless=new'] });
  // ================= Prompt Library =================
  { const { ctx, page } = await boot5(browser); const before = await DB(page);
    await studio(page, 'library'); ok('L0 Empty library explains what to do', /No saved prompts yet/.test(await page.textContent('#studio')));
    await page.click('#pl-new'); await page.fill('#np-title', 'Audit the codebase'); await page.fill('#np-summary', 'First pass over the repo'); await page.fill('#np-body', LONG_BODY);
    await page.selectOption('#np-category', 'Audit'); await page.fill('#np-tags', 'audit, s5'); await page.selectOption('#np-status', 'Ready');
    await page.click('#np-save'); await page.waitForSelector('#np-title', { state: 'detached' }); await page.waitForTimeout(200);
    const p = await dbBy(page, r => r.type === 'prompt' && r.title === 'Audit the codebase');
    ok('L1 Prompt saved without a project or sequence; full body stored exactly', !!p && p.body === LONG_BODY && !p.projectId && p.status === 'Ready' && p.category === 'Audit' && p.tags.join() === 'audit,s5' && !p.inbox, p && p.body.length + ' chars');
    const card = page.locator('.ps-card[data-id="' + p.id + '"]');
    const cardText = await card.textContent();
    ok('L2 Card shows title, purpose excerpt, status, tags and actions, not the whole body', /Audit the codebase/.test(cardText) && /First pass over the repo/.test(cardText) && /Ready/.test(cardText) && /#audit/.test(cardText) && !cardText.includes('Detail line 300') && (await card.locator('.ps-copy').count()) === 1);
    await card.locator('.ps-copy').click(); await page.waitForTimeout(150);
    const copied = await clip(page); const p2 = await dbBy(page, r => r.id === p.id); const t1 = await page.$$eval('.toast', t => t.map(x => x.textContent).join(' | '));
    ok('L3 Copy Prompt copies the complete body (line breaks, list, code, unicode, long text) and changes nothing', copied === LONG_BODY && JSON.stringify(p2) === JSON.stringify(p) && /copied/.test(t1), \`\${(copied || '').length} of \${LONG_BODY.length} chars\`);
    await page.evaluate(() => { window.__clipFail = true; }); await card.locator('.ps-copy').click(); await page.waitForSelector('#copy-fallback');
    const fb = await page.inputValue('#copy-fallback'); const fbSel = await page.evaluate(() => { const t = document.getElementById('copy-fallback'); return t.selectionStart === 0 && t.selectionEnd === t.value.length; });
    await page.click('.modal-ft button:has-text("Done")'); await page.evaluate(() => { window.__clipFail = false; });
    ok('L4 Clipboard blocked: full text shown selected for manual copy; prompt unchanged', fb === LONG_BODY && fbSel && JSON.stringify(await dbBy(page, r => r.id === p.id)) === JSON.stringify(p));
    // open details, edit body and summary
    await card.locator('.ps-title').click(); await page.waitForSelector('#prompt-body');
    await page.click('#prompt-copy'); const c2 = await clip(page);
    await page.click('#prompt-body'); await page.keyboard.press('Control+End'); await page.keyboard.type('\\nFINAL CHECK: run tests.'); await page.waitForTimeout(1300);
    const p3 = await dbBy(page, r => r.id === p.id);
    ok('L5 Details: Copy Prompt works there; editing the body autosaves and keeps existing text', c2 === LONG_BODY && p3.body === LONG_BODY + '\\nFINAL CHECK: run tests.' && /Saved/.test(await page.textContent('.drawer')));
    await page.evaluate(() => { window.__failSetAfter = 0; });
    await page.click('#prompt-body'); await page.keyboard.press('Control+End'); await page.keyboard.type(' OUTAGE-EDIT'); await page.waitForSelector('.drawer .autosave-err', { timeout: 15000 });
    const kept = (await page.inputValue('#prompt-body')).endsWith(' OUTAGE-EDIT'); const stored = (await dbBy(page, r => r.id === p.id)).body.includes('OUTAGE-EDIT');
    await page.keyboard.press('Escape'); await page.waitForTimeout(400); const stayed = !!(await page.$('.drawer'));
    await page.evaluate(() => { window.__failSetAfter = null; }); await page.click('.drawer .autosave-err button:has-text("Retry")'); await page.waitForTimeout(800);
    const retried = (await dbBy(page, r => r.id === p.id)).body.endsWith(' OUTAGE-EDIT');
    ok('L6 Failed save keeps the text, shows Retry, blocks closing; Retry saves', kept && !stored && stayed && retried, JSON.stringify({ kept, stored, stayed, retried }));
    await page.keyboard.press('Escape'); await page.waitForSelector('.drawer', { state: 'detached' });
    await mk(page, { type: 'prompt', title: 'Write the completion report', summary: 'Summarise what changed', body: 'Report on zebrafish-integration results.', status: 'Draft', category: 'Report', tags: ['report'] });
    await page.fill('#pl-q', 'zebrafish'); await page.waitForTimeout(100); const s1 = await page.$$eval('#pl-grid .ps-card h3', h => h.map(x => x.textContent));
    await page.fill('#pl-q', '#s5'); await page.waitForTimeout(100); const s2 = await page.$$eval('#pl-grid .ps-card h3', h => h.map(x => x.textContent));
    await page.fill('#pl-q', ''); await page.selectOption('#pl-status', 'Draft'); const s3 = await page.$$eval('#pl-grid .ps-card h3', h => h.map(x => x.textContent));
    await page.click('#pl-reset'); await page.selectOption('#pl-sort', 'title'); const s4 = await page.$$eval('#pl-grid .ps-card h3', h => h.map(x => x.textContent));
    ok('L7 Search by body text and #tag, filter by status, reset, sort by title', s1.join() === 'Write the completion report' && s2.join() === 'Audit the codebase' && s3.join() === 'Write the completion report' && s4.join() === 'Audit the codebase,Write the completion report');
    await page.locator('.ps-card', { hasText: 'Write the completion report' }).locator('button:has-text("Archive")').click(); await page.waitForTimeout(250);
    const inLib = await page.locator('#pl-grid .ps-card', { hasText: 'Write the completion report' }).count();
    await page.click('#studio-tab-archived'); const inArch = (await page.textContent('#studio-archived')).includes('Write the completion report');
    await page.locator('#studio-archived .row', { hasText: 'Write the completion report' }).locator('button:has-text("Restore")').click(); await page.waitForTimeout(250);
    ok('L8 Archive hides the prompt from the library and lists it under Archived; Restore brings it back', inLib === 0 && inArch && !(await dbBy(page, r => r.title === 'Write the completion report')).archived);
    const after = await DB(page); const old = before.map(r => JSON.stringify(r)).sort().join('\\n'); const oldAfter = after.filter(r => before.some(b => b.id === r.id)).map(r => JSON.stringify(r)).sort().join('\\n');
    ok('L9 Existing records untouched by prompt work', old === oldAfter, \`\${before.length} existing records\`);
    ok('L10 No console errors (library)', page.errs.length === 0, page.errs.slice(0, 2).join('; '));
    await ctx.close(); }
  // ================= Sequences =================
  { const { ctx, page } = await boot5(browser);
    const titles = ['Audit the existing project', 'Produce the implementation plan', 'Implement the approved changes', 'Run tests and fix failures', 'Review the final implementation', 'Produce the completion report'];
    const pids = []; for (const [i, t] of titles.entries()) pids.push(await mk(page, { type: 'prompt', title: t, summary: 'Purpose ' + (i + 1), body: \`PROMPT \${i + 1}: \${t}\\nline two of prompt \${i + 1}\`, status: 'Ready', projectId: 'sample_p_presence' }));
    await studio(page, 'sequences'); await page.click('#sq-new'); await page.fill('#ns-title', 'Implement a new feature'); await page.fill('#ns-summary', 'Ship the claim flow'); await page.selectOption('#ns-project', { label: 'PresenceScope' });
    await page.click('#ns-save'); await page.waitForSelector('#seq-page');
    const seqId = await page.getAttribute('#seq-page', 'data-id');
    await page.click('#seq-add-existing'); for (const t of titles) await page.locator('.ap-row', { hasText: t }).locator('input').check(); await page.click('#ap-add'); await page.waitForSelector('#seq-steps');
    const shown = await page.$$eval('#seq-steps .ps-step-title', e => e.map(x => x.textContent));
    ok('S1 Sequence with six ordered prompts shown as a numbered timeline', JSON.stringify(shown) === JSON.stringify(titles) && /0 of 6 steps · 0%/.test(await page.textContent('#seq-progress')) && /Step 1 — Audit the existing project/.test(await page.textContent('#seq-next')));
    await page.click('#seq-steps > li:nth-child(3) button[aria-label="Move step 3 up"]'); await page.waitForTimeout(250);
    await reload5(page); await page.click('#nav-studio'); await studio(page, 'sequences'); await page.click('.ps-seq[data-id="' + seqId + '"]'); await page.waitForSelector('#seq-steps');
    const order = await page.$$eval('#seq-steps .ps-step-title', e => e.map(x => x.textContent));
    ok('S2 Reordering persists after reload', order[1] === titles[2] && order[2] === titles[1] && order.length === 6, order.slice(0, 3).join(' | '));
    await page.click('#seq-copy-next'); const cnext = await clip(page);
    const statusAfterCopy = (await dbBy(page, r => r.id === seqId)).steps[0].status;
    ok('S3 Copy next prompt copies step 1 exactly; copying is not completion', cnext === \`PROMPT 1: \${titles[0]}\\nline two of prompt 1\` && statusAfterCopy === 'Not started');
    await page.click('#seq-steps > li:nth-child(1) .ps-complete'); await page.waitForTimeout(300);
    const s1 = (await dbBy(page, r => r.id === seqId)).steps[0];
    ok('S4 Mark complete: check mark, progress 1 of 6 (17%), next moves to step 2, completion time stored', s1.status === 'Completed' && !!s1.completedAt && (await page.getAttribute('#seq-steps > li:nth-child(1)', 'data-status')) === 'Completed' && /1 of 6 steps · 17%/.test(await page.textContent('#seq-progress')) && /Step 2 — /.test(await page.textContent('#seq-next')));
    // completion must never appear before storage confirms it
    await page.evaluate(() => { window.__failSetAfter = 0; });
    await page.click('#seq-steps > li:nth-child(2) .ps-complete'); const midStatus = await page.getAttribute('#seq-steps > li:nth-child(2)', 'data-status');
    await page.waitForTimeout(1500); const endStatus = await page.getAttribute('#seq-steps > li:nth-child(2)', 'data-status'); await page.evaluate(() => { window.__failSetAfter = null; });
    const s2st = (await dbBy(page, r => r.id === seqId)).steps[1].status; const t2 = await page.$$eval('.toast', t => t.map(x => x.textContent).join(' | '));
    ok('S5 A failed completion is never shown as completed and is reported', midStatus !== 'Completed' && endStatus !== 'Completed' && s2st !== 'Completed' && /Could not save/.test(t2), \`\${midStatus} → \${endStatus}\`);
    // out of order
    await page.click('#seq-steps > li:nth-child(4) .ps-complete'); await page.waitForTimeout(300);
    const warn = await page.textContent('#seq-steps > li:nth-child(4)');
    ok('S6 Steps can be completed out of order; unfinished earlier steps are flagged; next stays at step 2', (await page.getAttribute('#seq-steps > li:nth-child(4)', 'data-status')) === 'Completed' && /Earlier steps 2, 3 not finished/.test(warn) && /Step 2 — /.test(await page.textContent('#seq-next')));
    await page.click('#seq-steps > li:nth-child(1) button:has-text("Reopen")'); await page.waitForSelector('#confirm-ok'); await page.click('#confirm-ok'); await page.waitForTimeout(300);
    const r1 = (await dbBy(page, r => r.id === seqId)).steps[0];
    ok('S7 Reopen asks first, then clears completion and keeps the step', r1.status === 'In progress' && r1.completedAt === null && /Step 1 — /.test(await page.textContent('#seq-next')));
    // result note on a step
    await page.click('#seq-steps > li:nth-child(4) summary'); await page.fill('#seq-steps > li:nth-child(4) textarea[aria-label="Result of step 4"]', 'All 42 tests green'); await page.click('#seq-title'); await page.waitForTimeout(400);
    ok('S8 Step result note saves to that step only', (await dbBy(page, r => r.id === seqId)).steps[3].result === 'All 42 tests green');
    // second sequence sharing a prompt; editing the prompt must not touch either sequence's steps
    const seq2 = await mk(page, { type: 'sequence', title: 'Small fix', status: 'Active', steps: [{ id: 'st_b1', promptId: pids[0], status: 'Not started' }, { id: 'st_b2', promptId: pids[3], status: 'Completed', completedAt: new Date().toISOString() }] });
    const aBefore = JSON.stringify((await dbBy(page, r => r.id === seqId)).steps); const bBefore = JSON.stringify((await dbBy(page, r => r.id === seq2)).steps);
    await page.click('#seq-steps > li:nth-child(1) .ps-step-title'); await page.waitForSelector('#prompt-body'); const used = await page.textContent('.drawer');
    await page.click('#prompt-body'); await page.keyboard.press('Control+End'); await page.keyboard.type(' EDITED'); await page.waitForTimeout(1300); await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    const aAfter = JSON.stringify((await dbBy(page, r => r.id === seqId)).steps); const bAfter = JSON.stringify((await dbBy(page, r => r.id === seq2)).steps);
    ok('S9 Editing a shared prompt changes neither sequence\\'s steps or progress; the drawer lists both uses', aBefore === aAfter && bBefore === bAfter && (await dbBy(page, r => r.id === pids[0])).body.endsWith(' EDITED') && /Implement a new feature/.test(used) && /Small fix/.test(used));
    // duplicate
    await page.click('#seq-dup'); await page.fill('#dup-name', 'Feature B'); await page.click('#dup-go'); await page.waitForFunction(id => document.querySelector('#seq-page') && document.querySelector('#seq-page').dataset.id !== id, seqId);
    const dupId = await page.getAttribute('#seq-page', 'data-id'); const orig = await dbBy(page, r => r.id === seqId); const dup = await dbBy(page, r => r.id === dupId);
    const freshIds = dup.steps.every(s => !orig.steps.some(o => o.id === s.id)); const samePrompts = JSON.stringify(dup.steps.map(s => s.promptId)) === JSON.stringify(orig.steps.map(s => s.promptId));
    await page.click('#seq-steps > li:nth-child(1) .ps-complete'); await page.waitForTimeout(300);
    const origAfter = await dbBy(page, r => r.id === seqId);
    ok('S10 Duplicate: new sequence and step ids, same prompts, fresh progress; completing in the copy leaves the original alone', freshIds && samePrompts && dup.steps.every(s => s.status === 'Not started' && !s.completedAt && !s.result) && JSON.stringify(origAfter.steps) === JSON.stringify(orig.steps));
    await page.click('#seq-dup'); await page.check('#dup-copy-prompts'); await page.click('#dup-go'); await page.waitForFunction(id => document.querySelector('#seq-page').dataset.id !== id, dupId);
    const dup2 = await dbBy(page, r => r.id === (/* current */ null) || false); const dup2Id = await page.getAttribute('#seq-page', 'data-id'); const d2 = await dbBy(page, r => r.id === dup2Id);
    ok('S11 Duplicate with "copy prompts" points to new prompt copies', d2.steps.every(s => !pids.includes(s.promptId)) && (await DB(page)).filter(r => r.type === 'prompt' && / \\(copy\\)$/.test(r.title)).length === 6);
    // missing prompt
    const seq3 = await mk(page, { type: 'sequence', title: 'Has a missing prompt', status: 'Active', steps: [{ id: 'st_m1', promptId: 'prompt_gone_123', status: 'Not started' }, { id: 'st_m2', promptId: pids[1], status: 'Not started' }] });
    await page.evaluate(id => window.__nav && 0, seq3); await studio(page, 'sequences'); await page.click('.ps-seq[data-id="' + seq3 + '"]'); await page.waitForSelector('#seq-steps');
    const miss = await page.textContent('#seq-steps > li:nth-child(1)'); await page.click('#seq-steps > li:nth-child(1) button:has-text("Choose a prompt")'); await page.selectOption('#relink-sel', pids[4]); await page.click('.modal-ft button:has-text("Use this prompt")'); await page.waitForTimeout(300);
    ok('S12 A missing linked prompt shows a clear placeholder (no crash) and can be relinked', /Prompt missing/.test(miss) && (await dbBy(page, r => r.id === seq3)).steps[0].promptId === pids[4] && page.errs.length === 0, page.errs.slice(0, 2).join('; '));
    await page.click('#seq-archive'); await page.waitForTimeout(250); await studio(page, 'sequences'); const listed = await page.locator('.ps-seq[data-id="' + seq3 + '"]').count();
    ok('S13 Archive sequence removes it from the list', listed === 0 && (await dbBy(page, r => r.id === seq3)).archived === true);
    // overview counts derived from data
    await studio(page, 'overview'); const stats = await page.$$eval('#ov-stats b', b => Object.fromEntries(b.map(x => [x.dataset.k, Number(x.textContent)])));
    const exp = await page.evaluate(() => { const recs = Object.values(JSON.parse(localStorage.getItem('mockdb'))); const act = recs.filter(r => r.type === 'sequence' && !r.archived && (r.status || 'Active') === 'Active'); const st = act.flatMap(r => r.steps || []); return { active: act.length, ready: st.filter(s => s.status === 'Ready').length, doing: st.filter(s => s.status === 'In progress').length, done: st.filter(s => s.status === 'Completed').length, prompts: recs.filter(r => r.type === 'prompt' && !r.archived).length }; });
    ok('O1 Overview numbers match stored data; Continue shows a next prompt', JSON.stringify(stats) === JSON.stringify(exp) && /Step \\d+ — /.test(await page.textContent('#ov-continue')), JSON.stringify(stats));
    await page.click('#ov-copy-next'); ok('O2 Overview "Copy next prompt" copies a full prompt', /^PROMPT \\d: [\\s\\S]*line two/.test(await clip(page) || ''));
    // project integration
    await page.click('#nav-projects'); await page.click('h3:text-is("PresenceScope")'); await page.click('.tabs button:has-text("Prompts & plans")'); await page.waitForSelector('#project-studio');
    const pj = await page.textContent('#project-studio');
    ok('P1 Project tab shows its sequences with progress, the next action and its prompts', /Implement a new feature/.test(pj) && /Feature B/.test(pj) && /Current next action/.test(pj) && /Audit the existing project/.test(pj) && (await page.locator('#pj-prompts .row').count()) >= 6);
    await page.click('#pj-seqs .ps-seq >> nth=0'); ok('P2 Opening a sequence from the project goes to its page', !!(await page.waitForSelector('#seq-page')));
    ok('S14 No console errors (sequences)', page.errs.length === 0, page.errs.slice(0, 2).join('; '));
    await ctx.close(); }
  // ================= Action steps (no prompt) =================
  { const { ctx, page } = await boot5(browser);
    const pid = await mk(page, { type: 'prompt', title: 'Ask Claude to audit the repo', summary: 'Audit', body: 'Audit this repository.\\nList risks.', status: 'Ready' });
    const sid = await mk(page, { type: 'sequence', title: 'New client onboarding', status: 'Active', projectId: 'sample_p_presence', steps: [{ id: 'st_p1', promptId: pid, status: 'Not started' }] });
    const before = JSON.stringify((await dbBy(page, r => r.id === sid)).steps);
    await studio(page, 'sequences'); await page.click('.ps-seq[data-id="' + sid + '"]'); await page.waitForSelector('#seq-steps');
    await page.click('#seq-add-action'); await page.fill('#as-title', 'Set up the project');
    await page.fill('#as-items', '- Go to ~/projects/acme\\n* git clone https://github.com/me/acme.git\\n1. Open Claude Code in the terminal\\n\\n');
    await page.selectOption('#as-pos', { index: 0 }); await page.selectOption('#as-pos', 'st_p1'); // after step 1
    await page.click('#as-save'); await page.waitForSelector('#as-title', { state: 'detached' }); await page.waitForTimeout(250);
    let seq = await dbBy(page, r => r.id === sid);
    ok('A1 Action step saved with a title and cleaned bullets, at the chosen position', seq.steps.length === 2 && seq.steps[1].kind === 'action' && seq.steps[1].title === 'Set up the project' && JSON.stringify(seq.steps[1].items.map(x => x.text)) === JSON.stringify(['Go to ~/projects/acme', 'git clone https://github.com/me/acme.git', 'Open Claude Code in the terminal']) && seq.steps[1].items.every(x => x.done === false) && !seq.steps[1].promptId);
    ok('A2 Existing prompt steps are not rewritten (no new fields)', JSON.stringify([seq.steps[0]]) === before);
    // move the action step to the front so it is the next step
    await page.click('#seq-steps > li:nth-child(2) button[aria-label="Move step 2 up"]'); await page.waitForTimeout(250);
    const li = page.locator('#seq-steps > li:nth-child(1)');
    ok('A3 Action step shows as a card: title, "Action" tag, bullet list, no Copy prompt button', (await li.getAttribute('data-kind')) === 'action' && /Set up the project/.test(await li.textContent()) && /Action/.test(await li.locator('.kind-tag').textContent()) && (await li.locator('.ps-items li').count()) === 3 && (await li.locator('.ps-copy').count()) === 0 && (await page.locator('#seq-steps > li:nth-child(2) .ps-copy').count()) === 1);
    const nextTxt = await page.textContent('#seq-next');
    ok('A4 The Next card shows the action step with its bullets and a Mark complete button (no prompt copy)', /Next · action/.test(nextTxt) && /Step 1 — Set up the project/.test(nextTxt) && /git clone https:\\/\\/github.com\\/me\\/acme.git/.test(nextTxt) && !(await page.$('#seq-copy-next')) && !!(await page.$('#seq-complete-next')));
    await page.locator('#seq-next .ps-items li').nth(1).locator('.ps-item-copy').click(); const c1 = await clip(page);
    await page.locator('#seq-next .ps-items li').nth(0).locator('input[type=checkbox]').check(); await page.waitForTimeout(300);
    seq = await dbBy(page, r => r.id === sid);
    const tickedInList = await page.locator('#seq-steps > li:nth-child(1) .ps-items li').nth(0).locator('input').isChecked();
    await page.locator('#seq-steps > li:nth-child(1) .linklike:has-text("Copy list")').click(); const c2 = await clip(page);
    ok('A5 Copy one bullet exactly; tick a bullet (saved, shown in both places); Copy list gives the bullets', c1 === 'git clone https://github.com/me/acme.git' && seq.steps[0].items[0].done === true && tickedInList && c2 === '- Go to ~/projects/acme\\n- git clone https://github.com/me/acme.git\\n- Open Claude Code in the terminal' && seq.steps[0].status === 'Not started');
    await page.click('#seq-steps > li:nth-child(1) .ps-edit-step'); await page.fill('#as-title', 'Set up the client project');
    await page.fill('#as-items', 'Go to ~/projects/acme\\ngit clone https://github.com/me/acme.git\\nnpm install\\nOpen Claude Code in the terminal'); await page.click('#as-save'); await page.waitForTimeout(300);
    seq = await dbBy(page, r => r.id === sid); const it = seq.steps[0].items;
    ok('A6 Edit step: new title and bullets; the tick on the unchanged line is kept', seq.steps[0].title === 'Set up the client project' && it.length === 4 && it[0].done === true && it[2].text === 'npm install' && it[2].done === false);
    await page.click('#seq-complete-next'); await page.waitForTimeout(300);
    seq = await dbBy(page, r => r.id === sid); const n2 = await page.textContent('#seq-next');
    ok('A7 "Mark step complete" in the Next card completes the action step; Next moves to the prompt step with Copy next prompt', seq.steps[0].status === 'Completed' && !!seq.steps[0].completedAt && /Next · prompt/.test(n2) && /Ask Claude to audit the repo/.test(n2) && !!(await page.$('#seq-copy-next')) && /1 of 2 steps · 50%/.test(await page.textContent('#seq-progress')));
    await page.click('#seq-add-action'); await page.fill('#as-title', 'Message the client on WhatsApp'); await page.fill('#as-items', 'Send the kickoff summary\\nAsk for logo files'); await page.click('#as-save'); await page.waitForTimeout(300);
    await page.click('#seq-steps > li:nth-child(2) .ps-complete'); await page.waitForTimeout(300);
    const n3 = await page.textContent('#seq-next');
    ok('A8 A later action step becomes Next with its bullets once the prompt step is done', /Step 3 — Message the client on WhatsApp/.test(n3) && /Ask for logo files/.test(n3));
    await reload5(page); await studio(page, 'overview'); const ov = await page.textContent('#ov-continue');
    ok('A9 After reload the Overview "Continue" card shows the action step and its bullets', /Message the client on WhatsApp/.test(ov) && /Send the kickoff summary/.test(ov) && !(await page.$('#ov-copy-next')));
    await page.click('#nav-projects'); await page.click('h3:text-is("PresenceScope")'); await page.click('.tabs button:has-text("Prompts & plans")'); await page.waitForSelector('#project-studio');
    ok('A10 Project tab "Current next action" shows the action step and its bullets', /Message the client on WhatsApp/.test(await page.textContent('#pj-next')) && /Ask for logo files/.test(await page.textContent('#pj-next')));
    await page.fill('#global-search', 'kickoff summary'); await page.waitForTimeout(150); const hits = await page.$$eval('#search-results .row-title', r => r.map(x => x.textContent)); await page.fill('#global-search', '');
    ok('A11 Search finds a sequence by the text of an action bullet', hits.includes('New client onboarding'));
    await page.click('#nav-studio'); await studio(page, 'sequences'); await page.click('.ps-seq[data-id="' + sid + '"]'); await page.waitForSelector('#seq-page');
    await page.click('#seq-dup'); await page.click('#dup-go'); await page.waitForFunction(id => document.querySelector('#seq-page') && document.querySelector('#seq-page').dataset.id !== id, sid);
    const dupId = await page.getAttribute('#seq-page', 'data-id'); const d = await dbBy(page, r => r.id === dupId); const o = await dbBy(page, r => r.id === sid);
    ok('A12 Duplicate copies action steps with fresh ticks and new ids; the original keeps its ticks', d.steps.filter(x => x.kind === 'action').length === 2 && d.steps.every(x => x.status === 'Not started') && d.steps.filter(x => x.kind === 'action').every(x => x.items.every(i => !i.done && !o.steps.some(os => (os.items || []).some(oi => oi.id === i.id)))) && o.steps[0].items[0].done === true);
    const exp = await page.evaluate(() => JSON.stringify(exportPayload()));
    const { ctx: cx2, page: p2 } = await boot5(browser, { empty: true });
    await p2.click('#hdr-settings'); await p2.fill('#import-text', exp); await p2.click('#import-check'); await p2.waitForSelector('#import-result');
    const counts = await p2.$$eval('#import-counts li', l => Object.fromEntries(l.map(x => [x.dataset.k, parseInt(x.textContent)])));
    await p2.click('#import-merge'); await p2.waitForSelector('#import-report', { timeout: 20000 });
    const back = await dbBy(p2, r => r.id === sid);
    ok('A13 Export then import keeps action steps exactly (titles, bullets, ticks, order)', JSON.stringify(back.steps) === JSON.stringify(o.steps) && counts.corrected === 0, JSON.stringify(counts));
    await cx2.close();
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(200);
    if (await page.$('#seq-page')) { await page.goto(FILE); await page.waitForSelector('.hdr'); }
    await page.click('.menu-btn'); await page.waitForTimeout(120); await studio(page, 'sequences'); await page.click('.ps-seq[data-id="' + sid + '"]'); await page.waitForSelector('#seq-steps');
    ok('A14 Action-step cards fit at 390px with no sideways scrolling; no console errors', !(await overflow(page)) && page.errs.length === 0, page.errs.slice(0, 2).join('; '));
    await ctx.close(); }
  // ================= Plans & Reports =================
  { const { ctx, page } = await boot5(browser);
    await studio(page, 'docs'); const existingDocs = await page.$$eval('#pr-grid .ps-doc', c => c.length);
    await page.click('#pr-new'); await page.fill('#nd-title', 'PresenceScope master plan v1'); await page.selectOption('#nd-category', 'Project Master Plan'); await page.selectOption('#nd-project', { label: 'PresenceScope' }); await page.fill('#nd-summary', 'Scope, milestones and risks');
    await page.click('#nd-save'); await page.waitForSelector('.drawer #f-body .ed-content');
    const docId = await page.getAttribute('.drawer', 'data-id');
    const DOC = { type: 'doc', content: [{ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Milestones' }] }, { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Alpha by May' }] }] }, { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Beta by June' }] }] }] }, { type: 'codeBlock', attrs: { language: 'bash' }, content: [{ type: 'text', text: 'npm test\\nnpm run build' }] }, ...Array.from({ length: 150 }, (_, i) => ({ type: 'paragraph', content: [{ type: 'text', text: \`Section \${i + 1} quasar-\${i} detail text for the long report.\` }] }))] };
    await page.evaluate(d => { const e = document.querySelector('#f-body').__wos.editor; e.commands.setContent(d, { emitUpdate: true }); }, DOC); await page.waitForTimeout(1500);
    await page.keyboard.press('Escape'); await page.waitForTimeout(300); await reload5(page); await studio(page, 'docs');
    const d1 = await dbBy(page, r => r.id === docId); if (!d1) console.log('DIAG D1 docId', docId, JSON.stringify((await DB(page)).filter(r => r.kind === 'doc').map(r => [r.id, r.title, r.category])));
    ok('D1 Long report saved with category, project and summary; headings, lists and code blocks kept after reload', d1.category === 'Project Master Plan' && d1.projectId === 'sample_p_presence' && d1.summary === 'Scope, milestones and risks' && JSON.stringify(d1.bodyDoc).includes('"heading"') && JSON.stringify(d1.bodyDoc).includes('"bulletList"') && JSON.stringify(d1.bodyDoc).includes('npm test\\\\nnpm run build') && JSON.stringify(d1.bodyDoc).includes('quasar-149'));
    ok('D2 Grid lists the new report and every existing document', (await page.$$eval('#pr-grid .ps-doc', c => c.length)) === existingDocs + 1);
    await page.fill('#pr-q', 'quasar-77'); await page.waitForTimeout(150); const hit = await page.$$eval('#pr-grid .ps-doc h3', h => h.map(x => x.textContent));
    await page.fill('#pr-q', ''); await page.selectOption('#pr-category', 'Project Master Plan'); const cat = await page.$$eval('#pr-grid .ps-doc h3', h => h.map(x => x.textContent)); await page.click('#pr-reset');
    ok('D3 Search finds text deep inside the report; category filter works', hit.join() === 'PresenceScope master plan v1' && cat.join() === 'PresenceScope master plan v1');
    await page.locator('.ps-doc[data-id="' + docId + '"]').locator('button:has-text("Copy content")').click(); const md = await clip(page);
    ok('D4 Copy content keeps structure as Markdown', /^# Milestones/.test(md) && /\\n- Alpha by May\\n- Beta by June/.test(md) && /\`\`\`bash\\nnpm test\\nnpm run build\\n\`\`\`/.test(md) && /quasar-149/.test(md), (md || '').slice(0, 80).replace(/\\n/g, '⏎'));
    // link to sequence via card
    const sq = await mk(page, { type: 'sequence', title: 'Launch checklist', status: 'Active', projectId: 'sample_p_presence', steps: [] });
    await page.locator('.ps-doc[data-id="' + docId + '"] button:has-text("Link")').click(); await page.selectOption('.pop-panel select[aria-label="Sequence"]', sq); await page.keyboard.press('Escape'); await page.waitForTimeout(250);
    ok('D5 Link a report to a sequence from its card', (await dbBy(page, r => r.id === docId)).sequenceId === sq);
    // master plan: v1 then v2 → v1 kept, mark moves after confirmation
    await page.locator('.ps-doc[data-id="' + docId + '"] .ps-title').click(); await page.waitForSelector('#doc-master'); await page.click('#doc-master'); await page.waitForTimeout(300); await page.keyboard.press('Escape');
    const v2 = await mk(page, { type: 'note', kind: 'doc', title: 'PresenceScope master plan v2', category: 'Project Master Plan', projectId: 'sample_p_presence' });
    await page.locator('.ps-doc[data-id="' + v2 + '"] .ps-title').click(); await page.waitForSelector('#doc-master'); await page.click('#doc-master'); await page.waitForSelector('#confirm-ok'); await page.click('#confirm-ok'); await page.waitForTimeout(400); await page.keyboard.press('Escape');
    const v1r = await dbBy(page, r => r.id === docId), v2r = await dbBy(page, r => r.id === v2);
    ok('D6 A newer master plan takes the "current" mark after confirmation; the older plan is kept intact', v2r.masterPlan === true && v1r.masterPlan === false && JSON.stringify(v1r.bodyDoc).includes('quasar-149') && !v1r.archived);
    await page.click('#nav-projects'); await page.click('h3:text-is("PresenceScope")'); await page.click('.tabs button:has-text("Prompts & plans")'); const pj = await page.textContent('#project-studio');
    ok('D7 Project tab shows the current master plan and its other reports', /Current master plan[\\s\\S]*master plan v2/.test(pj) && /master plan v1/.test(pj));
    await studio(page, 'docs'); await page.locator('.ps-doc[data-id="' + v2 + '"] button:has-text("Archive")').click(); await page.waitForTimeout(250);
    ok('D8 Archive a report', (await page.locator('.ps-doc[data-id="' + v2 + '"]').count()) === 0 && (await dbBy(page, r => r.id === v2)).archived);
    // global search
    await page.fill('#global-search', 'quasar-77'); await page.waitForTimeout(150); const g1 = await page.$$eval('#search-results .row-title', r => r.map(x => x.textContent));
    await page.fill('#global-search', 'launch checklist'); await page.waitForTimeout(150); const groups = await page.$$eval('#search-results .sgroup', g => g.map(x => x.dataset.group));
    await page.click('#search-results .sgroup[data-group="sequence"] .row-title'); await page.waitForTimeout(200); const onSeq = !!(await page.$('#seq-page'));
    ok('C1 Universal search finds report content and sequences; opening a sequence result goes to its page', g1.includes('PresenceScope master plan v1') && groups.includes('sequence') && onSeq);
    ok('D9 No console errors (plans & reports)', page.errs.length === 0, page.errs.slice(0, 2).join('; '));
    // export + import into a fresh workspace
    const exp = await page.evaluate(() => JSON.stringify(exportPayload()));
    const { ctx: c2, page: p2 } = await boot5(browser, { empty: true });
    await p2.click('#hdr-settings'); await p2.fill('#import-text', exp); await p2.click('#import-check'); await p2.waitForSelector('#import-result');
    const counts = await p2.$$eval('#import-counts li', l => Object.fromEntries(l.map(x => [x.dataset.k, parseInt(x.textContent)])));
    await p2.click('#import-merge'); await p2.waitForSelector('#import-report', { timeout: 20000 });
    const a = JSON.parse(exp).records; const b = await DB(p2); const strip = r => { const { log, ...x } = r; return JSON.stringify(x, Object.keys(x).sort()); };
    const bm = new Map(b.map(r => [r.id, r]));
    const same = a.every(r => bm.has(r.id) && strip({ ...r, body: r.bodyDoc ? '' : r.body }) === strip({ ...bm.get(r.id), body: bm.get(r.id).bodyDoc ? '' : bm.get(r.id).body }));
    ok('E1 Export then import into a fresh workspace keeps every record: ids, step order and status, documents, categories, master marks, links', same && a.length === b.length && counts.add === a.length && counts.corrected === 0, JSON.stringify(counts));
    await c2.close(); await ctx.close(); }
  // ================= Empty workspace, older backups, layouts =================
  { const { ctx, page } = await boot5(browser, { empty: true });
    await studio(page); const t = await page.textContent('#studio-overview');
    ok('X1 Empty Prompt Studio offers "Create your first sequence" and "Save a prompt"', /Create your first sequence/.test(t) && /Save a prompt/.test(t));
    const old = require('fs').readFileSync(__dirname + '/export-before.json', 'utf8');
    await page.click('#hdr-settings'); await page.fill('#import-text', old); await page.click('#import-check'); await page.waitForSelector('#import-result');
    const counts = await page.$$eval('#import-counts li', l => Object.fromEntries(l.map(x => [x.dataset.k, parseInt(x.textContent)])));
    await page.click('#import-merge'); await page.waitForSelector('#import-report', { timeout: 20000 });
    const oldRecs = JSON.parse(old).records; const now = await DB(page);
    const unchanged = oldRecs.every(r => { const x = now.find(y => y.id === r.id); if (!x) return false; const { log: l1, ...a } = r; const { log: l2, ...b } = x; return JSON.stringify({ ...a, body: a.bodyDoc ? '' : a.body }, Object.keys(a).sort()) === JSON.stringify({ ...b, body: b.bodyDoc ? '' : b.body }, Object.keys(a).sort()) && Object.keys(b).every(k => k in a); });
    ok('X2 An older (Stage 1) backup imports with no corrections and no new fields on its records', counts.corrected === 0 && counts.invalid === 0 && unchanged, JSON.stringify(counts));
    await page.click('.modal-hd button[aria-label="Close"]');
    // an older-format document (no category, summary or master-plan fields) shows as "Other" and is not rewritten by viewing it
    const olderDoc = { id: 'old_doc_1', type: 'note', kind: 'doc', title: 'Old architecture notes', body: 'Written before Prompt Studio', tags: [], links: [], log: [], createdAt: '2026-09-01T10:00:00.000Z', updatedAt: '2026-09-01T10:00:00.000Z' };
    await page.click('#hdr-settings'); await page.fill('#import-text', JSON.stringify({ app: 'personal-work-os', schema: 1, records: [olderDoc] })); await page.click('#import-check'); await page.waitForSelector('#import-result'); await page.click('#import-merge'); await page.waitForSelector('#import-report', { timeout: 20000 }); await page.click('.modal-hd button[aria-label="Close"]');
    const storedBefore = JSON.stringify(await dbBy(page, r => r.id === 'old_doc_1'));
    await studio(page, 'docs'); const cardTxt = await page.textContent('.ps-doc[data-id="old_doc_1"]'); await page.click('.ps-doc[data-id="old_doc_1"] .ps-title'); await page.waitForSelector('#doc-category'); await page.waitForTimeout(400); await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    const storedAfter = JSON.stringify(await dbBy(page, r => r.id === 'old_doc_1'));
    ok('X3 Older documents appear in Plans & Reports as "Other"; opening one does not rewrite it or add fields', /Other/.test(cardTxt) && storedBefore === storedAfter && !/"category"|"masterPlan"|"summary"/.test(storedAfter) && unchanged);
    await ctx.close(); }
  for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    const { ctx, page } = await boot5(browser, { viewport: vp }); const ov = [];
    const pid = await mk(page, { type: 'prompt', title: 'Layout prompt with a fairly long title to test wrapping on phones', summary: 'x', body: 'a'.repeat(3000), status: 'Ready' });
    const sid = await mk(page, { type: 'sequence', title: 'Layout sequence', status: 'Active', steps: [{ id: 'st_l1', promptId: pid, status: 'Not started' }, { id: 'st_l2', promptId: pid, status: 'Completed', completedAt: new Date().toISOString(), result: 'done' }] });
    for (const tab of ['overview', 'library', 'sequences', 'docs', 'archived']) { if (vp.width < 900) { await page.click('.menu-btn'); await page.waitForTimeout(120); } await studio(page, tab); await page.waitForTimeout(100); ov.push(tab + ':' + (await overflow(page))); }
    if (vp.width < 900) { await page.click('.menu-btn'); await page.waitForTimeout(120); } await studio(page, 'sequences'); await page.click('.ps-seq[data-id="' + sid + '"]'); await page.waitForSelector('#seq-steps'); ov.push('sequence:' + (await overflow(page)));
    const copyBox = await page.$eval('#seq-steps > li:nth-child(1) .ps-copy', b => { const r = b.getBoundingClientRect(); return r.width > 0 && r.right <= innerWidth; });
    await page.click('#seq-steps > li:nth-child(1) .ps-step-title'); await page.waitForSelector('#prompt-body'); ov.push('prompt:' + (await overflow(page)));
    ok(\`V\${vp.width} No horizontal overflow at \${vp.width}px on every Prompt Studio screen; copy buttons reachable\`, ov.every(x => x.endsWith('false')) && copyBox && page.errs.length === 0, ov.join(' '));
    await ctx.close(); }
  console.log('TOTAL', R.filter(r => r[0] === 'PASS').length, 'pass,', R.filter(r => r[0] === 'FAIL').length, 'fail');
  await browser.close();
})();`);
