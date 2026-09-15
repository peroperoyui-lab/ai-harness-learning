import { walkthroughs } from './content/walkthroughs.js';
import { escapeHTML as e, note } from './ui.js';

/** A manual stepper over labelled teaching snapshots. No timers, eval, or network. */
export function mountLessonGuide(root, id) {
  const guide = walkthroughs[id];
  if (!guide) return () => {};
  let index = 0;
  root.innerHTML = `<section class="lesson-guide" aria-labelledby="guide-title"><div class="eyebrow">WORKED EXAMPLE / STEP BY STEP</div><h2 id="guide-title">${e(guide.title)}</h2><p>${e(guide.why)}</p><p class="guide-disclaimer">预设教学快照 · 手动切换 · 代码仅供阅读，不执行模型或外部操作</p><div class="guide-stages" aria-label="实例步骤">${guide.stages.map((step, i) => `<button type="button" class="btn small" data-guide-step="${i}">${i + 1}. ${e(step.title)}</button>`).join('')}</div><div id="guide-snapshot" class="guide-snapshot" aria-live="polite"></div><div class="button-row"><button type="button" class="btn small" id="guide-back">← 上一步</button><span id="guide-position" class="mono"></span><button type="button" class="btn small" id="guide-next">下一步 →</button></div><div class="guide-probe"><h3>先预测，再核对</h3><p>${e(guide.probe)}</p><button type="button" class="btn small" id="guide-reveal" aria-expanded="false" aria-controls="guide-answer">查看解释</button><div id="guide-answer" hidden>${note(guide.answer)}</div></div><details class="guide-transfer"><summary>迁移到自己的工程时，进一步考虑什么？</summary><p>${e(guide.transfer)}</p></details></section>`;
  const $ = name => root.querySelector('#' + name);
  function draw() {
    const step = guide.stages[index];
    $('guide-snapshot').innerHTML = `<h3>${e(step.title)}</h3><pre class="code-block"><code>${e(step.code)}</code></pre><strong>此时你应当观察到</strong><p>${e(step.observe)}</p>`;
    $('guide-position').textContent = `${index + 1} / ${guide.stages.length}`;
    $('guide-back').disabled = index === 0;
    $('guide-next').disabled = index === guide.stages.length - 1;
    root.querySelectorAll('[data-guide-step]').forEach(b => { b.setAttribute('aria-pressed', String(Number(b.dataset.guideStep) === index)); });
  }
  root.querySelectorAll('[data-guide-step]').forEach(b => { b.onclick = () => { index = Number(b.dataset.guideStep); draw(); }; });
  $('guide-back').onclick = () => { index = Math.max(0, index - 1); draw(); };
  $('guide-next').onclick = () => { index = Math.min(guide.stages.length - 1, index + 1); draw(); };
  $('guide-reveal').onclick = () => {
    const hidden = !$('guide-answer').hidden;
    $('guide-answer').hidden = hidden;
    $('guide-reveal').textContent = hidden ? '查看解释' : '收起解释';
    $('guide-reveal').setAttribute('aria-expanded', String(!hidden));
  };
  draw();
  return () => {};
}
