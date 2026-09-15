import { chapters, lessons, labs, sources, glossary } from './content/course.js';
import { createStore } from './lib/storage.js';
import { mountLab } from './labs.js';
import { mountPlayground } from './playground.js';
import { escapeHTML as e, icon, heading, note, downloadJSON } from './ui.js';

const REPO = 'https://github.com/peroperoyui-lab/ai-harness-learning';
const main = document.querySelector('#main'), sidebar = document.querySelector('#sidebar');
let toastTimer, cleanup = () => {}, route = '';
function notify(text) {
  const target = document.querySelector('#toast');
  target.textContent = text; target.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { target.hidden = true; }, 4200);
}
const storage = { getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value), removeItem: key => localStorage.removeItem(key) };
const store = createStore(storage, notify);
function saveSession(value) {
  const state = store.get();
  state.sessions = [value, ...state.sessions.filter(s => s.id !== value.id)].slice(0, 20);
  store.set(state);
}
const labContext = { saveSession, getState: () => store.get(), notify };

function navigation() {
  const done = store.get().completed.filter(id => lessons.some(l => l.id === id)).length;
  const nav = [ ['/', 'home', '学习总览', ''], ['/learn/harness', 'book', '课程路径', '24'], ['/labs', 'lab', '交互实验室', '11'], ['/playground', 'plug', 'API 体验', '可选'], ['/history', 'history', '学习记录', String(store.get().sessions.length)], ['/glossary', 'search', '术语速查', '41'] ];
  sidebar.innerHTML = `<a class="brand" href="#/"><span class="brand-mark">${icon('nodes', 22)}</span><div><div class="brand-name">Harness Lab<span style="color:#df845e">.</span></div><div class="brand-sub">LEARN BY BUILDING</div></div></a><div class="nav-caption">你的学习工作台</div><nav>${nav.map(([path, glyph, title, count]) => {
    const active = path === '/' ? route === '/' : path.startsWith('/learn') ? route.startsWith('/learn') : path === '/labs' ? route.startsWith('/lab') : route === path;
    return `<a class="nav-link ${active ? 'active' : ''}" href="#${path}" ${active ? 'aria-current="page"' : ''}>${icon(glyph, 18)}${title}${count ? `<span class="count">${count}</span>` : ''}</a>`;
  }).join('')}</nav><div class="nav-caption">从 0 到 1 · 六个阶段</div>${chapters.map((chapter, i) => `<a class="chapter-nav" href="#/learn/${chapter.lessons[0].id}"><span>${String(i + 1).padStart(2, '0')}</span><span>${chapter.title}</span></a>`).join('')}<div class="sidebar-bottom"><div class="progress-widget"><div class="progress-label"><span>你的学习进度</span><span class="mono">${done}/24</span></div><div class="progress-track" role="progressbar" aria-label="课程完成进度" aria-valuenow="${done}" aria-valuemin="0" aria-valuemax="24"><div class="progress-fill" style="width:${done / 24 * 100}%"></div></div><p style="margin-top:9px">每一个看懂的步骤，都算进步。</p></div><div class="sidebar-foot"><span>OPEN SOURCE · MIT</span><span>v1.0</span></div></div>`;
}

function architecture() {
  return `<svg class="architecture-map" viewBox="0 0 440 280" role="img" aria-label="Harness 连接模型、上下文、工具、状态、权限与运行记录"><g class="connector"><path d="M220 105V49M160 125 83 67M280 125l77-58M158 154l-75 57M282 154l75 57M220 174v57"/></g><rect class="core" x="147" y="104" width="146" height="72" rx="13"/><text class="core-text" x="220" y="135" text-anchor="middle">HARNESS</text><text class="core-sub" x="220" y="155" text-anchor="middle">ORCHESTRATE THE LOOP</text>${[[167, 13, '模型', 'MODEL'], [16, 41, '上下文', 'CONTEXT'], [318, 41, '工具', 'TOOLS'], [16, 190, '状态与记忆', 'STATE'], [318, 190, '权限', 'PERMISSION'], [167, 223, '运行记录', 'TRACE']].map(([x, y, title, subtitle]) => `<rect class="node" x="${x}" y="${y}" width="106" height="45" rx="8"/><text x="${x + 53}" y="${y + 20}" text-anchor="middle">${title}</text><text class="sub" x="${x + 53}" y="${y + 34}" text-anchor="middle">${subtitle}</text>`).join('')}<circle cx="220" cy="84" r="4" fill="#df663f"/><circle cx="314" cy="92" r="3" fill="#81a48d"/><circle cx="120" cy="180" r="3" fill="#81a48d"/></svg>`;
}

