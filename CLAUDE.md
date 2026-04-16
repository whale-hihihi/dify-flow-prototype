# DifyFlow 项目开发指引

## 项目概述
DifyFlow 智能文本处理平台 —— 数据库课程项目，PostgreSQL + Node.js + React 技术栈。

## 核心工作流（实现新功能时必须遵循）

当用户要求实现某个功能模块或修改功能时，**必须按以下顺序执行**：

### Step 1: 查阅计划书
读取 `DifyFlow智能文本处理系统计划书.docx`，找到对应该模块的设计要求：
- M1 资产管理 → 第 2.2.1 节
- M2 任务管理 → 第 2.2.2 节
- M3 Dify 智能体管理 → 第 2.2.3 节
- M4 智能体生成器 → 第 2.2.4 节
- M5 个人设置 → 第 2.2.5 节
- M6 通用支撑 → 第 2.2.6 节
- 技术路线 → 第 4.x 节

提取该模块的：功能需求、页面设计要求、数据模型、技术难点与解决方案。

### Step 2: 参考原型 Demo
读取 `dify-flow-prototype/` 目录下对应的 HTML/CSS/JS 文件：
- `index.html` — 页面结构和交互元素
- `styles.css` — 样式设计（颜色、布局、组件）
- `app.js` — 交互逻辑（弹窗、导航、数据展示）

原型是功能的"设计稿"，实现的前端应尽量还原原型的视觉和交互效果。

### Step 3: 实现功能
基于计划书需求和原型设计，在 `packages/` 目录下实现：
- 后端：`packages/server/src/` 下的 service/controller/route/middleware
- 前端：`packages/client/src/` 下的 page/api/component
- 数据库：`packages/server/prisma/schema.prisma`

### Step 4: 更新进度记录
每次完成功能后，更新 `PROGRESS.md`：
1. 更新「六大功能模块实现状态」表格中的状态和完成日期
2. 在「功能实现记录」章节追加一条记录，包含：
   - 完成日期
   - 实现的功能名称
   - 修改了哪些文件（新增/修改）
   - 是否与原型设计一致
   - 遗留问题（如有）
3. 如果项目目录结构有变化，更新「项目目录结构」章节

## 技术栈
- 后端：Node.js + Express + TypeScript + Prisma ORM
- 前端：React + Vite + TypeScript + Ant Design + Zustand
- 数据库：PostgreSQL 15（Docker）
- 实时通信：WebSocket
- 文件解析：pdf-parse / mammoth / xlsx / 等

## 关键配置
- 数据库：`postgresql://difyflow:password@localhost:15432/difyflow`
- 后端端口：3001
- Dify 默认地址：`http://localhost/v1`

## 开发命令
- `npm run dev` — 同时启动前后端开发服务器
- `npm run dev:server` — 仅启动后端
- `npm run dev:client` — 仅启动前端
- `npm run db:migrate` — 运行数据库迁移
- `npm run db:seed` — 填充种子数据
