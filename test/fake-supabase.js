// Test stand-in for the Supabase browser library (window.supabase.createClient). Not the real service:
// one user (test@example.com / correct-horse-1), a records table and session kept in localStorage (per browser profile),
// realtime between pages of the same profile via BroadcastChannel, and window.__fakeFail to make writes fail.
(function () {
  var USERS = { 'test@example.com': { id: '00000000-0000-4000-8000-000000000001', email: 'test@example.com', password: 'correct-horse-1' } };
  var T = 'fake-sb-table', S = 'fake-sb-session';
  var load = function () { try { return JSON.parse(localStorage.getItem(T) || '[]'); } catch (e) { return []; } };
  var save = function (rows) { localStorage.setItem(T, JSON.stringify(rows)); };
  var bc = new BroadcastChannel('fake-sb-rt');
  var listeners = [], authCbs = [];
  bc.onmessage = function (m) { listeners.forEach(function (l) { if (l.filterUser === m.data.user) l.cb(m.data.payload); }); };
  function session() { try { return JSON.parse(localStorage.getItem(S)); } catch (e) { return null; } }
  window.__fakeSb = { requests: 0 };
  function createClient(url, key) {
    var me = function () { var s = session(); return s && s.user; };
    var api = {
      auth: {
        getSession: async function () { return { data: { session: session() }, error: null }; },
        signInWithPassword: async function (c) { var u = USERS[c.email]; if (!u || u.password !== c.password) return { data: {}, error: { message: 'Invalid login credentials' } }; var s = { user: { id: u.id, email: u.email }, access_token: 'fake' }; localStorage.setItem(S, JSON.stringify(s)); authCbs.forEach(function (f) { f('SIGNED_IN', s); }); return { data: { user: s.user, session: s }, error: null }; },
        signOut: async function () { localStorage.removeItem(S); authCbs.forEach(function (f) { f('SIGNED_OUT', null); }); return { error: null }; },
        onAuthStateChange: function (f) { authCbs.push(f); return { data: { subscription: { unsubscribe: function () { } } } }; },
        resetPasswordForEmail: async function () { return { error: null }; },
        updateUser: async function () { return { error: null }; }
      },
      from: function (table) {
        var q = { op: 'select', filters: [] };
        var exec = async function () {
          window.__fakeSb.requests++;
          var u = me(); if (!u) return { data: null, error: { message: 'JWT expired', status: 401 } };
          if (window.__fakeFail && q.op !== 'select') return { data: null, error: { message: 'Failed to fetch', status: 0 } };
          var rows = load();
          if (q.op === 'select') { var mine = rows.filter(function (r) { return r.user_id === u.id; }).sort(function (a, b) { return a.id < b.id ? -1 : 1; }); return { data: mine.slice(q.from, q.to + 1).map(function (r) { return { id: r.id, data: r.data }; }), error: null }; }
          if (q.op === 'upsert') { if (q.row.user_id !== u.id) return { data: null, error: { message: 'new row violates row-level security policy', status: 403 } }; var i = rows.findIndex(function (r) { return r.user_id === u.id && r.id === q.row.id; }); var ev = i >= 0 ? 'UPDATE' : 'INSERT'; if (i >= 0) rows[i] = q.row; else rows.push(q.row); save(rows); bc.postMessage({ user: 'user_id=eq.' + u.id, payload: { eventType: ev, new: q.row } }); return { data: null, error: null }; }
          if (q.op === 'delete') { var id = (q.filters.find(function (f) { return f[0] === 'id'; }) || [])[1]; var before = rows.length; rows = rows.filter(function (r) { return !(r.user_id === u.id && r.id === id); }); save(rows); if (rows.length !== before) bc.postMessage({ user: 'user_id=eq.' + u.id, payload: { eventType: 'DELETE', old: { id: id, user_id: u.id } } }); return { data: null, error: null }; }
        };
        var b = {
          select: function () { q.op = 'select'; return b; }, order: function () { return b; },
          range: function (f, t) { q.from = f; q.to = t; return exec(); },
          upsert: function (row) { q.op = 'upsert'; q.row = row; return exec(); },
          delete: function () { q.op = 'delete'; return b; },
          eq: function (k, v) { q.filters.push([k, v]); return q.op === 'delete' && q.filters.length >= 2 ? exec() : b; }
        };
        return b;
      },
      channel: function () {
        var ch = { on: function (kind, opts, cb) { listeners.push({ filterUser: opts.filter, cb: cb }); return ch; }, subscribe: function (cb) { setTimeout(function () { cb && cb('SUBSCRIBED'); }, 10); return ch; } };
        return ch;
      }
    };
    return api;
  }
  window.supabase = { createClient: createClient };
})();
