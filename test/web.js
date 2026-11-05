// Tests the Netlify/web build (site/) against a fake Supabase (test/fake-supabase.js) served from a local web server.
const { chromium } = require('playwright-core');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), SITE = path.join(ROOT, 'site');
const R = []; const ok = (n, c, info) => { R.push([c ? 'PASS' : 'FAIL', n]); console.log(c ? 'PASS' : 'FAIL', n, info || ''); };
const CONFIG_OK = "window.WOS_CONFIG = { supabaseUrl: 'https://test-project.supabase.co', supabaseAnonKey: 'test-anon-key' };";
function serve(configBody) {
  const types = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json' };
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
    if (p === '/config.js' && configBody) { res.writeHead(200, { 'content-type': types['.js'] }); return res.end(configBody); }
    if (p === '/vendor/supabase.js') { res.writeHead(200, { 'content-type': types['.js'] }); return res.end(fs.readFileSync(path.join(__dirname, 'fake-supabase.js'))); }
    const f = path.join(SITE, p); if (!f.startsWith(SITE) || !fs.existsSync(f)) { res.writeHead(404); return res.end('nf'); }
    res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv)));
}
async function open(ctx, url) {
  const page = await ctx.newPage(); page.errs = []; page.ext = [];
  page.on('pageerror', e => page.errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) page.errs.push(m.text()); });
  page.on('request', r => { const u = r.url(); if (!u.startsWith(url) && !/fonts\.(googleapis|gstatic)\.com/.test(u) && !u.startsWith('blob:') && !u.startsWith('data:')) page.ext.push(u); });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto(url); return page;
}
const login = async (page, pass = 'correct-horse-1') => { await page.waitForSelector('#login-email'); await page.fill('#login-email', 'test@example.com'); await page.fill('#login-password', pass); await page.click('#login-submit'); };
const appReady = page => page.waitForFunction(() => document.querySelector('.hdr') && !document.body.innerText.includes('Loading your workspace') && !document.getElementById('wos-login'));
const table = page => page.evaluate(() => JSON.parse(localStorage.getItem('fake-sb-table') || '[]'));
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--headless=new'] });
  { const srv = await serve(fs.readFileSync(path.join(ROOT, 'web', 'config.js'), 'utf8')); const url = `http://127.0.0.1:${srv.address().port}/`; const ctx = await browser.newContext();
    const page = await open(ctx, url); await page.waitForSelector('#wos-login');
    ok('W1 Without keys in config.js the site shows "Setup needed" and stores nothing', /Setup needed/.test(await page.textContent('#wos-login')) && (await table(page)).length === 0);
    await ctx.close(); srv.close(); }
  const srv = await serve(CONFIG_OK); const url = `http://127.0.0.1:${srv.address().port}/`;
  const ctx = await browser.newContext({ acceptDownloads: true }); const page = await open(ctx, url);
  await login(page, 'wrong-password'); await page.waitForFunction(() => /not right/.test((document.getElementById('login-error') || {}).textContent || ''));
  const blocked = !(await page.$('.hdr')) || await page.isVisible('#wos-login');
  await page.fill('#login-password', 'correct-horse-1'); await page.click('#login-submit'); await appReady(page);
  ok('W2 Login screen: a wrong password is refused with a message; the right one opens the app', blocked && /Saved/.test(await page.textContent('.save-state')));
  await page.click('#hdr-settings'); const acct = await page.textContent('#host-account'); const store = await page.textContent('.modal');
  await page.click('.modal-hd button[aria-label="Close"]');
  ok('W3 Settings shows the signed-in email, a Sign out button, and that data is saved to Supabase', /test@example.com/.test(acct) && /Supabase database/.test(store));
  // create through the UI
  await page.click('#hdr-capture'); await page.waitForSelector('#cap-panel', { state: 'visible' });
  await page.fill('#cap-title', 'Web note one'); await page.click('#cap-save'); await page.waitForSelector('#cap-panel', { state: 'hidden' }); await page.waitForTimeout(400);
  let rows = await table(page); const row = rows.find(r => r.data.title === 'Web note one');
  ok('W4 A new note is written to the records table, as the signed-in user', !!row && row.user_id === '00000000-0000-4000-8000-000000000001' && row.id === row.data.id || (!!row && row.user_id === '00000000-0000-4000-8000-000000000001'));
  // second "device" (same browser profile, second window) sees changes live
  const page2 = await open(ctx, url); await appReady(page2);
  const sessionKept = !(await page2.$('#wos-login'));
  await page.evaluate(async () => { await createRecord({ type: 'task', title: 'Live sync task', status: 'Next' }); });
  await page2.waitForFunction(() => document.body.innerText.includes('Live sync task') || [...(window.__seen || [])].length, null, { timeout: 5000 }).catch(() => {});
  const seen = await page2.evaluate(() => [...store.all().values()].some(r => r.title === 'Live sync task'));
  ok('W5 A second window stays signed in and receives new records live, without reloading', sessionKept && seen);
  const tid = await page.evaluate(() => [...store.all().values()].find(r => r.title === 'Live sync task').id);
  await page.evaluate(id => deleteRecord(id), tid); await page.waitForTimeout(500);
  ok('W6 Deletes reach the other window too', !(await page2.evaluate(id => store.all().has(id), tid)));
  await page2.close();
  // reload keeps data and session
  await page.reload(); await appReady(page);
  ok('W7 After a reload you stay signed in and your data is still there', await page.evaluate(() => [...store.all().values()].some(r => r.title === 'Web note one')));
  // restore an older backup (the way you move data over from claude.ai)
  const old = fs.readFileSync(path.join(__dirname, 'export-before.json'), 'utf8'); const nOld = JSON.parse(old).records.length;
  await page.click('#hdr-settings'); await page.fill('#import-text', old); await page.click('#import-check'); await page.waitForSelector('#import-result');
  await page.click('#import-merge'); await page.waitForSelector('#import-report', { timeout: 20000 }); const rep = await page.textContent('#import-report');
  rows = await table(page);
  ok('W8 A backup from the claude.ai app imports with Merge; every record lands in the table', /Imported/.test(rep) && JSON.parse(old).records.every(r => rows.some(x => x.id === r.id)), `${nOld} records`);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#export-btn')]);
  const dlPath = await dl.path(); const backup = JSON.parse(fs.readFileSync(dlPath, 'utf8'));
  ok('W9 Download JSON saves a real backup file with every record', dl.suggestedFilename().endsWith('.json') && backup.app === 'personal-work-os' && backup.records.length === rows.length, dl.suggestedFilename());
  await page.click('.modal-hd button[aria-label="Close"]');
  // Prompt Studio works on the web build too
  const nAlerts = (await page.$$('.alert-card')).length;
  for (let i = 0; i < 10 && await page.$('.alert-card'); i++) { await page.click('.alert-card >> text=Hide'); await page.waitForTimeout(100); }
  ok('W9b Imported reminders that are already due show as reminder alerts and can be hidden', nAlerts > 0 && !(await page.$('.alert-card')), nAlerts + ' alerts');
  await page.click('#nav-studio'); await page.click('#studio-tab-sequences'); await page.click('#sq-new'); await page.fill('#ns-title', 'Web sequence'); await page.click('#ns-save'); await page.waitForSelector('#seq-page');
  await page.click('#seq-add-action'); await page.fill('#as-title', 'Open the project'); await page.fill('#as-items', 'cd ~/projects\ngit pull'); await page.click('#as-save'); await page.waitForTimeout(400);
  rows = await table(page); const sq = rows.find(r => r.data.type === 'sequence' && r.data.title === 'Web sequence');
  ok('W10 Prompt Studio: a sequence with an action step saves to Supabase', !!sq && sq.data.steps.length === 1 && sq.data.steps[0].items.length === 2);
  // save failure → honest message, retry works
  await page.evaluate(() => { window.__fakeFail = true; });
  await page.evaluate(async () => { const r = [...store.all().values()].find(x => x.title === 'Web note one'); await updateRecord(r.id, { title: 'Web note renamed' }); });
  const t = await page.$$eval('.toast', x => x.map(y => y.textContent).join(' | '));
  const notStored = (await table(page)).some(r => r.data.title === 'Web note one');
  await page.evaluate(() => { window.__fakeFail = false; });
  await page.evaluate(async () => { const r = [...store.all().values()].find(x => x.title === 'Web note one'); await updateRecord(r.id, { title: 'Web note renamed' }); });
  ok('W11 When Supabase cannot be reached the change is reported as not saved; saving again works', /Could not save this change/.test(t) && notStored && (await table(page)).some(r => r.data.title === 'Web note renamed'), t.slice(0, 120));
  // sign out
  await page.click('#hdr-settings'); await page.click('#sign-out'); await page.waitForSelector('#login-email');
  const hidden = await page.evaluate(() => !document.body.innerText.includes('Web note renamed') || !!document.getElementById('wos-login'));
  await login(page); await appReady(page);
  ok('W12 Sign out returns to the login screen; signing back in shows the data again', hidden && await page.evaluate(() => [...store.all().values()].some(r => r.title === 'Web note renamed')));
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(200);
  ok('W13 Phone width: no sideways scrolling', !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
  ok('W14 Everything loads from the site itself (no outside script CDNs); no console errors', page.ext.length === 0 && page.errs.length === 0, page.ext.slice(0, 3).join(' ') + ' ' + page.errs.slice(0, 2).join('; '));
  console.log('TOTAL', R.filter(r => r[0] === 'PASS').length, 'pass,', R.filter(r => r[0] === 'FAIL').length, 'fail');
  await browser.close(); srv.close();
})();
