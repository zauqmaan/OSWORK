const base = require('fs').readFileSync(__dirname + '/run.js', 'utf8').split('(async () => {')[0];
eval(base + `
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--headless=new'] });
  const { page } = await newPage(browser);
  await page.click('#hdr-settings'); await page.click('.modal button:has-text("Load sample workspace")'); await page.waitForSelector('#sample-banner'); await page.click('.modal-hd button[aria-label="Close"]');
  await capture(page, { type: 'note', title: 'Preview API research', content: 'The preview endpoint returns a JSON summary of a business listing. Rate limit 60/min. Needs an API key per workspace.', project: 'PresenceScope', topic: 'n8n' });
  await capture(page, { type: 'resource', url: 'https://docs.n8n.io/workflows/', title: 'n8n workflow docs', topic: 'n8n' });
  await capture(page, { type: 'note', title: 'Unsorted thought about pricing', content: 'Maybe a $9 starter tier for small agencies.' });
  const shots = async (theme) => {
    await page.emulateMedia({ colorScheme: theme });
    const go = async (name, fn) => { await fn(); await page.waitForTimeout(250); await page.screenshot({ path: 'audit/' + theme + '-' + name + '.png' }); };
    await go('today', () => nav(page, 'today'));
    await go('inbox', () => nav(page, 'inbox'));
    await go('tasks', () => nav(page, 'tasks'));
    await go('projects', () => nav(page, 'projects'));
    await go('project', async () => { await page.click('h3:text-is("PresenceScope")'); });
    await go('notes', () => nav(page, 'notes'));
    await go('topics', () => nav(page, 'topics'));
    await go('topic', async () => { await page.click('.tnode .nm:text-is("n8n")'); });
    await go('resources', () => nav(page, 'resources'));
    await go('leads', () => nav(page, 'leads'));
    await go('timeline', () => nav(page, 'timeline'));
    await go('search', async () => { await search(page, 'n8n'); });
    await clearSearch(page);
    await go('drawer-task', async () => { await nav(page, 'tasks'); await page.locator('.row', { hasText: 'Define PresenceScope MVP scope' }).first().click(); await page.waitForSelector('.drawer'); });
    await closeDrawer(page);
    await go('drawer-note', async () => { await nav(page, 'notes'); await page.locator('.row', { hasText: 'Preview API research' }).first().click(); await page.waitForSelector('.drawer .ed-content'); await page.click('#f-body .ed-content'); await page.evaluate(() => document.querySelector('#f-body').__wos.editor.commands.focus('end')); await page.keyboard.press('Enter'); await page.keyboard.type('/'); await page.waitForSelector('.wos-slash'); });
    await page.keyboard.press('Escape'); await page.keyboard.press('Backspace'); await closeDrawer(page);
  };
  await shots('dark'); await shots('light');
  await browser.close();
})();`);