function overview() {
  const done = new Set(store.get().completed), next = lessons.find(l => !done.has(l.id)) || lessons[0];
  main.innerHTML = `<div class="hero"><div><div class="eyebrow">A FIELD GUIDE TO AI HARNESS ENGINEERING</div><span class="badge green">交互式工程课程 · 中文 · 开源</span><h1>看见 AI 如何工作，<br>亲手搭起它的<em>运行系统。</em></h1><p>从一次模型请求，到一个可控、可观察的 Agent。用可视化实验拆开上下文、工具、记忆与权限，把抽象概念变成你能读懂的代码。</p><div class="button-row"><a class="btn primary" href="#/learn/${next.id}">${done.size ? '继续学习' : '开始第一课'} ${icon('arrow', 16)}</a><a class="btn" href="#/lab/trace">${icon('play', 15)} 先看一次运行</a></div><div class="hero-foot"><span>NO API KEY REQUIRED</span><span>NO INSTALL FOR SIMULATIONS</span></div></div><div class="hero-visual">${architecture()}</div></div>
  <div class="stats-strip"><div class="stat"><strong>24</strong><span>循序渐进的<br>中文课程</span></div><div class="stat"><strong>11</strong><span>可重复操作的<br>本地实验</span></div><div class="stat"><strong>04</strong><span>协议请求<br>预设对照</span></div><div class="stat"><strong>0</strong><span>免密钥学习<br>API 消耗</span></div></div>
  <div class="section-title"><div><h2>一条清晰的学习路径</h2><p>先理解完整通路，再逐层拆开。每节课都有代码、实验与自测。</p></div><a class="text-link" href="#/glossary">遇到术语？查一查 ↗</a></div><div class="grid-3">${chapters.map((chapter, i) => {
    const complete = chapter.lessons.filter(l => done.has(l.id)).length;
    return `<a class="card chapter-card" href="#/learn/${chapter.lessons[0].id}"><div class="chapter-card-top"><span class="chapter-icon">${icon(chapter.icon, 20)}</span><span class="chapter-number">CHAPTER 0${i + 1}</span></div><h3>${chapter.title}</h3><p>${chapter.subtitle}</p><div class="chapter-card-bottom"><span>4 节课 · ${complete}/4 已掌握</span>${icon('arrow', 16)}</div></a>`;
  }).join('')}</div><div class="section-title"><div><h2>让“模型调用工具”变得看得见</h2><p>只看结果不够，看看它是怎样到达结果的。</p></div><a class="text-link" href="#/labs">全部实验 ↗</a></div><div class="experiment-feature"><div><span class="badge dark">FEATURED EXPERIMENT</span><h2 style="margin-top:14px">一次循环，八个可检查的步骤</h2><p>逐步运行，验证参数，等待批准，读回工具结果。遇到错误或循环失控时，观察系统如何停止。</p><a class="btn small" href="#/lab/trace" style="margin-top:21px">打开循环观测台 ${icon('arrow', 14)}</a></div><div><div class="mini-flow"><span>输入</span><i>→</i><span>上下文</span><i>→</i><span class="hot">模型</span><i>→</i><span>工具</span><i>↩</i></div><div style="margin-top:22px;font:11px var(--mono);color:#8faea4">calculator(23, 7) <span style="color:#dda178">→ 161</span><br><span style="font-size:10px;color:#6e948a">SCRIPTED MODEL. REAL LOCAL COMPUTATION.</span></div></div></div><div class="grid-2" style="margin-top:22px"><div class="card"><h3>${icon('plug', 18)} 带上自己的模型，小试一次</h3><p style="font-size:12px;margin:10px 0 17px">可选 API 体验默认只发送一个小请求。输入密钥和模型名称，先预览参数，再明确发送。</p><a class="text-link" href="#/playground">进入 API 体验 ↗</a></div><div class="card"><h3>${icon('code', 18)} 看懂代码，也能改进课程</h3><p style="font-size:12px;margin:10px 0 17px">每节课关联实现文件。开发规范、页面目录、测试和贡献模板都在仓库中。</p><a class="text-link" href="${REPO}/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener noreferrer">阅读贡献规范 ↗</a></div></div>`;
}

