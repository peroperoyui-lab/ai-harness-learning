/** Teaching algorithms; no model calls. Context costs and durations are illustrative. */
export function packContext(items, capacity, reserve) {
  if (![capacity, reserve].every(Number.isFinite) || reserve < 0 || capacity < reserve) throw new Error('无效容量');
  const required = items.filter(x => x.required), available = capacity - reserve;
  let used = required.reduce((n, x) => n + x.tokens, 0);
  if (used > available) return { selected: [], excluded: items, used, available, overflow: true };
  const ids = new Set(required.map(x => x.id));
  for (const item of items.filter(x => !x.required).toSorted((a, b) => b.priority - a.priority)) {
    if (used + item.tokens <= available) { ids.add(item.id); used += item.tokens; }
  }
  return { selected: items.filter(x => ids.has(x.id)), excluded: items.filter(x => !ids.has(x.id)), used, available, overflow: false };
}
export function terms(text) {
  const chunks = String(text).toLowerCase().match(/[a-z0-9_]+|[\p{Script=Han}]+/gu) || [];
  return chunks.flatMap(x => /[\p{Script=Han}]/u.test(x) ? (x.length === 1 ? [x] : Array.from({ length: x.length - 1 }, (_, i) => x.slice(i, i + 2))) : [x]);
}
/** TF-IDF cosine over Chinese bigrams and Latin words, not semantic embeddings. */
export function retrieve(query, documents, topK = 3) {
  const bags = documents.map(d => terms(`${d.title} ${d.text}`));
  const idf = new Map([...new Set(bags.flat())].map(t => [t, Math.log((documents.length + 1) / (1 + bags.filter(b => b.includes(t)).length)) + 1]));
  const vector = bag => {
    const v = new Map();
    for (const t of bag) if (idf.has(t)) v.set(t, (v.get(t) || 0) + idf.get(t));
    const norm = Math.hypot(...v.values()) || 1;
    return new Map([...v].map(([k, value]) => [k, value / norm]));
  };
  const q = vector(terms(query));
  return documents.map((d, i) => {
    const v = vector(bags[i]);
    return { ...d, score: [...q].reduce((s, [t, w]) => s + w * (v.get(t) || 0), 0), matches: [...q.keys()].filter(t => v.has(t)) };
  }).filter(d => d.score > 0).toSorted((a, b) => b.score - a.score).slice(0, Math.max(1, Math.min(5, topK)));
}
export function costOf({ input, cached, output, inputPrice, cachePrice, outputPrice, calls }) {
  if (![input, cached, output, inputPrice, cachePrice, outputPrice, calls].every(x => Number.isFinite(x) && x >= 0) || cached > input) throw new Error('数值必须非负，缓存输入不能超过总输入');
  return ((input - cached) * inputPrice + cached * cachePrice + output * outputPrice) / 1000000 * calls;
}
export function scheduleWorkflow(mode, durations = [3, 5, 2]) {
  const labels = ['检索主题 A', '检索主题 B', '汇总结果'];
  let clock = 0;
  const tasks = durations.map((duration, i) => {
    const start = mode === 'parallel' && i < 2 ? 0 : mode === 'parallel' ? Math.max(...durations.slice(0, 2)) : clock;
    clock = start + duration;
    return { label: labels[i], start, duration, end: clock };
  });
  return { tasks, latency: Math.max(...tasks.map(t => t.end)), work: durations.reduce((a, b) => a + b, 0) };
}
