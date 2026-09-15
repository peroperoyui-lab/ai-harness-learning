/** Persistent fields are allow-listed. Configuration and API keys are never persisted. */
const KEY = 'harness-lab:v1';
const EMPTY = () => ({ version: 1, completed: [], sessions: [] });
export function sanitizeState(raw) {
  if (!raw || raw.version !== 1) return EMPTY();
  const completed = Array.isArray(raw.completed) ? [...new Set(raw.completed.filter(x => typeof x === 'string' && /^[a-z-]{1,40}$/.test(x)))].slice(0, 100) : [];
  const sessions = Array.isArray(raw.sessions) ? raw.sessions.slice(0, 20).filter(s => s && typeof s.id === 'string' && Array.isArray(s.messages)).map(s => ({
    id: s.id.slice(0, 80), title: String(s.title || '学习会话').slice(0, 80), mode: s.mode === 'live' ? 'live' : 'simulation', date: typeof s.date === 'string' ? s.date.slice(0, 40) : '',
    messages: s.messages.slice(-40).filter(m => m && ['user', 'assistant', 'event'].includes(m.role) && typeof m.content === 'string').map(m => ({ role: m.role, content: m.content.slice(0, 12000), ...(['explain', 'json', 'tool'].includes(m.task) ? { task: m.task } : {}) })),
  })) : [];
  return { version: 1, completed, sessions };
}
export function createStore(storage, onFailure = () => {}) {
  let state = EMPTY();
  try { state = sanitizeState(JSON.parse(storage.getItem(KEY) || 'null')); } catch { onFailure('本地记录无法读取；已使用临时会话。'); }
  return {
    get() { return structuredClone(state); },
    set(next) {
      state = sanitizeState(next);
      try { storage.setItem(KEY, JSON.stringify(state)); } catch { onFailure('浏览器存储不可用或已满；本次记录仅保留在内存。'); }
      return structuredClone(state);
    },
    clear() { state = EMPTY(); try { storage.removeItem(KEY); } catch { onFailure('浏览器拒绝清除存储；请在浏览器设置中清理本站数据。'); } },
  };
}
export function redactExact(text, secret) {
  return typeof secret === 'string' && secret.length ? String(text).split(secret).join('[REDACTED]') : String(text);
}
