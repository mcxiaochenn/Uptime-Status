# AGENTS.md

## 铁律（绝对不能违反）

1. **必须使用中文** — 所有交流、回复、解释一律使用中文，代码注释优先中文
2. **默认只 commit，绝对不要 push** — 除非用户明确说「推送」或「push」
3. **不确定就问，不要猜** — 宁可多问一句，也不要擅自行动

---

## 用户信息

| 项目 | 内容 |
|------|------|
| 昵称 | 辰渊尘 |
| 身份 | 高中生，自学前端，正转向全栈 |
| GitHub | https://github.com/mcxiaochenn |
| 博客 | https://blog.mcxiaochen.top |

- 项目多为**二次开发**，代码风格以项目原有规范为主
- 缩进用 Tab，引号/分号随项目规范
- 默认少注释，仅在必要处添加（变量用途、复杂逻辑、配置定义）

---

## 项目概述

Vue 3 + Vite + Tailwind CSS 站点监测面板，基于 UptimeRobot API。纯 JavaScript，无 TypeScript、无测试、无 lint、无 CI。

## 常用命令

```bash
npm run dev      # Vite 开发服务器，端口 3100
npm run build    # 生产构建 → dist/
npm run preview  # 本地预览生产构建
```

无测试/lint 命令，lockfile 全部 gitignore。

## 架构

- **入口：** `src/main.js` → 挂载 `src/App.vue`
- **组件：** `src/components/` — `Header.vue`、`Stats.vue`、`Card.vue`（最大文件，~640 行，含图表和弹窗）、`Footer.vue`
- **工具：** `src/utils/` — `api.js`（调用 UptimeRobot v3 API）、`monitor.js`（数据处理）、`chartConfig.js`（Chart.js 配置）
- **API 代理（两套实现，通用转发 + Bearer 认证）：**
  - `api/status.js` — Vercel serverless 函数
  - `functions/api/status.js` — EdgeOne Pages / Cloudflare Pages edge function
- **`@` 别名** 映射到 `src/`（在 `vite.config.js` 中配置）

## 关键约定

- 所有环境变量使用 `VITE_` 前缀（暴露给客户端）。详见 `.env`
- `.env` 已提交，含 UptimeRobot API key。本地覆盖用 `.env.local`（已 gitignore）
- Tailwind 暗色模式使用 `class` 策略 — 通过 `document.documentElement.classList` 切换
- `vue-router` 在依赖中但**源码中未使用**
- Chart.js 通过 `vue-chartjs` 封装在 `Card.vue` 中使用
- UptimeRobot v3 API 免费版限 10 req/min，`api.js` 中每请求间隔 6.5s 以避免 429

## 部署

三个部署目标共用同一份源码，但 API 代理路径不同：
- **Vercel：** `api/status.js`（serverless）
- **EdgeOne Pages：** `functions/api/status.js`（edge function）
- **Cloudflare Pages：** 同 `functions/api/status.js`

## Git 规范

- Commit 使用 **Conventional Commits** 格式：`feat: 新增 xxx`、`fix: 修复 xxx`、`docs: 更新 xxx`
- **默认只 commit，不 push** — 用户审查后再决定是否推送
- 修改代码后如有 lint/typecheck 命令应主动运行验证
