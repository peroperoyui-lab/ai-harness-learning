export default [
  {
    id: 'loop', title: '一个 Agent 循环怎样转起来', subtitle: '状态、动作、观测与终止', minutes: 16, lab: 'trace', goal: '把一次任务拆成状态转移，并解释每次循环为什么需要新观测。',
    sections: [
      ['循环的骨架', '先构建上下文，再请求模型。若得到最终文本就结束；若得到工具调用，就校验、授权、执行，把结果加入历史，再进入下一轮。这个骨架很小，但每个箭头都意味着数据契约和错误处理。模型调用轮数与页面上的步骤数不同，一次模型调用前后可以经过多个程序步骤。'],
      ['状态机让过程可以检查', '状态可以是 ready、running、awaiting_approval、completed、failed 等。一个运行在某一刻只能有一个明确状态；处于等待审批时，不应继续执行。状态转移由事件触发，页面只是显示状态，不应该用动画是否结束来决定工具是否执行。'],
      ['循环依靠新证据推进', '工具执行结果、错误和用户决定都是外部观测。重复相同请求却没有新增信息，会浪费预算。生产系统常加入最大轮数、重复调用检测、时间限制和停滞检测。本课程先实现轮数上限，方便逐步验证终止行为。'],
    ],
    code: [['while (turn < maxTurns) {', '教学伪代码：上限由程序控制。'], ['  const reply = await model(context);', 'model 是可替换的接口。'], ['  if (reply.final) return reply.text;', '明确识别终止输出。'], ['  const result = await checkedTool(reply.call);', '包含验证、授权和错误处理。'], ['  context = appendObservation(context, result);', '让下一轮获得新观测。'], ['  turn += 1;', '统计模型调用次数。'], ['}', '达到上限后还需记录 limited 终态。']],
    source: 'web/lib/engine.js', codeLabel: '控制流伪代码；抽象函数用于说明职责',
    pitfall: '把 while(true) 和模型接口直接连起来，可能产生无法收束的费用与副作用。', challenge: '把最大轮数设为 1，观察工具已经计算完成但模型尚未生成最终解释时，为什么仍会触发上限。',
    quiz: ['工具结果回填的主要目的是什么？', ['让动画更漂亮', '为下一次模型决策提供新观测', '自动增加模型权重'], 1, '工具结果改变本轮上下文，不会更新模型权重。'], sources: ['agents'],
  },
  {
    id: 'tools', title: '把工具做成可靠的合同', subtitle: 'Schema、业务验证、调用 ID 与返回值', minutes: 17, lab: 'schema', goal: '拦截合法 JSON 中不合法的工具参数。',
    sections: [
      ['工具定义描述可调用能力', '名称让程序定位实现，描述帮助模型选择，参数 Schema 描述输入结构。calculator 只允许 add 或 multiply，并要求 a、b 是指定范围内的有限数字。工具定义越明确，越容易构造测试与诊断失败。本站手写的验证器只实现这个固定合同，不是通用 JSON Schema 引擎。'],
      ['模型给出的参数也是不可信输入', '即使供应商支持结构化工具调用，运行时仍要验证工具是否注册、字段是否合法、对象是否过大、请求者是否有权限。不能把模型生成的任意字符串直接当程序执行。计算器使用显式分支完成加法或乘法，不需要执行任意表达式。'],
      ['请求与结果必须配对', '调用 ID 把工具请求和工具响应连接起来。多次调用时，只有工具名不足以区分每一次结果。失败也应形成清楚的观测：例如 INVALID_ARGUMENT，而不是把报错文本伪装成成功输出。真实演示最多执行一次允许的计算器调用，不自动发起第二次模型请求。'],
    ],
    code: [['const errors = validateCalculator(args);', '逐项检查允许字段、枚举、类型和范围。'], ['if (errors.length) throw new Error(errors.join(";"));', '尽早失败；不给错误数据进入执行器。'], ['return args.operation === "add"', '显式选择允许的运算。'], ['  ? args.a + args.b', '加法分支。'], ['  : args.a * args.b;', '乘法分支；没有任意代码执行。']],
    source: 'web/lib/calculator.js', codeLabel: '项目计算器的核心逻辑片段',
    pitfall: 'Schema 验证不能替代授权。例如“金额为数字”不代表用户有权转账。', challenge: '依次试验缺少 b、额外字段、字符串数字、超范围数字，记录验证层给出的差异。',
    quiz: ['参数合法后，写文件工具还需要什么？', ['无需任何检查', '权限、路径及副作用检查', '把温度调低'], 1, '结构、业务规则与权限是不同的检查层。'], sources: ['schema', 'messages'],
  },
  {
    id: 'streaming', title: '让一段回复逐步抵达', subtitle: '字节块、SSE 事件、文本增量与取消', minutes: 15, lab: 'stream', goal: '在故意切碎的字节流中，仍正确拼出中文事件。',
    sections: [
      ['网络块不是一个完整事件', '流式传输中，一次读取可能只有半个事件，也可能包含多个事件，甚至把一个中文字符的 UTF-8 字节切开。解码器要保留未完成字符，协议解析器要缓存未完成行。先解析完整事件，再根据事件类型更新消息；不要对每个网络块直接 JSON.parse。'],
      ['SSE 的层次', 'SSE 以文本行表示字段，空行结束一个事件，data 可以跨多行。供应商还会在 data 内定义自己的 JSON 结构。SSE 是单向事件流，WebSocket 是双向通信通道；流式文本并不必须使用 WebSocket。本站实验喂入固定的本地字节，不会连接真实服务。'],
      ['停止需要传递到网络层', '界面上的停止按钮应触发 AbortController，并将断开信号传给上游请求。已生成的内容应保留并标明被中断，资源和计时器也要清理。取消本地等待不能保证服务商没有产生费用。本项目真实小额体验使用非流式响应，SSE 作为独立可测试实验。'],
    ],
    code: [['const parser = createSSEParser(event => events.push(event));', '建立解析器，收到完整事件才回调。'], ['for (const bytes of chunks) parser.push(bytes);', '每个 bytes 可以在任意字符位置结束。'], ['parser.end();', '结束解码；未以空行闭合的事件不会被伪造为完整事件。'], ['const controller = new AbortController();', '另一个概念：创建网络取消信号。'], ['controller.abort();', '显式停止等待；并非退款操作。']],
    source: 'web/lib/sse.js', codeLabel: '调用真实 SSE 解析器的片段；最后两行示意取消',
    pitfall: '一个 chunk、一个 SSE event 和一个 token 是三个不同概念。', challenge: '把每块字节数调为 1，逐步发送。观察许多块抵达后才出现一个完整的中文事件。',
    quiz: ['为什么需要流式 TextDecoder？', ['提升模型智力', '避免把跨块的 UTF-8 字符错误解码', '节省全部输出 Token'], 1, '解码器跨调用保留未完成的字节序列。'], sources: ['sse'],
  },
  {
    id: 'reliability', title: '失败之后应该做什么', subtitle: '分类、超时、重试、退避与幂等', minutes: 15, lab: 'trace', goal: '把“再试一次”转换成有边界的工程策略。',
    sections: [
      ['先判断错误属于哪一层', 'JSON 语法错误、参数错误、认证错误、请求超限、上游故障和用户取消，需要不同处理。修改参数可能修复 400；检查凭证与权限可能修复 401 或 403；临时限流可能需要等待。没有分类就盲目重试，既浪费费用，也会掩盖问题。'],
      ['重试也是一次新的行动', '重试需要次数上限、总时间预算和可追踪的 attempt 编号。指数退避加入随机扰动可以减少同时重试的拥堵；具体策略仍应遵守上游规则。本站真实体验故意不自动重试，错误后由用户检查配置并决定是否再次发送。'],
      ['副作用不能随便重复', '超时可能发生在远端已经完成操作之后。重新发送支付或写入动作可能造成重复结果。幂等键、操作去重和提交状态查询用于降低这个风险。对只读请求与有副作用的动作应采取不同策略；取消不是失败重试的理由。'],
    ],
    code: [['if (error.kind === "invalid_argument") return showFix(error);', '伪代码：让用户修正输入。'], ['if (error.kind === "cancelled") return stop();', '尊重用户停止意图。'], ['if (!operation.idempotent) return requestReview();', '非幂等动作先确认远端状态。'], ['if (attempt >= retryLimit) return fail(error);', '重试有明确上限。'], ['await wait(backoff(attempt));', '等待策略应考虑服务端提示。']],
    source: 'server/index.mjs', codeLabel: '生产重试策略伪代码；本项目真实请求不自动重试',
    pitfall: '网络超时只说明客户端没有及时得到结果，不说明远端没有执行。', challenge: '在参数错误场景定位失败事件，再与循环上限场景比较：这两种结束为什么不应采用同一种重试策略？',
    quiz: ['写入超时后最应先确认什么？', ['是否提高温度', '远端是否已完成以及操作是否幂等', '能否无限重试'], 1, '先判断重复动作是否会产生额外副作用。'], sources: ['async'],
  },
];
