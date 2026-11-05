# Personal Work OS: web version (Netlify + Supabase)

The same app as the claude.ai artifact. The only difference: data is saved to **your own Supabase database**, with a login, and syncs live across devices.

## One-time setup (about 10 minutes)

1. **Supabase**: create a free project at supabase.com.
2. **SQL Editor** → New query → paste `supabase/setup.sql` → Run.
3. **Authentication → Users → Add user → Create new user**: your email and a strong password, with "Auto confirm user" ticked.
   Then go to **Authentication → Sign In / Providers** and turn **off** "Allow new users to sign up", so nobody else can create an account.
4. **Project Settings → API**: copy the **Project URL** and the **anon / publishable** key into `site/config.js`.
   Never use the `service_role` / secret key or your database password here.
5. **Netlify**: "Add new site → Import an existing project" from your GitHub repo. No build command is needed; the publish folder is `site` (already set in `netlify.toml`).
   Without GitHub: drag the `site` folder onto app.netlify.com/drop.
6. **Supabase → Authentication → URL Configuration**: set **Site URL** to your Netlify address. Password-reset emails link there.
7. **Moving your data from claude.ai**:
   - In the claude.ai app: Settings → **Download JSON**.
   - On the Netlify site: Settings → paste or choose the file → **Check** → **Merge**.

## Getting new features later

New features are built in `src/`, then:

```
python3 build.py        # builds work-os.html (the claude.ai version)
python3 build_web.py    # builds site/ (the Netlify version; keeps your site/config.js)
node test/web.js        # web-version tests (needs playwright-core + Chromium)
git commit -am "…" && git push   # Netlify deploys automatically
```

Your data lives in Supabase, so a new deploy never touches it.

## Notes

- The anon key is designed to be public. Row-level security means each account can only read and write its own rows.
- Image uploads inside notes are not available on the web version yet. Everything else works the same.
- `test/fake-supabase.js` is a stand-in used only by the tests. It is never deployed.
