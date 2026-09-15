import https from 'node:https';
import { resolvePublic } from './security.mjs';
import { normalizeResponse } from '../web/lib/protocol.js';
import { calculate } from '../web/lib/calculator.js';
import { redactExact } from '../web/lib/storage.js';

export async function callUpstream({ url, protocol, body, apiKey, signal }) {
  const address = await resolvePublic(url.hostname);
  if (signal.aborted) throw new Error('请求已停止');
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (protocol === 'anthropic') { headers['x-api-key'] = apiKey; headers['anthropic-version'] = '2023-06-01'; }
  else headers.Authorization = `Bearer ${apiKey}`;
  const data = await new Promise((resolve, reject) => {
    const request = https.request(url, {
      method: 'POST', headers, signal, agent: false,
      lookup(_host, options, callback) {
        if (options.all) callback(null, [{ address, family: 4 }]); else callback(null, address, 4);
      },
    }, response => {
      if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
        response.resume();
        const status = response.statusCode || 502;
        const hint = status === 401 || status === 403 ? '检查凭证、模型权限与服务区域' : status === 429 ? '服务限流或配额不足' : status >= 300 && status < 400 ? '重定向已阻止，请填写最终可信服务地址' : '检查模型名、协议和参数兼容性';
        reject(new Error(`上游 HTTP ${status}：${hint}。未自动重试。`));
        return;
      }
      let size = 0;
      const chunks = [];
      response.on('data', chunk => {
        size += chunk.length;
        if (size > 262144) { response.destroy(); reject(new Error('上游响应超过学习演示大小限制')); }
        else chunks.push(chunk);
      });
      response.on('error', () => reject(new Error('读取上游响应失败')));
      response.on('end', () => {
        try { resolve(JSON.parse(redactExact(Buffer.concat(chunks).toString('utf8'), apiKey))); }
        catch { reject(new Error('上游没有返回有效 JSON')); }
      });
    });
    request.on('error', () => reject(new Error(signal.aborted ? '请求已停止或超时；已产生的费用不一定撤销' : '网络连接失败；请检查网络和服务地址')));
    request.end(JSON.stringify(body));
  });
  return normalizeResponse(protocol, data);
}

/** Only one registered pure tool can execute, with no automatic model follow-up. */
export function interpretResult(result, task) {
  const output = { ...result, toolResult: null, validation: null };
  if (task === 'tool' && result.calls.length) {
    if (result.calls.length !== 1 || result.calls[0].name !== 'calculator') {
      output.validation = '拒绝：只允许一次 calculator 调用';
    } else {
      try {
        const raw = result.calls[0].arguments;
        const args = typeof raw === 'string' ? JSON.parse(raw) : raw;
        output.toolResult = calculate(args);
        output.validation = '工具参数通过；本地计算已完成，未再次调用模型';
      } catch { output.validation = '工具参数未通过 JSON 或计算器合同验证；未执行'; }
    }
  } else if (task === 'tool') output.validation = '模型未提出工具调用；未执行工具，也未自动重试';
  if (task === 'json') {
    try {
      const value = JSON.parse(result.text);
      output.validation = value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 2 && typeof value.concept === 'string' && typeof value.meaning === 'string' ? 'JSON 语法与两个字符串字段验证通过；事实仍需核验' : 'JSON 可解析，但 concept / meaning 合同未通过';
    } catch { output.validation = '输出不是有效 JSON；本演示使用提示约束，不保证结构化生成'; }
  }
  return output;
}
