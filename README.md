# 门诊预约与智能分诊辅助系统

## 技术栈
- 前端：Vue3 + Vite + Element Plus（端口 `11999`）
- 后端：Node.js + Express + MySQL2（端口 `11888`）
- 数据库：MySQL（默认示例 `127.0.0.1:1111`，账号/密码请在 `server/.env` 自行配置）
- AI：OpenAI 兼容接口（支持 DeepSeek / DashScope / Ollama）

## 首次配置（必做）
- 复制 `server/.env.example` 为 `server/.env`
- 修改以下敏感项后再启动：`MYSQL_PASSWORD`、`JWT_SECRET`、`ADMIN_USERNAME`、`ADMIN_PASSWORD`
- 可选：`JWT_EXPIRES_IN`（默认 `24h`）
- 可选安全项：`API_RATE_LIMIT_WINDOW_MS`、`API_RATE_LIMIT_MAX`、`CORS_ALLOWED_ORIGINS`
- 可选认证限流项：`LOGIN_RATE_LIMIT_*`、`REGISTER_RATE_LIMIT_*`、`FORGOT_PASSWORD_RATE_LIMIT_*`
- 生产环境建议设置 `NODE_ENV=production`，此时 CORS 仅允许 `CORS_ALLOWED_ORIGINS` 白名单来源

## 主要模块（对应白皮书）
- 首页公告与统计
- 挂号预约（预约/取消/改约，防重复和时间冲突）
- 医生排班（按角色维护）
- 就诊记录（医生/管理角色录入）
- AI 分诊（症状输入 -> 推荐科室）
- 个人中心
- 后台管理（用户与公告）

## 启动步骤
1. 初始化数据库：双击 `init-database.bat`
2. 一键启动前后端：双击 `start-all.bat`
3. 浏览器访问：`http://localhost:11999`

也可分别启动：
- 前端：`start-frontend.bat`
- 后端：`start-backend.bat`

## 跨平台启动（PowerShell / Bash）
- 后端：
  - `cd server && npm install`
  - `npm run dev`
- 前端：
  - `cd client && npm install`
  - `npm run dev`
- 数据库初始化：
  - 手动执行 `database/schema.sql`
  - 或在 Windows 上使用 `init-database.bat`

## 代码质量检查（新增）
- 前端：在 `client` 目录执行 `npm run lint`、`npm run build`
- 后端：在 `server` 目录执行 `npm run lint`、`npm test`
- Lighthouse 基线（前端）：在 `client` 目录执行
  - `npm run lh:baseline`（生成最新报告并与基线对比）
  - `npm run lh:baseline:update`（将当前结果更新为新基线）

## 持续集成（CI）
- 已提供 GitHub Actions 工作流：`.github/workflows/ci.yml`
- 会自动执行：
  - `server`: `npm run lint` + `npm test`
  - `client`: `npm run lint` + `npm run build`

## 仓库结构说明
- `client/` 与 `server/` 是本系统主项目（门诊预约与智能分诊）
- `student-info-system/` 是独立的 Java 课程作业子项目，不参与主系统运行链路
- 静态界面原型：根目录 `门诊预约系统-静态原型.html`（单文件，双击打开，顶部导航 + 哈希路由切换页面，无需其它文件）

## AI Key 一键设置
- 双击 `04-设置AI密钥并测试.bat`
- 粘贴你自己的 DeepSeek API Key
- 成功后如后端已在运行，请重启后端

## 切换到 Ollama（免费本地）
1. 先安装 Ollama，并在终端执行：`ollama serve`
2. 拉取一个模型（示例）：`ollama pull qwen2.5:7b`
3. 双击 `05-一键切换Ollama-免费本地AI.bat`
4. 重启后端，在后台管理点击“测试AI连通性”

推荐配置（也可在后台手动填）：
- `AI Base URL`：`http://127.0.0.1:11434/v1`
- `AI 模型`：`qwen2.5:7b`
- `AI Key`：可留空
