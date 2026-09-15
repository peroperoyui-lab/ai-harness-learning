import { PRESETS, PROTOCOLS, buildRequest } from './lib/protocol.js';
import { redactExact } from './lib/storage.js';
import { canResume, latestExplanationPair } from './lib/history.js';
import { calculate } from './lib/calculator.js';
import { escapeHTML as e, icon, json, note, session } from './ui.js';

const prompts = { explain: '用一句话解释 AI Harness 的作用。', json: '解释工具调用，输出 concept 与 meaning。', tool: '使用 calculator 计算 23 × 7。' };
const demos = {
  explain: '【预设演示】Harness 是围绕模型运行的工程设施，负责组织上下文、调用工具、检查权限、保存状态，并控制任务何时结束。',
  json: '{"concept":"工具调用","meaning":"模型提出结构化请求，程序验证并执行工具，再把结果提供给模型。"}',
  tool: '【预设演示】模型提出 calculator({"operation":"multiply","a":23,"b":7})。程序验证后真实计算出 161；本次不再调用模型。',
};

export function mountPlayground(root, { saveSession, notify, initialSession }) {
  let mode = 'simulation', config = null, busy = false, disposed = false, controller = null, messages = [], conversation = session('API 学习会话', []), previousPair = [], requestCount = 0;
  root.innerHTML = `<div class="playground-layout"><section class="card connection-panel"><h3>${icon('plug')} 连接与预算</h3><div class="mode-tabs" aria-label="体验模式"><button type="button" data-mode="simulation" class="active">无需密钥</button><button type="button" data-mode="live" disabled>真实 API</button></div><div id="relay-notice">${note('正在检查本机中继。离线演示始终可用。')}</div><div class="connection-fields" style="margin-top:18px"><div class="field full"><label for="demo-task">演示任务</label><select id="demo-task"><option value="explain">简短概念解释</option><option value="json">JSON 输出与校验</option><option value="tool">一次计算器工具调用</option></select></div><div id="live-settings" class="full" hidden><div class="field"><label for="provider-preset">服务预设</label><select id="provider-preset">${PRESETS.map(p => `<option value="${p.id}">${e(p.label)}</option>`).join('')}</select></div><div class="field"><label for="api-base">HTTPS Base URL</label><input id="api-base" type="url" value="${PRESETS[0].baseUrl}" spellcheck="false" autocomplete="off"><small>不含 /responses 等最终端点。</small></div><div class="field"><label for="api-protocol">协议类型</label><select id="api-protocol">${Object.entries(PROTOCOLS).map(([id, p]) => `<option value="${id}" ${id === 'responses' ? 'selected' : ''}>${e(p.label)}</option>`).join('')}</select></div><div class="field"><label for="api-model">模型名称</label><input id="api-model" placeholder="填写服务支持的准确模型标识" maxlength="120" spellcheck="false" autocomplete="off"></div><div class="field"><label for="api-key">API Key · 只留在本页内存</label><input id="api-key" type="password" placeholder="不会保存或导出" maxlength="500" autocomplete="off" spellcheck="false"><button class="btn small" id="clear-key" type="button">清除密钥</button></div><div class="field"><label for="api-limit">单次输出上限</label><select id="api-limit"><option>64</option><option selected>128</option><option>256</option></select><small>默认 128，上限 256；不自动重试。部分推理模型在小预算下可能没有可见输出。</small></div><label class="inline-check"><input id="carry-history" type="checkbox"><span>携带上一组问答（每条最多 400 字符，只适用于解释任务）。</span></label><label class="inline-check" style="margin-top:13px"><input id="api-consent" type="checkbox"><span>允许将本次提示词和密钥交给上方所选服务；确认此地址可信，并接受可能产生的小额费用。</span></label></div><div class="full" style="margin-top:18px"><label class="inline-check"><input id="persist-chat" type="checkbox"><span>将本页问答保存到当前浏览器。最多 20 个会话、每会话 40 条；不要保存敏感资料。</span></label></div></div></section>
  <div class="stack"><section class="chat-panel"><div class="chat-header"><div><h3>小请求，看懂大流程</h3><p style="font-size:11px;margin-top:4px">预览请求 → 手动发送 → 检查响应</p></div><span id="mode-badge" class="badge green">本地演示 · 0 Token</span></div><div id="chat-messages" class="chat-messages" aria-live="polite"></div><div id="chat-usage" class="usage-strip"><span>未发送真实请求</span><span>模型名称由你填写，不自动探测</span></div><div class="chat-input"><div class="preset-prompts">${Object.entries(prompts).map(([id, text]) => `<button type="button" data-prompt="${id}">${e(id === 'explain' ? '解释 Harness' : id === 'json' ? '生成 JSON' : '计算 23 × 7')}</button>`).join('')}</div><label class="label" for="chat-prompt">本次输入（最多 600 字符）</label><textarea id="chat-prompt" maxlength="600">${e(prompts.explain)}</textarea><div class="button-row"><span id="prompt-length" class="muted" style="font-size:11px"></span><div class="button-row"><button class="btn" id="chat-new" type="button">新会话</button><button class="btn danger" id="chat-stop" type="button" hidden>停止请求</button><button class="btn primary" id="chat-send" type="button">运行预设演示 ${icon('arrow', 16)}</button></div></div></div><details class="request-details"><summary>查看本次请求结构 · 不含密钥</summary><div id="request-preview"></div></details></section><div id="playground-error" aria-live="polite"></div>${note('教学边界：离线回复是固定范例，不会理解任意输入；真实模式每次只发一个请求。工具模式最多执行一个已验证的本地计算器调用，不自动再调用模型。')}</div></div>`;
  const $ = id => root.querySelector('#' + id);
  function readInput() {
    const task = $('demo-task').value;
    return { protocol: $('api-protocol').value, model: $('api-model').value || (mode === 'simulation' ? 'simulation-model' : ''), prompt: $('chat-prompt').value, maxTokens: Number($('api-limit').value), task, history: task === 'explain' && $('carry-history').checked ? previousPair.map(m => ({ role: m.role, content: m.content.slice(0, 400) })) : [] };
  }
  function preview() {
    $('prompt-length').textContent = `${$('chat-prompt').value.length} / 600 字符`;
    try { const request = buildRequest(readInput()); $('request-preview').innerHTML = `<p style="margin-top:12px">POST ${e(request.path)} ${mode === 'simulation' ? '· 只展示，不发送' : ''}</p>${json(request.body)}`; }
    catch (error) { $('request-preview').innerHTML = note(error.message, 'warning'); }
  }
  function showMessages() {
    $('chat-messages').innerHTML = messages.length ? messages.map(m => `<div class="chat-message ${m.role}"><div class="chat-avatar">${m.role === 'user' ? 'YOU' : 'AI'}</div><div class="chat-message-content"><small>${m.role === 'user' ? '你的输入' : mode === 'live' ? '服务返回 / 本地验证' : '确定性教学范例'}</small><p>${e(m.content)}</p></div></div>`).join('') : `<div class="empty-state" style="border:0">${icon('cycle', 30)}<h3>${mode === 'simulation' ? '不需要密钥，也能开始' : '你的密钥，你的模型，一次小请求'}</h3><p>选择一个预设任务，先看看请求长什么样。</p></div>`;
    $('chat-messages').scrollTop = $('chat-messages').scrollHeight;
  }
  function persist() {
    if (!$('persist-chat').checked || !messages.length) return;
    const key = $('api-key').value;
    conversation = { ...conversation, title: `${mode === 'live' ? '真实' : '预设'} · ${messages[0]?.content.slice(0, 35) || '学习会话'}`, mode, messages: messages.map(m => ({ role: m.role, content: redactExact(m.content, key), task: m.task })) };
    saveSession(conversation);
  }
  function lock(value) {
    busy = value;
    for (const element of root.querySelectorAll('input,select,textarea,[data-mode],[data-prompt],#chat-new,#clear-key,#chat-send')) element.disabled = value || (element.dataset.mode === 'live' && !config?.relay) || (element.id === 'chat-send' && mode === 'live' && !config?.relay);
    $('chat-stop').hidden = !value;
    $('chat-send').textContent = value ? '正在请求…' : mode === 'simulation' ? '运行预设演示 →' : '发送 1 次请求 →';
  }
  function fresh() {
    messages = []; previousPair = []; requestCount = 0; conversation = session('学习会话', []);
    $('carry-history').checked = false; $('playground-error').innerHTML = '';
    $('chat-usage').innerHTML = '<span>尚未发送本轮请求</span>';
    history.replaceState(null, '', '#/playground'); showMessages(); preview();
  }
  function resetRecipient() {
    $('api-consent').checked = false; $('carry-history').checked = false;
    previousPair = mode === 'live' ? latestExplanationPair(messages) : []; preview();
  }
  function changeMode(next) {
    if (busy || next === 'live' && !config?.relay) return;
    mode = next; $('live-settings').hidden = next !== 'live';
    root.querySelectorAll('[data-mode]').forEach(button => { button.classList.toggle('active', button.dataset.mode === mode); });
    $('mode-badge').textContent = mode === 'simulation' ? '本地演示 · 0 Token' : '真实 API · 手动触发';
    $('chat-usage').innerHTML = '<span>尚未发送本轮请求</span>';
    if (next === 'simulation') $('api-key').value = '';
    fresh(); lock(false);
  }
  async function send() {
    if (busy || (mode === 'live' && !config?.relay)) return;
    $('playground-error').innerHTML = '';
    let input;
    try { input = readInput(); buildRequest(input); }
    catch (error) { $('playground-error').innerHTML = note(error.message, 'error'); return; }
    if (mode === 'simulation') {
      const text = input.task === 'tool' ? demos.tool + '\n本地复核：' + calculate({ operation: 'multiply', a: 23, b: 7 }) : demos[input.task];
      messages.push({ role: 'user', content: input.prompt, task: input.task }, { role: 'assistant', content: text, task: input.task });
      messages = messages.slice(-40); previousPair = [];
      $('chat-usage').innerHTML = '<span>实际 API 请求：0</span><span>计费 Token：0</span><span>回答来自固定教学范例</span>';
      showMessages(); persist(); return;
    }
    const key = $('api-key').value, baseUrl = $('api-base').value;
    if (!key || !$('api-consent').checked) { $('playground-error').innerHTML = note('请填写密钥，并确认所选服务与费用授权。', 'warning'); return; }
    let target;
    try { target = new URL(baseUrl); } catch { $('playground-error').innerHTML = note('Base URL 无效。', 'error'); return; }
    if (target.protocol !== 'https:' || !config.allowedHosts.includes(target.hostname)) { $('playground-error').innerHTML = note('目标不是已允许的 HTTPS 主机。自定义服务需以 --allow-host=主机名 启动本机中继。', 'error'); return; }
    controller = new AbortController(); lock(true);
    try {
      const response = await fetch('/api/demo', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Harness-Client': '1' }, body: JSON.stringify({ ...input, baseUrl, apiKey: key }), signal: controller.signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '请求失败');
      if (disposed) return;
      requestCount++;
      let text = result.text || '服务没有返回可见文本。可能是输出预算不足、模型只提出工具调用，或服务返回了非文本内容。';
      if (result.calls?.length) text += '\n\n工具请求：' + JSON.stringify(result.calls, null, 2);
      if (result.validation) text += '\n\n验证：' + result.validation;
      if (result.toolResult !== null && result.toolResult !== undefined) text += '\n本地计算结果：' + result.toolResult;
      text = redactExact(text, key);
      const safePrompt = redactExact(input.prompt, key);
      // Only plain explanation turns can become context. Tool annotations are display-only.
      const task = input.task === 'explain' && (!result.text || result.calls?.length) ? undefined : input.task;
      messages.push({ role: 'user', content: safePrompt, task }, { role: 'assistant', content: text, task }); messages = messages.slice(-40);
      previousPair = latestExplanationPair(messages);
      const usage = result.usage || {}, quantity = value => value === null || value === undefined ? '未知' : e(value);
      $('chat-usage').innerHTML = `<span>成功请求：${requestCount}</span><span>输入：${quantity(usage.input)}</span><span>输出：${quantity(usage.output)}</span><span>缓存读取：${quantity(usage.cached)}</span><span>缓存写入：${quantity(usage.cacheCreation)}</span><span>停止：${e(result.finish || '未知')}</span>`;
      showMessages(); persist(); preview();
    } catch (error) {
      if (!disposed) $('playground-error').innerHTML = note(error.name === 'AbortError' ? '已停止本地等待并通知中继取消；服务商已经生成的 Token 仍可能收费。' : redactExact(error.message, key), 'error');
    } finally { if (!disposed) lock(false); controller = null; }
  }
  root.querySelectorAll('[data-mode]').forEach(button => { button.onclick = () => changeMode(button.dataset.mode); });
  root.querySelectorAll('[data-prompt]').forEach(button => { button.onclick = () => { $('demo-task').value = button.dataset.prompt; $('chat-prompt').value = prompts[button.dataset.prompt]; preview(); }; });
  $('demo-task').onchange = () => { $('chat-prompt').value = prompts[$('demo-task').value]; preview(); };
  $('provider-preset').onchange = () => { const preset = PRESETS.find(p => p.id === $('provider-preset').value); $('api-base').value = preset.baseUrl; $('api-protocol').value = preset.protocol; $('api-model').value = ''; $('api-key').value = ''; resetRecipient(); };
  for (const id of ['chat-prompt', 'api-limit', 'carry-history']) $(id).oninput = preview;
  for (const id of ['api-base', 'api-protocol', 'api-model']) $(id).oninput = resetRecipient;
  $('clear-key').onclick = () => { $('api-key').value = ''; notify('本页密钥已清除。'); };
  $('chat-send').onclick = send;
  $('chat-stop').onclick = () => controller?.abort();
  $('chat-new').onclick = fresh;
  $('persist-chat').onchange = persist;
  fetch('/api/config').then(response => response.ok ? response.json() : null).then(value => {
    if (disposed) return;
    const local = ['127.0.0.1', 'localhost'].includes(location.hostname);
    config = local && value?.relay && Array.isArray(value.allowedHosts) ? value : null;
    $('relay-notice').innerHTML = config ? note('本机中继可用。真实请求只在你切换模式并手动发送后发生。') : note('当前为静态课程站。真实 API 体验请下载仓库后运行 npm start，在本机打开页面。', 'warning');
    lock(false);
  }).catch(() => { if (!disposed) { $('relay-notice').innerHTML = note('没有本机中继；免密钥演示可正常使用。', 'warning'); lock(false); } });
  if (canResume(initialSession)) {
    conversation = { ...initialSession }; messages = initialSession.messages.map(m => ({ ...m }));
    mode = initialSession.mode === 'live' ? 'live' : 'simulation';
    previousPair = mode === 'live' ? latestExplanationPair(messages) : [];
    $('live-settings').hidden = mode !== 'live';
    root.querySelectorAll('[data-mode]').forEach(button => button.classList.toggle('active', button.dataset.mode === mode));
    $('mode-badge').textContent = mode === 'live' ? '历史真实会话 · 手动发送' : '历史预设会话 · 0 Token';
    $('playground-error').innerHTML = note('已恢复对话用于查看；没有恢复密钥、服务地址或费用授权，也没有发送请求。填写连接后，需重新勾选携带历史与保存问答。旧版未标注任务的问答只展示，不会发给模型。');
  }
  showMessages(); preview(); lock(false);
  return () => { disposed = true; controller?.abort(); $('api-key').value = ''; messages = []; previousPair = []; };
}
