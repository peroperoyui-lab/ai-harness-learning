# 测试与验证

## 必跑检查

需要 Node.js 22+；项目本身不需要安装 npm 依赖。

```bash
npm run verify
```

顺序为课程/语法/文档完整性检查、Node 内置测试、静态构建。任何一步失败即停止。`dist/` 是生成文件，不提交到仓库。

测试文件：`core.test.mjs` 覆盖状态机、计算器、算法、SSE 和存储；`protocol.test.mjs` 覆盖四种请求预设及响应归一；`server.test.mjs` 使用本机假上游检查预算、来源、目标限制、取消与脱敏。`history.test.mjs` 检查导入合同、同 ID 副本及续聊上下文；`content.test.mjs` 检查全部课程的分步实例和版本说明。

## 可选浏览器依赖

```bash
python -m pip install playwright==1.58.0
python -m playwright install chromium
python tests/browser_smoke.py
```

Linux 缺系统库时使用 `python -m playwright install --with-deps chromium`。已有 Chromium 可通过 `CHROMIUM_PATH` 指定可执行文件。Windows 使用 PowerShell：`$env:CHROMIUM_PATH='完整可执行文件路径'`。

脚本启动 127.0.0.1:4179，仅用于测试，结束时自动停止该 Node 子进程。应先确保该端口空闲。浏览器验收覆盖全部课程与实验路由、24 个分步实例、桌面/手机布局、真实浏览器刷新持久化、历史搜索/导入/导出/续聊、权限拒绝和文本转义。真实 API 按钮的请求在浏览器层被 mock 拦截，**不会到模型服务商**。

结果保存在 `test-results/`：截图和 `browser-report.json`。若浏览器环境不允许 HTTP 导航，记录环境限制，不关闭安全策略，也不能把静态截图描述为真实来源下的持久化测试。GitHub Actions 在正常本机来源环境运行同一脚本。

## CI 与真实联调的区别

CI 在 Ubuntu Node 22/24、Windows Node 22 运行核心检查，并在 Ubuntu Chromium 执行浏览器验收。查看当前 PR 对应提交的结果，不沿用旧提交的绿色状态。

真实供应商验证需要维护者自备低额度凭证，明确选择服务和模型后手动发送。记录协议、模型、任务、时间、HTTP/结束状态和真实 usage；不要记录密钥。未做付费调用时必须标记“未验证真实供应商”。小输出预算可能引发截断或推理模型无可见输出，应保留错误信息而不是偷偷增加预算或自动重试。
