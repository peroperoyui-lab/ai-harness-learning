import { sanitizeState } from './storage.js';

export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
/** Only a complete, explicitly labelled explanation pair is eligible for resending. */
export function latestExplanationPair(messages) {
  const pair = Array.isArray(messages) ? messages.slice(-2) : [];
  if (pair.length !== 2 || pair[0]?.role !== 'user' || pair[1]?.role !== 'assistant' ||
      pair.some(m => m.task !== 'explain' || typeof m.content !== 'string' || !m.content.trim())) return [];
  return pair.map(m => ({ role: m.role, content: m.content.slice(0, 400) }));
}
export function canResume(record) {
  return Boolean(record && Array.isArray(record.messages) && record.messages.length &&
    record.messages.every(m => ['user', 'assistant'].includes(m.role)));
}
/** Reject unknown versions instead of silently resetting the learner's current data. */
export function parseHistoryImport(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) throw new Error('导入文件不能超过 2 MiB');
  let value;
  try { value = JSON.parse(text); } catch { throw new Error('文件不是有效 JSON'); }
  if (!value || value.version !== 1 || !Array.isArray(value.sessions) || !Array.isArray(value.completed)) throw new Error('需要 version: 1、sessions 和 completed；不支持此文件格式');
  if (value.sessions.length > 20 || value.sessions.some(s => !s || typeof s.id !== 'string' || !s.id || !Array.isArray(s.messages) || s.messages.length > 40 || s.messages.some(m => !m || !['user', 'assistant', 'event'].includes(m.role) || typeof m.content !== 'string' || m.content.length > 12000))) throw new Error('记录字段无效，或超过 20 个会话 / 每会话 40 条的限制');
  return sanitizeState(value);
}
/** Import a copy on ID collision. Nothing from imported configuration is adopted. */
export function mergeHistory(current, incoming) {
  const base = sanitizeState(current), added = sanitizeState(incoming);
  const ids = new Set(base.sessions.map(s => s.id));
  const sessions = added.sessions.map(s => {
    let id = s.id, index = 1;
    while (ids.has(id)) id = `${s.id.slice(0, 60)}-import-${index++}`;
    ids.add(id);
    return { ...s, id };
  });
  return sanitizeState({ version: 1, completed: [...base.completed, ...added.completed], sessions: [...sessions, ...base.sessions] });
}
