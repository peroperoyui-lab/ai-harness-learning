# API 体验与本机中继

真实体验链路：`web/playground.js → POST /api/demo → shared buildRequest → HTTPS provider → normalizeResponse → local validation → UI`。浏览器只请求本机同源地址，不把密钥从公共静态页面直接发送到第三方服务。

## 启动与填写

```bash
npm start
# 或显式允许一个你信任的服务主机
npm start -- --allow-host=llm.example
```

浏览器打开终端中的本机地址，进入 API 体验并切换真实模式。服务预设只填写 Base URL 和协议，模型名称必须由用户按自己账户可用标识填写。切换服务会清空旧模型、密钥和授权勾选，避免误发到另一个服务。

Base URL 例如 `https://api.openai.com/v1`，不要加 `/responses`；DeepSeek 预设为 `https://api.deepseek.com`。中继按协议追加一次端点路径。地址不支持查询参数、非 443 端口、私网或仅 IPv6 的目标。

## 统一输入合同

以下示意不含真实密钥：

```json
{
  "protocol": "responses",
  "model": "your-model",
  "prompt": "用一句话解释 Harness。",
  "maxTokens": 128,
  "task": "explain",
  "history": [],
  "baseUrl": "https://api.openai.com/v1",
  "apiKey": "YOUR_TEMPORARY_KEY"
}
```

`protocol`：`chat-modern`、`chat-compatible`、`responses` 或 `anthropic`。

`task`：`explain`、`json` 或 `tool`。解释任务可携带上一组完整问答；其他任务不携带历史。JSON 任务通过提示要求 `concept` 和 `meaning` 两个字符串字段，返回后执行语法与字段校验，不声称采用供应商强制 Schema 输出。

工具任务提供相同的计算器合同，但序列化成不同协议的工具形状。返回后仅允许一次 `calculator` 调用，检查名称、参数、枚举、类型、额外字段和数值范围，然后执行本地加法／乘法。不会自动把结果再次发给模型。模型没有提出调用、提出多个调用或参数不合法时，只显示说明，不重试或假装执行成功。

## 请求与响应映射

| 内部协议 | 路径 | 指令位置 | 输出上限 |
| --- | --- | --- | --- |
| `chat-modern` | `/chat/completions` | `messages` 的 system 角色 | `max_completion_tokens` |
| `chat-compatible` | `/chat/completions` | `messages` 的 system 角色 | `max_tokens` |
| `responses` | `/responses` | `instructions`，消息在 `input` | `max_output_tokens` |
| `anthropic` | `/messages` | 顶层 `system` | `max_tokens` |

默认不发送 temperature、top-p 等并非所有模型都支持的参数。当前真实请求为非流式；流式解析通过本地 SSE 实验学习。Responses 发送 `store:false`，它不是所有供应商零保留的保证。

认证由中继注入：Chat／Responses 使用 Bearer，Messages 使用 `x-api-key` 和 `anthropic-version: 2023-06-01`。用户不能通过请求传入任意头覆盖这些边界。

归一化结果包含 `text`、`calls`、`finish`、`usage`、`toolResult` 和 `validation`。输入、输出、缓存读取、缓存写入按照上游对应字段展示；未提供时为 `null`，页面显示“未知”。例如 Anthropic 的缓存输入字段可能与普通输入字段分开，不在 UI 中擅自合成跨服务总量或统一账单。

## 明确的学习预算

| 项目 | 限制 |
| --- | --- |
| 本次 prompt | 最多 600 字符；字符数不等于 Token 数 |
| 模型名称 | 1–120 字符 |
| 输出上限 | 64、128、256 三档，默认 128 |
| 历史 | 0 条或 user／assistant 一组；每条最多 400 字符 |
| 请求体 | 最多 12 KB |
| 上游响应 | 最多 256 KiB |
| 同时请求 | 整个本机进程最多 1 个 |
| 尝试频率 | 每分钟最多 12 次；重启进程会重置本机计数 |
| 总等待时间 | 20 秒，随后取消本地等待并中止上游连接 |
| 自动重试／协议探测 | 0 次 |
| 工具执行 | 最多一个已验证的本地 calculator |
| 自动后续模型调用 | 0 次 |

输出限制控制单次请求规模，不保证精确费用上限。一些推理模型需要更大推理预算，在此上限下可能得到不完整或没有可见文本的结果。应选择支持小输出预算的模型，或把该结果作为停止原因和预算约束的教学案例；项目不会自动增加上限。

## 常见问题

**真实 API 按钮不可用。** 当前可能是静态托管站，或本机中继未启动。通过 `npm start` 打开本机页面。不要在 GitHub Pages 中期待存在 Node 接口。

**400 或参数不支持。** 检查模型标识、协议类型、Base URL 是否重复写端点，以及服务是否接受该输出限制字段或工具定义。项目不会静默换协议试错。

**401／403。** 检查密钥有效性、模型权限、服务账户与地区限制。不要把密钥贴到公开 Issue 中。

**429。** 可能是本站本机并发／频率规则，也可能是上游配额或限流。页面错误会指出所属层；没有自动重试。

**网络连接失败。** 检查本机 Node 进程的网络访问。此实现使用原生 HTTPS，未实现代理配置，也不承诺遵循浏览器代理。代理 Fake-IP 将目标解析到保留网段时会被阻止，不应直接移除安全检查。

**停止后是否不收费？** 停止按钮中止浏览器等待，并由中继传播取消；上游已经生成的 Token 仍可能计费。

**模型只回答文字、不调用计算器。** 工具调用由模型决定，本演示没有强制所有服务都执行特定 tool choice，也不自动重试。页面会明确显示“未提出工具调用”。

**已保存的历史不见了。** 浏览器、隐私模式、主机名和端口都会影响本地存储来源；不同来源不共享 localStorage。可导出记录，但目前没有导入或跨设备同步功能。

## 验证范围

单元与集成测试使用固定响应和依赖注入，不连接真实供应商，也不包含真实凭证。浏览器测试中的 live 路径同样使用明确标记的 HTTP mock。真实上游兼容性仍需用用户自己的模型和密钥进行一次明确授权的小额验证。
