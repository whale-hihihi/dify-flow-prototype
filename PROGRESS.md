# DifyFlow 项目进度记录

> 每次完成功能模块后更新此文件，记录实现状态、修改内容和项目目录结构变化。

---

## 项目目录结构

```
DifyFlow/
├── .env                          # 全局环境变量
├── .env.example                  # 环境变量模板
├── docker-compose.yml            # PostgreSQL Docker 配置
├── init-db.sql                   # 数据库初始化 SQL
├── package.json                  # Monorepo 根配置
├── DifyFlow智能文本处理系统计划书.docx  # 项目计划书
│
├── dify-flow-prototype/          # 硬编码 UI 原型（HTML/CSS/JS）
│   ├── index.html
│   ├── styles.css
│   └── app.js
│
├── packages/
│   ├── client/                   # React 前端
│   │   ├── src/
│   │   │   ├── api/              # API 调用层
│   │   │   │   ├── agent.api.ts
│   │   │   │   ├── asset.api.ts
│   │   │   │   ├── auth.api.ts
│   │   │   │   ├── client.ts
│   │   │   │   ├── dify-config.api.ts
│   │   │   │   ├── folder.api.ts
│   │   │   │   └── search.api.ts
│   │   │   ├── pages/            # 页面组件
│   │   │   │   ├── AgentsPage.tsx
│   │   │   │   ├── AssetsPage.tsx
│   │   │   │   ├── LoginPage.tsx
│   │   │   │   └── SettingsPage.tsx
│   │   │   ├── layouts/          # 布局组件
│   │   │   │   └── AppLayout.tsx
│   │   │   ├── hooks/            # 自定义 Hooks
│   │   │   │   └── useWebSocket.ts
│   │   │   ├── stores/           # Zustand 状态管理
│   │   │   │   └── authStore.ts
│   │   │   ├── styles/           # 样式
│   │   │   │   ├── global.css
│   │   │   │   └── theme.ts
│   │   │   ├── types/            # TypeScript 类型
│   │   │   │   └── index.ts
│   │   │   ├── router/           # 路由
│   │   │   │   └── index.tsx
│   │   │   ├── App.tsx
│   │   │   └── main.tsx
│   │   ├── public/
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   └── server/                   # Express 后端
│       ├── src/
│       │   ├── config/           # 配置
│       │   │   ├── constants.ts
│       │   │   ├── database.ts
│       │   │   └── env.ts
│       │   ├── controllers/      # 控制器
│       │   │   ├── agent.controller.ts
│       │   │   ├── asset.controller.ts
│       │   │   ├── auth.controller.ts
│       │   │   ├── dify-config.controller.ts
│       │   │   ├── folder.controller.ts
│       │   │   └── search.controller.ts
│       │   ├── routes/           # 路由定义
│       │   │   ├── agent.routes.ts
│       │   │   ├── asset.routes.ts
│       │   │   ├── auth.routes.ts
│       │   │   ├── dify-config.routes.ts
│       │   │   ├── folder.routes.ts
│       │   │   ├── index.ts
│       │   │   └── search.routes.ts
│       │   ├── services/         # 业务逻辑
│       │   │   ├── agent.service.ts
│       │   │   ├── asset.service.ts
│       │   │   ├── auth.service.ts
│       │   │   ├── dify-client.service.ts
│       │   │   ├── dify-config.service.ts
│       │   │   ├── folder.service.ts
│       │   │   └── search.service.ts
│       │   ├── middleware/       # 中间件
│       │   │   ├── auth.ts
│       │   │   ├── upload.ts
│       │   │   └── validate.ts
│       │   ├── parsers/          # 文件解析器
│       │   │   ├── csv.parser.ts
│       │   │   ├── docx.parser.ts
│       │   │   ├── md.parser.ts
│       │   │   ├── parser-factory.ts
│       │   │   ├── parser-interface.ts
│       │   │   ├── pdf.parser.ts
│       │   │   ├── txt.parser.ts
│       │   │   └── xlsx.parser.ts
│       │   ├── utils/            # 工具函数
│       │   │   ├── crypto.ts
│       │   │   ├── file-utils.ts
│       │   │   └── jwt.ts
│       │   ├── workers/          # Worker 线程
│       │   │   └── parse-worker.ts
│       │   ├── ws/               # WebSocket
│       │   │   └── socket-manager.ts
│       │   ├── scripts/          # 脚本
│       │   │   └── fix-filenames.ts
│       │   ├── types/            # 类型声明
│       │   │   └── modules.d.ts
│       │   ├── app.ts
│       │   └── index.ts
│       ├── prisma/               # 数据库
│       │   ├── schema.prisma
│       │   ├── seed.ts
│       │   └── migrations/
│       ├── uploads/              # 上传文件目录
│       ├── .env
│       ├── nodemon.json
│       ├── tsconfig.json
│       └── package.json
│
└── test-files/                   # 测试用文件
    ├── 示例文本.txt
    ├── 技术文档.md
    ├── 人员信息表.csv
    ├── 信息化培训通知.docx
    ├── 季度工作总结.pdf
    └── 装备清单.xlsx
```

