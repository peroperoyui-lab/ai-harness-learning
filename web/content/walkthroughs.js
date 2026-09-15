/** Original, deterministic teaching snapshots. Not executed code or private reasoning. */
export const walkthroughs = {
  "harness": {
    "title": "把一个问题拆成三种责任",
    "why": "同一句“23 × 7 等于多少”，聊天界面只给答案；工程视图还要告诉你谁提出动作、谁执行、谁收束。",
    "stages": [
      {
        "title": "模型提出意图",
        "code": "{ name: \"calculator\", arguments: { operation: \"multiply\", a: 23, b: 7 } }",
        "observe": "此刻只有数据。还没有调用 calculate，工具结果应为空。"
      },
      {
        "title": "程序承担执行",
        "code": "const result = calculate({ operation: \"multiply\", a: 23, b: 7 });",
        "observe": "验证允许字段和数值范围后，普通 JavaScript 函数返回 161。"
      },
      {
        "title": "运行时决定下一步",
        "code": "state.phase = \"observe\"; // 回填结果，再判断是否继续",
        "observe": "将结果与调用 ID 配对。剩余调用预算允许时再请求模型；达到上限则停止。"
      }
    ],
    "probe": "把最多模型调用设为 1，能得到乘法结果和最终自然语言回答吗？",
    "answer": "在本站 success 场景中，工具仍可算出 161，但第二次模型调用被阻止，终态是 limited。工具成功与整项任务完成分别记录。",
    "transfer": "真正接模型时保留执行器和状态合同，只替换产生模型响应的适配器。"
  },
  "javascript": {
    "title": "跟踪一个值的类型变化",
    "why": "很多工具错误来自“看起来正确”的数据。把值和类型一起检查，比只盯着界面文字更容易定位。",
    "stages": [
      {
        "title": "文本进入程序",
        "code": "const raw = '{\"operation\":\"multiply\",\"a\":\"23\",\"b\":7}';",
        "observe": "raw 是 string。双引号包住 23，所以 a 也会被读为字符串。"
      },
      {
        "title": "解析不改变业务含义",
        "code": "const args = JSON.parse(raw);\n// typeof args.a === \"string\"",
        "observe": "JSON.parse 只恢复 JSON 所表达的值，不替你推断字段应是什么类型。"
      },
      {
        "title": "合同阻止错误传播",
        "code": "const errors = validateCalculator(args);\n// [\"a 必须是有限数字\"]",
        "observe": "验证失败时不会运行乘法。先修数据或明确转换规则，而非在执行函数里悄悄强制转换。"
      }
    ],
    "probe": "把 a 改成 null、删除 b、增加 extra 字段，哪些能通过 JSON.parse？",
    "answer": "三个都可以是合法 JSON，却分别违反数字类型、必需字段和额外字段约束。语法测试与合同测试需要分别存在。",
    "transfer": "读代码按“输入 → 转换 → 判断 → 副作用 → 返回”追踪，不必先背完整语言语法。"
  },
  "messages": {
    "title": "看清保存、发送与生成的三份数据",
    "why": "会话列表有十轮，不代表这次请求含十轮。模型能利用什么，先检查实际请求体。",
    "stages": [
      {
        "title": "浏览器里的历史",
        "code": "history = [user1, assistant1, user2, assistant2];",
        "observe": "这是应用保存的记录。保存本身不会发出请求，也不会更新模型权重。"
      },
      {
        "title": "本次选中的消息",
        "code": "input = [user2, assistant2, currentUser];",
        "observe": "仅选择最近一组问答并加入当前问题。应用指令通过对应协议的专用字段附加。"
      },
      {
        "title": "生成与计量",
        "code": "{ usage: { input: 120, output: 45 } } // 示例观测值",
        "observe": "usage 来自服务，不是本地按字数猜出的精确值。采样设置与模型支持需要单独核对。"
      }
    ],
    "probe": "从历史页继续会话，但不勾选“携带上一组问答”，旧消息会进入请求吗？",
    "answer": "不会。历史会显示在页面中，但请求预览的历史数组为空。只有明确选择后，最近一组合格的简短解释问答才会进入请求。",
    "transfer": "缓存通常由服务侧匹配输入实现；本地保存历史、上下文选择与计费缓存是三种不同机制。"
  },
  "protocols": {
    "title": "同一个预算怎样变成三个字段",
    "why": "协议名负责选择序列化规则；模型名负责选择该入口上的模型。两者不要混成一个模糊的“服务类型”。",
    "stages": [
      {
        "title": "统一应用输入",
        "code": "{ protocol: \"responses\", model: \"your-model\", maxTokens: 128 }",
        "observe": "应用层统一表达输出预算，完整输入还需要 prompt 与任务类型。"
      },
      {
        "title": "映射到请求体",
        "code": "Responses: max_output_tokens\nChat modern: max_completion_tokens\nChat compatible / Messages: max_tokens",
        "observe": "字段的拼写、位置和支持范围是适配器责任。不要失败后自动改协议并再次计费。"
      },
      {
        "title": "归一化响应",
        "code": "{ text, calls, usage, finish }",
        "observe": "Chat 从 choices、Responses 从 output、Messages 从 content 提取信息。缺失用量保留未知。"
      }
    ],
    "probe": "把完整 /chat/completions 地址填入 Base URL，会发生什么？",
    "answer": "中继会明确拒绝，避免再次追加端点。先核对服务入口和最终路径，再判断是字段错误、模型权限还是网络错误。",
    "transfer": "新协议先写离线请求与响应夹具，验证字段和错误分支，再用一次低预算真实调用验证兼容性。"
  },
  "loop": {
    "title": "用状态证明动作发生的次序",
    "why": "循环里最重要的不是 while 的写法，而是每个分支何时能执行，以及怎样保证停止后不再推进。",
    "stages": [
      {
        "title": "运行中",
        "code": "receive → context → model → validate",
        "observe": "每次 advanceRun 产生一个新快照。旧快照可回看，事件指出刚刚发生了什么。"
      },
      {
        "title": "暂停也是状态",
        "code": "permission → awaiting_approval",
        "observe": "等待批准时，自动播放暂停；继续点击不会让计算器偷偷运行。"
      },
      {
        "title": "终态不可继续",
        "code": "completed | failed | denied | cancelled | limited",
        "observe": "不同终态保留不同原因。再次推进终态应返回同样状态，而非新一次工具调用。"
      }
    ],
    "probe": "在等待批准时点“停止任务”，然后尝试继续，会怎样？",
    "answer": "终态应为 cancelled，工具不执行。重新开始需要显式重置。这可以用状态断言验证，不依赖按钮颜色。",
    "transfer": "区分 phase（停在哪一步）与 status（运行状态），调试时同时检查。"
  },
  "tools": {
    "title": "一次调用要通过三道门",
    "why": "工具描述帮助模型选择；Schema 描述结构；授权规则决定此用户能否执行。三者分别维护、共同生效。",
    "stages": [
      {
        "title": "名字在注册表中",
        "code": "registry.has(call.name) // calculator",
        "observe": "名称必须对应已有实现。模型返回未知名字时，不创建或下载任意程序。"
      },
      {
        "title": "参数符合合同",
        "code": "{ operation: \"multiply\", a: 23, b: 7 }",
        "observe": "必须使用数字，只能 add 或 multiply，不接受额外字段，绝对值最多 1,000,000。"
      },
      {
        "title": "调用与结果配对",
        "code": "{ role: \"tool\", tool_call_id: \"call_1\", content: \"161\" }",
        "observe": "call ID 标记的是具体调用。两个相同工具并发时，工具名不足以区分它们的结果。"
      }
    ],
    "probe": "模型返回 a: \"23\"，为什么不直接做一次乘法试试？",
    "answer": "隐式转换容易掩盖合同错误。工具边界先拒绝非法类型，测试才能稳定复现；需要宽容解析时应单独定义并测试转换规则。",
    "transfer": "带副作用的工具还要加资源范围、幂等键、审批和审计，参数正确只是其中一层。"
  },
  "streaming": {
    "title": "一段中文为什么不能按网络块拆字符串",
    "why": "网络块边界、UTF-8 字符边界、SSE 事件边界、模型输出片段边界彼此不同。必须分层解析。",
    "stages": [
      {
        "title": "字节逐块抵达",
        "code": "decoder.decode(bytes, { stream: true })",
        "observe": "“你”的 UTF-8 编码可能被拆开。流式解码器保留尚未闭合的字符字节。"
      },
      {
        "title": "完整文本行才交给解析器",
        "code": "event: delta\ndata: 你好\n\n",
        "observe": "空行提交一个 SSE 事件。一个网络块可以含多个事件，一个事件也可能跨多个块。"
      },
      {
        "title": "按事件语义累积输出",
        "code": "onEvent(event) → parse data → append delta",
        "observe": "只在事件闭合后处理 data。真实接口还可能交错发出文本、工具参数和结束事件。"
      }
    ],
    "probe": "把块大小改成 1 字节，最终文字会改变吗？",
    "answer": "不会。本站会得到同样的完整文字和三个事件；中间只是在更多次递送后才出现完整事件。若结果改变，说明解析器错误地依赖了网络块边界。",
    "transfer": "部分工具参数也会流式抵达；必须等参数完整并校验后再执行。此站真实 API 仍是非流式，实验专门测试解析。"
  },
  "reliability": {
    "title": "把重试写成一个受限决定",
    "why": "请求失败不能直接推出“再发一次就好”。先判断请求是否已产生外部效果，再看错误类型和剩余预算。",
    "stages": [
      {
        "title": "确定失败在哪一层",
        "code": "400 / 401 / 429 / timeout",
        "observe": "字段错误应修参数，鉴权错误应检查凭证；限流与暂时故障才可能适合有界退避。"
      },
      {
        "title": "区分只读与写入",
        "code": "read document ≠ send email ≠ charge payment",
        "observe": "超时可能发生在上游已完成操作之后。重复写入可能重复发信或重复扣费。"
      },
      {
        "title": "写下终止条件",
        "code": "retry only when allowed && attempts < limit",
        "observe": "生产实现还需要抖动、总时限和幂等处理。本站真实模式不自动重试，方便观察一次请求的费用边界。"
      }
    ],
    "probe": "停止按钮已经取消本地等待，这次调用一定不收费吗？",
    "answer": "不一定。取消信号只能尽力传播；上游可能已经生成部分输出或完成操作。界面应保留这个区别，不把取消说成撤销。",
    "transfer": "做故障注入测试时，分别模拟提交前失败、执行后响应丢失和重试预算耗尽。"
  },
  "context": {
    "title": "亲手算一次上下文预算",
    "why": "先用能复算的小数字理解策略，再换成供应商 tokenizer 和实际窗口限制。",
    "stages": [
      {
        "title": "算可用容量",
        "code": "1600 - 250 = 1350",
        "observe": "总容量 1600，输出预留 250，输入可用 1350；这里只是教学单位。"
      },
      {
        "title": "先装必需内容",
        "code": "180 + 120 = 300",
        "observe": "应用规则与当前问题共占 300。必需项不足时显式报告 overflow。"
      },
      {
        "title": "再按优先级装入",
        "code": "300 + 260 + 380 + 320 + 90 = 1350",
        "observe": "工具、证据、最近问答、技能摘要恰好装满。较早问答被舍弃，完整技能默认未选中。"
      }
    ],
    "probe": "把完整技能也勾上，它一定能挤掉最近问答吗？",
    "answer": "不能。本站按显式优先级贪心装箱，完整技能优先级低于最近问答；是否被选中与是否能装入是两件事。",
    "transfer": "生产上下文单元还需包含工具调用依赖、来源和裁剪理由，不能简单逐条截断数组。"
  },
  "rag": {
    "title": "分别检查召回和答案忠实性",
    "why": "RAG 的质量问题可以定位到“材料没找到”或“找到了但答案没依据”，这比笼统评价模型更可操作。",
    "stages": [
      {
        "title": "查询转成词项",
        "code": "\"工具权限\" → [\"工具\", \"具权\", \"权限\"]",
        "observe": "本项目中文使用双字片段，没有神经嵌入模型；它容易解释，也会漏掉同义词。"
      },
      {
        "title": "计算排序",
        "code": "TF-IDF → 向量归一化 → cosine",
        "observe": "稀有词的重合通常更有区分力。只返回非零候选，Top-k 是上限而非必须凑满的数量。"
      },
      {
        "title": "把结论连回材料",
        "code": "claim → evidence ID → original passage",
        "observe": "材料得分高不保证事实可靠；答案应引用实际支持它的片段，缺乏证据时明确空缺。"
      }
    ],
    "probe": "查询一个没有词面重合的同义表达，检索为空证明知识库没有答案吗？",
    "answer": "不能。可能是检索表示不匹配。可比较关键词改写、嵌入召回或混合检索；同时单独检查引用是否支持答案。",
    "transfer": "评估集应同时标注预期证据与答案要求，检索 Recall@k 和回答忠实性分别报告。"
  },
  "memory": {
    "title": "聊天记录怎样重新成为上下文",
    "why": "恢复显示只是第一步。数据格式、消息角色、任务类型和发送授权还要逐项确认。",
    "stages": [
      {
        "title": "读回持久记录",
        "code": "{ version: 1, sessions: [{ id, mode, messages }] }",
        "observe": "只接受约定字段，密钥和连接配置不在记录合同里；记录使用同源浏览器存储。"
      },
      {
        "title": "恢复到工作台",
        "code": "saved messages → visible transcript",
        "observe": "继续会话后仍需填写真实连接信息。默认不发送历史，也不自动调用模型。"
      },
      {
        "title": "显式选择发送内容",
        "code": "latest complete explanation pair → max 400 chars each",
        "observe": "JSON、工具记录和旧格式未知任务记录不自动作为解释上下文；通过请求预览核对最终内容。"
      }
    ],
    "probe": "导入一个同 ID 会话会覆盖原来的记录吗？",
    "answer": "不会。导入会创建新 ID 副本，并在合并前显示确认。总量超过 20 时会提示旧记录淘汰风险，应先导出备份。",
    "transfer": "检查点恢复与聊天续聊不同；外部写入任务要保存已完成动作和幂等信息，避免恢复后重复执行。"
  },
  "skills": {
    "title": "从技能目录到按需读取",
    "why": "把技能理解为可检索的工作说明与资源包，便能区分模型能力、程序知识和实际执行权限。",
    "stages": [
      {
        "title": "先读目录",
        "code": "[{ name: \"citation-audit\", description: \"核验引文\" }]",
        "observe": "入口元数据说明何时使用。尚未把所有说明和脚本塞进上下文。"
      },
      {
        "title": "选中后加载说明",
        "code": "load selected SKILL.md → load relevant reference",
        "observe": "任务匹配后加载主说明，再按需要取子资源。这种分层读取减少无关上下文。"
      },
      {
        "title": "执行仍受运行时约束",
        "code": "requested script → policy → approval → sandbox",
        "observe": "说明中的文字不会扩大授权。外部脚本需要来源、版本、可访问资源和执行限制。"
      }
    ],
    "probe": "文献任务加载十份网页设计技能，会发生什么？",
    "answer": "输入负担和指令冲突机会都会增加，而且不直接帮助核验文献。目录匹配、实际加载清单和任务效果应一起检查。",
    "transfer": "本站演示容量选择，不执行外部 Skill。真正添加加载器时要测试路径穿越、未知版本和不可信脚本。"
  },
  "workflow": {
    "title": "用依赖而非直觉安排并行",
    "why": "两个任务都要运行并不表示它们互相依赖。把数据依赖画清，关键路径才能算对。",
    "stages": [
      {
        "title": "串行基线",
        "code": "A(3) → B(5) → 汇总(2)",
        "observe": "总等待为 10。三个任务按固定顺序开始。"
      },
      {
        "title": "独立分支并发",
        "code": "A(3) ─┐\nB(5) ─┴→ 汇总(2)",
        "observe": "理想时长 max(3,5)+2=7，总工作量仍为 10。"
      },
      {
        "title": "处理部分失败",
        "code": "Promise.allSettled → inspect each result",
        "observe": "需要部分结果时逐项收集。Promise.all 拒绝并不会自动取消另外的请求。"
      }
    ],
    "probe": "把 A 改为 8，B 保持 5，并行流程需要多长时间？",
    "answer": "理想时长为 max(8,5)+2=10。A 成为关键路径，总工作量为 15；真实系统还要计入调度和排队。",
    "transfer": "有依赖的步骤保持串行；并发度上限则由资源、供应商限流和任务预算共同决定。"
  },
  "multi-agent": {
    "title": "给“专家”一份可检验的任务单",
    "why": "角色名字只提供意图，输入输出合同与控制权才决定系统怎样协作。",
    "stages": [
      {
        "title": "拆分子任务",
        "code": "{ role: \"retriever\", goal, evidenceScope, outputSchema }",
        "observe": "每个角色只获得完成子任务需要的资料和工具，不复制完整聊天和凭证。"
      },
      {
        "title": "明确控制权",
        "code": "delegate → result returns to coordinator",
        "observe": "委派时主 Agent 等待结果并保留汇总责任；handoff 则转交后续控制权。"
      },
      {
        "title": "汇总前核验",
        "code": "validate schema → check citations → resolve conflicts",
        "observe": "多个模型可能共享同一个错误来源。先检查证据链，再处理意见差异。"
      }
    ],
    "probe": "三个 Agent 得到相同答案，可信度可以直接按三份独立证据计算吗？",
    "answer": "不可以直接这样算。它们可能使用相同来源、提示或错误前提，需要检查证据独立性，并和单 Agent 基线比较。",
    "transfer": "本站只模拟调度和任务分工。真实多 Agent 还需要隔离状态、预算分配、取消传播和失败汇总。"
  },
  "mcp": {
    "title": "区分模型连线和工具连线",
    "why": "用户应用一侧同时存在两条不同连接：请求模型生成输出，以及通过 MCP 访问外部能力。",
    "stages": [
      {
        "title": "明确参与者",
        "code": "Host → Client → MCP Server",
        "observe": "Host 管理客户端和权限，Server 提供 tools、resources、prompts；模型服务是另一端。"
      },
      {
        "title": "按明确版本发现能力",
        "code": "2026-07-28: server/discover\nolder versions: initialize / initialized",
        "observe": "新规范使用请求级元数据与发现；旧版初始化序列不能直接当作新版本报文。接入时固定 SDK 与协议版本。"
      },
      {
        "title": "执行前仍要授权",
        "code": "tools/list → validate → authorize → tools/call",
        "observe": "工具名、参数、结果和来源需经过 Host 检查。发现工具不等于获得用户授权。"
      }
    ],
    "probe": "看到一个 HTTP JSON 接口，就能把 Base URL 填进模型适配器当 MCP 使用吗？",
    "answer": "不能。模型 API 与 MCP 的方法、消息合同和生命周期不同。先辨认接口属于哪一层，再使用对应客户端。",
    "transfer": "这里是版本化报文阅读训练，没有连接真实 MCP Server。传输层区分 stdio 与 Streamable HTTP，SSE 可承载 HTTP 流事件。"
  },
  "artifacts": {
    "title": "让“完成了”有可检查的证据",
    "why": "下游程序需要稳定的数据和真实存储结果，而不是只听到模型声称“文件已创建”。",
    "stages": [
      {
        "title": "语法验证",
        "code": "JSON.parse(modelText)",
        "observe": "失败说明文本格式不合法。不要把 Markdown 包裹或解释段落直接交给 JSON 消费者。"
      },
      {
        "title": "合同验证",
        "code": "{ concept: string, meaning: string }",
        "observe": "字段、类型和额外项满足约定后，仍需要核验事实与引用。此站 JSON 模式使用提示约束。"
      },
      {
        "title": "真实交付",
        "code": "content → storage result → artifact reference",
        "observe": "保存内容、格式版本、来源和可核查标识。下载记录的 JSON 来自真实程序序列化。"
      }
    ],
    "probe": "两个必需字段都是字符串，就说明答案事实正确吗？",
    "answer": "不说明。结构验证确保下游能读取，事实验证检查内容与证据相符；两套标准应分别记录结果。",
    "transfer": "支持 schema-constrained output 的供应商也有拒绝、截断和不支持的 Schema 子集，需要完整错误处理。"
  },
  "permissions": {
    "title": "让授权绑定到一次具体动作",
    "why": "批准界面应足以让人判断真实后果，批准结果还要与准备执行的参数一致。",
    "stages": [
      {
        "title": "展示操作对象",
        "code": "{ action: \"write\", path: \"notes/a.md\", scope: \"this-call\" }",
        "observe": "这是权限概念示意；本站不会执行此文件写入。用户应看到目标、内容摘要和后果。"
      },
      {
        "title": "等待明确决定",
        "code": "status = \"awaiting_approval\"",
        "observe": "等待期间不执行，拒绝与取消都是正常结束方式，不引导模型绕过。"
      },
      {
        "title": "绑定动作后执行",
        "code": "approvedCall === pendingCall",
        "observe": "生产系统可绑定调用 ID 与参数摘要，并处理审批过期、身份和恢复后的重新验证。"
      }
    ],
    "probe": "用户批准后，目标路径被改成另一个目录，可以直接沿用批准吗？",
    "answer": "不能。批准应绑定原动作与参数，变化后重新判断。否则界面上的同意与实际执行对象会脱节。",
    "transfer": "审批不替代工具自身的资源范围限制；先限制可做什么，再确认这一次是否该做。"
  },
  "injection": {
    "title": "把资料当资料，把权限交给程序",
    "why": "攻击可以不含熟悉的关键词。观察是否触发告警，同时验证独立权限规则仍然生效。",
    "stages": [
      {
        "title": "保留来源",
        "code": "{ trust: \"external\", sourceId: \"doc-4\", text }",
        "observe": "网页、检索结果和导入消息均为输入资料，不会因为正文写“管理员”而提升角色。"
      },
      {
        "title": "检测只做提示",
        "code": "suspicious text → warning",
        "observe": "规则会误报与漏报。普通研究讨论也可能包含攻击词，关键词不能单独决定信任。"
      },
      {
        "title": "实际行动由策略控制",
        "code": "requested action → allow-list + scope + approval",
        "observe": "未允许的删除或外发即使没有告警也被阻止；外部文本按文字显示，不执行 HTML。"
      }
    ],
    "probe": "去掉可疑文本的所有关键词，再请求删除操作，会放行吗？",
    "answer": "本站仍应拒绝。策略依据动作白名单，而不依据是否命中敏感词。这个实验分别观察检测与执行两层。",
    "transfer": "生产系统还需网络出口控制、最小权限凭证、输出处理和持续攻击回归，单条提示词不能覆盖全部风险。"
  },
  "sandbox": {
    "title": "顺着凭证和数据的路径做审计",
    "why": "每经过一个组件，都问它是否需要看到这份数据、保存多久、出错时会不会进入日志。",
    "stages": [
      {
        "title": "浏览器输入",
        "code": "key in current page memory",
        "observe": "浏览器明文内存并非安全保险箱；避免复制到历史或配置导出，使用可撤销低额度凭证。"
      },
      {
        "title": "本机中继",
        "code": "127.0.0.1 → allow-listed HTTPS host",
        "observe": "校验 Origin、主机白名单和公网地址，固定验证后的解析结果，不跟随重定向。"
      },
      {
        "title": "完成后清理",
        "code": "abort pending request; clear key on route exit",
        "observe": "密钥不进入学习存储。关闭页面不等于停止 Node 服务，服务应由 Ctrl+C 结束。"
      }
    ],
    "probe": "把本地监听地址改成 0.0.0.0，就成为可以给别人用的安全服务了吗？",
    "answer": "没有。多用户部署需要独立的身份认证、租户隔离、配额、会话和凭证管理；当前中继按个人本机学习场景设计。",
    "transfer": "生产隔离应说明文件、网络、进程、时间和资源边界，而不是只贴一个“沙箱”标签。"
  },
  "budget": {
    "title": "算清一次请求与一项任务的差别",
    "why": "一个任务可能包含多次模型调用、工具成本和重试。输出上限只约束其中一部分。",
    "stages": [
      {
        "title": "划分输入",
        "code": "input=1000; cached=600; uncached=400",
        "observe": "本例总输入包含缓存命中部分。不同服务的 usage 口径可能不同，不能盲目相加。"
      },
      {
        "title": "按假设单价计算",
        "code": "(400 × 1 + 600 × 0.2 + 128 × 3) / 1e6",
        "observe": "得到 0.000904 个货币单位。这里使用输入 1、缓存 0.2、输出 3 的每百万教学单价。"
      },
      {
        "title": "放到任务层",
        "code": "task cost = sum(request costs) + other charges",
        "observe": "若五次调用具有相同用量，则为 0.00452。真实上下文常增长，不一定每次都相同。"
      }
    ],
    "probe": "API 的输出上限是 128，最多总共消耗 128 Token 吗？",
    "answer": "不是。仍包含发送的输入，部分模型还会涉及推理 Token 或其他计费项。小预算可能导致没有可见输出，应检查停止原因和 usage。",
    "transfer": "教学预设不追踪实时价格。实际使用以目标服务的用量口径、价格与账单为准。"
  },
  "traces": {
    "title": "用记录回答“到底卡在哪里”",
    "why": "一条完成提示无法解释失败；带阶段和关联标识的记录可以把问题定位到具体边界。",
    "stages": [
      {
        "title": "关联整次任务",
        "code": "{ traceId: \"run-1\", span: \"model-request\", turn: 1 }",
        "observe": "生产轨迹可为子操作设置起止时间、父子关系和必要错误码；本站事件是简化教学记录。"
      },
      {
        "title": "观察工具边界",
        "code": "validate → permission → execute → observe",
        "observe": "查看最后成功的节点，就能区分参数未通过、等待审批和执行失败。"
      },
      {
        "title": "只记录必要信息",
        "code": "{ code: \"INVALID_ARGUMENT\", field: \"a\" }",
        "observe": "不要默认记录完整凭证和敏感输入。可观测性有价值，过量日志也会带来数据泄漏与成本。"
      }
    ],
    "probe": "界面说“处理中”，轨迹停在 awaiting_approval，应该等待网络恢复吗？",
    "answer": "应先处理审批状态。它与网络请求超时不同；清晰的运行状态让排障从猜测变成检查。",
    "transfer": "Trace 展示外部可观察动作和数据，不展示或猜测模型私有思维过程。"
  },
  "evals": {
    "title": "把一次修复变成长期约束",
    "why": "先有能暴露问题的案例，再修改实现，最后确认旧功能仍然通过。",
    "stages": [
      {
        "title": "建立可失败的基线",
        "code": "multiply(23, 7) → 30 // 错把所有运算做成加法",
        "observe": "只测试 add(2,3)=5 会误以为实现正确；测试要覆盖不同操作与边界。"
      },
      {
        "title": "增加反例与拒绝测试",
        "code": "negative, zero, string input, extra field",
        "observe": "拒绝非法输入也是正确行为。业务成功率不能只统计返回了某个结果。"
      },
      {
        "title": "比较修复前后",
        "code": "same cases → baseline vs fixed implementation",
        "observe": "使用相同输入和标准，保留失败案例作为回归。本站五个案例的通过率不是模型智力分数。"
      }
    ],
    "probe": "五个案例全过，就证明工具和 Agent 永远正确吗？",
    "answer": "只证明这些案例与断言通过。还需边界、随机或性质测试，并把真实故障转成新案例；不要扩大测试结论的范围。",
    "transfer": "真实模型评估还要固定模型版本与参数，处理随机波动，分别报告任务正确性、费用、延迟和越权行为。"
  },
  "deployment": {
    "title": "先分清静态网页和本机服务",
    "why": "构建产物与服务进程承担不同工作。理解两者，可以避免把密钥塞进公开网页以“补全功能”。",
    "stages": [
      {
        "title": "本机运行",
        "code": "npm start → http://127.0.0.1:4173",
        "observe": "Node 同时提供课程文件和受限 API 中继。关闭浏览器后服务仍存在，Ctrl+C 才停止。"
      },
      {
        "title": "静态构建",
        "code": "npm run build → dist/",
        "observe": "dist 只含前端文件。公开静态站支持课程与本地演示，不执行 Node 中继。"
      },
      {
        "title": "提交前验证",
        "code": "npm run verify → browser smoke → PR",
        "observe": "语法、内容合同、单元与服务集成、浏览器交互属于不同层。CI 失败要读日志而非忽略红灯。"
      }
    ],
    "probe": "静态站显示真实 API 不可用，是不是一定坏了？",
    "answer": "不一定。此项目有意把公开课程与持有密钥的本机中继分开。需要真实请求时下载仓库并本机运行。",
    "transfer": "依赖新增、存储变更、权限放宽应独立审查。可复现的测试与清晰目录比不断换框架更重要。"
  },
  "capstone": {
    "title": "独立验收你的最小 Harness",
    "why": "最终产物应是一组可以重放并核查的行为，而不只是课程完成标记。",
    "stages": [
      {
        "title": "先验收零密钥路径",
        "code": "success → result=161, modelCalls=2",
        "observe": "打开循环观测台，逐步检查输入、上下文、工具请求、结果配对和完成终态。"
      },
      {
        "title": "再验收失败与恢复",
        "code": "invalid → failed; deny → denied; limit=1 → limited",
        "observe": "逐一验证非法参数不执行、拒绝不绕过、预算不超出，并保存轨迹和恢复学习记录。"
      },
      {
        "title": "最后替换真实模型",
        "code": "preview → explicit send → inspect response",
        "observe": "手填模型与可信地址，默认 128 输出，一次手动请求。没有真实凭证时只报告离线与 mock 测试结果。"
      }
    ],
    "probe": "接入一个更强模型后，能删掉参数校验、审批和预算了吗？",
    "answer": "不能因此删掉。模型能力决定它提出什么，运行设施决定允许执行什么、能否恢复和怎样验证。更换模型也应跑相同回归案例。",
    "transfer": "下一步可选择减法工具、一个新的协议夹具或更好的上下文策略做小 PR；一次只增加一个可测试能力。"
  }
};
