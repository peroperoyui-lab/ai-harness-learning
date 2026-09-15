export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const paths = {
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
  cycle: '<path d="M20 8a8 8 0 0 0-14-3L3 8m0-5v5h5M4 16a8 8 0 0 0 14 3l3-3m0 5v-5h-5"/>',
  book: '<path d="M12 5v16M3 4h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5v15h-5a4 4 0 0 0-4 2 4 4 0 0 0-4-2H3V4Z"/>',
  nodes: '<rect x="2" y="3" width="6" height="6" rx="1"/><rect x="16" y="3" width="6" height="6" rx="1"/><rect x="9" y="16" width="6" height="6" rx="1"/><path d="M5 9v3h14V9m-7 3v4"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
  check: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="m7 12 3 3 7-7"/>',
  code: '<path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-16-2 20"/>',
  search: '<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',
  plug: '<path d="M9 3v5m6-5v5M6 8h12v3a6 6 0 0 1-12 0V8Zm6 9v5"/>',
  wave: '<path d="M2 12h3l3-8 4 16 4-13 3 5h3"/>',
  save: '<path d="M4 3h13l4 4v14H3V3h1Zm3 0v6h10V3M7 21v-8h10v8"/>',
  meter: '<path d="M4 19a10 10 0 1 1 16 0M12 12l5-5M5 12H3m18 0h-2M12 3v2"/><circle cx="12" cy="12" r="2"/>',
  home: '<path d="m3 10 9-7 9 7v11h-6v-7H9v7H3V10Z"/>',
  lab: '<path d="M8 3h8m-6 0v7L4 19a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2l-6-9V3M7 15h10"/>',
  history: '<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6m3-3v6l4 2"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  play: '<path d="m7 4 13 8-13 8V4Z"/>',
};
export function icon(name, size = 20) { return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.layers}</svg>`; }
export function heading(eyebrow, title, description, extra = '') {
  return `<div class="page-heading"><div><div class="eyebrow">${escapeHTML(eyebrow)}</div><h1>${escapeHTML(title)}</h1><p>${escapeHTML(description)}</p></div>${extra}</div>`;
}
export function note(text, kind = '') { return `<div class="notice ${kind}">${escapeHTML(text)}</div>`; }
export function json(value) { return `<pre class="code-block"><code>${escapeHTML(JSON.stringify(value, null, 2))}</code></pre>`; }
export function downloadJSON(value, filename) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const statusLabels = { ready: '准备就绪', running: '运行中', awaiting_approval: '等待批准', completed: '已完成', failed: '验证失败', limited: '触发上限', denied: '已拒绝', cancelled: '已停止' };
export function session(title, messages, mode = 'simulation') {
  return { id: crypto.randomUUID(), title, messages, mode, date: new Date().toISOString() };
}