function lessonPage(id) {
  const lesson = lessons.find(l => l.id === id);
  if (!lesson) return notFound();
  const done = store.get().completed.includes(id), next = lessons[lesson.number], previous = lessons[lesson.number - 2];
  document.title = `${lesson.title} · Harness Lab`;
  main.innerHTML = heading(`CHAPTER ${String(lesson.chapterIndex + 1).padStart(2, '0')} / LESSON ${String(lesson.number).padStart(2, '0')}`, lesson.title, lesson.subtitle) + `<div class="lesson-layout"><article class="lesson-article"><div class="lesson-meta"><span class="badge green">${e(lesson.chapterTitle)}</span><span class="badge border">参考学习时长 ${lesson.minutes} 分钟</span><span class="badge border">无需 API Key</span></div><div class="learning-goal"><strong>完成这一课，你将能够</strong>${e(lesson.goal)}</div>${lesson.sections.map(([title, text]) => `<section class="prose-section"><h2>${e(title)}</h2><p>${e(text)}</p></section>`).join('')}<h2>沿着代码读一遍</h2><div class="annotated-code"><div class="code-caption">${e(lesson.codeLabel)}</div>${lesson.code.map(([line, text], i) => `<div class="code-row"><span class="line-number">${String(i + 1).padStart(2, '0')}</span><div><code>${e(line)}</code><p>${e(text)}</p></div></div>`).join('')}</div><a class="source-link" href="${REPO}/blob/main/${lesson.source}" target="_blank" rel="noopener noreferrer">查看关联实现：${e(lesson.source)} ↗</a><div class="lesson-box"><h3>容易踩的坑</h3><p>${e(lesson.pitfall)}</p></div><div class="lesson-box"><h3>动手做一个小验证</h3><p>${e(lesson.challenge)}</p><a class="btn primary small" href="#/lab/${lesson.lab}" style="margin-top:14px">${icon('lab', 15)} ${e(labs[lesson.lab].title)}</a></div><div class="lesson-box"><h3>检查一下你的理解</h3><p style="color:var(--ink)">${e(lesson.quiz[0])}</p><div class="quiz-options">${lesson.quiz[1].map((option, i) => `<button class="quiz-option" data-answer="${i}"><span class="letter">${String.fromCharCode(65 + i)}</span>${e(option)}</button>`).join('')}</div><div id="quiz-feedback" aria-live="polite"></div></div><div class="button-row"><button class="btn ${done ? '' : 'primary'}" id="complete-lesson">${done ? '✓ 已掌握 · 点击取消标记' : '标记为已掌握'}</button><a class="text-link" href="#/glossary">术语速查</a></div><div class="lesson-sources"><span>延伸阅读：</span>${lesson.sources.map(key => `<a href="${sources[key][1]}" target="_blank" rel="noopener noreferrer">${e(sources[key][0])} ↗</a>`).join('')}</div><div class="lesson-bottom">${previous ? `<a class="btn small" href="#/learn/${previous.id}">← 上一课</a>` : '<span></span>'}${next ? `<a class="btn dark small" href="#/learn/${next.id}">下一课：${e(next.title)} →</a>` : '<a class="btn dark small" href="#/">回到学习总览 →</a>'}</div></article><aside class="lesson-aside"><div class="notice">先读概念，再运行实验。拿不准时，回到事件或代码，而不是凭感觉猜。</div><div class="card" style="margin-top:16px"><h3>这一阶段的课程</h3>${lessons.filter(l => l.chapter === lesson.chapter).map(l => `<a class="toc-link ${l.id === id ? 'current' : ''}" href="#/learn/${l.id}"><span>${String(l.number).padStart(2, '0')}</span>${e(l.title)}</a>`).join('')}<a class="text-link" style="display:block;margin-top:16px;font-size:11px" href="#/">查看完整学习路径 ↗</a></div></aside></div>`;
  main.querySelectorAll('[data-answer]').forEach(button => { button.onclick = () => {
    const correct = Number(button.dataset.answer) === lesson.quiz[2];
    main.querySelectorAll('[data-answer]').forEach(b => b.classList.remove('correct', 'wrong'));
    button.classList.add(correct ? 'correct' : 'wrong');
    main.querySelector('#quiz-feedback').innerHTML = note((correct ? '答对了。' : '再想一步。') + lesson.quiz[3], correct ? '' : 'warning');
  }; });
  main.querySelector('#complete-lesson').onclick = () => {
    const state = store.get();
    state.completed = state.completed.includes(id) ? state.completed.filter(x => x !== id) : [...state.completed, id];
    store.set(state); navigation();
    const marked = state.completed.includes(id), button = main.querySelector('#complete-lesson');
    button.textContent = marked ? '✓ 已掌握 · 点击取消标记' : '标记为已掌握'; button.classList.toggle('primary', !marked);
    notify(marked ? '进度已保存。下一次可以从这里继续。' : '已取消这一课的完成标记。');
  };
}

