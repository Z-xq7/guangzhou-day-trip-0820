# 广州一日游网页迁移至 GitHub Pages：设计规格

## 目标

将现有广州情侣一日游互动网页迁移到 `Z-xq7` 账号下的公开 GitHub 仓库，并以 GitHub Pages 提供手机和桌面端可直接访问的公开地址，绕开当前 `chatgpt.site` 域名在用户网络环境中触发的 Cloudflare 拦截。

## 已确认边界

- 目标仓库：`Z-xq7/guangzhou-day-trip-0820`。
- 仓库可见性：公开；源代码和 GitHub Actions 日志均可被互联网访问。
- 目标地址：`https://z-xq7.github.io/guangzhou-day-trip-0820/`。
- 保留现有 Sites 配置和部署，不删除、不改访问权限；GitHub Pages 成为交付给用户的主访问地址。
- 不改变既有路线、预算、场景切换、打卡存储、地图联动和视觉设计。
- 网页继续不请求定位、不上传用户数据；清单和模式只保存在浏览器 `localStorage`。

## 方案选择

采用“独立 Vite 静态构建 + GitHub Actions Pages 发布”。现有 Vinext/Sites 构建继续保留，同时增加一个只负责 GitHub Pages 的静态入口和构建配置。这样复用同一套 React 组件与结构化行程数据，不重写业务界面，也不把生成后的文件提交到源码分支。

未采用的方案：

- `gh-pages` 产物分支：会把生成文件纳入版本历史，后续更新和审查成本更高。
- 全量改造成纯 Vite SPA：会扩大改动面并破坏现有 Sites 构建，不符合本次迁移的最小风险目标。

## 架构与组件

### 静态入口

新增一个独立 HTML/React 入口，直接渲染现有 `TripPlanner`，并复用 `app/globals.css`。该入口不依赖 Next/Vinext 路由、服务端渲染、Cloudflare Worker 或运行时环境变量。

### Pages 构建

新增专用 Vite 配置：

- `base` 固定为 `/guangzhou-day-trip-0820/`；
- 公共资源继续来自现有 `public/`；
- 输出到独立目录 `dist-pages/`；
- 现有 `npm run build` 保持原意，新增 `npm run build:pages`。

地图的 Leaflet CSS 目前使用根路径 `/assets/leaflet.css`。迁移时将资源地址改为基于 Vite `BASE_URL` 生成，使 Sites 根路径和 GitHub Pages 仓库子路径都能正确加载。OpenStreetMap 瓦片仍从网络加载，失败时继续使用现有路线示意回退界面。

### 自动发布

新增 GitHub Actions 工作流，在 `main` 分支更新时执行：

1. 安装锁定依赖；
2. 运行 Pages 静态构建；
3. 上传 `dist-pages/`；
4. 使用 GitHub 官方 Pages Actions 发布。

工作流只申请 `contents: read`、`pages: write` 和 `id-token: write`，不保存个人令牌到仓库。

## 数据流

行程数据、场景规则和组件代码仍由现有 `src/` 提供。浏览器加载 GitHub Pages 的静态 HTML 和带哈希的 JS/CSS 后，由 React 在客户端渲染页面；用户的场景、预约清单与打卡状态继续按现有版本号写入本机 `localStorage`。地图接近视口时才加载 Leaflet 和 OpenStreetMap 瓦片。

## 仓库创建与迁移

- 通过当前已登录 `Z-xq7` 的 Chrome 会话创建空的公开仓库，不自动生成 README、许可证或 `.gitignore`，避免与本地历史冲突。
- 将本地仓库的 `origin` 指向新仓库，并推送现有 `main` 历史及迁移提交。
- 优先使用 macOS Git 凭据链完成 HTTPS 推送；若凭据链没有 `Z-xq7` 的写权限，则使用 GitHub 官方登录流程补充认证，不在命令、文件或对话中暴露密码或令牌。
- 发布后确认仓库默认分支为 `main`，Pages 来源为 GitHub Actions。

## 错误处理

- 静态资源路径错误：构建测试必须检查生成 HTML 使用仓库子路径，且 Leaflet CSS 地址不再写死为根路径。
- 地图网络失败：保留现有 SVG/列表式路线回退，不阻断完整行程阅读和高德导航。
- Actions 失败：读取失败步骤和日志，修复后重新推送；工作流未成功前不交付 URL。
- GitHub 认证不匹配：停止写入，保留本地提交，不把仓库创建到当前 Codex Connector 的其他账号。
- Pages 尚未传播：轮询官方部署状态和目标 URL；仅在返回成功页面后进行移动端验收。

## 测试与验收

实施遵循测试先行：先增加会失败的 Pages 构建/资源路径测试，再写最小实现使其通过。

必须完成：

- 现有 Vitest、渲染测试、Sites 构建和 lint 不回归；
- `npm run build:pages` 成功，并生成可独立托管的 `dist-pages/index.html`；
- 生成页面的资源 URL 带 `/guangzhou-day-trip-0820/` 前缀；
- GitHub Actions Pages 工作流成功；
- 公开 URL 返回正常页面，而不是 403、404 或登录页；
- 375×812 与 390×844 视口无横向滚动，底部操作栏不遮挡内容；
- 场景切换、时间轴与地图联动、打卡持久化和高德导航入口可用；
- 地图资源失败时仍能查看完整路线示意。

## 完成标准

只有当代码已推送到 `Z-xq7/guangzhou-day-trip-0820`、GitHub Actions 显示 Pages 部署成功、公开 URL 在未登录上下文中可以访问且移动端核心交互通过验收，迁移才视为完成。
