# ZenLink - 现代全能网址导航、云笔记与 AI 智能工作台

[![GitHub Workflow](https://github.com/akasls/ZenLink/actions/workflows/docker-build.yml/badge.svg)](https://github.com/akasls/ZenLink/actions)
[![Docker Image](https://img.shields.io/badge/docker-ghcr.io%2Fakasls%2Fzenlink-blue.svg)](https://github.com/akasls/ZenLink/pkgs/container/zenlink)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

ZenLink 是一个高颜值、极速响应、开箱即用的现代化自建网址导航、在线云笔记与多轨 AI 智能助手平台。支持单容器极简部署、全平台响应式适配、无缝多模型调度与生产级安全防护。

---

## ✨ 核心特性

- 🚀 **极速响应与高性能架构**：
  - 核心接口响应时延均在 **10ms ~ 28ms** 内；
  - **Favicon 本地磁盘永久持久化**：首次抓取永久落盘，前台访问 0 外部网络请求，100% 磁盘直读与长效不可变强缓存；
  - **并发竞争拉取**：Favicon 多源候选采用 `Promise.any` 并发竞争，抓取耗时由数秒降至 300ms 以内。
- 🧭 **智能网址导航与书签管理**：
  - 拖拽重排、多层级分类树、私密书签/分类隔离；
  - **AI 智能导航解析**：自动抓取网站元数据并提炼极简标题与 **100% 地道纯简体中文简介**，内置知名站点中文知识库与自动二次中译兜底。
- 🤖 **三轨解耦 AI 助手体系**：
  - **独立解耦调度**：对话主模型 (`model`)、笔记写作模型 (`writing_model`)、导航解析模型 (`bookmark_model`) 互不干扰；
  - **AI 智能对话**：多会话管理、角色预设记忆、按最新活动时间倒序排列、流式打字机渲染；
  - **XSS 免疫**：全链路接入 `DOMPurify` 进行 Markdown 安全清洗，彻底防御脚本注入。
- 📝 **在线云笔记与安全分享**：
  - Markdown 即时编辑、自动提取标签与标签筛选归类；
  - **安全短链分享**：免登录公开直达、访问密码提取保护、**阅后即焚**自动销毁。
- 🛡️ **生产级深度攻防加固**：
  - **SSRF 深度阻断**：严格过滤私有网段、本地环回、云元数据及进制变形；
  - **路径穿越隔离**：磁盘文件直读白名单化，拒绝目录穿越；
  - **SQL 注入免疫**：全量参数化预编译绑定；
  - **多因素认证**：支持账号密码 + TOTP 2FA + WebAuthn (Passkey) 生物识别登录。

---

## 🛠️ 技术栈

- **前端**：Vue 3 (Composition API) + TypeScript + Pinia + Vue Router + Element Plus + Tailwind CSS + DOMPurify
- **后端**：Node.js + Fastify + TypeScript + SQL.js (WASM SQLite) + SimpleWebAuthn
- **部署**：Docker (多架构 `linux/amd64`, `linux/arm64`) + GitHub Actions CI/CD

---

## 🐳 Docker 一键实机部署

### 方式一：Docker Run 极简一行启动（推荐）

```bash
docker run -d \
  --name zenlink \
  --restart unless-stopped \
  -p 3000:3000 \
  -v $(pwd)/zenlink_data:/app/server/data \
  ghcr.io/akasls/zenlink:latest
```

> 💡 **极简提示**：
> - **无需手动填写任何密钥**！系统首次启动时会自动生成 256 位强随机 `JWT_SECRET` 并持久化保存在挂载的数据卷中，容器重启或平滑升级时自动加载，用户会话永不丢失。
> - 容器数据（SQLite 数据库、Favicon 磁盘缓存、附件上传等）均自动保存在宿主机的 `zenlink_data` 目录中。
> - 浏览器访问：`http://你的服务器IP:3000`

---

### 方式二：Docker Compose 编排启动

创建 `docker-compose.yml` 文件：

```yaml
version: '3.8'

services:
  zenlink:
    image: ghcr.io/akasls/zenlink:latest
    container_name: zenlink
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - ./zenlink_data:/app/server/data
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/api/settings"]
      interval: 30s
      timeout: 5s
      retries: 3
```

启动命令：

```bash
docker compose up -d
```

---

## 💻 本地源码开发

```bash
# 1. 安装依赖
npm install

# 2. 启动本地开发服务 (前端 Vite + 后端 Fastify)
npm run dev

# 3. 生产打包构建
npm run build

# 4. 生产运行
npm start
```

---

## 📄 License

[MIT License](LICENSE) © 2026 ZenLink
