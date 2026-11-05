/* Personal Work OS block editor: Tiptap (ProseMirror) with slash commands, tables, toggles, callouts,
   code blocks, page links, checklist→task conversion, block moves, read/edit modes. Exposes window.WosEditor. */
import { Editor, Node, Extension, mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TaskList, TaskItem } from '@tiptap/extension-list';
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table';
import { TextStyle, Color, FontSize } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import { Details, DetailsSummary, DetailsContent } from '@tiptap/extension-details';
import UniqueID from '@tiptap/extension-unique-id';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Image from '@tiptap/extension-image';
import { Placeholder } from '@tiptap/extensions';
import Suggestion from '@tiptap/suggestion';
import { PluginKey, TextSelection } from '@tiptap/pm/state';
import { createLowlight } from 'lowlight';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import json from 'highlight.js/lib/languages/json';
import sql from 'highlight.js/lib/languages/sql';
import php from 'highlight.js/lib/languages/php';
import python from 'highlight.js/lib/languages/python';
import bash from 'highlight.js/lib/languages/bash';
import markdown from 'highlight.js/lib/languages/markdown';
import yaml from 'highlight.js/lib/languages/yaml';

const lowlight = createLowlight();
lowlight.register({ javascript, typescript, html: xml, xml, css, json, sql, php, python, bash, markdown, yaml });
const LANGS = [['', 'Plain text'], ['javascript', 'JavaScript'], ['typescript', 'TypeScript'], ['html', 'HTML'], ['css', 'CSS'], ['json', 'JSON'], ['sql', 'SQL'], ['php', 'PHP'], ['python', 'Python'], ['bash', 'Bash'], ['markdown', 'Markdown'], ['yaml', 'YAML']];

let hooks = {};
const H = name => (hooks[name] || (() => null));
const shortId = () => Math.random().toString(36).slice(2, 10);

/* ---------- popup plumbing (menus live on document.body, above modals) ---------- */
let openPops = 0;
const setPopFlag = () => { window.__wosPopupOpen = openPops > 0; };
function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
  }
  kids.flat().forEach(k => k != null && e.append(k.nodeType ? k : document.createTextNode(k)));
  return e;
}
function placePopup(pop, rect) {
  const vw = window.innerWidth, vh = window.innerHeight;
  pop.style.left = '0px'; pop.style.top = '0px';
  const pw = pop.offsetWidth, ph = pop.offsetHeight;
  let left = Math.min(Math.max(8, rect.left), vw - pw - 8);
  let top = rect.bottom + 6;
  if (top + ph > vh - 8) top = Math.max(8, rect.top - ph - 6);
  pop.style.left = left + 'px'; pop.style.top = top + 'px';
}
function openPopup(rect, build, { onClose, cls = '' } = {}) {
  const pop = el('div', { class: 'wos-pop ' + cls, role: 'dialog' });
  document.body.append(pop); openPops++; setPopFlag();
  let closed = false;
  const close = () => {
    if (closed) return; closed = true; pop.remove(); openPops--; setTimeout(setPopFlag, 0);
    document.removeEventListener('mousedown', outside, true); document.removeEventListener('keydown', esc, true); onClose && onClose();
  };
  const outside = e => { if (!pop.contains(e.target)) close(); };
  const esc = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } };
  build(pop, close);
  placePopup(pop, rect);
  setTimeout(() => { document.addEventListener('mousedown', outside, true); document.addEventListener('keydown', esc, true); }, 0);
  return { pop, close, reposition: r => placePopup(pop, r) };
}
function caretRect(editor) {
  try { const c = editor.view.coordsAtPos(editor.state.selection.from); return { left: c.left, right: c.right, top: c.top, bottom: c.bottom }; }
  catch (e) { return editor.view.dom.getBoundingClientRect(); }
}
/** A small form popup: fields [{name,label,value,placeholder}] → onSubmit(values). */
function formPopup(rect, title, fields, submitLabel, onSubmit) {
  return openPopup(rect, (pop, close) => {
    const inputs = {};
    const form = el('form', { class: 'wos-form', onsubmit: e => { e.preventDefault(); const v = {}; for (const k in inputs) v[k] = inputs[k].value; close(); onSubmit(v); } },
      el('div', { class: 'wos-form-t', text: title }),
      ...fields.map(f => { const i = el('input', { class: 'wos-in', name: f.name, value: f.value || '', placeholder: f.placeholder || '', 'aria-label': f.label }); inputs[f.name] = i; return el('label', { class: 'wos-field' }, el('span', { text: f.label }), i); }),
      el('div', { class: 'wos-form-ft' }, el('button', { type: 'button', class: 'wos-btn ghost', onclick: () => close(), text: 'Cancel' }), el('button', { type: 'submit', class: 'wos-btn', text: submitLabel })));
    pop.append(form);
    setTimeout(() => { const first = form.querySelector('input'); first && first.focus(); }, 10);
  });
}

/* ---------- custom nodes ---------- */
const Callout = Node.create({
  name: 'callout', group: 'block', content: 'block+', defining: true,
  addAttributes() { return { emoji: { default: '💡', parseHTML: e => e.getAttribute('data-emoji') || '💡', renderHTML: a => ({ 'data-emoji': a.emoji }) } }; },
  parseHTML() { return [{ tag: 'div[data-type="callout"]' }]; },
  renderHTML({ HTMLAttributes }) { return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'callout', class: 'callout' }), 0]; },
  addNodeView() {
    return ({ node, getPos, editor }) => {
      const dom = el('div', { class: 'callout', 'data-type': 'callout' });
      const icon = el('button', { type: 'button', class: 'callout-ico', contenteditable: 'false', title: 'Change icon', text: node.attrs.emoji });
      const EMO = ['💡', 'ℹ️', '⚠️', '✅', '❗', '📌', '🔥', '🧪', '📝', '🚀'];
      icon.addEventListener('mousedown', e => e.preventDefault());
      icon.addEventListener('click', () => {
        if (!editor.isEditable) return;
        openPopup(icon.getBoundingClientRect(), (pop, close) => {
          pop.append(el('div', { class: 'wos-emoji' }, EMO.map(em => el('button', { type: 'button', text: em, onclick: () => { const p = getPos(); if (typeof p === 'number') editor.view.dispatch(editor.state.tr.setNodeMarkup(p, undefined, { ...editor.state.doc.nodeAt(p).attrs, emoji: em })); close(); } }))));
        });
      });
      const content = el('div', { class: 'callout-body' });
      dom.append(icon, content);
      return { dom, contentDOM: content, update: n => { if (n.type.name !== 'callout') return false; icon.textContent = n.attrs.emoji; return true; }, ignoreMutation: m => icon.contains(m.target) };
    };
  }
});

