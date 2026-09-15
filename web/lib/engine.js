import { calculate, validateCalculator } from './calculator.js';
export const SCENARIOS = { success: '正常完成', invalid: '参数类型错误', approval: '等待人工批准', loop: '反复调用，触发上限' };
const terminal = ['completed', 'failed', 'limited', 'denied', 'cancelled'];
export function createRun(scenario = 'success', maxTurns = 3) {
  if (!Object.hasOwn(SCENARIOS, scenario)) throw new Error('未知场景');
  if (!Number.isInteger(maxTurns) || maxTurns < 1 || maxTurns > 8) throw new Error('轮数必须为 1–8');
  return { scenario, maxTurns, phase: 'receive', status: 'ready', turns: 0, events: [], messages: [], result: null, call: null };
}
/** Every transition is deterministic. The model is scripted; the calculator is real. */
export function advanceRun(previous, decision) {
  const s = structuredClone(previous);
  if (terminal.includes(s.status)) return s;
  if (s.status === 'awaiting_approval' && !['approve', 'deny'].includes(decision)) return s;
  const node = s.phase;
  const emit = (title, detail, data = {}) => s.events.push({ index: s.events.length + 1, node, title, detail, data });
  s.status = 'running';
  switch (s.phase) {
    case 'receive':
      s.messages.push({ role: 'user', content: '计算 23 × 7。' });
      emit('接收任务', '创建运行状态；尚未调用模型。', s.messages[0]);
      s.phase = 'context'; break;
    case 'context':
      emit('组装上下文', '挑选指令、消息历史和工具定义。', { messages: s.messages.length, tool: 'calculator' });
      s.phase = 'model'; break;
    case 'model':
      if (s.turns >= s.maxTurns) {
        s.status = 'limited';
        emit('触发轮数上限', '在下一次模型调用之前停止。', { modelCalls: s.turns });
      } else {
        s.turns++;
        if (s.result !== null && s.scenario !== 'loop') {
          s.messages.push({ role: 'assistant', content: `23 × 7 = ${s.result}。` });
          emit('返回最终文本', '这是预设模型输出，不是真实模型推理。', s.messages.at(-1));
          s.phase = 'done';
        } else {
          s.call = { id: `call_${s.turns}`, name: 'calculator', arguments: { operation: 'multiply', a: s.scenario === 'invalid' ? '23' : 23, b: 7 } };
          s.messages.push({ role: 'assistant', tool_calls: [structuredClone(s.call)] });
          emit('提出工具请求', '模型提出工具名与参数；乘法尚未执行。', s.call);
          s.phase = 'validate';
        }
      }
      break;
    case 'validate': {
      const errors = validateCalculator(s.call.arguments);
      emit(errors.length ? '参数验证失败' : '参数验证通过', errors.length ? errors.join('；') : '检查参数类型、允许字段和数值范围。', { errors });
      if (errors.length) s.status = 'failed'; else s.phase = 'permission';
      break;
    }
    case 'permission':
      if (s.scenario === 'approval' && !decision) {
        emit('等待人工批准', '模拟需确认的工作流；不会写入真实文件。');
        s.status = 'awaiting_approval';
      } else if (decision === 'deny') {
        emit('用户拒绝', '未执行工具；拒绝是正常终态。');
        s.status = 'denied';
      } else {
        emit('权限通过', '纯计算工具按预设规则放行；模拟审批只对本次有效。');
        s.phase = 'tool';
      }
      break;
    case 'tool':
      s.result = calculate(s.call.arguments);
      emit('执行本地工具', '这里真正运行 JavaScript 乘法。', { result: s.result });
      s.phase = 'observe'; break;
    case 'observe':
      s.messages.push({ role: 'tool', tool_call_id: s.call.id, content: String(s.result) });
      emit('回填工具结果', '通过调用 ID 配对；下一轮模型才读得到结果。', s.messages.at(-1));
      s.phase = 'context'; break;
    case 'done':
      emit('完成并收束', '记录终态，释放资源。', { result: s.result, modelCalls: s.turns });
      s.status = 'completed'; break;
    default: throw new Error('无效状态');
  }
  return s;
}
export function cancelRun(previous) {
  const s = structuredClone(previous);
  if (!terminal.includes(s.status)) {
    s.status = 'cancelled';
    s.events.push({ index: s.events.length + 1, node: s.phase, title: '用户停止', detail: '停止本地运行，无后台请求。', data: {} });
  }
  return s;
}
