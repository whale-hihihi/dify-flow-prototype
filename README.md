# DifyFlow 智能文本处理平台

> 面向部队日常文本处理需求的智能化统一平台 — 数据库课程项目

## 项目概况

DifyFlow 通过对接 Dify AI 平台，实现文件上传 → 智能体处理 → 结果归档的完整业务闭环。本项目为数据库课程设计，涵盖从需求分析到部署的完整开发流程。

## 当前进度

| 里程碑 | 状态 | 说明 |
|--------|------|------|
| M1 基础骨架 | 已完成 | 项目搭建、用户认证、Dify 连接配置、智能体 CRUD |
| M2 文件处理 | 已完成 | 文件上传解析、文件夹管理、全文搜索、在线预览、下载 |
| M3 任务管理 | 待开发 | 即时任务 + 定时任务(cron)、任务状态机、WebSocket 进度推送 |
| M4 智能体生成器 | 待开发 | AI 引导式 5 步对话，自动生成 Dify DSL YAML |
| M5 搜索与统计 | 待开发 | 前端搜索 UI、数据统计仪表板 |
| M6 打包部署 | 待开发 | 一键安装包(.run/.deb)、Systemd 服务 |

---

## 快速部署指南（从零开始）

### 环境要求

| 工具 | 版本要求 | 用途 |
|------|---------|------|
| Node.js | 18+ | 运行前后端 |
| npm | 9+ | 包管理器 |
| Docker Desktop | 最新版 | 运行 PostgreSQL 数据库 |
| Git | 最新版 | 版本管理（可选） |

> **注意**：以下所有命令在项目根目录（`DifyFlow/`）下执行。

### 第 1 步：启动 PostgreSQL 数据库

确保 Docker Desktop 已启动，然后在项目根目录运行：

```bash
docker compose up -d
```

数据库默认运行在 `localhost:15432`，用户名 `difyflow`，密码 `password`。

验证是否启动成功：

```bash
docker compose ps
```

应看到 `difyflow-postgres` 状态为 `running`。

### 第 2 步：配置环境变量

项目根目录已包含 `.env.example` 模板文件。复制为 `.env`：

```bash
cp .env.example .env
```

> **Windows 用户**：直接复制 `.env.example` 文件并重命名为 `.env` 即可。文件内容无需修改，默认值已可直接用于开发。

`.env` 内容如下（如需修改可自行调整）：

```env
DATABASE_URL="postgresql://difyflow:password@localhost:15432/difyflow"
JWT_SECRET="change-me-to-a-random-64-character-string"
ENCRYPTION_KEY="change-me-to-a-64-char-hex-string-32-bytes"
PORT=3001
UPLOAD_DIR="./uploads"
MAX_FILE_SIZE=52428800
```

### 第 3 步：安装依赖

```bash
npm install
```

这会自动安装根目录、`packages/server`、`packages/client` 三个位置的依赖（npm workspaces）。

### 第 4 步：初始化数据库

```bash
# 执行数据库迁移（创建所有表）
npm run db:migrate

# 填充种子数据（创建 admin 用户 + 默认文件夹）
npm run db:seed
```

> 数据库迁移会在 `packages/server/prisma/migrations/` 下记录版本。如果后续有人修改了 `schema.prisma`，再次运行 `npm run db:migrate` 即可增量更新。

### 第 5 步：启动项目

需要**开两个终端**分别启动前后端：

**终端 1 — 启动后端**（端口 3001）：

```bash
npm run dev:server
```

**终端 2 — 启动前端**（端口 5173）：

```bash
npm run dev:client
```

看到以下输出说明启动成功：
- 后端：`DifyFlow server running on http://localhost:3001`
- 前端：`Local: http://localhost:5173/`

### 第 6 步：访问系统

- 地址：`http://localhost:5173`
- 账号：`admin`
- 密码：`admin123`

---

## 技术栈

```
后端:  Node.js 18+ / Express / TypeScript / Prisma / PostgreSQL 15
前端:  React 19 / Vite 8 / Ant Design 5 / Zustand / React Router 7
实时:  WebSocket (ws)
安全:  JWT / bcrypt / AES-256-GCM
工具:  pdf-parse / mammoth / xlsx / csv-parse
```

## 项目结构

