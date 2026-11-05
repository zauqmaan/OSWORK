// Test workspace with dates relative to the run's reference time.
// dataset.json was captured at CAPTURED_AT; every date in it is moved so it keeps the same relation to "now":
//   - timestamps (createdAt, updatedAt, completedAt, remindAt, log times) move by the exact time elapsed;
//   - calendar dates (due, scheduled, start, target, contact, follow-up) move by whole days, in the test timezone.
// "now" is WOS_NOW when set (the browser clock is then installed at that time), otherwise the real time.
// WOS_TZ sets the browser timezone; calendar dates are computed in it.
const fs = require('fs');
const CAPTURED_AT = '2026-10-16T07:55:37.265Z';
const TS = ['createdAt', 'updatedAt', 'completedAt', 'remindAt'];
const DAYS = ['dueAt', 'scheduledFor', 'startDate', 'targetDate', 'lastContact', 'nextFollowUp'];
const nowMs = () => process.env.WOS_NOW ? Date.parse(process.env.WOS_NOW) : Date.now();
function localDay(ms, tz) { return new Intl.DateTimeFormat('en-CA', { timeZone: tz || undefined, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms)); }
const dayNum = d => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86400000;
function shiftDay(d, n) { const t = new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10) + n)); return t.toISOString().slice(0, 10); }
function datasetJSON(now = nowMs(), tz = process.env.WOS_TZ) {
  const data = JSON.parse(fs.readFileSync(__dirname + '/dataset.json', 'utf8'));
  const dMs = now - Date.parse(CAPTURED_AT);
  const dDays = dayNum(localDay(now, tz)) - dayNum(localDay(Date.parse(CAPTURED_AT), tz));
  const mv = v => new Date(Date.parse(v) + dMs).toISOString();
  for (const r of Object.values(data)) {
    for (const k of TS) if (typeof r[k] === 'string' && !isNaN(Date.parse(r[k]))) r[k] = mv(r[k]);
    for (const k of DAYS) if (typeof r[k] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r[k])) r[k] = shiftDay(r[k], dDays);
    if (Array.isArray(r.log)) r.log = r.log.map(e => e && typeof e.at === 'string' ? { ...e, at: mv(e.at) } : e);
  }
  return JSON.stringify(data);
}
/** Context options and clock for a deterministic run. */
async function prepareContext(ctx) { if (process.env.WOS_NOW) await ctx.clock.install({ time: new Date(process.env.WOS_NOW) }); }
const contextOptions = () => process.env.WOS_TZ ? { timezoneId: process.env.WOS_TZ } : {};
module.exports = { datasetJSON, prepareContext, contextOptions, CAPTURED_AT };
