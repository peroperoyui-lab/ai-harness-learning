/** A real local tool with a deliberately small input contract. */
export function validateCalculator(value) {
  const errors = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ['参数必须是 JSON 对象'];
  for (const key of Object.keys(value)) {
    if (!['operation', 'a', 'b'].includes(key)) errors.push(`不允许额外字段：${key}`);
  }
  if (!['add', 'multiply'].includes(value.operation)) errors.push('operation 只能是 add 或 multiply');
  for (const key of ['a', 'b']) {
    if (typeof value[key] !== 'number' || !Number.isFinite(value[key])) errors.push(`${key} 必须是有限数字`);
    else if (Math.abs(value[key]) > 1000000) errors.push(`${key} 绝对值不能超过 1000000`);
  }
  return errors;
}
export function calculate(args) {
  const errors = validateCalculator(args);
  if (errors.length) throw new Error(errors.join('；'));
  return args.operation === 'add' ? args.a + args.b : args.a * args.b;
}
