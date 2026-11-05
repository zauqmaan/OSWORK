import sys
src='src/'
head=open(src+'head.html').read(); css=open(src+'style.css').read()+open(src+'editor.css').read()
editor=open('editor/dist/wos-editor.js').read().replace('</script','<\\/script')
js='\n'.join(open(src+f).read() for f in ['core.js','ui.js','views.js','studio.js','app.js'])
out=f"""{head}<style>
{css}</style>
<div id="app"><div class="boot">Loading Personal Work OS…</div></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/htm@3.1.1/dist/htm.umd.js"></script>
<script>
{editor}
</script>
<script>
{js}
</script>
"""
open('work-os.html','w').write(out)
print(len(out))