const PageLink = Node.create({
  name: 'pageLink', group: 'inline', inline: true, atom: true, selectable: true,
  addAttributes() { return { id: { default: null, parseHTML: e => e.getAttribute('data-page-id'), renderHTML: a => ({ 'data-page-id': a.id }) }, title: { default: '', parseHTML: e => e.getAttribute('data-title') || e.textContent, renderHTML: a => ({ 'data-title': a.title }) } }; },
  parseHTML() { return [{ tag: 'span[data-page-id]' }]; },
  renderHTML({ HTMLAttributes, node }) { return ['span', mergeAttributes(HTMLAttributes, { class: 'page-link' }), node.attrs.title || 'Page']; },
  renderText({ node }) { const r = H('resolvePage')(node.attrs.id); return r ? r.title : (node.attrs.title || ''); },
  addNodeView() {
    return ({ node }) => {
      const dom = el('span', { class: 'page-link', 'data-page-id': node.attrs.id, contenteditable: 'false', role: 'link', tabindex: '0' });
      const paint = n => {
        const r = H('resolvePage')(n.attrs.id);
        dom.classList.toggle('broken', !r);
        dom.textContent = r ? (r.icon || '📄') + ' ' + r.title : '⚠ Missing page' + (n.attrs.title ? ` (“${n.attrs.title}”)` : '');
        dom.title = r ? `Open ${r.typeLabel || 'record'}: ${r.title}` : 'The linked record was deleted';
      };
      paint(node);
      const open = e => { e.preventDefault(); e.stopPropagation(); if (H('resolvePage')(node.attrs.id)) H('openPage')(node.attrs.id); };
      dom.addEventListener('click', open); dom.addEventListener('keydown', e => { if (e.key === 'Enter') open(e); });
      dom._wosPaint = () => paint(node);
      return { dom, update: n => { if (n.type.name !== 'pageLink') return false; node = n; dom.setAttribute('data-page-id', n.attrs.id); paint(n); return true; } };
    };
  }
});

const TaskItemX = TaskItem.extend({
  addAttributes() {
    return { ...this.parent(), taskId: { default: null, keepOnSplit: false, parseHTML: e => e.getAttribute('data-task-id'), renderHTML: a => (a.taskId ? { 'data-task-id': a.taskId } : {}) } };
  },
  addNodeView() {
    const parent = this.parent();
    return props => {
      const v = parent(props);
      const mark = n => { if (n.attrs.taskId) v.dom.setAttribute('data-task-id', n.attrs.taskId); else v.dom.removeAttribute('data-task-id'); };
      mark(props.node);
      const up = v.update;
      v.update = n => { const r = up(n); if (r) mark(n); return r; };
      return v;
    };
  }
});

const DetailsX = Details.extend({
  addAttributes() { return { ...this.parent(), level: { default: 0, parseHTML: e => Number(e.getAttribute('data-level')) || 0, renderHTML: a => ({ 'data-level': a.level || 0 }) } }; },
  addNodeView() {
    const parent = this.parent();
    return props => { const v = parent(props); const up = v.update; v.update = n => { const r = up(n); if (r) v.dom.setAttribute('data-level', n.attrs.level || 0); return r; }; return v; };
  }
});

const CodeBlockX = CodeBlockLowlight.extend({
  addNodeView() {
    return ({ node, getPos, editor }) => {
      const dom = el('div', { class: 'code-wrap' });
      const sel = el('select', { class: 'code-lang', 'aria-label': 'Code language' }, LANGS.map(([v, l]) => el('option', { value: v, text: l })));
      sel.value = node.attrs.language || '';
      sel.addEventListener('change', () => { const p = getPos(); if (typeof p === 'number') editor.view.dispatch(editor.state.tr.setNodeMarkup(p, undefined, { ...editor.state.doc.nodeAt(p).attrs, language: sel.value || null })); });
      const copy = el('button', { type: 'button', class: 'code-copy', text: 'Copy' });
      copy.addEventListener('mousedown', e => e.preventDefault());
      copy.addEventListener('click', async () => {
        const text = node.textContent; let ok = false;
        try { await navigator.clipboard.writeText(text); ok = true; } catch (e) {
          try { const ta = el('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.append(ta); ta.select(); ok = document.execCommand('copy'); ta.remove(); } catch (e2) { }
        }
        window.__wosLastCopy = text;
        copy.textContent = ok ? 'Copied' : 'Copy blocked'; setTimeout(() => { copy.textContent = 'Copy'; }, 1400);
      });
      const head = el('div', { class: 'code-head', contenteditable: 'false' }, sel, copy);
      const pre = el('pre'); const code = el('code', { class: 'hljs' + (node.attrs.language ? ' language-' + node.attrs.language : '') });
      pre.append(code); dom.append(head, pre);
      return {
        dom, contentDOM: code,
        update: n => { if (n.type.name !== 'codeBlock') return false; node = n; sel.value = n.attrs.language || ''; code.className = 'hljs' + (n.attrs.language ? ' language-' + n.attrs.language : ''); return true; },
        ignoreMutation: m => head.contains(m.target),
        stopEvent: e => head.contains(e.target)
      };
    };
  }
});

/* ---------- block helpers ---------- */
const MOVABLE_PARENTS = new Set(['doc', 'bulletList', 'orderedList', 'taskList', 'detailsContent', 'callout', 'blockquote']);
function findMovable($pos) {
  for (let d = $pos.depth; d > 0; d--) {
    const parent = $pos.node(d - 1);
    if (MOVABLE_PARENTS.has(parent.type.name)) return { depth: d, node: $pos.node(d), pos: $pos.before(d), parent, index: $pos.index(d - 1) };
  }
  if ($pos.depth === 0 && $pos.nodeAfter) return { depth: 1, node: $pos.nodeAfter, pos: $pos.pos, parent: $pos.parent, index: $pos.index(0) };
  return null;
}
function moveBlock(editor, dir, at) {
  const { state, view } = editor; const $pos = at != null ? state.doc.resolve(Math.min(at + 1, state.doc.content.size)) : state.selection.$from;
  const m = findMovable($pos); if (!m) return false;
  const t = m.index + dir; if (t < 0 || t >= m.parent.childCount) return false;
  const sib = m.parent.child(t); const node = m.node;
  const start = dir < 0 ? m.pos - sib.nodeSize : m.pos;
  const end = dir < 0 ? m.pos + node.nodeSize : m.pos + node.nodeSize + sib.nodeSize;
  const tr = state.tr.replaceWith(start, end, dir < 0 ? [node, sib] : [sib, node]);
  const np = dir < 0 ? start : start + sib.nodeSize;
  try { tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(np + 1, tr.doc.content.size)))); } catch (e) { }
  view.dispatch(tr.scrollIntoView()); view.focus(); return true;
}
function blockAt(editor, at) { const $p = editor.state.doc.resolve(Math.min(at + 1, editor.state.doc.content.size)); return findMovable($p); }

