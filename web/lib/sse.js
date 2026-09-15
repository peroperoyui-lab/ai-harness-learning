/** Minimal SSE data/event/id parser, including UTF-8 and split CRLF boundaries. */
export function createSSEParser(onEvent) {
  const decoder = new TextDecoder();
  let buffer = '', data = [], event = '', lastId = '';
  function line(value) {
    if (value === '') {
      if (data.length) onEvent({ event: event || 'message', data: data.join('\n'), id: lastId });
      data = []; event = ''; return;
    }
    if (value.startsWith(':')) return;
    const i = value.indexOf(':');
    const field = i === -1 ? value : value.slice(0, i);
    let content = i === -1 ? '' : value.slice(i + 1);
    if (content.startsWith(' ')) content = content.slice(1);
    if (field === 'data') data.push(content);
    if (field === 'event') event = content;
    if (field === 'id' && !content.includes('\0')) lastId = content;
  }
  function consume(final = false) {
    for (;;) {
      const i = buffer.search(/[\r\n]/);
      if (i < 0 || (!final && i === buffer.length - 1 && buffer[i] === '\r')) break;
      const width = buffer[i] === '\r' && buffer[i + 1] === '\n' ? 2 : 1;
      const current = buffer.slice(0, i);
      buffer = buffer.slice(i + width);
      line(current);
    }
  }
  return {
    push(bytes) { buffer += decoder.decode(bytes, { stream: true }); consume(); },
    end() { buffer += decoder.decode(); consume(true); buffer = ''; data = []; },
  };
}