---

## 六大功能模块实现状态

| 模块 | 计划书章节 | 原型文件 | 状态 | 完成日期 |
|------|-----------|---------|------|---------|
| M1 资产管理 | 2.2.1 | assets view | 已完成 | 2026-04-14 |
| M2 任务管理 | 2.2.2 | tasks view | 待开发 | - |
| M3 Dify 智能体管理 | 2.2.3 | agents view | 已完成(基础CRUD) | 2026-04-13 |
| M4 智能体生成器 | 2.2.4 | generator view | 待开发 | - |
| M5 个人设置 | 2.2.5 | settings view | 待开发 | - |
| M6 通用支撑 | 2.2.6 | login page | 已完成 | 2026-04-13 |

---

## 功能实现记录

### 2026-04-13 — M1 基础骨架 + M6 通用支撑 + M3 智能体基础

**实现内容：**
- Monorepo 项目搭建（pnpm workspaces → npm workspaces）
- 用户认证：JWT + bcrypt，登录/获取用户/更新资料
- Dify 连接配置：upsert + 连通测试 + 延迟测量
- 智能体 CRUD：增删改查 + API Key AES 加密
- 前端：LoginPage、AgentsPage、SettingsPage + 侧栏布局 + 路由

**修改文件：** 全量初始搭建

**与原型一致性：** 基本一致，登录页、设置页、智能体管理页布局还原原型

---

### 2026-04-14 — M1 资产管理模块

**实现内容：**
- 文件上传：Multer + 批量上传（最多 20 文件），拖拽/点击上传
- 多格式解析：PDF/DOCX/XLSX/TXT/MD/CSV 六种格式，Worker 队列异步解析
- 文件夹管理：增删改查 + 右键菜单，扁平结构，删除时文件自动归入"全部文件"
- 全文搜索：PostgreSQL tsvector 后端已实现
- 文件下载：axios blob 下载（携带 JWT 认证）
- 在线预览：点击已解析文件弹出 Modal 展示解析后纯文本
- 文件名中文编码修复：解决 Multer 1.4.x 的 latin1 编码问题
- 状态筛选 + 文件类型筛选 + 文件名搜索

**修改文件：**
- 新增：`packages/server/src/parsers/` 全部解析器
- 新增：`packages/server/src/workers/parse-worker.ts`
- 新增：`packages/server/src/scripts/fix-filenames.ts`
- 修改：`packages/server/src/middleware/upload.ts`（中文文件名编码修复）
- 修改：`packages/client/src/pages/AssetsPage.tsx`（预览、搜索、筛选、删除）
- 修改：`packages/client/src/api/asset.api.ts`（下载 + blob 支持）

**与原型一致性：** 基本还原原型中的文件上传区、文件卡片网格、文件夹侧栏

**遗留问题：**
- 全文搜索前端 UI 未实现（后端 API 已就绪）
- 文件上传进度百分比未实现（仅展示状态标签）

---

### 2026-04-15 — PDF 解析增强：重试机制 + OCR 后备

**实现内容：**
- pdf-parse 3 次重试机制：解决 "bad XRef entry" 等非确定性失败
- null bytes 过滤：`.replace(/\0/g, '')` 修复 PostgreSQL UTF8 编码错误
- OCR 后备流程：文字提取少于 50 字符时自动触发
  - pdfjs-dist (scale 4.0) 渲染 PDF 页面为高清图片
  - tesseract.js (chi_sim + eng) 中英文 OCR 识别
  - PSM_SINGLE_BLOCK 模式优化版面分析
  - 后处理：去除中文间多余空格、修复常见技术术语 OCR 错误
- 前端预览空内容修复：`parsedText` 为空字符串时正确显示"暂无解析内容"

**修改文件：**
- 修改：`packages/server/src/parsers/pdf.parser.ts`（重试 + OCR + 后处理）
- 修改：`packages/server/src/types/modules.d.ts`（新增 @napi-rs/canvas、pdfjs-dist 类型声明）
- 修改：`packages/client/src/pages/AssetsPage.tsx`（预览空内容条件判断修复）

**与原型一致性：** 不涉及 UI 变更

**依赖新增：** tesseract.js、pdfjs-dist、@napi-rs/canvas（均已有 Windows 预编译）

**遗留问题：**
- OCR 对纯图片 PDF 仍有少量识别误差（英文字母混淆），属 tesseract.js 引擎限制
- tesseract.js 首次使用需下载约 20MB 语言包，之后缓存