/* ---------- slash commands ---------- */
const COMMANDS = [
  { key: 'text', title: 'Text', desc: 'Plain paragraph', icon: '¶', aliases: ['paragraph', 'p', 'plain'], run: c => c.clearNodes().setParagraph() },
  { key: 'h1', title: 'Heading 1', desc: 'Large section heading', icon: 'H1', aliases: ['heading1', 'title', 'heading'], run: c => c.clearNodes().setHeading({ level: 1 }) },
  { key: 'h2', title: 'Heading 2', desc: 'Medium section heading', icon: 'H2', aliases: ['heading2', 'subtitle', 'heading'], run: c => c.clearNodes().setHeading({ level: 2 }) },
  { key: 'h3', title: 'Heading 3', desc: 'Small section heading', icon: 'H3', aliases: ['heading3', 'heading'], run: c => c.clearNodes().setHeading({ level: 3 }) },
  { key: 'bullet', title: 'Bulleted list', desc: 'Simple bulleted list', icon: '•', aliases: ['ul', 'list', 'bulleted', 'unordered'], run: c => c.clearNodes().toggleBulletList() },
  { key: 'numbered', title: 'Numbered list', desc: 'List with numbering', icon: '1.', aliases: ['ol', 'ordered', 'number'], run: c => c.clearNodes().toggleOrderedList() },
  { key: 'todo', title: 'To-do list', desc: 'Checkbox items you can tick', icon: '☑', aliases: ['task', 'checkbox', 'checklist', 'check'], run: c => c.clearNodes().toggleTaskList() },
  { key: 'toggle', title: 'Toggle list', desc: 'Collapsible section', icon: '▸', aliases: ['details', 'collapse', 'expand'], run: c => c.clearNodes().setDetails().updateAttributes('details', { level: 0, open: true }) },
  { key: 'toggle1', title: 'Toggle heading 1', desc: 'Collapsible large heading', icon: '▸1', aliases: ['heading', 'th1', 'toggle h1'], run: c => c.clearNodes().setDetails().updateAttributes('details', { level: 1, open: true }) },
  { key: 'toggle2', title: 'Toggle heading 2', desc: 'Collapsible medium heading', icon: '▸2', aliases: ['heading', 'th2', 'toggle h2'], run: c => c.clearNodes().setDetails().updateAttributes('details', { level: 2, open: true }) },
  { key: 'toggle3', title: 'Toggle heading 3', desc: 'Collapsible small heading', icon: '▸3', aliases: ['heading', 'th3', 'toggle h3'], run: c => c.clearNodes().setDetails().updateAttributes('details', { level: 3, open: true }) },
  { key: 'quote', title: 'Quote', desc: 'Block quotation', icon: '❝', aliases: ['blockquote', 'citation'], run: c => c.clearNodes().setBlockquote() },
  { key: 'divider', title: 'Divider', desc: 'Horizontal line between sections', icon: '—', aliases: ['hr', 'line', 'separator', 'rule'], run: c => c.setHorizontalRule() },
  { key: 'callout', title: 'Callout', desc: 'Highlighted info box', icon: '💡', aliases: ['note', 'info', 'tip', 'warning', 'box'], run: c => c.clearNodes().wrapIn('callout') },
  { key: 'table', title: 'Table', desc: 'Editable table, 3 × 3 with header', icon: '▦', aliases: ['grid', 'spreadsheet', 'columns'], run: c => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }) },
  { key: 'code', title: 'Code', desc: 'Code block with syntax highlighting', icon: '</>', aliases: ['snippet', 'codeblock', 'pre'], run: c => c.clearNodes().setCodeBlock() },
  { key: 'link', title: 'Link', desc: 'Insert a web link', icon: '🔗', aliases: ['url', 'hyperlink', 'href'], special: 'link' },
  { key: 'page', title: 'Link to page', desc: 'Link a note, topic, project or task', icon: '📄', aliases: ['mention', 'note', 'topic', 'project', 'reference', '@'], special: 'page' },
  { key: 'image', title: 'Image', desc: 'Upload an image', icon: '🖼', aliases: ['picture', 'img', 'photo'], special: 'image' }
];
function filterCommands(q) {
  q = (q || '').toLowerCase().trim();
  if (!q) return COMMANDS;
  const score = c => {
    if (c.key === q) return 0; if (c.key.startsWith(q)) return 1; if (c.title.toLowerCase().startsWith(q)) return 2;
    if (c.aliases.some(a => a.startsWith(q))) return 3; if (c.title.toLowerCase().includes(q)) return 4; if (c.aliases.some(a => a.includes(q))) return 5; return 99;
  };
  return COMMANDS.map(c => [c, score(c)]).filter(x => x[1] < 99).sort((a, b) => a[1] - b[1]).map(x => x[0]);
}
function runSpecial(editor, cmd, ctx) {
  const rect = caretRect(editor);
  if (cmd.special === 'link') {
    const sel = editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to);
    formPopup(rect, 'Insert link', [{ name: 'url', label: 'URL', placeholder: 'https://' }, { name: 'text', label: 'Text (optional)', value: sel }], 'Insert', v => {
      let url = (v.url || '').trim(); if (!url) return; if (!/^[a-z]+:/i.test(url)) url = 'https://' + url;
      if (!/^(https?:|mailto:)/i.test(url)) { H('toast')('Only http, https and mailto links are allowed.', 'bad'); return; }
      const text = (v.text || '').trim() || url;
      editor.chain().focus().insertContent([{ type: 'text', text, marks: [{ type: 'link', attrs: { href: url } }] }, { type: 'text', text: ' ' }]).run();
    });
  } else if (cmd.special === 'page') pagePicker(editor, rect, ctx);
  else if (cmd.special === 'image') {
    const inp = el('input', { type: 'file', accept: 'image/*' }); inp.style.display = 'none'; document.body.append(inp);
    inp.addEventListener('change', async () => { const f = inp.files && inp.files[0]; inp.remove(); if (f) await insertImage(editor, f); });
    inp.click();
  }
}
async function insertImage(editor, file) {
  const up = hooks.uploadImage;
  if (!up) { H('toast')('Image storage is not available in this view.', 'bad'); return false; }
  try { const url = await up(file); if (!url) return false; editor.chain().focus().setImage({ src: url, alt: file.name || '' }).run(); return true; }
  catch (e) { H('toast')('Image not added: ' + ((e && (e.message || e.code)) || 'upload failed'), 'bad'); return false; }
}
function pagePicker(editor, rect, ctx) {
  const at = editor.state.selection.from;
  openPopup(rect, (pop, close) => {
    const inp = el('input', { class: 'wos-in', placeholder: 'Search notes, topics, projects, tasks…', 'aria-label': 'Search pages' });
    const list = el('div', { class: 'wos-list', role: 'listbox' });
    let items = [], cur = 0;
    const insert = (id, title) => { close(); editor.chain().focus().setTextSelection(at).insertContent([{ type: 'pageLink', attrs: { id, title } }, { type: 'text', text: ' ' }]).run(); };
    const render = () => {
      const q = inp.value.trim();
      items = (H('searchPages')(q, ctx && ctx.ownerId) || []).slice(0, 8).map(r => ({ ...r, kind: 'existing' }));
      if (q && hooks.createPage && !items.some(i => i.title.toLowerCase() === q.toLowerCase())) items.push({ kind: 'new', title: q });
      cur = Math.min(cur, Math.max(0, items.length - 1));
      list.replaceChildren(...(items.length ? items.map((it, i) => el('div', { class: 'wos-item' + (i === cur ? ' on' : ''), role: 'option', onmousedown: e => e.preventDefault(), onclick: () => choose(i) },
        el('span', { class: 'wos-ico', text: it.kind === 'new' ? '+' : (it.icon || '📄') }),
        el('span', { class: 'wos-txt' }, el('b', { text: it.kind === 'new' ? `Create note “${it.title}”` : it.title }), el('small', { text: it.kind === 'new' ? 'New note in the Inbox, linked here' : (it.typeLabel || '') }))))
        : [el('div', { class: 'wos-empty', text: q ? 'No matches' : 'Type to search' })]));
    };
    const choose = async i => {
      const it = items[i]; if (!it) return;
      if (it.kind === 'existing') return insert(it.id, it.title);
      const id = await hooks.createPage(it.title); if (id) insert(id, it.title);
    };
    inp.addEventListener('input', () => { cur = 0; render(); });
    inp.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); cur = Math.min(cur + 1, items.length - 1); render(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); cur = Math.max(cur - 1, 0); render(); }
      else if (e.key === 'Enter') { e.preventDefault(); choose(cur); }
    });
    pop.append(el('div', { class: 'wos-form-t', text: 'Link to page' }), inp, list); render();
    setTimeout(() => inp.focus(), 10);
  }, { cls: 'wos-picker' });
}
function slashExtension(ctx) {
  return Extension.create({
    name: 'slashCommands',
    addProseMirrorPlugins() {
      const editor = this.editor;
      return [Suggestion({
        editor, char: '/', pluginKey: new PluginKey('slash' + shortId()), allowSpaces: false, startOfLine: false, allowedPrefixes: [' '],
        allow: ({ state, range }) => { const $f = state.doc.resolve(range.from); return !$f.parent.type.spec.code && $f.parent.type.name !== 'codeBlock'; },
        items: ({ query }) => filterCommands(query),
        command: ({ editor, range, props }) => {
          editor.chain().focus().deleteRange(range).run();
          if (props.special) return runSpecial(editor, props, ctx);
          props.run(editor.chain().focus()).run();
        },
        render: () => {
          let pop = null, items = [], cur = 0, cmd = null;
          const paint = () => {
            if (!pop) return;
            pop.pop.replaceChildren(items.length ? el('div', { class: 'wos-list', role: 'listbox', 'aria-label': 'Blocks' }, items.map((it, i) => el('div', {
              class: 'wos-item' + (i === cur ? ' on' : ''), role: 'option', 'aria-selected': i === cur ? 'true' : 'false', 'data-cmd': it.key,
              onmousedown: e => e.preventDefault(), onclick: () => cmd && cmd(it)
            }, el('span', { class: 'wos-ico', text: it.icon }), el('span', { class: 'wos-txt' }, el('b', { text: it.title }), el('small', { text: it.desc }))))) : el('div', { class: 'wos-empty', text: 'No matching blocks' }));
            const on = pop.pop.querySelector('.on'); on && on.scrollIntoView({ block: 'nearest' });
          };
          return {
            onStart: p => { items = p.items; cur = 0; cmd = p.command; pop = openPopup(p.clientRect ? p.clientRect() : caretRect(p.editor), () => {}, { cls: 'wos-slash', onClose: () => { pop = null; } }); paint(); pop.reposition(p.clientRect()); },
            onUpdate: p => { items = p.items; cur = 0; cmd = p.command; if (!pop) return; paint(); p.clientRect && pop.reposition(p.clientRect()); },
            onKeyDown: ({ event }) => {
              if (!pop) return false;
              if (event.key === 'ArrowDown') { cur = (cur + 1) % Math.max(items.length, 1); paint(); return true; }
              if (event.key === 'ArrowUp') { cur = (cur - 1 + items.length) % Math.max(items.length, 1); paint(); return true; }
              if (event.key === 'Enter' || event.key === 'Tab') { if (items[cur]) { cmd(items[cur]); return true; } return false; }
              if (event.key === 'Escape') { pop.close(); return true; }
              return false;
            },
            onExit: () => { if (pop) pop.close(); pop = null; }
          };
        }
      })];
    }
  });
}

