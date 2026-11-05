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
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--headless=new'] });
  // ---------- theme ----------
  { const { ctx, page } = await boot(browser, { scheme: 'light' });
    ok('T1 System is default (no override attribute)', !(await page.getAttribute('body', 'data-app-theme')) && (await bodyBg(page)) === LIGHT);
    await page.emulateMedia({ colorScheme: 'dark' }); ok('T2 System follows OS change to dark', (await bodyBg(page)) === DARK);
    await page.click('#hdr-settings'); ok('T3 Settings shows System selected', (await page.getAttribute('#theme-system', 'aria-checked')) === 'true');
    await page.click('#theme-light'); ok('T4 Light overrides a dark OS', (await bodyBg(page)) === LIGHT && (await page.getAttribute('body', 'data-app-theme')) === 'light');
    await page.emulateMedia({ colorScheme: 'light' }); await page.click('#theme-dark'); ok('T5 Dark overrides a light OS', (await bodyBg(page)) === DARK);
    const popBg = await page.evaluate(() => { const d = document.createElement('div'); d.className = 'wos-pop'; document.body.appendChild(d); const c = getComputedStyle(d).backgroundColor; d.remove(); return c; });
    ok('T6 Editor popups (attached to body) follow the choice', popBg === 'rgb(26, 26, 32)', popBg);
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
    ok('T7 Host data-theme on <html> is left untouched and does not beat the app choice', (await page.getAttribute('html', 'data-theme')) === 'light' && (await bodyBg(page)) === DARK);
    await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));
    await page.click('.modal-hd button[aria-label="Close"]'); await reload(page);
    { const at = await page.getAttribute('body', 'data-app-theme'), bg = await bodyBg(page), ls = await page.evaluate(() => localStorage.getItem('personal-work-os.theme')); ok('T8 Dark persists after reload', at === 'dark' && bg === DARK, [at, bg, ls].join(' ')); }
    await page.click('#hdr-settings'); await page.click('#theme-system'); await page.click('.modal-hd button[aria-label="Close"]');
    await page.emulateMedia({ colorScheme: 'dark' }); const a = await bodyBg(page); await page.emulateMedia({ colorScheme: 'light' }); const b = await bodyBg(page);
    await reload(page); ok('T9 Back to System: follows OS both ways and persists', a === DARK && b === LIGHT && !(await page.getAttribute('body', 'data-app-theme')));
    ok('T10 no console errors (theme)', page.errs.length === 0, page.errs.join('; ')); await ctx.close(); }
  { const { ctx, page } = await boot(browser, { scheme: 'light', blockTheme: true });
    await page.click('#hdr-settings'); await page.click('#theme-dark');
    const warn = await page.textContent('#theme-setting'); const dark = (await bodyBg(page)) === DARK;
    await page.click('.modal-hd button[aria-label="Close"]'); await nav(page, 'tasks'); const works = (await page.$$('.task-row')).length > 0;
    await reload(page); const back = !(await page.getAttribute('body', 'data-app-theme'));
    ok('T11 Blocked storage: choice applies this session, warns, app works, reload falls back to System', dark && /blocked saving/.test(warn) && works && back && page.errs.length === 0, page.errs.join('; ')); await ctx.close(); }
  // ---------- project workspace ----------
  const { ctx, page } = await boot(browser);
  await nav(page, 'projects'); await page.click('h3:text-is("PresenceScope")'); await page.waitForSelector('#project-head');
  const prog = await page.textContent('#project-progress');
  ok('P1 Progress from existing tasks', /0 of 3 done/.test(prog), prog);
  const nextB = await page.$eval('.ws-main', e => e.innerText.toLowerCase().indexOf('next action')); const aboutB = await page.$eval('.ws-page', e => e.innerText.indexOf('About'));
  const layout = await page.evaluate(() => { const m = document.querySelector('.ws-main').getBoundingClientRect(), s = document.querySelector('.ws-side').getBoundingClientRect(); return { sideRight: s.left > m.right - 1, sameTop: Math.abs(s.top - m.top) < 4 }; });
  ok('P2 Work first: next action + open tasks in main column, About/context in side column', nextB >= 0 && layout.sideRight && layout.sameTop && !!(await page.$('#project-open')), JSON.stringify(layout));
  ok('P3 Description starts in Read mode (no toolbar)', await page.$eval('#project-desc', e => e.classList.contains('reading') && getComputedStyle(e.querySelector('.ed-toolbar')).display === 'none'));
  ok('P4 Header: no permanent reminder input; Delete lives in the overflow', !(await page.$('#f-remind')) && !(await page.$('#project-delete')));
  await page.click('#project-reminder'); const remOk = !!(await page.$('.pop-panel #f-remind')); await page.keyboard.press('Escape'); const closed = !(await page.$('.pop-panel'));
  await page.click('#project-more'); const delOk = !!(await page.$('#project-delete')); await page.keyboard.press('Escape');
  ok('P5 Reminder and overflow popovers open and close with Escape', remOk && closed && delOk && !!(await page.$('#project-head')));
  await page.locator('#project-open .task-row').first().locator('.check').click(); await page.waitForTimeout(250);
  const prog2 = await page.textContent('#project-progress'); await page.locator('.tabs button:has-text("Tasks")').click();
  await page.locator('.task-row .check.on').first().click(); await page.waitForTimeout(250);
  ok('P6 Progress updates when a task is completed', /1 of 3 done/.test(prog2), prog2);
  const tabs = []; for (const t of ['Tasks', 'Board', 'Notes & resources', 'Timeline', 'Overview']) { await page.click('.tabs button:has-text("' + t + '")'); await page.waitForTimeout(80); tabs.push(t + ':' + ((await page.$$('.main .row, .main .bcard, .main .tl')).length)); }
  ok('P7 All tabs still render their content', tabs.every(x => !/:0$/.test(x)), tabs.join(' '));
  await nav(page, 'projects'); await page.click('h3:text-is("Personal Projects")'); ok('P8 Zero-task project hides progress and says so', (await page.textContent('#project-progress')) === 'No tasks yet' && !(await page.$('#project-progress .progress')));
  // description edit, save, failure, retry, unmount flush, long text
  await nav(page, 'projects'); await page.click('h3:text-is("PresenceScope")');
  await page.click('#project-desc-edit'); await page.waitForSelector('#project-desc .ed-toolbar', { state: 'visible' }); await page.waitForTimeout(120); await page.waitForSelector('#project-desc .ed-toolbar', { state: 'visible' });
  await page.evaluate(() => document.querySelector('#project-desc').__wos.editor.commands.focus('end')); await page.keyboard.type(' Edited in Stage 2.');
  await page.click('#project-desc-done'); await page.waitForTimeout(300);
  const readAgain = await page.$eval('#project-desc', e => e.classList.contains('reading')); 
  await reload(page); await nav(page, 'projects'); await page.click('h3:text-is("PresenceScope")');
  ok('P9 Edit → Done saves through autosave and returns to Read mode', readAgain && (await getEditor(page, '#project-desc')).includes('Edited in Stage 2.'));
  await page.evaluate(() => { window.__failWrites = true; });
  await page.click('#project-desc-edit'); await page.waitForSelector('#project-desc .ed-toolbar', { state: 'visible' }); await page.waitForTimeout(120); await page.evaluate(() => document.querySelector('#project-desc').__wos.editor.commands.focus('end')); await page.keyboard.type(' Outage text.');
  await page.click('#project-desc-done'); await page.waitForSelector('#project-desc-panel .banner.bad', { timeout: 8000 });
  const stillEdit = await page.$eval('#project-desc', e => !e.classList.contains('reading')); const kept = (await getEditor(page, '#project-desc')).includes('Outage text.');
  await page.evaluate(() => { window.__failWrites = false; }); await page.click('#project-desc-panel .banner.bad button'); await page.waitForSelector('#project-desc-panel .banner.bad', { state: 'detached', timeout: 8000 });
  await page.click('#project-desc-done'); await page.waitForTimeout(200);
  await reload(page); await nav(page, 'projects'); await page.click('h3:text-is("PresenceScope")');
  ok('P10 Save failure keeps Edit mode + text, Retry saves', stillEdit && kept && (await getEditor(page, '#project-desc')).includes('Outage text.'));
  await page.click('#project-desc-edit'); await page.waitForSelector('#project-desc .ed-toolbar', { state: 'visible' }); await page.waitForTimeout(120); await page.evaluate(() => document.querySelector('#project-desc').__wos.editor.commands.focus('end')); await page.keyboard.type(' Unmount flush.');
  await nav(page, 'tasks'); await page.waitForTimeout(400); await reload(page); await nav(page, 'projects'); await page.click('h3:text-is("PresenceScope")');
  ok('P11 Leaving the page mid-edit still saves (unmount flush)', (await getEditor(page, '#project-desc')).includes('Unmount flush.'));
  const LONG = Array.from({ length: 300 }, (_, i) => 'Line ' + i + ' of a long project brief with details.').join('\\n');
  await page.click('#project-desc-edit'); await page.waitForSelector('#project-desc .ed-toolbar', { state: 'visible' }); await page.waitForTimeout(120); await setEditor(page, '#project-desc', LONG); await page.click('#project-desc-done'); await page.waitForTimeout(400);
  await reload(page); await nav(page, 'projects'); await page.click('h3:text-is("PresenceScope")');
  ok('P12 Long description survives reload in Read mode', (await getEditor(page, '#project-desc')) === LONG && await page.$eval('#project-desc', e => e.classList.contains('reading')));
  // ---------- topic hub ----------
  for (let i = 0; i < 7; i++) await capture(page, { type: 'note', title: 'Hub note ' + i, topic: 'n8n' });
  await nav(page, 'topics'); await page.click('.tnode .nm:text-is("n8n")'); await page.waitForSelector('#topic-head');
  const crumbs = await page.textContent('#topic-head .crumbs'); const countsTxt = await page.textContent('#topic-counts');
  const groupCounts = await page.$$eval('.ws-main .sec', s => s.map(x => [x.id, Number((x.querySelector('.sec-hd .n') || {}).textContent)]));
  const expect = await page.evaluate(() => { const recs = Object.values(JSON.parse(localStorage.getItem('mockdb'))); const t = recs.find(r => r.type === 'topic' && r.title === 'n8n'); const ids = new Set([t.id]); let add = true; while (add) { add = false; for (const r of recs) if (r.type === 'topic' && ids.has(r.parentId) && !ids.has(r.id)) { ids.add(r.id); add = true; } } const inT = recs.filter(r => r.topicId && ids.has(r.topicId) && !r.archived); return { note: inT.filter(r => r.type === 'note').length, task: inT.filter(r => r.type === 'task').length, resource: inT.filter(r => r.type === 'resource').length, child: recs.filter(r => r.type === 'topic' && r.parentId === t.id).length }; });
  const gc = Object.fromEntries(groupCounts);
  ok('H1 Counts match stored relationships', gc['topic-notes'] === expect.note && gc['topic-tasks'] === expect.task && gc['topic-resources'] === expect.resource && gc['topic-children'] === expect.child && countsTxt.includes(expect.note + ' notes'), countsTxt + ' | ' + JSON.stringify(expect));
  const order = groupCounts.map(g => g[0]); ok('H2 Groups ordered Notes, Tasks, Resources, Projects, Child topics', JSON.stringify(order) === JSON.stringify(['topic-notes', 'topic-tasks', 'topic-resources', 'topic-projects', 'topic-children'].filter(x => order.includes(x))), order.join(','));
  const before = await page.$$eval('#topic-notes .list > .row', r => r.length); await page.click('#topic-notes .hub-more'); const after = await page.$$eval('#topic-notes .list > .row', r => r.map(x => x.querySelector('.row-title').textContent));
  ok('H3 Show all opens every related note', before === 5 && after.length === expect.note && after.filter(t => /Hub note/.test(t)).length === 7, before + ' → ' + after.length);
  ok('H4 Description Read by default, context files in side column', await page.$eval('#topic-desc-panel', e => !!e.closest('.ws-side')) && !!(await page.$('.ws-side .ctx')));
  await page.click('#topic-children .row-title:text-is("Workflows")'); await page.waitForSelector('#topic-head');
  const crumb2 = await page.textContent('#topic-head .crumbs'); await page.click('#topic-head .crumbs button:has-text("n8n")'); const back = await page.inputValue('#topic-title');
  ok('H5 Child navigation and breadcrumb back to parent', /Topics\\s*\\/\\s*n8n\\s*\\/\\s*Workflows/.test(crumb2) && back === 'n8n', crumb2);
  await page.click('#topic-more'); const parentSel = !!(await page.$('.pop-panel select')); await page.keyboard.press('Escape');
  await page.click('.tabs button:has-text("Timeline")'); const tl = (await page.$$('.main .tl')).length; await page.click('.tabs button:has-text("Everything")');
  ok('H6 Parent change + delete in overflow; Timeline tab intact', parentSel && tl > 0);
  // ---------- drawer ----------
  await nav(page, 'tasks'); await page.click('.tabs button:has-text("All open")');
  const rows = page.locator('.main .task-row'); await rows.nth(0).click(); await page.waitForSelector('.drawer');
  const d1 = await page.getAttribute('.drawer', 'data-id'); const noBackdrop = !(await page.$('.backdrop')); const docked = await page.$eval('.drawer', e => e.classList.contains('docked'));
  const sel1 = await page.$$eval('.main .row.is-open', r => r.map(x => x.dataset.id));
  const listVisible = await page.evaluate(() => { const d = document.querySelector('.drawer').getBoundingClientRect(); const r = document.querySelector('.main .task-row').getBoundingClientRect(); return r.right <= d.left + 1; });
  await rows.nth(1).click(); await page.waitForTimeout(150); const d2 = await page.getAttribute('.drawer', 'data-id'); const sel2 = await page.$$eval('.main .row.is-open', r => r.map(x => x.dataset.id));
  ok('D1 Desktop: docked, no backdrop, list beside it, selected row highlighted, click switches record', docked && noBackdrop && listVisible && sel1.length === 1 && sel1[0] === d1 && d2 !== d1 && sel2[0] === d2, [d1, d2].join(' → '));
  await page.click('#hdr-capture'); await page.waitForSelector('#cap-panel', { state: 'visible' }); await page.keyboard.press('Escape');
  const capClosed = await page.isHidden('#cap-panel'); const drawerStays = !!(await page.$('.drawer'));
  await page.click('#hdr-settings'); await page.waitForSelector('.modal'); await page.keyboard.press('Escape'); const modalClosed = !(await page.$('.modal')); const drawerStill = !!(await page.$('.drawer'));
  ok('D2 Header usable with drawer open; Escape closes capture panel / modal first, not the drawer', capClosed && drawerStays && modalClosed && drawerStill);
  await page.evaluate(() => document.activeElement && document.activeElement.blur()); await page.keyboard.press('Escape'); await page.waitForTimeout(100);
  ok('D3 Escape closes the docked drawer', !(await page.$('.drawer')) && !(await page.$$eval('.main .row.is-open', r => r.length)));
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(150);
  await page.locator('.main .task-row .row-title').first().click(); await page.waitForSelector('.drawer');
  const mob = await page.evaluate(() => ({ backdrop: !!document.querySelector('.backdrop'), docked: document.querySelector('.drawer').classList.contains('docked'), w: document.querySelector('.drawer').getBoundingClientRect().width, vw: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth }));
  await page.keyboard.press('Escape'); await page.waitForTimeout(100);
  ok('D4 Mobile keeps the overlay drawer (backdrop, full width) and Escape closes it', mob.backdrop && !mob.docked && mob.w === mob.vw && !mob.overflow && !(await page.$('.drawer')), JSON.stringify(mob));
  await page.click('.menu-btn'); await nav(page, 'projects'); await page.click('h3:text-is("PresenceScope")'); const ov1 = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  await page.click('.menu-btn'); await nav(page, 'topics'); await page.click('.tnode .nm:text-is("n8n")'); const ov2 = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  ok('D5 No horizontal overflow at 390 px on project and topic pages', !ov1 && !ov2);
  ok('E No console errors', page.errs.length === 0, page.errs.slice(0, 3).join('; '));
  console.log('TOTAL', R.filter(r => r[0] === 'PASS').length, 'pass,', R.filter(r => r[0] === 'FAIL').length, 'fail');
  await browser.close();
})();`);
