# DifyFlow 智能文本处理平台

> 面向部队日常文本处理需求的智能化统一平台 — 数据库课程项目

## 项目概况

DifyFlow 通过对接 Dify AI 平台，实现文件上传 → 智能体处理 → 结果归档的完整业务闭环。支持即时任务与定时任务、自然语言生成 Dify 工作流 DSL。

## 模块完成状态

| 模块 | 状态 | 说明 |
|------|------|------|
| M1 资产管理 | 已完成 | 文件上传解析、文件夹管理、全文搜索、在线预览、下载 |
| M2 任务管理 | 已完成 | 即时任务（批处理+分文件处理）、定时任务、WebSocket 进度推送、自动归档 |
| M3 Dify 智能体管理 | 已完成 | 智能体 CRUD、连通测试、动态参数获取 |
| M4 智能体生成器 | 已完成 | NLG→DSL 对话式生成器，LLM 管道自动生成 Dify 工作流 |
| M5 个人设置 | 已完成 | Dify 连接配置、个人信息管理 |
| M6 通用支撑 | 已完成 | 用户认证、侧栏布局、NUDT 视觉主题 |

---

## 快速部署指南

### 环境要求

| 工具 | 版本要求 | 用途 |
|------|---------|------|
| Node.js | 18+ | 运行前后端 |
| npm | 9+ | 包管理器 |
| Docker Desktop | 最新版 | 运行 PostgreSQL 数据库 |
| Python | 3.10+ | NLG→DSL 生成器（M4模块） |

### 第 1 步：启动 PostgreSQL 数据库

确保 Docker Desktop 已启动，在项目根目录运行：

```bash
docker compose up -d
```

数据库运行在 `localhost:15432`，用户名 `difyflow`，密码 `password`。

### 第 2 步：配置环境变量

```bash
cp .env.example .env
```

`.env` 默认内容可直接用于开发，无需修改。

### 第 3 步：安装依赖

```bash
# Node.js 依赖（根 + server + client）
npm install

# Python 生成器依赖（M4 模块需要）
pip install fastapi pydantic pyyaml uvicorn httpx jinja2 eval_type_backport
```

### 第 4 步：初始化数据库

```bash
npm run db:migrate
npm run db:seed
```

### 第 5 步：启动项目

需要开**三个终端**：

**终端 1 — 后端**（端口 3001）：

```bash
npm run dev:server
```

**终端 2 — 前端**（端口 5174）：

```bash
npm run dev:client
```

**终端 3 — NLG→DSL 生成器**（端口 5000，M4 模块需要）：

```bash
cd nlg-to-dsl && python web_app.py
```

或者一条命令启动前后端：

```bash
npm run dev
```

### 第 6 步：访问系统

- 地址：`http://localhost:5174`
- 账号：`admin`
- 密码：`admin123`

---

## 技术栈

```
后端:  Node.js 18+ / Express / TypeScript / Prisma / PostgreSQL 15
前端:  React 19 / Vite 5 / Ant Design 5 / Zustand / React Router 6
实时:  WebSocket (ws)
安全:  JWT / bcrypt / AES-256-GCM
解析:  pdf-parse / mammoth / xlsx / csv-parse
AI:    Python FastAPI / SiliconFlow (Qwen3.6-35B-A3B) / LLM 管道
```

## 项目结构

```
difyflow/
├── packages/
│   ├── server/                       # Express 后端
│   │   ├── prisma/
│   │   │   ├── schema.prisma         # 数据模型
│   │   │   ├── seed.ts               # 种子数据
│   │   │   └── migrations/
│   │   └── src/
│   │       ├── controllers/          # 路由控制器
│   │       ├── services/             # 业务逻辑
│   │       ├── routes/               # API 路由 + Python 代理
│   │       ├── middleware/           # JWT / 上传 / 校验
│   │       ├── parsers/              # 6种文件解析器
│   │       ├── workers/              # 异步解析队列
│   │       ├── ws/                   # WebSocket
│   │       └── utils/                # 加密 / JWT / 文件工具
│   └── client/                       # React 前端
│       └── src/
│           ├── pages/                # LoginPage, AssetsPage, AgentsPage, TasksPage, GeneratorPage, SettingsPage
│           ├── api/                  # API 调用层
│           ├── stores/               # Zustand 状态管理
│           ├── hooks/                # 自定义 Hooks
│           ├── layouts/              # 侧栏布局
│           ├── styles/               # 全局样式 + NUDT 主题
│           └── router/               # 路由配置
├── nlg-to-dsl/                       # NLG→DSL Python 生成器
│   ├── web_app.py                    # FastAPI 后端 (端口 5000)
│   ├── nlg_to_dsl_test.py            # LLM 管道核心
│   ├── dify-dsl-builder/             # DSL 构建器库
│   └── static/                       # 原版前端（参考）
├── dify-flow-prototype/              # 原型设计稿（HTML/CSS/JS）
├── dsl-templates/                    # DSL 模板
├── docker-compose.yml                # PostgreSQL 容器
├── init-db.sql                       # 数据库扩展
├── PROGRESS.md                       # 开发进度记录
└── CLAUDE.md                         # AI 辅助开发指引
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
| GET | `/api/assets/:id` | 文件详情 |
| GET | `/api/assets/:id/download` | 下载文件 |
| DELETE | `/api/assets/:id` | 删除文件 |
| GET | `/api/folders` | 文件夹列表 |
| POST | `/api/folders` | 创建文件夹 |
| PUT | `/api/folders/:id` | 重命名文件夹 |
| DELETE | `/api/folders/:id` | 删除文件夹 |
| GET/POST | `/api/tasks` | 任务列表 / 创建任务 |
| GET/PUT/DELETE | `/api/tasks/:id` | 任务详情 / 更新 / 删除 |
| POST | `/api/tasks/:id/execute` | 执行任务 |
| GET | `/api/search?q=&type=` | 全文搜索 |
| POST | `/api/generator/chat` | NLG→DSL 对话 |
| GET | `/api/generator/dsl/:sessionId` | 获取生成的 DSL |

## 常用开发命令

```bash
npm install          # 安装全部依赖
npm run dev          # 同时启动前后端
npm run dev:server   # 仅启动后端 (端口 3001)
npm run dev:client   # 仅启动前端 (端口 5174)
npm run db:migrate   # 数据库迁移
npm run db:seed      # 填充种子数据
```

## 注意事项

1. **数据库变更**：修改 `schema.prisma` 后必须运行 `npm run db:migrate`
2. **环境变量**：`.env` 不提交到版本控制，从 `.env.example` 复制
3. **原型参考**：`dify-flow-prototype/` 是 UI 设计稿
4. **计划书**：`DifyFlow智能文本处理系统计划书.docx` 是需求来源
5. **进度记录**：每完成一个功能模块更新 `PROGRESS.md`
6. **生成器**：M4 模块需要单独启动 Python 后端（`cd nlg-to-dsl && python web_app.py`）