/* ---------- keyboard extras ---------- */
const Keys = Extension.create({
  name: 'wosKeys',
  addKeyboardShortcuts() {
    return {
      'Alt-Shift-ArrowUp': () => moveBlock(this.editor, -1),
      'Alt-Shift-ArrowDown': () => moveBlock(this.editor, 1),
      Tab: () => { if (this.editor.isActive('codeBlock')) return this.editor.commands.insertContent('  '); return false; }
    };
  }
});

/* ---------- conversions ---------- */
function textToDoc(text) {
  const lines = String(text || '').split('\n');
  return { type: 'doc', content: lines.map(l => (l ? { type: 'paragraph', content: [{ type: 'text', text: l }] } : { type: 'paragraph' })) };
}
/** Quill delta (legacy content) → editor document. Unknown formats are dropped, text is kept. */
function deltaToDoc(delta) {
  const ops = (delta && Array.isArray(delta.ops)) ? delta.ops : [];
  const lines = []; let runs = [];
  const marksOf = a => {
    if (!a) return undefined; const m = [];
    if (a.bold) m.push({ type: 'bold' }); if (a.italic) m.push({ type: 'italic' }); if (a.underline) m.push({ type: 'underline' }); if (a.strike) m.push({ type: 'strike' }); if (a.code) m.push({ type: 'code' });
    if (a.link && /^(https?:|mailto:)/i.test(a.link)) m.push({ type: 'link', attrs: { href: a.link } });
    if (a.color || a.size) m.push({ type: 'textStyle', attrs: { color: a.color || null, fontSize: a.size || null } });
    if (a.background) m.push({ type: 'highlight', attrs: { color: a.background } });
    return m.length ? m : undefined;
  };
  for (const op of ops) {
    if (typeof op.insert !== 'string') continue;
    const parts = op.insert.split('\n');
    parts.forEach((p, i) => {
      if (p) runs.push({ type: 'text', text: p, ...(marksOf(op.attributes) ? { marks: marksOf(op.attributes) } : {}) });
      if (i < parts.length - 1) { lines.push({ runs, a: op.attributes || {} }); runs = []; }
    });
  }
  if (runs.length) lines.push({ runs, a: {} });
  const out = []; let i = 0;
  const para = l => (l.runs.length ? { type: 'paragraph', content: l.runs } : { type: 'paragraph' });
  const listKind = a => a.list === 'bullet' ? 'bulletList' : a.list === 'ordered' ? 'orderedList' : (a.list === 'checked' || a.list === 'unchecked') ? 'taskList' : null;
  function buildList(indent) {
    const kind = listKind(lines[i].a); const list = { type: kind, content: [] };
    while (i < lines.length && listKind(lines[i].a) && (lines[i].a.indent || 0) >= indent) {
      const l = lines[i]; const lk = listKind(l.a); const li = l.a.indent || 0;
      if (li > indent) { const sub = buildList(li); const last = list.content[list.content.length - 1]; if (last) last.content.push(sub); else list.content.push({ type: kind === 'taskList' ? 'taskItem' : 'listItem', attrs: kind === 'taskList' ? { checked: false } : undefined, content: [{ type: 'paragraph' }, sub] }); continue; }
      if (lk !== kind) break;
      list.content.push(kind === 'taskList' ? { type: 'taskItem', attrs: { checked: l.a.list === 'checked' }, content: [para(l)] } : { type: 'listItem', content: [para(l)] });
      i++;
    }
    return list;
  }
  while (i < lines.length) {
    const l = lines[i]; const a = l.a;
    if (listKind(a)) { out.push(buildList(a.indent || 0)); continue; }
    if (a['code-block']) { const buf = []; const lang = typeof a['code-block'] === 'string' && a['code-block'] !== 'plain' ? a['code-block'] : null; while (i < lines.length && lines[i].a['code-block']) { buf.push(lines[i].runs.map(r => r.text).join('')); i++; } out.push({ type: 'codeBlock', attrs: { language: lang }, content: buf.join('\n') ? [{ type: 'text', text: buf.join('\n') }] : [] }); continue; }
    if (a.header) out.push({ type: 'heading', attrs: { level: Math.min(3, a.header) }, ...(l.runs.length ? { content: l.runs } : {}) });
    else if (a.blockquote) out.push({ type: 'blockquote', content: [para(l)] });
    else out.push(para(l));
    i++;
  }
  return { type: 'doc', content: out.length ? out : [{ type: 'paragraph' }] };
}
/** Plain text of a document, for search and previews (includes table cells, code and toggle content). */
function docText(doc) {
  const out = [];
  const walk = (n, depth) => {
    if (!n || typeof n !== 'object') return;
    if (n.type === 'text') { out.push(n.text || ''); return; }
    if (n.type === 'hardBreak') { out.push('\n'); return; }
    if (n.type === 'pageLink') { const r = H('resolvePage')(n.attrs && n.attrs.id); out.push((r && r.title) || (n.attrs && n.attrs.title) || ''); return; }
    const kids = Array.isArray(n.content) ? n.content : [];
    kids.forEach(k => walk(k, depth + 1));
    if (n.type === 'tableCell' || n.type === 'tableHeader') out.push('\t');
    else if (n.type !== 'doc' && n.type !== 'text' && !['bold', 'italic'].includes(n.type) && (n.type === 'paragraph' || n.type === 'heading' || n.type === 'codeBlock' || n.type === 'tableRow' || n.type === 'horizontalRule' || n.type === 'image')) out.push('\n');
  };
  walk(doc, 0);
  return out.join('').replace(/\t\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/\n$/, '');
}
function validDoc(d) { return !!(d && typeof d === 'object' && d.type === 'doc' && Array.isArray(d.content)); }

