// usage: node test/exportcmp.js <html> <mode:make|export> <dataset.json> [out.json]
const [, , HTMLF, MODE, DS, OUTF] = process.argv;
let base = require('fs').readFileSync(__dirname + '/run.js', 'utf8').split('(async () => {')[0];
base = base.replace("const FILE = 'file://' + path.join(ROOT, 'work-os.html');", "const FILE = 'file://' + path.resolve(" + JSON.stringify(HTMLF) + ");");
eval(base + `
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--headless=new'] });
  if (MODE === 'make') {
    const { page } = await newPage(browser);
    await page.click('#hdr-settings'); await page.click('.modal button:has-text("Load sample workspace")'); await page.waitForSelector('#sample-banner'); await page.click('.modal-hd button[aria-label="Close"]');
    await capture(page, { type: 'note', title: 'Preview API research', content: 'Rate limit 60/min.', project: 'PresenceScope', topic: 'n8n' });
    await capture(page, { type: 'resource', url: 'https://docs.n8n.io/workflows/', title: 'n8n workflow docs', topic: 'n8n' });
    await page.waitForTimeout(500);
    require('fs').writeFileSync(DS, await page.evaluate(() => localStorage.getItem('mockdb')));
  } else {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const ds = require('fs').readFileSync(DS, 'utf8');
    await ctx.addInitScript(d => { if (!localStorage.getItem('mockdb')) localStorage.setItem('mockdb', d); }, ds);
    await ctx.addInitScript(MOCK);
    await ctx.route(/cdnjs\\.cloudflare\\.com|cdn\\.jsdelivr\\.net/, r => { const f = Object.keys(VENDOR).find(k => r.request().url().endsWith(k)); return f ? r.fulfill({ path: VENDOR[f], contentType: 'application/javascript' }) : r.abort(); });
    await ctx.route(/fonts\\.(googleapis|gstatic)\\.com/, r => r.abort());
    const page = await ctx.newPage(); await page.goto(FILE); await page.waitForSelector('.hdr'); await page.waitForFunction(() => !document.body.innerText.includes('Loading your workspace'));
    for (const k of ['today','inbox','tasks','projects','notes','topics','resources','leads','timeline']) await nav(page, k);
    await search(page, 'n8n'); await clearSearch(page);
    await page.click('#hdr-settings'); await page.click('#export-btn'); await page.waitForTimeout(300);
    const dl = await page.evaluate(() => window.__downloads[0]);
    const after = await page.evaluate(() => localStorage.getItem('mockdb'));
    require('fs').writeFileSync(OUTF, dl.data);
    console.log('store untouched by browsing:', after === ds);
  }
  await browser.close();
})();`);
