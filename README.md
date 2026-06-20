# PlainMark

一个轻量的 macOS Markdown 编辑器和阅读器，基于 Electron + React + TypeScript + Vite 构建。

## 功能特性

- **4 种视图模式** — 编辑、分屏、预览、阅读模式
- **KaTeX 数学公式渲染** — 支持行内 `$...$` 和块级 `$$...$$` 公式
- **代码语法高亮** — 基于 highlight.js
- **文档大纲** — 自动提取标题，侧边栏快速导航
- **多文件工作区** — 同时打开多个 Markdown 文件并切换
- **macOS 原生集成** — 注册 `.md` 和 `.markdown` 文件类型
- **打开与保存** — 支持文件对话框打开和保存 Markdown 文件

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器（Vite + Electron）
npm run dev

# 运行测试
npm test

# 构建
npm run build

# 打包 macOS 应用
npm run dist
```

## 技术栈

- Electron
- React 19
- TypeScript
- Vite
- markdown-it
- KaTeX
- highlight.js
