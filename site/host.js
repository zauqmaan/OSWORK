/* Personal Work OS — web host for running outside claude.ai (e.g. on Netlify).
 * Provides the same small storage interface the app uses inside claude.ai (window.claude.use('db' | 'user' |
 * 'downloads')), backed by your own Supabase project: one row per record in public.records, protected by row-level
 * security so only the signed-in user can read or write their rows. Changes from other devices arrive through
 * Supabase Realtime. The app code itself is identical to the claude.ai build.
 */
(function () {
  'use strict';
  var cfg = window.WOS_CONFIG || {};
  var sb = null, user = null, resolveUser, ready = new Promise(function (r) { resolveUser = r; });

  /* ---------- login screen (plain DOM, styled with the app's own colour tokens) ---------- */
  function el(tag, attrs, kids) { var e = document.createElement(tag); for (var k in (attrs || {})) { if (k === 'text') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); } (kids || []).forEach(function (c) { e.appendChild(c); }); return e; }
  var css = '#wos-login{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;background:var(--bg,#f7f7f5);padding:16px;font-family:var(--f-body,system-ui,sans-serif);color:var(--fg,#111)}'
    + '#wos-login form{width:min(380px,100%);background:var(--surface,#fff);border:1px solid var(--border-strong,#ccc);border-radius:14px;padding:24px;display:flex;flex-direction:column;gap:12px}'
    + '#wos-login h1{margin:0;font:600 20px/1.3 var(--f-display,inherit)}#wos-login p{margin:0;font-size:13px;color:var(--fg2,#555)}'
    + '#wos-login label{display:flex;flex-direction:column;gap:4px;font-size:12.5px;color:var(--fg2,#555)}'
    + '#wos-login input{height:38px;border:1px solid var(--border-strong,#ccc);border-radius:8px;padding:0 10px;font:inherit;font-size:14px;background:var(--surface,#fff);color:var(--fg,#111)}'
    + '#wos-login button{height:38px;border:0;border-radius:8px;background:var(--primary,#4f46e5);color:#fff;font:inherit;font-weight:600;cursor:pointer}'
    + '#wos-login button[disabled]{opacity:.6;cursor:default}#wos-login .link{background:none;color:var(--primary,#4f46e5);height:auto;font-weight:500;padding:0;text-align:left}'
    + '#wos-login .err{color:var(--bad,#b42318);font-size:13px;min-height:1em}#wos-login .ok{color:var(--ok,#067647);font-size:13px}';
  function showScreen(kind, note) {
    var old = document.getElementById('wos-login'); if (old) old.remove();
    if (!document.getElementById('wos-login-css')) document.head.appendChild(el('style', { id: 'wos-login-css', text: css }));
    var err = el('div', { class: 'err', role: 'alert', id: 'login-error' });
    var form, email, pass, btn;
    if (kind === 'config') {
      form = el('form', {}, [el('h1', { text: 'Setup needed' }), el('p', { text: note || 'Add your Supabase Project URL and anon key to config.js, then reload.' })]);
    } else if (kind === 'newpass') {
      pass = el('input', { type: 'password', id: 'login-newpass', autocomplete: 'new-password', required: 'required', minlength: '8' });
      btn = el('button', { type: 'submit', text: 'Set new password' });
      form = el('form', {}, [el('h1', { text: 'Choose a new password' }), el('label', {}, [document.createTextNode('New password (8+ characters)'), pass]), err, btn]);
      form.onsubmit = function (e) { e.preventDefault(); btn.disabled = true; sb.auth.updateUser({ password: pass.value }).then(function (r) { btn.disabled = false; if (r.error) { err.textContent = r.error.message; return; } location.replace(location.pathname); }); };
    } else {
      email = el('input', { type: 'email', id: 'login-email', autocomplete: 'username', required: 'required' });
      pass = el('input', { type: 'password', id: 'login-password', autocomplete: 'current-password', required: 'required' });
      btn = el('button', { type: 'submit', id: 'login-submit', text: 'Sign in' });
      var forgot = el('button', { type: 'button', class: 'link', id: 'login-forgot', text: 'Forgot password?' });
      form = el('form', {}, [el('h1', { text: 'Personal Work OS' }), el('p', { text: note || 'Sign in to open your workspace.' }),
        el('label', {}, [document.createTextNode('Email'), email]), el('label', {}, [document.createTextNode('Password'), pass]), err, btn, forgot]);
      form.onsubmit = function (e) {
        e.preventDefault(); btn.disabled = true; err.textContent = '';
        sb.auth.signInWithPassword({ email: email.value.trim(), password: pass.value }).then(function (r) {
          btn.disabled = false;
          if (r.error) { err.textContent = r.error.message === 'Invalid login credentials' ? 'Email or password is not right.' : r.error.message; return; }
          start(r.data.user);
        }, function () { btn.disabled = false; err.textContent = 'Could not reach the server. Check your connection and try again.'; });
      };
      forgot.onclick = function () {
        if (!email.value.trim()) { err.textContent = 'Type your email first, then click “Forgot password?”.'; return; }
        sb.auth.resetPasswordForEmail(email.value.trim(), { redirectTo: location.origin + location.pathname }).then(function (r) {
          err.className = r.error ? 'err' : 'ok'; err.textContent = r.error ? r.error.message : 'If that email has an account, a reset link is on its way.';
        });
      };
    }
    var wrap = el('div', { id: 'wos-login' }, [form]);
    (document.body || document.documentElement).appendChild(wrap);
    var first = wrap.querySelector('input'); if (first) setTimeout(function () { first.focus(); }, 0);
  }
  function start(u) { if (user) return; user = u; var s = document.getElementById('wos-login'); if (s) s.remove(); resolveUser(u); }

  /* ---------- storage: the collection interface the app expects ---------- */
  function mapErr(e) {
    var msg = (e && (e.message || e.error_description)) || String(e);
    var st = e && (e.status || e.code);
    if (/fetch|network|Failed to|timeout/i.test(msg) || st === 0 || (typeof st === 'number' && st >= 500)) return { code: 'unavailable', message: msg };
    if (st === 401 || st === 403 || st === '42501' || /JWT|row-level security|permission/i.test(msg)) return { code: 'permission_denied', message: msg };
    if (st === 413 || /too large|payload/i.test(msg)) return { code: 'resource_exhausted', message: msg };
    return { code: 'invalid_argument', message: msg };
  }
  function makeCollection() {
    var rows = new Map(), subs = [], started = false, timer = null, channel = null;
    function snapshot() { var docs = []; rows.forEach(function (data, id) { docs.push({ id: id, exists: true, data: function () { return data; } }); }); return { docs: docs }; }
    function emit(now) { clearTimeout(timer); var go = function () { var s = snapshot(); subs.forEach(function (x) { x.cb(s); }); }; if (now) go(); else timer = setTimeout(go, 30); }
    function fail(e) { subs.forEach(function (x) { if (x.err) x.err(mapErr(e)); }); }
    async function loadAll() {
      var fresh = new Map(), from = 0, size = 1000;
      for (;;) {
        var r = await sb.from('records').select('id,data').order('id').range(from, from + size - 1);
        if (r.error) throw r.error;
        r.data.forEach(function (x) { fresh.set(x.id, x.data); });
        if (r.data.length < size) break; from += size;
      }
      rows = fresh;
    }
    function subscribe() {
      var joined = false;
      channel = sb.channel('records-' + user.id)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'records', filter: 'user_id=eq.' + user.id }, function (p) {
          if (p.eventType === 'DELETE') { if (p.old && p.old.id) rows.delete(p.old.id); } else if (p.new && p.new.id) rows.set(p.new.id, p.new.data);
          emit();
        })
        .subscribe(function (status) {
          // after a reconnect, reload everything so changes made while offline on other devices are not missed
          if (status === 'SUBSCRIBED') { if (joined) loadAll().then(function () { emit(); }, function () { }); joined = true; }
        });
    }
    return {
      onSnapshot: function (cb, err) {
        subs.push({ cb: cb, err: err });
        if (!started) { started = true; loadAll().then(function () { emit(true); subscribe(); }, fail); }
        else setTimeout(function () { cb(snapshot()); }, 0);
        return function () { subs = subs.filter(function (x) { return x.cb !== cb; }); };
      },
      doc: function (id) {
        return {
          set: async function (data) {
            var r = await sb.from('records').upsert({ user_id: user.id, id: id, data: data, updated_at: new Date().toISOString() }, { onConflict: 'user_id,id' });
            if (r.error) throw mapErr(r.error);
            rows.set(id, data); emit();
          },
          delete: async function () {
            var r = await sb.from('records').delete().eq('user_id', user.id).eq('id', id);
            if (r.error) throw mapErr(r.error);
            rows.delete(id); emit();
          }
        };
      }
    };
  }
  var collection = null;
  var db = { doc: function () { return { collection: function () { return collection || (collection = makeCollection()); } }; } };
  var downloads = {
    save: async function (o) {
      var blob = o.data instanceof Blob ? o.data : new Blob([o.data], { type: /\.json$/i.test(o.filename) ? 'application/json' : 'text/plain' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = o.filename || 'download';
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    }
  };

  /* ---------- boot ---------- */
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || /YOUR-/.test(cfg.supabaseUrl + cfg.supabaseAnonKey)) { window.addEventListener('DOMContentLoaded', function () { showScreen('config'); }); return; }
  if (!window.supabase || !window.supabase.createClient) { window.addEventListener('DOMContentLoaded', function () { showScreen('config', 'The Supabase library did not load. Check your connection and reload.'); }); return; }
  sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  window.WOS_HOST = {
    kind: 'supabase',
    email: function () { return user ? user.email : ''; },
    signOut: function () { return sb.auth.signOut().then(function () { location.reload(); }, function () { location.reload(); }); }
  };
  window.claude = {
    use: async function (name) {
      var u = await ready;
      if (name === 'user') return { id: async function () { return u.id; }, isOwner: function () { return true; }, canEdit: function () { return true; } };
      if (name === 'db') return db;
      if (name === 'downloads') return downloads;
      return null; // image uploads are not set up on the web version yet
    }
  };
  var recovering = /type=recovery/.test(location.hash);
  sb.auth.onAuthStateChange(function (ev, session) {
    if (ev === 'PASSWORD_RECOVERY') { recovering = true; showScreen('newpass'); return; }
    if (ev === 'SIGNED_OUT' && user) location.reload();
  });
  window.addEventListener('DOMContentLoaded', function () {
    sb.auth.getSession().then(function (r) {
      var s = r.data && r.data.session;
      if (recovering) { showScreen('newpass'); return; }
      if (s && s.user) start(s.user); else showScreen('login');
    }, function () { showScreen('login', 'Could not check your sign-in. Check your connection.'); });
  });
})();
