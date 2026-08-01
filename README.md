# 广州情侣一日游互动路线

2026 年 8 月 20 日从深圳出发的广州一日游互动网页，包含西关文化、美食对比、本地交互路线图、正常/下雨/高铁晚点方案、预算和本地打卡清单。

公开访问：<https://z-xq7.github.io/guangzhou-day-trip-0820/>

## 本地开发

要求 Node.js `>=22.13.0`。

```bash
npm install
npm run dev
```

## 验证与构建

```bash
npm run lint
npm test
npm run build:pages
```

- `npm run build`：现有 Vinext/Sites 构建。
- `npm run build:pages`：输出 GitHub Pages 静态文件到 `dist-pages/`。
- 路线图完全在本地渲染，不加载地图网络资源；仅当用户点击导航链接时，才会打开百度地图。