function labsPage() {
  main.innerHTML = heading('THE INTERACTIVE WORKBENCH', '交互实验室', '把参数改一改，把流程停一停。这里的所有实验都在本地运行，不需要模型或 API Key。') + `<div class="grid-3">${Object.entries(labs).map(([id, lab], i) => `<a class="card lab-card" href="#/lab/${id}"><div class="lab-card-head">${icon(lab.icon, 25)}<span class="badge green">LOCAL / ${String(i + 1).padStart(2, '0')}</span></div><h3>${e(lab.title)}</h3><p>${e(lab.description)}</p><span class="text-link">打开实验 ${icon('arrow', 14)}</span></a>`).join('')}</div>`;
}
function labPage(id) {
  if (!labs[id]) return notFound();
  const lab = labs[id];
  main.innerHTML = heading('EXPERIMENT / LOCAL ONLY', lab.title, lab.description, '<a class="btn small" href="#/labs">← 全部实验</a>') + '<div id="active-lab"></div><div class="section-title"><h3>把实验与概念连起来</h3></div><div class="button-row">' + lessons.filter(l => l.lab === id).map(l => `<a class="btn small" href="#/learn/${l.id}">${String(l.number).padStart(2, '0')} · ${e(l.title)}</a>`).join('') + '</div>';
  document.title = `${lab.title} · Harness Lab`;
  cleanup = mountLab(main.querySelector('#active-lab'), id, labContext);
}

function historyPage() {
  const state = store.get();
  main.innerHTML = heading('YOUR LOCAL NOTEBOOK', '学习记录', '只存储在当前浏览器，不跨设备同步。记录和导出可能含你输入的内容，请勿保存敏感资料。', `<div class="button-row"><button class="btn small" id="export-history">导出全部</button><button class="btn small danger" id="clear-history">清除本站学习数据</button></div>`) + note(`已保存 ${state.sessions.length} / 20 个会话。达到上限时保留最近记录；API Key 和连接设置不在存储字段中。`) + `<div style="margin-top:20px">${state.sessions.length ? state.sessions.map(s => `<section class="card history-card"><div class="history-head"><div><h3>${e(s.title)}</h3><p>${e(s.date ? new Date(s.date).toLocaleString('zh-CN') : '未知时间')} · ${s.mode === 'live' ? '真实 API' : '本地演示'} · ${s.messages.length} 条记录</p></div><div class="button-row"><button class="btn small" data-export="${e(s.id)}">导出</button><button class="btn small danger" data-delete="${e(s.id)}">删除</button></div></div><details><summary>展开记录内容</summary>${s.messages.map(m => `<div class="history-message"><span class="badge">${e(m.role)}</span><p style="margin-top:8px">${e(m.content)}</p></div>`).join('')}</details></section>`).join('') : `<div class="empty-state">${icon('history', 32)}<h3>还没有保存的轨迹或会话</h3><p>在循环观测台保存轨迹，或在 API 体验中勾选保存问答。</p><a class="btn primary" href="#/lab/trace">保存你的第一次运行 →</a></div>`}</div>`;
  main.querySelector('#export-history').onclick = () => { downloadJSON(state, 'harness-learning-history.json'); notify('已导出本地学习记录；分享前请检查其中的输入内容。'); };
  main.querySelector('#clear-history').onclick = () => { if (confirm('清除课程进度和所有学习会话？此操作无法撤销。')) { store.clear(); navigation(); historyPage(); notify('本站学习数据已清除。'); } };
  main.querySelectorAll('[data-export]').forEach(button => { button.onclick = () => { const s = state.sessions.find(s => s.id === button.dataset.export); downloadJSON({ version: 1, sessions: [s], completed: [] }, 'harness-session.json'); }; });
  main.querySelectorAll('[data-delete]').forEach(button => { button.onclick = () => { const next = store.get(); next.sessions = next.sessions.filter(s => s.id !== button.dataset.delete); store.set(next); navigation(); historyPage(); }; });
}

function glossaryPage() {
  main.innerHTML = heading('A SMALL ENGINEERING DICTIONARY', '术语速查', '用一句话建立直觉，再回到对应课程看细节。支持中文解释和英文术语搜索。') + '<label class="label" for="glossary-search">查找术语</label><input class="search-field" id="glossary-search" type="search" placeholder="试试：Token、权限、MCP、记忆…"><div id="glossary-list" class="grid-3"></div>';
  const update = () => {
    const query = main.querySelector('#glossary-search').value.toLowerCase().trim();
    const selected = glossary.filter(([term, definition]) => (term + ' ' + definition).toLowerCase().includes(query));
    main.querySelector('#glossary-list').innerHTML = selected.length ? selected.map(([term, definition, id]) => `<div class="card glossary-item"><h3>${e(term)}</h3><p>${e(definition)}</p><a href="#/learn/${id}">在课程中继续理解 ↗</a></div>`).join('') : '<div class="search-empty">没有匹配项。尝试更短的中文或英文词。</div>';
  };
  main.querySelector('#glossary-search').oninput = update; update();
}

