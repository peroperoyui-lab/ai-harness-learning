# 页面与文件目录

页面使用 Hash 路由。URL 形如 `http://127.0.0.1:4173/#/learn/harness`，静态托管时路径前可包含仓库名。路由统一在 `web/app.js`；课程内容注册于 `web/content/course.js`。

## 常用页面

| 路由 | 用途 | 主要文件 |
| --- | --- | --- |
| `#/` | 首页、学习进度、六阶段课程卡、实验入口 | `web/app.js`、`web/styles.css` |
| `#/labs` | 11 类本地实验总览 | `web/app.js`、`web/content/course.js` |
| `#/playground` | 免密钥范例、真实 API 连接与单次交互 | `web/playground.js`、`server/` |
| `#/history` | 运行轨迹、检查点、会话查看、导出与删除 | `web/app.js`、`web/lib/storage.js` |
| `#/glossary` | 41 条术语的中英文搜索 | `web/app.js`、`web/content/course.js` |
| `#/sources` | 官方来源、开源与许可声明 | `web/app.js`、`web/content/course.js` |

## 全部课程

所有课程共用 `lessonPage()` 的阅读模板。修正文句优先修改对应内容文件，不必改路由或服务端。

| 序号 | 路由 | 课程 | 内容文件 | 关联实验 |
| --- | --- | --- | --- | --- |
| 01 | `#/learn/harness` | 模型、Agent 与 Harness | `foundations.js` | trace |
| 02 | `#/learn/javascript` | 最小 JavaScript 与异步代码 | `foundations.js` | schema |
| 03 | `#/learn/messages` | 消息角色与 Token | `foundations.js` | context |
| 04 | `#/learn/protocols` | 模型协议适配器 | `foundations.js` | protocol |
| 05 | `#/learn/loop` | Agent 循环与状态机 | `runtime.js` | trace |
| 06 | `#/learn/tools` | 工具合同与验证 | `runtime.js` | schema |
| 07 | `#/learn/streaming` | SSE、字节块与取消 | `runtime.js` | stream |
| 08 | `#/learn/reliability` | 错误分类与重试 | `runtime.js` | trace |
| 09 | `#/learn/context` | 上下文选择与压缩 | `context.js` | context |
| 10 | `#/learn/rag` | 检索增强与证据 | `context.js` | retrieval |
| 11 | `#/learn/memory` | 记忆与持久检查点 | `context.js` | memory |
| 12 | `#/learn/skills` | Skill 与渐进披露 | `context.js` | context |
| 13 | `#/learn/workflow` | 工作流与依赖调度 | `orchestration.js` | workflow |
| 14 | `#/learn/multi-agent` | 多 Agent 分工 | `orchestration.js` | workflow |
| 15 | `#/learn/mcp` | MCP 连接架构 | `orchestration.js` | protocol |
| 16 | `#/learn/artifacts` | 结构化输出与成果 | `orchestration.js` | schema |
| 17 | `#/learn/permissions` | 最小权限与人工批准 | `safety.js` | trace |
| 18 | `#/learn/injection` | 提示注入与信任边界 | `safety.js` | safety |
| 19 | `#/learn/sandbox` | 隔离、凭证与数据流 | `safety.js` | safety |
| 20 | `#/learn/budget` | Token 与费用预算 | `safety.js` | cost |
| 21 | `#/learn/traces` | 可观测性与轨迹 | `shipping.js` | trace |
| 22 | `#/learn/evals` | 评估与回归测试 | `shipping.js` | eval |
| 23 | `#/learn/deployment` | 开发、构建与发布 | `shipping.js` | protocol |
| 24 | `#/learn/capstone` | 完整 Harness 纵向实作 | `shipping.js` | trace |

内容文件均位于 `web/content/`。课程中的 `source` 字段指向实际关联源码或文档，`codeLabel` 说明展示片段属于真实函数调用、教学伪代码还是概念图式。

## 全部实验

| 路由 | 页面行为 | 核心逻辑 | 真实性范围 |
| --- | --- | --- | --- |
| `#/lab/trace` | 单步、自动、回看、审批、停止、保存 | `trace-lab.js`、`lib/engine.js` | 模型脚本；计算器真实计算 |
| `#/lab/schema` | 编辑并验证 JSON，运行计算 | `labs.js`、`lib/calculator.js` | 固定合同验证与真实运算 |
| `#/lab/context` | 容量、预留、内容选择 | `labs.js`、`lib/algorithms.js` | 真实装箱算法，容量为教学单位 |
| `#/lab/retrieval` | 查询、top-k、排序与匹配词 | `labs.js`、`lib/algorithms.js` | 本地 TF-IDF，无嵌入或生成模型 |
| `#/lab/protocol` | 协议切换与请求 JSON | `labs.js`、`lib/protocol.js` | 与中继共用的真实序列化器；不发送 |
| `#/lab/stream` | 任意字节切块、递送、暂停 | `labs.js`、`lib/sse.js` | 真实解析器，输入是固定本地 SSE |
| `#/lab/workflow` | 串并行、时长调整、时间线 | `labs.js`、`lib/algorithms.js` | 理想化本地调度计算 |
| `#/lab/memory` | 保存、重置、刷新后恢复 | `labs.js`、`lib/storage.js` | 浏览器真实持久化；没有外部副作用 |
| `#/lab/safety` | 可疑词提示、独立权限与模拟批准 | `labs.js` | 规则教学，不是完整安全防护 |
| `#/lab/cost` | 用量、单价、次数与费用 | `labs.js`、`lib/algorithms.js` | 真实公式计算，默认价格为假设 |
| `#/lab/eval` | 五个固定回归案例 | `labs.js`、`lib/calculator.js` | 真实断言对照，不评估模型智能 |

以上文件路径以 `web/` 为起点。新增实验需要同时注册 `labs`、挂载函数、课程入口、纯函数测试和浏览器行为测试。

## 按修改目的找文件

- **首页、导航、阅读页、历史页：**`web/app.js`。
- **整体颜色、排版、小屏断点：**`web/styles.css`；共享图标与转义：`web/ui.js`。
- **概念、题目、来源、术语：**`web/content/`。
- **工具与计算结果错误：**`web/lib/calculator.js`、`web/lib/protocol.js` 的工具合同、相应测试。
- **状态错误、轮数上限、审批绕过：**`web/lib/engine.js`、`web/trace-lab.js`。
- **真实协议字段或用量显示：**`web/lib/protocol.js`、`server/upstream.mjs`、`web/playground.js`。
- **网络、目标主机、Origin、预算或超时：**`server/security.mjs`、`server/index.mjs`。
- **历史保存、大小与版本：**`web/lib/storage.js`。
- **测试和静态打包：**`tests/`、`scripts/`、`.github/workflows/`。

未知路由显示 404 页面。更改已有课程 ID 属于破坏链接的行为，应提供迁移或重定向，而不是直接删除旧入口。
