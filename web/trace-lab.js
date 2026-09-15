import { SCENARIOS, createRun, advanceRun, cancelRun } from './lib/engine.js';
import { escapeHTML as e, icon, json, statusLabels, session } from './ui.js';
const nodes = [['receive', '接收任务'], ['context', '组装上下文'], ['model', '请求模型'], ['validate', '验证参数'], ['permission', '检查权限'], ['tool', '执行工具'], ['observe', '回填观测'], ['done', '完成任务']];
const terminal = s => ['completed', 'failed', 'limited', 'denied', 'cancelled'].includes(s.status);

export function mountTrace(root, { saveSession, notify }) {
  let snapshots = [createRun()], cursor = 0, selected = -1, timer = null;
  const current = () => snapshots[cursor];
  const pause = () => { clearInterval(timer); timer = null; };
  function advance(decision) {
    const next = advanceRun(current(), decision);
    if (next.events.length !== current().events.length) {
      snapshots = snapshots.slice(0, cursor + 1); snapshots.push(next); cursor++; selected = next.events.length - 1;
    }
    if (terminal(next) || next.status === 'awaiting_approval') pause();
    render();
  }
  function render() {
    const s = current(), events = s.events, detail = events[selected] || events.at(-1);
    const seen = new Set(events.map(ev => ev.node));
    root.innerHTML = `<div class="lab-frame">
      <div class="lab-toolbar"><div class="button-row"><label class="label" for="trace-scenario">场景</label><select id="trace-scenario">${Object.entries(SCENARIOS).map(([id, title]) => `<option value="${id}" ${s.scenario === id ? 'selected' : ''}>${e(title)}</option>`).join('')}</select><label class="label" for="trace-limit">最多调用</label><select id="trace-limit">${Array.from({ length: 8 }, (_, i) => `<option ${s.maxTurns === i + 1 ? 'selected' : ''}>${i + 1}</option>`).join('')}</select></div><span class="badge ${terminal(s) ? 'green' : 'orange'}">${e(statusLabels[s.status])}</span></div>
      <div class="trace-map" aria-label="当前运行阶段">${nodes.map(([id, name], i) => `<div class="trace-node ${s.phase === id ? 'active' : seen.has(id) ? 'done' : ''}" ${s.phase === id ? 'aria-current="step"' : ''}><span class="node-index">${String(i + 1).padStart(2, '0')}</span>${e(name)}</div>`).join('')}<div class="trace-node"><span class="node-index">MODEL CALLS</span>${s.turns} / ${s.maxTurns}</div><div class="trace-node"><span class="node-index">ACTUAL RESULT</span>${s.result ?? '—'}</div></div>
      <div class="lab-toolbar"><div class="button-row"><button class="btn small" data-action="back" ${cursor === 0 ? 'disabled' : ''}>← 回看</button><button class="btn primary small" data-action="step" ${terminal(s) || s.status === 'awaiting_approval' ? 'disabled' : ''}>下一步 ${icon('arrow', 14)}</button><button class="btn small" data-action="auto" ${terminal(s) || s.status === 'awaiting_approval' ? 'disabled' : ''}>${timer ? '暂停播放' : '自动播放'}</button><button class="btn small" data-action="stop" ${terminal(s) ? 'disabled' : ''}>停止任务</button><button class="btn small" data-action="reset">重置</button></div><button class="btn small" data-action="save" ${events.length ? '' : 'disabled'}>${icon('save', 14)} 保存轨迹</button></div>
      ${s.status === 'awaiting_approval' ? '<div class="lab-body"><div class="notice warning"><strong>执行已暂停。</strong>本场景模拟需要审批的工作流，只计算 23 × 7，不写真实文件。<div class="button-row" style="margin-top:12px"><button class="btn primary small" data-action="approve">批准这一次</button><button class="btn small danger" data-action="deny">拒绝执行</button></div></div></div>' : ''}
      <div class="lab-body lab-split"><div><h3 style="margin-bottom:14px">事件轨迹 <span class="badge border">${events.length} EVENTS</span></h3><div class="trace-events">${events.length ? events.map((ev, i) => `<button class="trace-event ${detail === ev ? 'selected' : ''}" data-event="${i}"><span>${String(ev.index).padStart(2, '0')}</span><div><strong>${e(ev.title)}</strong><p>${e(ev.node)}</p></div></button>`).join('') : '<div class="empty-state">点击“下一步”，接收第一个任务。<br>每次点击只推进一个可观测步骤。</div>'}</div></div>
      <div class="lab-output trace-detail"><h3>${detail ? e(detail.title) : '观察，而不猜测'}</h3><p>${detail ? e(detail.detail) : '右侧显示选中步骤的说明和数据。模型回复是预设脚本，计算器则真正运行。'}</p>${detail ? json(detail.data) : json({ mode: 'deterministic simulation', networkRequests: 0 })}<details style="margin-top:14px"><summary class="muted">查看当前内部消息（教学格式）</summary>${json(s.messages)}</details></div></div>
      <div class="trace-caption">本地确定性演示 · 模型为脚本，工具为真实计算 · 回看会恢复快照；从旧快照继续将创建新分支 · 所有计时器随离开页面清理。</div></div>`;
    root.querySelector('#trace-scenario').onchange = event => reset(event.target.value, s.maxTurns);
    root.querySelector('#trace-limit').onchange = event => reset(s.scenario, Number(event.target.value));
    root.querySelectorAll('[data-event]').forEach(button => { button.onclick = () => { selected = Number(button.dataset.event); render(); }; });
    root.querySelectorAll('[data-action]').forEach(button => { button.onclick = () => {
      switch (button.dataset.action) {
        case 'step': pause(); advance(); break;
        case 'back': pause(); cursor = Math.max(0, cursor - 1); selected = current().events.length - 1; render(); break;
        case 'auto': if (timer) pause(); else timer = setInterval(() => advance(), 750); render(); break;
        case 'reset': reset(s.scenario, s.maxTurns); break;
        case 'stop': pause(); snapshots = snapshots.slice(0, cursor + 1); snapshots.push(cancelRun(s)); cursor++; selected = current().events.length - 1; render(); break;
        case 'approve': advance('approve'); break;
        case 'deny': advance('deny'); break;
        case 'save': saveSession(session(`运行轨迹 · ${SCENARIOS[s.scenario]}`, events.map(ev => ({ role: 'event', content: `${ev.index}. ${ev.title}\n${ev.detail}\n${JSON.stringify(ev.data, null, 2)}` })))); notify('轨迹已保存到学习记录。'); break;
      }
    }; });
  }
  function reset(scenario, limit) { pause(); snapshots = [createRun(scenario, limit)]; cursor = 0; selected = -1; render(); }
  render();
  return pause;
}