function sourcePage() {
  main.innerHTML = heading('REFERENCES / OPEN SOURCE', '来源与开源声明', '课程自行撰写，示意图、图标与交互由本项目实现。下面列出官方文档与原始技术资料，供继续核对和阅读。') + note('接口与标准会演进。协议示例是明确的教学预设，具体模型能力以你所使用服务的最新文档为准。本站不代表任何模型供应商。') + `<div class="grid-2" style="margin-top:22px">${Object.entries(sources).map(([id, [title, url, description]]) => `<article class="card source-card"><span class="badge border">${e(id)}</span><h3 style="margin-top:13px">${e(title)}</h3><p>${e(description)}</p><a href="${url}" target="_blank" rel="noopener noreferrer">阅读原始资料 ↗</a></article>`).join('')}</div><div class="card" style="margin-top:24px"><h3>许可、依赖与贡献</h3><p style="font-size:13px;margin:12px 0">项目代码与原创课程采用 MIT 许可。运行时不依赖第三方包、字体 CDN 或遥测服务。外部资料的版权与商标归各自所有者，链接不表示合作或背书。Node.js、浏览器与可选 Playwright 测试工具遵循各自许可。</p><div class="button-row"><a class="btn small" href="${REPO}/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">MIT 许可 ↗</a><a class="btn small" href="${REPO}/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener noreferrer">贡献规范 ↗</a><a class="btn small" href="${REPO}/blob/main/docs/PAGES.md" target="_blank" rel="noopener noreferrer">页面与文件目录 ↗</a><a class="btn small" href="${REPO}/issues" target="_blank" rel="noopener noreferrer">报告问题 ↗</a></div></div>`;
}
function notFound() { main.innerHTML = heading('404', '这条学习路径还不存在', '返回总览，或者从实验目录重新选择。') + '<a class="btn primary" href="#/">返回总览 →</a>'; }
function render() {
  cleanup(); cleanup = () => {};
  route = location.hash.slice(1).split('?')[0] || '/';
  if (!route.startsWith('/')) route = '/';
  sidebar.classList.remove('open'); document.querySelector('#menu-toggle').setAttribute('aria-expanded', 'false');
  navigation();
  document.title = 'Harness Lab · 看见 AI 如何工作';
  const label = route === '/' ? '总览' : route.startsWith('/learn/') ? '课程学习' : route.startsWith('/lab') ? '交互实验' : route === '/playground' ? 'API 体验' : route === '/history' ? '学习记录' : route === '/glossary' ? '术语速查' : '参考资料';
  document.querySelector('#breadcrumb').innerHTML = `学习工作台 <span>/</span> ${label}`;
  if (route === '/') overview();
  else if (route.startsWith('/learn/')) lessonPage(route.split('/')[2]);
  else if (route === '/labs') labsPage();
  else if (route.startsWith('/lab/')) labPage(route.split('/')[2]);
  else if (route === '/playground') { main.innerHTML = heading('BRING YOUR MODEL / SMALL REQUESTS', 'API 体验工作台', '先用预设范例理解流程，再接入自己的模型。真实模式通过本机中继，一次只运行一个小请求。') + '<div id="playground"></div>'; cleanup = mountPlayground(main.querySelector('#playground'), labContext); }
  else if (route === '/history') historyPage();
  else if (route === '/glossary') glossaryPage();
  else if (route === '/sources') sourcePage();
  else notFound();
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', () => { render(); main.focus({ preventScroll: true }); });
window.addEventListener('pagehide', () => { cleanup(); clearTimeout(toastTimer); });
document.querySelector('#menu-toggle').onclick = () => { const open = sidebar.classList.toggle('open'); document.querySelector('#menu-toggle').setAttribute('aria-expanded', String(open)); };
document.addEventListener('keydown', event => { if (event.key === 'Escape') { sidebar.classList.remove('open'); document.querySelector('#menu-toggle').setAttribute('aria-expanded', 'false'); } });
document.addEventListener('click', event => { if (sidebar.classList.contains('open') && !sidebar.contains(event.target) && !event.target.closest('#menu-toggle')) { sidebar.classList.remove('open'); document.querySelector('#menu-toggle').setAttribute('aria-expanded', 'false'); } });
render();
