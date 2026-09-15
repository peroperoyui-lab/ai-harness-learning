/** Shared by the browser inspector and server. Credentials never enter this module. */
export const PROTOCOLS = {
  'chat-modern': { label: 'OpenAI Chat · modern', path: '/chat/completions', limit: 'max_completion_tokens' },
  'chat-compatible': { label: 'Chat Completions · compatible', path: '/chat/completions', limit: 'max_tokens' },
  responses: { label: 'OpenAI Responses', path: '/responses', limit: 'max_output_tokens' },
  anthropic: { label: 'Anthropic Messages', path: '/messages', limit: 'max_tokens' },
};
export const PRESETS = [
  { id: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', protocol: 'responses' },
  { id: 'deepseek', label: 'DeepSeek / Chat 兼容', baseUrl: 'https://api.deepseek.com', protocol: 'chat-compatible' },
  { id: 'anthropic', label: 'Anthropic', baseUrl: 'https://api.anthropic.com/v1', protocol: 'anthropic' },
  { id: 'custom', label: '自定义可信服务', baseUrl: '', protocol: 'chat-compatible' },
];
export const TOOL_SCHEMA = {
  type: 'object', properties: {
    operation: { type: 'string', enum: ['add', 'multiply'] },
    a: { type: 'number', minimum: -1000000, maximum: 1000000 },
    b: { type: 'number', minimum: -1000000, maximum: 1000000 },
  }, required: ['operation', 'a', 'b'], additionalProperties: false,
};
export const SYSTEMS = {
  explain: '你是 AI Harness 入门教师。用中文简短回答，尽量不超过 80 字。',
  json: '只输出一个 JSON 对象，包含 concept 和 meaning 两个字符串字段。内容简短，不要 Markdown。',
  tool: '请用 calculator 完成用户要求的加法或乘法。只提出一次工具调用，不要自行执行。',
};
export function validateDemo(input) {
  if (!input || typeof input !== 'object') throw new Error('请求格式错误');
  const { protocol, model, prompt, maxTokens = 128, task = 'explain', history = [] } = input;
  if (!Object.hasOwn(PROTOCOLS, protocol)) throw new Error('不支持的协议');
  if (typeof model !== 'string' || !model.trim() || model.length > 120 || /[\r\n]/.test(model)) throw new Error('请输入有效模型名称（最多 120 字符）');
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 600) throw new Error('本次输入必须为 1–600 字符');
  if (![64, 128, 256].includes(maxTokens)) throw new Error('输出上限只能为 64、128 或 256');
  if (!Object.hasOwn(SYSTEMS, task)) throw new Error('无效演示类型');
  if (!Array.isArray(history) || ![0, 2].includes(history.length)) throw new Error('最多携带上一组完整问答');
  if (history.length && (history[0]?.role !== 'user' || history[1]?.role !== 'assistant')) throw new Error('历史必须是 user、assistant 配对');
  for (const m of history) if (typeof m.content !== 'string' || m.content.length > 400) throw new Error('单条历史最多 400 字符');
  if (task !== 'explain' && history.length) throw new Error('结构化和工具演示不携带历史');
  return { protocol, model: model.trim(), prompt: prompt.trim(), maxTokens, task, history: history.map(m => ({ role: m.role, content: m.content })) };
}
export function buildRequest(input) {
  const c = validateDemo(input);
  const messages = [...c.history, { role: 'user', content: c.prompt }], system = SYSTEMS[c.task];
  let body;
  if (c.protocol === 'responses') body = { model: c.model, instructions: system, input: messages, max_output_tokens: c.maxTokens, store: false, stream: false };
  else if (c.protocol === 'anthropic') body = { model: c.model, system, messages, max_tokens: c.maxTokens, stream: false };
  else body = { model: c.model, messages: [{ role: 'system', content: system }, ...messages], [PROTOCOLS[c.protocol].limit]: c.maxTokens, stream: false };
  if (c.task === 'tool') {
    const tool = { name: 'calculator', description: 'Add or multiply two finite numbers.', parameters: TOOL_SCHEMA };
    if (c.protocol === 'anthropic') body.tools = [{ name: tool.name, description: tool.description, input_schema: TOOL_SCHEMA }];
    else if (c.protocol === 'responses') body.tools = [{ type: 'function', ...tool, strict: false }];
    else body.tools = [{ type: 'function', function: tool }];
  }
  return { path: PROTOCOLS[c.protocol].path, body };
}
const count = value => Number.isFinite(value) && value >= 0 ? value : null;
export function normalizeResponse(protocol, data) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || data.error) throw new Error('服务返回了错误或无效对象');
  let text = '', calls = [], finish = null;
  const usage = data.usage || {};
  if (protocol === 'responses') {
    if (!Array.isArray(data.output)) throw new Error('缺少 Responses output');
    text = data.output.filter(x => x.type === 'message').flatMap(x => x.content || []).map(x => x.text || x.refusal || '').join('');
    calls = data.output.filter(x => x.type === 'function_call').map(x => ({ name: x.name, arguments: x.arguments, id: x.call_id }));
    finish = data.status || null;
  } else if (protocol === 'anthropic') {
    if (!Array.isArray(data.content)) throw new Error('缺少 Messages content');
    text = data.content.filter(x => x.type === 'text').map(x => x.text || '').join('');
    calls = data.content.filter(x => x.type === 'tool_use').map(x => ({ name: x.name, arguments: x.input, id: x.id }));
    finish = data.stop_reason || null;
  } else {
    const choice = data.choices?.[0];
    if (!choice?.message) throw new Error('缺少 Chat choices[0].message');
    text = typeof choice.message.content === 'string' ? choice.message.content : choice.message.refusal || '';
    calls = (choice.message.tool_calls || []).map(x => ({ name: x.function?.name, arguments: x.function?.arguments, id: x.id }));
    finish = choice.finish_reason || null;
  }
  return { text: String(text).slice(0, 12000), calls: calls.slice(0, 4), finish,
    usage: { input: count(usage.input_tokens ?? usage.prompt_tokens), output: count(usage.output_tokens ?? usage.completion_tokens), cached: count(usage.input_tokens_details?.cached_tokens ?? usage.prompt_tokens_details?.cached_tokens ?? usage.cache_read_input_tokens), cacheCreation: count(usage.cache_creation_input_tokens) } };
}