/* ---------- toolbar / context bar ---------- */
const COLORS = [['', 'Default'], ['#6b7280', 'Gray'], ['#b45309', 'Brown'], ['#ea580c', 'Orange'], ['#ca8a04', 'Yellow'], ['#16a34a', 'Green'], ['#2563eb', 'Blue'], ['#7c3aed', 'Purple'], ['#db2777', 'Pink'], ['#dc2626', 'Red']];
const HIGHLIGHTS = [['', 'None'], ['rgba(250,204,21,.35)', 'Yellow'], ['rgba(34,197,94,.28)', 'Green'], ['rgba(59,130,246,.25)', 'Blue'], ['rgba(236,72,153,.25)', 'Pink'], ['rgba(249,115,22,.28)', 'Orange'], ['rgba(148,163,184,.3)', 'Gray'], ['rgba(239,68,68,.25)', 'Red']];
const SIZES = [['', 'Normal'], ['12px', 'Small'], ['18px', 'Medium'], ['22px', 'Large'], ['28px', 'X-large'], ['36px', 'Huge']];
function tbtn(label, title, onClick, cls = '') { const b = el('button', { type: 'button', class: 'tb ' + cls, title, 'aria-label': title, onmousedown: e => e.preventDefault(), onclick: onClick }); b.innerHTML = label; return b; }
const I = {
  bold: '<b>B</b>', italic: '<i>I</i>', underline: '<u>U</u>', strike: '<s>S</s>', code: '<span class="mono">&lt;/&gt;</span>',
  bullet: '<svg viewBox="0 0 16 16"><circle cx="3" cy="4" r="1.3"/><circle cx="3" cy="8" r="1.3"/><circle cx="3" cy="12" r="1.3"/><path d="M6 4h8M6 8h8M6 12h8" stroke="currentColor" stroke-width="1.4" fill="none"/></svg>',
  ordered: '<svg viewBox="0 0 16 16"><text x="0.5" y="6" font-size="5.5" fill="currentColor">1</text><text x="0.5" y="13" font-size="5.5" fill="currentColor">2</text><path d="M6 4h8M6 11h8" stroke="currentColor" stroke-width="1.4" fill="none"/></svg>',
  todo: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="1.5" y="2.5" width="5" height="5" rx="1"/><path d="m2.7 5 1 1 1.8-2"/><rect x="1.5" y="9.5" width="5" height="5" rx="1"/><path d="M9 5h6M9 12h6"/></svg>',
  outdent: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M7 4h8M7 8h8M7 12h8M4 6 2 8l2 2"/></svg>',
  indent: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M7 4h8M7 8h8M7 12h8M2 6l2 2-2 2"/></svg>',
  link: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M7 9a3 3 0 0 0 4 0l2-2a3 3 0 0 0-4-4l-.6.6M9 7a3 3 0 0 0-4 0L3 9a3 3 0 0 0 4 4l.6-.6"/></svg>',
  table: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1.5" y="2.5" width="13" height="11" rx="1"/><path d="M1.5 6.5h13M1.5 10h13M6 2.5v11M10.5 2.5v11"/></svg>',
  undo: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M4 6h6a3 3 0 0 1 0 6H7M6 3.5 3.5 6 6 8.5"/></svg>',
  redo: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M12 6H6a3 3 0 0 0 0 6h3M10 3.5 12.5 6 10 8.5"/></svg>',
  color: '<span class="tb-a">A</span>', hl: '<span class="tb-hl">A</span>', plus: '+'
};
function swatchPopup(anchor, list, onPick, kind) {
  openPopup(anchor.getBoundingClientRect(), (pop, close) => {
    pop.append(el('div', { class: 'wos-form-t', text: kind === 'hl' ? 'Highlight' : 'Text color' }),
      el('div', { class: 'wos-swatches' }, list.map(([v, l]) => el('button', { type: 'button', class: 'sw', title: l, 'aria-label': l, onmousedown: e => e.preventDefault(), onclick: () => { onPick(v); close(); } },
        el('span', { class: 'sw-chip', style: kind === 'hl' ? `background:${v || 'transparent'}` : `color:${v || 'var(--fg)'}`, text: kind === 'hl' ? '' : 'A' }), el('span', { text: l })))));
  });
}
function blockTypeOf(e) {
  if (e.isActive('heading', { level: 1 })) return 'h1'; if (e.isActive('heading', { level: 2 })) return 'h2'; if (e.isActive('heading', { level: 3 })) return 'h3';
  if (e.isActive('codeBlock')) return 'code'; if (e.isActive('blockquote')) return 'quote'; return 'text';
}
function buildToolbar(editor, opts, api) {
  const bar = el('div', { class: 'ed-toolbar', role: 'toolbar', 'aria-label': 'Formatting' });
  const modeBtn = el('div', { class: 'ed-seg' });
  const editB = el('button', { type: 'button', text: 'Edit', class: 'on', onclick: () => api.setMode('edit') });
  const readB = el('button', { type: 'button', text: 'Read', onclick: () => api.setMode('read') });
  modeBtn.append(editB, readB);
  const blockSel = el('select', { class: 'tb-sel', 'aria-label': 'Block type', title: 'Block type' }, [['text', 'Text'], ['h1', 'Heading 1'], ['h2', 'Heading 2'], ['h3', 'Heading 3'], ['quote', 'Quote'], ['code', 'Code']].map(([v, l]) => el('option', { value: v, text: l })));
  blockSel.addEventListener('change', () => {
    const v = blockSel.value; const c = editor.chain().focus();
    ({ text: () => c.setParagraph(), h1: () => c.setHeading({ level: 1 }), h2: () => c.setHeading({ level: 2 }), h3: () => c.setHeading({ level: 3 }), quote: () => c.setParagraph().setBlockquote(), code: () => c.setCodeBlock() })[v]().run();
  });
  const sizeSel = el('select', { class: 'tb-sel', 'aria-label': 'Font size', title: 'Font size' }, SIZES.map(([v, l]) => el('option', { value: v, text: l })));
  sizeSel.addEventListener('change', () => { const v = sizeSel.value; v ? editor.chain().focus().setFontSize(v).run() : editor.chain().focus().unsetFontSize().run(); });
  const marks = [['bold', I.bold, 'Bold (Ctrl/⌘+B)', 'toggleBold'], ['italic', I.italic, 'Italic (Ctrl/⌘+I)', 'toggleItalic'], ['underline', I.underline, 'Underline (Ctrl/⌘+U)', 'toggleUnderline'], ['strike', I.strike, 'Strikethrough', 'toggleStrike'], ['code', I.code, 'Inline code', 'toggleCode']]
    .map(([n, ic, t, cmd]) => { const b = tbtn(ic, t, () => editor.chain().focus()[cmd]().run()); b.dataset.mark = n; return b; });
  const colorB = tbtn(I.color, 'Text color', () => swatchPopup(colorB, COLORS, v => v ? editor.chain().focus().setColor(v).run() : editor.chain().focus().unsetColor().run(), 'color'));
  const hlB = tbtn(I.hl, 'Highlight', () => swatchPopup(hlB, HIGHLIGHTS, v => v ? editor.chain().focus().setHighlight({ color: v }).run() : editor.chain().focus().unsetHighlight().run(), 'hl'));
  const lists = [['bulletList', I.bullet, 'Bulleted list', 'toggleBulletList'], ['orderedList', I.ordered, 'Numbered list', 'toggleOrderedList'], ['taskList', I.todo, 'To-do list', 'toggleTaskList']]
    .map(([n, ic, t, cmd]) => { const b = tbtn(ic, t, () => editor.chain().focus()[cmd]().run()); b.dataset.node = n; return b; });
  const ind = [tbtn(I.outdent, 'Outdent (Shift+Tab)', () => { const c = editor.chain().focus(); editor.isActive('taskItem') ? c.liftListItem('taskItem').run() : c.liftListItem('listItem').run(); }),
    tbtn(I.indent, 'Indent (Tab)', () => { const c = editor.chain().focus(); editor.isActive('taskItem') ? c.sinkListItem('taskItem').run() : c.sinkListItem('listItem').run(); })];
  const linkB = tbtn(I.link, 'Link', () => runSpecial(editor, { special: 'link' }, opts));
  const tableB = tbtn(I.table, 'Insert table', () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run());
  const plusB = tbtn('<span class="tb-plus">+ Block</span>', 'Insert a block (or type /)', () => {
    openPopup(plusB.getBoundingClientRect(), (pop, close) => {
      pop.append(el('div', { class: 'wos-list' }, COMMANDS.map(c => el('div', { class: 'wos-item', onmousedown: e => e.preventDefault(), onclick: () => { close(); editor.chain().focus().run(); if (c.special) runSpecial(editor, c, opts); else c.run(editor.chain().focus()).run(); } },
        el('span', { class: 'wos-ico', text: c.icon }), el('span', { class: 'wos-txt' }, el('b', { text: c.title }), el('small', { text: c.desc }))))));
    }, { cls: 'wos-slash' });
  });
  const undoB = tbtn(I.undo, 'Undo (Ctrl/⌘+Z)', () => editor.chain().focus().undo().run());
  const redoB = tbtn(I.redo, 'Redo (Ctrl/⌘+Shift+Z)', () => editor.chain().focus().redo().run());
  const status = el('span', { class: 'ed-status', 'aria-live': 'polite' });
  const editGroup = el('div', { class: 'ed-tools' },
    el('span', { class: 'tb-g' }, plusB, blockSel, opts.compact ? null : sizeSel),
    el('span', { class: 'tb-g' }, ...marks, colorB, hlB),
    el('span', { class: 'tb-g' }, ...lists, ...(opts.compact ? [] : ind)),
    el('span', { class: 'tb-g' }, linkB, tableB, undoB, redoB));
  bar.append(opts.modes === false ? null : modeBtn, editGroup, status);
  const refresh = () => {
    blockSel.value = blockTypeOf(editor);
    const fs = editor.getAttributes('textStyle').fontSize || ''; sizeSel.value = SIZES.some(s => s[0] === fs) ? fs : '';
    marks.forEach(b => b.classList.toggle('on', editor.isActive(b.dataset.mark)));
    lists.forEach(b => b.classList.toggle('on', editor.isActive(b.dataset.node)));
    undoB.disabled = !editor.can().undo(); redoB.disabled = !editor.can().redo();
  };
  return { bar, refresh, status, editGroup, editB, readB };
}
function cellPos(editor) {
  const $f = editor.state.selection.$from; let tableD = null;
  for (let d = $f.depth; d > 0; d--) if ($f.node(d).type.name === 'table') { tableD = d; break; }
  if (tableD == null) return null;
  return { row: $f.index(tableD), col: $f.index(tableD + 1), tablePos: $f.before(tableD) };
}
function focusCell(editor, row, col) {
  const p = cellPos(editor); if (!p) return;
  const table = editor.state.doc.nodeAt(p.tablePos); if (!table || row >= table.childCount) return;
  let pos = p.tablePos + 1;
  for (let r = 0; r < row; r++) pos += table.child(r).nodeSize;
  const rowNode = table.child(row); pos += 1;
  for (let c = 0; c < Math.min(col, rowNode.childCount - 1); c++) pos += rowNode.child(c).nodeSize;
  editor.chain().focus().setTextSelection(pos + 2).run();
}
function buildContextBar(editor, opts) {
  const bar = el('div', { class: 'ed-ctx', hidden: true });
  const refresh = () => {
    if (!editor.isEditable) { bar.hidden = true; return; }
    const kids = [];
    if (editor.isActive('table')) {
      const c = () => editor.chain().focus();
      kids.push(el('span', { class: 'ed-ctx-l', text: 'Table' }),
        tbtn('+ Row above', 'Add row above', () => { const p = cellPos(editor); c().addRowBefore().run(); p && focusCell(editor, p.row, 0); }), tbtn('+ Row below', 'Add row below', () => { const p = cellPos(editor); c().addRowAfter().run(); p && focusCell(editor, p.row + 1, 0); }),
        tbtn('+ Col left', 'Add column left', () => { const p = cellPos(editor); c().addColumnBefore().run(); p && focusCell(editor, p.row, p.col); }), tbtn('+ Col right', 'Add column right', () => { const p = cellPos(editor); c().addColumnAfter().run(); p && focusCell(editor, p.row, p.col + 1); }),
        tbtn('− Row', 'Delete row', () => c().deleteRow().run()), tbtn('− Col', 'Delete column', () => c().deleteColumn().run()),
        tbtn('Header row', 'Toggle header row', () => c().toggleHeaderRow().run()), tbtn('Merge/split', 'Merge or split cells', () => c().mergeOrSplit().run()),
        tbtn('Delete table', 'Delete table', () => c().deleteTable().run(), 'danger'));
    }
    if (editor.isActive('taskItem') && hooks.convertTodo) {
      const $f = editor.state.selection.$from; let item = null, pos = null;
      for (let d = $f.depth; d > 0; d--) if ($f.node(d).type.name === 'taskItem') { item = $f.node(d); pos = $f.before(d); break; }
      if (item) {
        const linked = item.attrs.taskId && H('taskInfo')(item.attrs.taskId);
        if (linked) kids.push(el('span', { class: 'ed-ctx-l', text: 'Checklist item' }), el('span', { class: 'ed-ctx-info', text: `Linked task: ${linked.title} · ${linked.status}` }), tbtn('Open task', 'Open the linked task', () => H('openPage')(item.attrs.taskId)));
        else {
          const b = tbtn('Convert to task', 'Create a real task from this checklist item', async () => {
            if (b.disabled) return; b.disabled = true;
            const text = item.firstChild ? item.firstChild.textContent : item.textContent;
            const blockId = item.attrs.id;
            try {
              const taskId = await hooks.convertTodo({ text, blockId, ownerId: opts.ownerId });
              if (taskId) {
                let tp = null; editor.state.doc.descendants((n, p) => { if (tp == null && n.type.name === 'taskItem' && n.attrs.id === blockId) tp = p; });
                if (tp == null) tp = pos;
                const n = editor.state.doc.nodeAt(tp);
                if (n) editor.view.dispatch(editor.state.tr.setNodeMarkup(tp, undefined, { ...n.attrs, taskId }));
              }
            } finally { b.disabled = false; }
          });
          kids.push(el('span', { class: 'ed-ctx-l', text: 'Checklist item' }), b, el('span', { class: 'ed-ctx-info', text: 'Ticking here does not complete the task.' }));
        }
      }
    }
    if (editor.isActive('link')) {
      const href = editor.getAttributes('link').href || '';
      kids.push(el('span', { class: 'ed-ctx-l', text: 'Link' }), el('a', { href, target: '_blank', rel: 'noopener noreferrer', class: 'ed-ctx-info', text: href.length > 48 ? href.slice(0, 48) + '…' : href }),
        tbtn('Edit', 'Edit link', () => formPopup(caretRect(editor), 'Edit link', [{ name: 'url', label: 'URL', value: href }], 'Save', v => { const u = v.url.trim(); if (!u) return editor.chain().focus().extendMarkRange('link').unsetLink().run(); if (!/^(https?:|mailto:)/i.test(u)) return H('toast')('Only http, https and mailto links are allowed.', 'bad'); editor.chain().focus().extendMarkRange('link').setLink({ href: u }).run(); })),
        tbtn('Remove', 'Remove link', () => editor.chain().focus().extendMarkRange('link').unsetLink().run()));
    }
    bar.replaceChildren(...kids); bar.hidden = !kids.length;
  };
  return { bar, refresh };
}
function buildBlockHandle(editor, wrap) {
  const handle = el('button', { type: 'button', class: 'blk-handle', title: 'Block menu: move, duplicate, delete, turn into', 'aria-label': 'Block menu', text: '⋮⋮', hidden: true });
  let at = null;
  wrap.append(handle);
  const hide = () => { handle.hidden = true; };
  wrap.addEventListener('mousemove', e => {
    if (!editor.isEditable || window.__wosPopupOpen) return hide();
    if (handle.contains(e.target)) return;
    const pm = editor.view.dom; const r = pm.getBoundingClientRect();
    if (e.clientY < r.top || e.clientY > r.bottom) return hide();
    const p = editor.view.posAtCoords({ left: Math.min(Math.max(e.clientX, r.left + 30), r.right - 10), top: e.clientY });
    if (!p) return hide();
    const m = findMovable(editor.state.doc.resolve(p.inside >= 0 ? Math.min(p.inside + 1, editor.state.doc.content.size) : p.pos));
    if (!m) return hide();
    const dom = editor.view.nodeDOM(m.pos); if (!dom || !dom.getBoundingClientRect) return hide();
    const br = dom.getBoundingClientRect(); const wr = wrap.getBoundingClientRect();
    at = m.pos; handle.hidden = false;
    handle.style.top = (br.top - wr.top + 2) + 'px';
    handle.style.left = Math.max(0, br.left - wr.left - 24) + 'px';
  });
  wrap.addEventListener('mouseleave', hide);
  handle.addEventListener('mousedown', e => e.preventDefault());
  handle.addEventListener('click', () => {
    if (at == null) return; const pos = at;
    const sel = () => { const m = blockAt(editor, pos); if (!m) return null; editor.chain().focus().setTextSelection(Math.min(m.pos + 1, editor.state.doc.content.size)).run(); return m; };
    const turn = fn => () => { if (sel()) fn(editor.chain().focus()).run(); };
    openPopup(handle.getBoundingClientRect(), (pop, close) => {
      const item = (label, fn, cls = '') => el('div', { class: 'wos-item ' + cls, onmousedown: e => e.preventDefault(), onclick: () => { close(); fn(); } }, el('span', { class: 'wos-txt' }, el('b', { text: label })));
      pop.append(el('div', { class: 'wos-list' },
        item('Move up  (Alt+Shift+↑)', () => moveBlock(editor, -1, pos)), item('Move down  (Alt+Shift+↓)', () => moveBlock(editor, 1, pos)),
        item('Duplicate', () => { const m = blockAt(editor, pos); if (m) editor.chain().focus().insertContentAt(m.pos + m.node.nodeSize, m.node.toJSON()).run(); }),
        item('Delete', () => { const m = blockAt(editor, pos); if (m) editor.view.dispatch(editor.state.tr.delete(m.pos, m.pos + m.node.nodeSize)); }, 'danger'),
        el('div', { class: 'wos-sep', text: 'Turn into' }),
        item('Text', turn(c => c.clearNodes().setParagraph())), item('Heading 1', turn(c => c.clearNodes().setHeading({ level: 1 }))), item('Heading 2', turn(c => c.clearNodes().setHeading({ level: 2 }))), item('Heading 3', turn(c => c.clearNodes().setHeading({ level: 3 }))),
        item('Bulleted list', turn(c => c.clearNodes().toggleBulletList())), item('Numbered list', turn(c => c.clearNodes().toggleOrderedList())), item('To-do list', turn(c => c.clearNodes().toggleTaskList())),
        item('Quote', turn(c => c.clearNodes().setBlockquote())), item('Callout', turn(c => c.clearNodes().wrapIn('callout'))), item('Toggle', turn(c => c.clearNodes().setDetails().updateAttributes('details', { open: true }))), item('Code', turn(c => c.clearNodes().setCodeBlock()))));
    }, { cls: 'wos-slash' });
  });
}

