import { canResume, parseHistoryImport, mergeHistory, MAX_IMPORT_BYTES } from './lib/history.js';
import { escapeHTML as e, heading, note, downloadJSON, icon } from './ui.js';

export function mountHistory(root, { getState, setState, clearState, notify, onChange }) {
  let disposed = false;
  root.innerHTML = heading('YOUR LOCAL NOTEBOOK', '学习记录', '保存在当前浏览器。可搜索、继续问答、导入导出；恢复记录不会自动发送请求，也不会恢复密钥。', '<div class="button-row"><button class="btn small" id="export-history">导出全部</button><button class="btn small danger" id="clear-history">清除本站学习数据</button></div>') +
    note('最多 20 个会话、每会话 40 条消息。导入内容按文本显示；分享文件前请检查你的输入与输出。') +
    '<div class="history-tools"><div class="field"><label for="history-search">搜索标题或消息内容</label><input type="search" id="history-search" placeholder="例如：工具、计算结果、检查点"></div><div class="field"><label for="history-import">导入本站导出的 JSON（最多 2 MiB）</label><input type="file" id="history-import" accept="application/json,.json"></div></div><div id="history-notice" aria-live="polite"></div><p id="history-count" class="muted"></p><div id="history-list"></div>';
  const $ = id => root.querySelector('#' + id);
  function draw() {
    const state = getState(), query = $('history-search').value.trim().toLowerCase();
    const selected = state.sessions.filter(s => (s.title + '\n' + s.messages.map(m => m.content).join('\n')).toLowerCase().includes(query));
    $('history-count').textContent = `已保存 ${state.sessions.length} / 20 个会话 · 当前显示 ${selected.length} 个`;
    $('history-list').innerHTML = selected.length ? selected.map(s => {
      const date = new Date(s.date), stamp = Number.isNaN(date.getTime()) ? '未知时间' : date.toLocaleString('zh-CN');
      return `<section class="card history-card"><div class="history-head"><div><h3>${e(s.title)}</h3><p>${e(stamp)} · ${s.mode === 'live' ? '真实 API' : '本地演示'} · ${s.messages.length} 条记录</p></div><div class="button-row">${canResume(s) ? `<a class="btn small primary" data-resume="${e(s.id)}" href="#/playground?session=${encodeURIComponent(s.id)}">继续会话</a>` : '<span class="badge border">轨迹 / 检查点 · 只读记录</span>'}<button class="btn small" data-export="${e(s.id)}">导出</button><button class="btn small danger" data-delete="${e(s.id)}">删除</button></div></div><details><summary>展开记录内容</summary>${s.messages.map(m => `<div class="history-message"><span class="badge">${e(m.role)}</span><p style="margin-top:8px">${e(m.content)}</p></div>`).join('')}</details></section>`;
    }).join('') : `<div class="empty-state">${icon('history', 32)}<h3>${query ? '没有匹配记录' : '还没有保存的轨迹或会话'}</h3><p>${query ? '尝试更短的关键词。' : '在循环观测台保存轨迹，或在 API 体验中勾选保存问答。'}</p><a class="btn primary" href="#/playground">打开体验工作台 →</a></div>`;
    root.querySelectorAll('[data-export]').forEach(button => { button.onclick = () => {
      const item = getState().sessions.find(s => s.id === button.dataset.export);
      if (item) downloadJSON({ version: 1, completed: [], sessions: [item] }, 'harness-session.json');
    }; });
    root.querySelectorAll('[data-delete]').forEach(button => { button.onclick = () => {
      const next = getState(); next.sessions = next.sessions.filter(s => s.id !== button.dataset.delete);
      setState(next); onChange(); draw();
    }; });
  }
  $('history-search').oninput = draw;
  $('export-history').onclick = () => downloadJSON(getState(), 'harness-learning-history.json');
  $('clear-history').onclick = () => {
    if (confirm('清除课程进度和所有学习会话？此操作无法撤销。')) { const cleared = clearState(); onChange(); draw(); if (cleared) notify('本站学习数据已清除。'); }
  };
  $('history-import').onchange = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > MAX_IMPORT_BYTES) throw new Error('导入文件不能超过 2 MiB');
      const incoming = parseHistoryImport(await file.text());
      if (disposed) return;
      const dropped = Math.max(0, getState().sessions.length + incoming.sessions.length - 20);
      if (!confirm(`导入 ${incoming.sessions.length} 个会话及课程进度？同名 ID 将创建副本。${dropped ? `超出容量，将移除末尾 ${dropped} 个旧会话，请先导出备份。` : ''}不会导入连接设置或密钥。`)) return;
      setState(mergeHistory(getState(), incoming)); onChange(); draw();
      $('history-notice').innerHTML = note('导入完成。内容仍需自行核验；没有执行其中的任何代码或网络请求。');
    } catch (error) { if (!disposed) $('history-notice').innerHTML = note(error.message, 'error'); }
    finally { if (!disposed) $('history-import').value = ''; }
  };
  draw();
  return () => { disposed = true; };
}
