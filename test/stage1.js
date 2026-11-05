let base = require('fs').readFileSync(__dirname + '/run.js', 'utf8').split('(async () => {')[0];
eval(base + `
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--headless=new'] });
  const DC = require(__dirname + '/dataset-clock.js'); const ds = DC.datasetJSON(); // dates relative to the run time
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...DC.contextOptions() }); await DC.prepareContext(ctx);
  await ctx.addInitScript(d => { if (!localStorage.getItem('mockdb')) localStorage.setItem('mockdb', d); }, ds);
  await ctx.addInitScript(MOCK);
  await ctx.route(/cdnjs\\.cloudflare\\.com|cdn\\.jsdelivr\\.net/, r => { const f = Object.keys(VENDOR).find(k => r.request().url().endsWith(k)); return f ? r.fulfill({ path: VENDOR[f], contentType: 'application/javascript' }) : r.abort(); });
  await ctx.route(/fonts\\.(googleapis|gstatic)\\.com/, r => r.abort());
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) errs.push(m.text()); });
  await page.goto(FILE); await page.waitForSelector('.hdr'); await page.waitForFunction(() => !document.body.innerText.includes('Loading your workspace'));
  // add one of each remaining type through the UI
  await capture(page, { type: 'idea', title: 'Idea: agency tier' });
  await capture(page, { type: 'doc', title: 'Doc: claim flow spec', content: 'Long form spec.' });
  await nav(page, 'notes'); await page.locator('.row', { hasText: 'Preview API research' }).first().click(); await page.waitForSelector('.drawer');
  await page.setInputFiles('.drawer .ctx input[type=file]', { name: 'preview-notes.md', mimeType: 'text/markdown', buffer: Buffer.from('zebra context file') });
  await page.waitForSelector('.drawer .ctx-card'); await closeDrawer(page);
  // 1. types by leading element in search
  const leadOf = async q => { await page.fill('#global-search', q); await page.waitForTimeout(120); return page.$$eval('#search-results .row', rows => rows.map(r => ({ type: r.dataset.type, title: (r.querySelector('.row-title') || {}).textContent, lead: r.querySelector('.check') ? 'checkbox' : r.querySelector('.row-lead') ? (r.querySelector('.row-lead').className + '|' + ((r.querySelector('.row-lead path') || {}).getAttribute ? r.querySelector('.row-lead path').getAttribute('d').slice(0, 14) : r.querySelector('.row-lead').textContent.trim().slice(0,1))) : 'none' }))); };
  const seen = {};
  for (const q of ['PresenceScope', 'n8n', 'Idea: agency', 'Doc: claim', 'zebra', 'Corner Bakery', 'Preview API', 'Next.js']) for (const r of await leadOf(q)) seen[r.type + (r.title.startsWith('Idea:') ? ':idea' : r.title.startsWith('Doc:') ? ':doc' : '')] = r.lead;
  await clearSearch(page);
  console.log('LEADS', JSON.stringify(seen, null, 1));
  const leads = Object.values(seen); const distinct = new Set(leads).size;
  console.log('types seen', Object.keys(seen).length, 'distinct leading elements', distinct, 'none-leads', leads.filter(l => l === 'none').length);
  // 2. complete a task from search, then reopen it
  await page.fill('#global-search', 'Send invoice'); await page.waitForTimeout(150);
  await page.click('#search-results .row:has-text("Send invoice") .check'); await page.waitForTimeout(250);
  const doneInSearch = await page.$eval('#search-results .row:has-text("Send invoice") .row-title', e => e.classList.contains('done'));
  await page.click('#search-results .row:has-text("Send invoice") .check'); await page.waitForTimeout(250);
  const reopened = await page.$eval('#search-results .row:has-text("Send invoice") .row-title', e => !e.classList.contains('done'));
  console.log('complete from search:', doneInSearch, 'reopen:', reopened);
  // 3. completable from Today, All Tasks, project page, topic page, lead drawer
  const tryComplete = async (label, go, title) => { await go(); const row = page.locator('.row:has-text("' + title + '")').first(); await row.locator('.check').click(); await page.waitForTimeout(200); const d = await row.locator('.row-title').evaluate(e => e.classList.contains('done')).catch(() => 'gone'); await page.locator('.row:has-text("' + title + '")').first().locator('.check').click().catch(()=>{}); await page.waitForTimeout(150); console.log('complete in', label + ':', d === true || d === 'gone' ? 'ok' : 'FAIL'); };
  await tryComplete('Today', () => nav(page, 'today'), 'Draft PresenceScope landing page copy');
  await tryComplete('All Tasks', async () => { await nav(page, 'tasks'); await page.click('.tabs button:has-text("Everything")'); }, 'Send invoice for last client site');
  await tryComplete('Project page', async () => { await nav(page, 'projects'); await page.click('h3:text-is("PresenceScope")'); await page.click('.tabs button:has-text("Tasks")'); }, 'Wait for designer feedback');
  await tryComplete('Topic page', async () => { await nav(page, 'topics'); await page.click('.tnode .nm:text-is("n8n")'); }, 'Build an n8n webhook');
  // 4. keyboard search
  await page.click('#global-search'); await page.fill('#global-search', 'n8n'); await page.waitForTimeout(150);
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); const sel = await page.$eval('#search-results .kbd-on .row-title', e => e.textContent);
  await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  const opened = await page.$eval('.drawer #f-title', e => e.value).catch(async () => await page.$eval('#topic-title', e => e.value).catch(() => null));
  console.log('keyboard search selected', JSON.stringify(sel), 'opened', JSON.stringify(opened), sel === opened ? 'ok' : 'FAIL');
  await closeDrawer(page); await clearSearch(page);
  // 5. filters/sort still work
  await nav(page, 'tasks'); await page.selectOption('select[aria-label="Priority"]', 'Urgent'); const n1 = await page.$$eval('.main .list .row', r => r.length); await page.selectOption('select[aria-label="Priority"]', ''); 
  await page.selectOption('select[aria-label="Sort"]', 'title'); const titles = await page.$$eval('.main .list .row-title', r => r.map(x => x.textContent)); 
  // Stage 3: All Tasks groups by date by default and sorts within each group; with grouping off the sort is global as before
  const groupsOk = await page.$$eval('.main .task-groups .list', ls => ls.every(l => { const t = [...l.querySelectorAll('.row-title')].map(x => x.textContent); return JSON.stringify(t) === JSON.stringify([...t].sort((a, b) => a.localeCompare(b))); }));
  await page.selectOption('#tasks-group', 'none'); const flat = await page.$$eval('.main .list .row-title', r => r.map(x => x.textContent)); await page.selectOption('#tasks-group', 'date');
  console.log('filter urgent rows', n1, 'sorted by title', groupsOk && titles.length && JSON.stringify(flat) === JSON.stringify([...flat].sort((a,b)=>a.localeCompare(b))) ? 'ok' : 'FAIL');
  // 6. metadata still in detail view: tags + topic + project
  await nav(page, 'notes'); await page.locator('.row', { hasText: 'n8n: credentials' }).first().click(); await page.waitForSelector('.drawer');
  const dtxt = await page.textContent('.drawer'); const topicSel = await page.$eval('#f-topic', s => s.options[s.selectedIndex].text);
  console.log('detail keeps tag', dtxt.includes('automation'), 'topic', topicSel.trim());
  await closeDrawer(page);
  await search(page, 'automation'); const tagHit = await page.$$eval('#search-results .row-title', r => r.map(x => x.textContent)); await clearSearch(page);
  console.log('tag still searchable', tagHit.includes('n8n: credentials and environment variables'));
  console.log('console errors', errs.length, errs.slice(0,3));
  await browser.close();
})();`);