/* ---------- create ---------- */
function create(host, opts = {}) {
  host.classList.add('wos-ed'); if (opts.compact) host.classList.add('compact');
  host.style.setProperty('--ed-min', (opts.minHeight || 140) + 'px');
  const wrap = el('div', { class: 'ed-body' });
  let content = opts.content;
  if (!validDoc(content)) content = opts.delta ? deltaToDoc(opts.delta) : textToDoc(opts.text || '');
  let contentError = null;
  const editor = new Editor({
    element: wrap, content, editable: opts.editable !== false,
    enableContentCheck: true,
    onContentError: ({ error, disableCollaboration }) => { contentError = error; },
    extensions: [
      StarterKit.configure({
        codeBlock: false, heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true, linkOnPaste: true, defaultProtocol: 'https', protocols: ['http', 'https', 'mailto'], HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' }, isAllowedUri: (url, ctx) => /^(https?:|mailto:)/i.test(url) || (!/^[a-z]+:/i.test(url) && ctx.defaultValidate(url)) }
      }),
      TaskList, TaskItemX.configure({ nested: true, onReadOnlyChecked: (node, checked) => { let pos = null; editor.state.doc.descendants((n, p) => { if (pos == null && n === node) pos = p; }); if (pos == null) return false; editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, checked })); return true; } }),
      Table.configure({ resizable: false, HTMLAttributes: { class: 'ed-table' } }), TableRow, TableHeader, TableCell,
      TextStyle, Color, FontSize, Highlight.configure({ multicolor: true }),
      DetailsX.configure({ persist: true, HTMLAttributes: { class: 'toggle' } }), DetailsSummary, DetailsContent,
      CodeBlockX.configure({ lowlight, defaultLanguage: null, HTMLAttributes: { class: 'code' } }),
      Image.configure({ inline: false, allowBase64: false }),
      Callout, PageLink,
      UniqueID.configure({ types: ['heading', 'bulletList', 'orderedList', 'taskList', 'taskItem', 'listItem', 'blockquote', 'codeBlock', 'table', 'details', 'callout', 'horizontalRule', 'image'], generateID: shortId }),
      Placeholder.configure({ includeChildren: true, placeholder: ({ node, editor: ed }) => (node.type.name === 'detailsSummary' ? 'Toggle title' : node.type.name === 'heading' ? 'Heading' : (ed.isEmpty ? (opts.placeholder || "Write, or type '/' for blocks…") : "Type '/' for blocks")) }),
      slashExtension(opts), Keys
    ],
    editorProps: {
      attributes: { class: 'ed-content', spellcheck: 'true' },
      handlePaste: (view, event) => {
        const files = [...(event.clipboardData && event.clipboardData.files || [])].filter(f => /^image\//.test(f.type));
        if (files.length) { files.forEach(f => insertImage(editor, f)); return true; }
        const html = event.clipboardData && event.clipboardData.getData('text/html');
        const text = event.clipboardData && event.clipboardData.getData('text/plain');
        if (text && !(html && /<table/i.test(html)) && /\t/.test(text) && !editor.isActive('table') && !editor.isActive('codeBlock')) {
          const rows = text.replace(/\r/g, '').replace(/\n+$/, '').split('\n').map(r => r.split('\t'));
          if (rows.length >= 1 && rows[0].length >= 2) {
            const cols = Math.max(...rows.map(r => r.length));
            const cell = (t, h) => ({ type: h ? 'tableHeader' : 'tableCell', content: [{ type: 'paragraph', ...(t ? { content: [{ type: 'text', text: t }] } : {}) }] });
            editor.chain().focus().insertContent({ type: 'table', content: rows.map((r, i) => ({ type: 'tableRow', content: Array.from({ length: cols }, (_, j) => cell((r[j] || '').trim(), i === 0)) })) }).run();
            return true;
          }
        }
        return false;
      },
      handleDrop: (view, event) => {
        const files = [...(event.dataTransfer && event.dataTransfer.files || [])].filter(f => /^image\//.test(f.type));
        if (files.length) { event.preventDefault(); files.forEach(f => insertImage(editor, f)); return true; }
        return false;
      }
    }
  });
  if (contentError) { editor.commands.setContent(textToDoc(opts.text || ''), { emitUpdate: false }); }
  let mode = opts.editable === false ? 'read' : 'edit';
  const api = {
    editor,
    getJSON: () => editor.getJSON(),
    getText: () => docText(editor.getJSON()),
    setContent: doc => { const sel = editor.state.selection; editor.commands.setContent(validDoc(doc) ? doc : textToDoc(''), { emitUpdate: false }); try { editor.commands.setTextSelection(Math.min(sel.from, editor.state.doc.content.size)); } catch (e) { } },
    setMode: m => { mode = m; editor.setEditable(m === 'edit'); host.classList.toggle('reading', m === 'read'); tb.editB.classList.toggle('on', m === 'edit'); tb.readB.classList.toggle('on', m === 'read'); tb.editGroup.hidden = m === 'read'; ctxBar.refresh(); opts.onMode && opts.onMode(m); },
    getMode: () => mode,
    setStatus: (state, onRetry) => {
      const s = tb.status; s.replaceChildren(); s.className = 'ed-status ' + (state || '');
      if (state === 'saving') s.textContent = 'Saving…'; else if (state === 'saved') s.textContent = 'Saved'; else if (state === 'unsaved') s.textContent = 'Unsaved changes';
      else if (state === 'failed') s.append('Save failed', ' ', el('button', { type: 'button', class: 'ed-retry', text: 'Retry', onclick: () => onRetry && onRetry() }));
    },
    focus: () => editor.commands.focus('end'),
    destroy: () => { editor.destroy(); host.replaceChildren(); },
    repaintLinks: () => host.querySelectorAll('.page-link').forEach(n => n._wosPaint && n._wosPaint())
  };
  const tb = buildToolbar(editor, opts, api); const ctxBar = buildContextBar(editor, opts);
  host.append(tb.bar, ctxBar.bar, wrap);
  buildBlockHandle(editor, wrap);
  const refresh = () => { tb.refresh(); ctxBar.refresh(); };
  editor.on('selectionUpdate', refresh); editor.on('transaction', refresh); editor.on('focus', refresh);
  editor.on('update', () => opts.onUpdate && opts.onUpdate());
  editor.on('blur', ({ event }) => { setTimeout(() => { if (!host.contains(document.activeElement) && !window.__wosPopupOpen) opts.onBlur && opts.onBlur(); }, 0); });
  host.__wos = api;
  if (mode === 'read') api.setMode('read');
  refresh();
  return api;
}
function repaintAllLinks() { document.querySelectorAll('.wos-ed .page-link').forEach(n => n._wosPaint && n._wosPaint()); }

window.WosEditor = { create, deltaToDoc, textToDoc, docText, validDoc, setHooks: h => { hooks = h || {}; }, repaintAllLinks, COMMANDS: COMMANDS.map(c => c.key) };
