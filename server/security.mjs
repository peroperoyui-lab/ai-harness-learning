import dns from 'node:dns/promises';
import net from 'node:net';
export const DEFAULT_HOSTS = ['api.openai.com', 'api.anthropic.com', 'api.deepseek.com'];
export function publicIPv4(ip) {
  if (net.isIP(ip) !== 4) return false;
  const [a, b, c] = ip.split('.').map(Number);
  if ([0, 10, 127].includes(a) || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) return false;
  if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}
export function validateBaseUrl(baseUrl, allowedHosts = DEFAULT_HOSTS) {
  if (typeof baseUrl !== 'string' || baseUrl.length > 500) throw new Error('Base URL 无效');
  let url;
  try { url = new URL(baseUrl); } catch { throw new Error('请输入完整 HTTPS Base URL'); }
  if (url.protocol !== 'https:' || (url.port && url.port !== '443')) throw new Error('只允许 HTTPS 默认端口');
  if (url.username || url.password || url.search || url.hash) throw new Error('地址不能包含凭证、查询参数或片段');
  if (net.isIP(url.hostname) || !allowedHosts.includes(url.hostname)) throw new Error('目标主机未获本机允许；自定义服务需启动时使用 --allow-host=主机名');
  if (!/^\/[a-zA-Z0-9_./-]*$/.test(url.pathname) || url.pathname.includes('..')) throw new Error('Base URL 路径无效');
  if (/\/(chat\/completions|responses|messages)\/?$/.test(url.pathname)) throw new Error('请填写 Base URL，不要包含最终请求端点');
  return url;
}
/** Resolve once, reject every non-public answer, then pin the verified address in HTTPS. */
export async function resolvePublic(hostname, lookup = dns.lookup) {
  const addresses = await lookup(hostname, { family: 4, all: true });
  if (!addresses.length || addresses.some(x => !publicIPv4(x.address))) throw new Error('拒绝私网、保留地址或不可用的 DNS 结果');
  return addresses[0].address;
}
export function validHostHeader(req) {
  const port = req.socket.localPort;
  return [`127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.host);
}
export function validOrigin(req) {
  return validHostHeader(req) && req.headers.origin === `http://${req.headers.host}` && req.headers['x-harness-client'] === '1';
}
export function validateKey(key) {
  if (typeof key !== 'string' || key.length < 1 || key.length > 500 || !/^[\x21-\x7e]+$/.test(key)) throw new Error('API Key 为空或包含无效字符');
  return key;
}
