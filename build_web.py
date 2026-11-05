#!/usr/bin/env python3
"""Builds the web (Netlify) version into site/ from the same work-os.html the claude.ai artifact uses.

The only differences from the artifact: libraries are served from site/vendor (no outside CDNs), and three scripts load
before the app: the Supabase client, config.js (your project URL + anon key) and host.js (login + storage adapter).
Run `python3 build.py && python3 build_web.py`.
"""
import os, re, shutil, sys
ROOT = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.join(ROOT, 'site')
src = open(os.path.join(ROOT, 'work-os.html'), encoding='utf8').read()
VENDOR = {
    'https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js': ('node_modules/react/umd/react.production.min.js', 'react.production.min.js'),
    'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js': ('node_modules/react-dom/umd/react-dom.production.min.js', 'react-dom.production.min.js'),
    'https://cdn.jsdelivr.net/npm/htm@3.1.1/dist/htm.umd.js': ('node_modules/htm/dist/htm.umd.js', 'htm.umd.js'),
}
os.makedirs(os.path.join(SITE, 'vendor'), exist_ok=True)
for url, (path, name) in VENDOR.items():
    if url not in src: sys.exit('expected script not found in work-os.html: ' + url)
    src = src.replace(url, 'vendor/' + name)
    shutil.copyfile(os.path.join(ROOT, path), os.path.join(SITE, 'vendor', name))
for name in os.listdir(os.path.join(ROOT, 'web', 'vendor')):
    shutil.copyfile(os.path.join(ROOT, 'web', 'vendor', name), os.path.join(SITE, 'vendor', name))
left = re.findall(r'<script src="https?://[^"]+"', src)
if left: sys.exit('external scripts left: ' + ', '.join(left))
host = '<script src="vendor/supabase.js"></script><script src="config.js"></script><script src="host.js"></script>\n'
i = src.index('<script')
src = src[:i] + host + src[i:]
# claude.ai wraps the artifact in a document skeleton when publishing; the web build adds the same kind of wrapper.
src = ('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
       '<meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"></head><body>\n' + src + '\n</body></html>\n')
open(os.path.join(SITE, 'index.html'), 'w', encoding='utf8').write(src)
shutil.copyfile(os.path.join(ROOT, 'web', 'host.js'), os.path.join(SITE, 'host.js'))
cfg = os.path.join(SITE, 'config.js')
if not os.path.exists(cfg): shutil.copyfile(os.path.join(ROOT, 'web', 'config.js'), cfg)  # keeps your keys once set
print('site/ built:', ', '.join(sorted(os.listdir(SITE))))
