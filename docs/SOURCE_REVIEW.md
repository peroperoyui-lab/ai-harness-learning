# 本轮技术来源复核

复核日期：2026-09-16。教学内容为原创改写；外部页面仅提供技术依据，许可仍归原作者。链接更新不是运行兼容性证明。

| 来源 | 核对内容 | 对应处理 |
| --- | --- | --- |
| [Anthropic：Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) | 固定工作流、自治循环与复杂度选择 | 保留工作流/多 Agent 的职责和成本对照，不将角色标签当协作质量保证 |
| [Anthropic：Context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) | 有限上下文、信息选择、渐进装载 | 增加可核算装箱案例；说明保存记录与发送上下文不同 |
| [Agent Skills](https://agentskills.io/home) | 可移植说明及按需读取 | 将教学快照与真正执行外部技能脚本区分 |
| [MCP 2026-07-28 架构](https://modelcontextprotocol.io/docs/2026-07-28/learn/architecture) | Host/Client/Server、逐请求元数据、发现、传输 | 固定本课版本；从泛化的初始化描述改为当前 server/discover 与 _meta，并说明旧版生命周期差异 |
| [OpenAI Chat reference](https://developers.openai.com/api/reference/resources/chat) | 消息、输出预算、工具字段与兼容差异 | 保留 modern 与 compatible 两种独立预设和边界测试 |
| [Anthropic Messages reference](https://platform.claude.com/docs/en/api/messages/create) | 顶层 system、max_tokens、content 数组 | 保留独立适配器，不将 Chat Completions 结构直接套用 |

Responses 参考页面在本次检索中未能可靠读取；该适配器保留既有实现和 mock 合同测试，本轮没有据此宣称完成新的真实兼容性核验。其维护入口仍列在课程来源页，修改字段前应重新核对官方文档。

MCP 的课程只做架构/报文阅读，不实现 MCP Client。2026-07-28 中服务端须实现 server/discover；客户端是否先发发现请求是可选的。不能将“服务端必须支持”误写成“客户端每次调用都必须先发现”。生产应用应选择与所用 SDK、服务端一致的规范版本。