```
difyflow/
├── packages/
│   ├── server/                  # Express 后端
│   │   ├── prisma/
│   │   │   ├── schema.prisma    # 数据库模型 (User, Agent, Folder, Asset, DifyConfig)
│   │   │   ├── seed.ts          # 种子数据 (admin/admin123)
│   │   │   └── migrations/      # 数据库迁移
│   │   └── src/
│   │       ├── controllers/     # auth, agent, asset, folder, dify-config, search
│   │       ├── services/        # 业务逻辑层
│   │       ├── routes/          # API 路由
│   │       ├── middleware/      # JWT认证, 文件上传, Zod校验
│   │       ├── parsers/         # 6种文件解析器 + 工厂模式
│   │       ├── workers/         # 异步解析队列
│   │       ├── ws/              # WebSocket 管理
│   │       └── utils/           # 加密, JWT, 文件工具
│   └── client/                  # React 前端
│       └── src/
│           ├── pages/           # LoginPage, AssetsPage, AgentsPage, SettingsPage
│           ├── api/             # API 客户端 (axios + 拦截器)
│           ├── stores/          # Zustand 状态管理
│           ├── hooks/           # WebSocket hook
│           └── layouts/         # 侧栏布局
├── dify-flow-prototype/         # HTML/CSS/JS 前端原型（设计参考）
├── test-files/                  # 测试用文件（6种格式各一份）
├── docker-compose.yml           # PostgreSQL 容器
├── init-db.sql                  # 数据库扩展 (pg_trgm, uuid-ossp)
├── PROGRESS.md                  # 开发进度记录
└── CLAUDE.md                    # AI 辅助开发指引
```

## API 端点总览

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 用户登录 |
| GET | `/api/auth/me` | 获取当前用户 |
| PUT | `/api/auth/me` | 更新个人资料 |
| GET | `/api/dify-config` | 获取 Dify 配置 |
| PUT | `/api/dify-config` | 更新 Dify 配置 |
| POST | `/api/dify-config/test` | 测试 Dify 连接 |
| GET | `/api/agents` | 智能体列表 |
| POST | `/api/agents` | 添加智能体 |
| PUT | `/api/agents/:id` | 更新智能体 |
| DELETE | `/api/agents/:id` | 删除智能体 |
| POST | `/api/agents/:id/test` | 连通测试 |
| POST | `/api/assets/upload` | 上传文件 |
| GET | `/api/assets` | 文件列表(分页+筛选) |
| GET | `/api/assets/:id` | 文件详情（含解析文本） |
| GET | `/api/assets/:id/download` | 下载文件 |
| DELETE | `/api/assets/:id` | 删除文件 |
| GET | `/api/folders` | 文件夹列表 |
| POST | `/api/folders` | 创建文件夹 |
| PUT | `/api/folders/:id` | 重命名文件夹 |
| DELETE | `/api/folders/:id` | 删除文件夹 |
| GET | `/api/search?q=&type=` | 全文搜索 |

## 数据库 ER 图

```
┌──────────┐     ┌───────────────┐     ┌──────────┐
│  users   │────<│  dify_configs │     │  agents  │
│──────────│     └───────────────┘     │──────────│
│ id (PK)  │────<│ id (PK)       │     │ id (PK)  │
│ username │     │ dify_url      │     │ name     │
│ email    │     │ conn_status   │     │ mode     │
│ password │     │ user_id (FK)  │     │ api_key  │
│ role     │     └───────────────┘     │ user_id  │
└────┬─────┘                           └──────────┘
     │
     │         ┌──────────┐     ┌──────────┐
     ├────────<│ folders  │     │  assets  │
     │         │──────────│────<│──────────│
     │         │ id (PK)  │     │ id (PK)  │
     │         │ name     │     │ filename │
     │         │ is_default│    │ file_type│
     │         │ user_id  │     │ status   │
     │         └──────────┘     │ parsed   │
     │                          │ folder_id│
     └────────────────────────<│ user_id  │
                                └──────────┘
```

## 常用开发命令

```bash
npm install          # 安装全部依赖（根 + server + client）
npm run dev:server   # 仅启动后端（端口 3001，自动热重载）
npm run dev:client   # 仅启动前端（端口 5173，自动热重载）
npm run db:migrate   # 运行数据库迁移（修改 schema.prisma 后执行）
npm run db:seed      # 填充种子数据（admin/admin123 + 默认文件夹）
```

## 给后续开发者的注意事项

1. **数据库变更**：修改 `packages/server/prisma/schema.prisma` 后，必须运行 `npm run db:migrate` 生成迁移文件，并将迁移文件一并提交
2. **环境变量**：`.env` 不应提交到版本控制，团队成员需各自从 `.env.example` 复制
3. **原型参考**：`dify-flow-prototype/` 是 UI 设计稿，新功能的视觉和交互应尽量还原
4. **计划书**：`DifyFlow智能文本处理系统计划书.docx` 是需求来源，开发前务必先阅读对应章节
5. **进度记录**：每完成一个功能模块，请更新 `PROGRESS.md`
