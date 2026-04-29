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
	│   │   │   │   └── task.api.ts
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
| M1 资产管理 | 2.2.1 | assets view | 已完成 | 2026-04-25 |
| M2 任务管理 | 2.2.2 | tasks view | 已完成(即时任务) | 2026-04-20 |
| M3 Dify 智能体管理 | 2.2.3 | agents view | 已完成 | 2026-04-20 |
| M4 智能体生成器 | 2.2.4 | generator view | 基本完成 | 2026-04-28 |
| M5 个人设置 | 2.2.5 | settings view | 已完成 | 2026-04-20 |
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

---

### 2026-04-20 — M5 个人设置模块

**实现内容：**
- Schema 扩展：User 模型新增 `defaultAgentId` 字段 + Agent 反向关联
- RBAC 中间件：`requireRole(...roles)` 角色校验，admin-only 管理接口
- 团队管理后端：listUsers / createUser / updateUserRole / deleteUser / resetUserPassword
- 个人信息增强：默认智能体偏好（Select 下拉）
- 团队管理前端：成员列表（头像+角色标签）、邀请成员 Modal、角色切换 Dropdown、重置密码 Modal、移除成员 Popconfirm
- 通知偏好：任务完成/失败/Dify 断连三个 Switch，localStorage 持久化
- 启动恢复：`bootstrapAuth()` 刷新页面后自动恢复用户信息到 store
- 种子数据：添加 liting(admin) 和 wanghao(member) 测试用户

**修改文件：**
- 修改：`packages/server/prisma/schema.prisma`（User + defaultAgentId，Agent 反向关联）
- 修改：`packages/server/prisma/seed.ts`（多用户种子数据）
- 修改：`packages/server/src/middleware/auth.ts`（新增 requireRole）
- 修改：`packages/server/src/services/auth.service.ts`（新增 5 个用户管理函数）
- 修改：`packages/server/src/controllers/auth.controller.ts`（新增 5 个管理员控制器）
- 修改：`packages/server/src/routes/auth.routes.ts`（5 条 admin-only 路由）
- 修改：`packages/client/src/types/index.ts`（User 加 defaultAgentId）
- 修改：`packages/client/src/api/auth.api.ts`（新增 5 个团队管理 API）
- 修改：`packages/client/src/pages/SettingsPage.tsx`（四面板重构）
- 修改：`packages/client/src/stores/authStore.ts`（新增 bootstrapAuth）
- 修改：`packages/client/src/main.tsx`（启动时调用 bootstrapAuth）

**与原型一致性：** 四面板布局与原型一致，团队管理成员列表还原原型头像+角色标签设计

---

### 2026-04-20 — M3 Dify 智能体管理完善

**实现内容：**
- 连接状态栏：显示 Dify 服务连接状态、URL、已接入智能体数量
- 批量在线状态探测：`/agents/check-online` 接口，并行探测所有智能体，更新 isOnline 字段
- I/O 测试：`/agents/:id/chat` 接口，发送自定义文本查看智能体返回结果
- 前端卡片增强：智能体图标（emoji 轮换）、在线状态脉冲动画、刷新状态按钮
- I/O 测试 Modal：输入测试文本，展示智能体返回内容
- 编辑 Modal 布局优化：名称+模式并排显示

**修改文件：**
- 修改：`packages/server/src/services/dify-client.service.ts`（新增 chatWithDifyAgent）
- 修改：`packages/server/src/services/agent.service.ts`（新增 checkAgentsOnline、chatTest）
- 修改：`packages/server/src/controllers/agent.controller.ts`（新增 checkOnline、chatTest）
- 修改：`packages/server/src/routes/agent.routes.ts`（新增 2 条路由）
- 修改：`packages/client/src/api/agent.api.ts`（新增 checkAgentsOnline、chatTest）
- 修改：`packages/client/src/pages/AgentsPage.tsx`（状态栏 + I/O 测试 + 卡片增强）

**与原型一致性：** 状态栏还原原型设计，卡片图标/在线标签/操作按钮对齐原型布局

---

### 2026-04-20 — M2 任务管理模块（即时任务）

**实现内容：**
- Schema：Task + TaskItem 数据模型，任务状态机 pending→running→completed/failed/canceled
- 后端：createTask、listTasks、retryTask、cancelTask、deleteTask
- 任务执行器：逐文件调用 Dify API，结果自动存为新资产（关联源文件）
- WebSocket 实时推送任务进度到前端
- 前端：任务列表（筛选标签页：全部/运行中/已完成/定时）
- 任务卡片：状态圆点 + 进度条 + 操作按钮（查看结果/重试/暂停/删除）
- 新建任务弹窗：名称、类型选择、智能体下拉、文件多选
- 侧边栏新增"任务管理"导航项

**修改文件：**
- 修改：`packages/server/prisma/schema.prisma`（新增 Task、TaskItem 模型 + 关联）
- 新增：`packages/server/src/services/task.service.ts`
- 新增：`packages/server/src/controllers/task.controller.ts`
- 新增：`packages/server/src/routes/task.routes.ts`
- 修改：`packages/server/src/routes/index.ts`（注册 /tasks）
- 修改：`packages/client/src/types/index.ts`（新增 Task、TaskItem 类型）
- 新增：`packages/client/src/api/task.api.ts`
- 新增：`packages/client/src/pages/TasksPage.tsx`
- 修改：`packages/client/src/router/index.tsx`（新增 /tasks 路由）
- 修改：`packages/client/src/layouts/AppLayout.tsx`（侧边栏加任务管理）

**与原型一致性：** 任务卡片横向布局、状态圆点颜色、进度条、筛选标签页均对齐原型设计

**遗留问题：**
- 定时任务（node-cron 调度）待实现
- 任务执行结果"查看结果"按钮跳转待完善

---

### 2026-04-22 — Bug修复：删除文件夹操作（完整修复）

**实现内容：**
- 修复删除文件夹功能的bug，原先实现是将文件夹内文件移至"全部文件"而非真正删除
- 后端逻辑完全重写：
  - 处理 Asset 与 TaskItem 的外键关联关系，先删除相关 TaskItem 记录
  - 正确解析文件路径，使用 process.cwd() 结合相对路径
  - 逐个删除物理文件，处理文件不存在的情况
  - 逐个删除数据库记录，确保事务完整性
  - 添加详细的日志记录便于调试
  - 修复 TypeScript 类型错误（error: unknown）
- 前端提示优化：将"文件将移回'全部文件'"改为"将永久删除文件夹内所有文件，无法恢复"
- 前端错误处理增强：添加详细的控制台日志和用户友好的错误提示
- 修复前端 Modal 对话框不显示的问题：
  - 修正 Dropdown 配置，将 onClick 处理函数移到每个菜单项上
  - 增强 handleDeleteFolder 函数的调试信息
  - 添加 Modal.confirm 调用的详细日志
  - 修复事件处理冲突
- 确认删除对话框：保持原有的确认删除对话框，但更新了提示内容
- 调试工具：创建测试脚本和调试指南

**修改文件：**
- 修改：`packages/server/src/services/folder.service.ts`（deleteFolder 函数完全重写，修复类型错误）
- 修改：`packages/client/src/pages/AssetsPage.tsx`（修复 Dropdown 配置，增强调试信息）
- 新增：`test-folder-delete.js`（测试脚本）
- 新增：`DEBUG_FOLDER_DELETE.md`（调试指南）
- 新增：`DIAGNOSE_MODAL_ISSUE.md`（Modal 问题诊断指南）
- 新增：`packages/client/test-modal.html`（Modal 测试页面）
- 新增：`quick-test-delete.bat`（快速测试脚本）

**与原型一致性：** 功能实现符合用户需求，前端确认对话框设计符合原型UI规范

**遗留问题：** 无

**调试要点：**
- 后端添加了详细的日志输出，格式为 `[DELETE FOLDER]` 和 `[DELETE ASSET]`

---

### 2026-04-23 — Bug修复：资产管理文件类型选择器添加"全部"选项

**实现内容：**
- 解决资产管理界面中文件类型选择的用户体验问题
- 在文件类型选择器最顶端添加"全部"选项，允许用户返回查看所有类型文件
- 当用户选择单一文件类型后，可以在列表中继续选择"全部"查看所有文件

**修改文件：**
- 修改：`packages/client/src/pages/AssetsPage.tsx`（第374-384行）
  - Select组件配置：添加"全部"选项作为默认值
  - onChange处理：当选择"全部"时设置 fileTypeFilter 为空字符串
  - API调用优化：第81行将 fileTypeFilter 转换为 undefined，避免传递空参数给后端

---

### 2026-04-23 — Bug修复：资产管理文件上传重复解析问题

**问题描述：**
在资产管理模块中，当用户选择n个文件进行上传时，系统会将这n个文件分别解析n次，造成：
- 文件被重复上传到服务器
- 每个文件被重复解析n次
- 浪费计算资源和存储空间
- 用户体验下降（文件处理时间延长）

**问题原因分析：**
问题出在Ant Design Upload组件的`beforeUpload`回调机制：
- 当用户选择n个文件时，`beforeUpload`会被调用n次（每个文件触发一次）
- 每次调用都传入累积的文件列表（[A]、[A,B]、[A,B,C]...）
- 每次调用都触发完整的上传操作，导致重复上传

**实现内容：**
- 实现防抖+状态锁定机制，确保每个文件只上传一次
- 使用`useRef`跟踪上传状态，避免React渲染导致的性能问题
- 100ms防抖时间，合并短时间内的多次上传调用
- 重构上传逻辑，使用`useCallback`优化函数依赖关系

**修改文件：**
- 修改：`packages/client/src/pages/AssetsPage.tsx`
  - 第14行：添加`useRef`导入
  - 第112-121行：使用`useCallback`包装`handleUpload`函数，优化依赖项
  - 第124-125行：添加`uploadTimeoutRef`和`isUploadingRef`用于状态跟踪
  - 第127-142行：新增`handleUploadWithDebounce`防抖函数
  - 第367-370行：修改`beforeUpload`回调，使用防抖处理函数

**修复效果：**
- ✅ 每个文件只被上传和解析一次（无论选择多少个文件）
- ✅ 性能提升：避免了重复的网络请求和数据库操作
- ✅ 用户体验改善：上传处理时间显著减少
- ✅ 代码质量提升：使用React最佳实践优化组件性能

**与原型一致性：** 功能实现完全符合用户期望的批量上传需求

**遗留问题：** 无

**与原型一致性：** 不涉及UI原型变更，但增强了用户体验，符合用户预期行为

**实现逻辑：**
- 使用空字符串 `''` 表示"全部"选项
- Select组件初始值为 `fileTypeFilter || ''`
- 选择"全部"时，setFileTypeFilter('')，API调用时转换为 undefined
- 文件类型显示顺序：全部 → PDF → Word → Excel → TXT → Markdown → CSV
- 前端添加了 `[FRONTEND]` 前缀的日志输出
- 需要重启前后端服务器以加载最新代码
- 必须清除浏览器缓存（Ctrl+Shift+R）
- 检查浏览器控制台和后端控制台以获取详细错误信息
- 使用 test-modal.html 测试 Modal 组件是否正常工作

**常见问题解决：**
- Modal 不显示：重启前端服务器，清除缓存，检查浏览器控制台错误
- 删除失败：检查后端日志，确认外键约束处理正确
- TypeScript 错误：已修复 error: unknown 类型问题

---

### 2026-04-23 - React版本兼容性问题修复（重要）

**问题描述：**
用户反馈在资产管理界面中，点击文件夹删除按钮时出现以下错误：
- `(匿名) @ useWebSocket.ts:36`
- `warning.js:30 Warning: [antd: Modal] Static function can not consume context like dynamic theme. Please use 'App' component instead.`
- `warning.js:30 Warning: [antd: compatible] antd v5 support React is 16 ~ 18. see https://u.ant.design/v5-for-19 for compatible.`

**问题原因分析：**
项目使用的是React 19.2.4版本，但Ant Design 5.24.2官方仅支持React 16-18版本。这导致：
1. Modal.confirm等静态方法无法正常工作，无法显示确认对话框
2. 控制台显示版本兼容性警告
3. 文件夹删除功能失效

**实现内容：**
1. 版本降级：
   - React: `19.2.4` → `18.3.1`
   - React DOM: `19.2.4` → `18.3.1`
   - React Router: `7.2.0` → `6.28.0`
   - Vite: `8.0.9` → `5.4.11`
   - @vitejs/plugin-react: `6.0.1` → `4.3.4`

2. Modal使用方式修复：
   - 在AssetsPage.tsx和AgentsPage.tsx中导入App组件
   - 使用App.useApp()获取modal实例
   - 将Modal.confirm改为modal.confirm
   - 在App.tsx中添加<AntdApp>组件包裹

3. 类型定义更新：
   - @types/react: `19.2.14` → `18.3.12`
   - @types/react-dom: `19.2.3` → `18.3.1`

**修改文件：**
- 修改：`packages/client/package.json`（降级所有依赖版本）
- 修改：`packages/client/src/pages/AssetsPage.tsx`
  - 导入App组件
  - 使用const { modal } = App.useApp()
  - 将Modal.confirm改为modal.confirm
- 修改：`packages/client/src/pages/AgentsPage.tsx`
  - 同样的修改，应用新的Modal使用方式
- 修改：`packages/client/src/App.tsx`
  - 导入App和AntdApp
  - 添加<AntdApp>组件包裹

**修复效果：**
- ✅ 浏览器控制台不再显示React版本兼容性警告
- ✅ 不再显示"Static function can not consume context"警告
- ✅ 文件夹删除功能正常工作
- ✅ 智能体删除功能正常工作

**注意事项：**
- 需要重新安装依赖包：`rm -rf node_modules package-lock.json && npm install`
- 需要清除浏览器缓存并重新加载页面
- 前端开发服务器需要重启

---

### 2026-04-24 — M1 资产管理回收站功能

**实现内容：**
- 数据库模型扩展：
  - Folder 模型新增 `isTrash` 字段，标识回收站文件夹
  - Asset 模型新增 `originalFolderId`、`deletedAt`、`isPermanentlyDeleted` 字段
  - 添加相关索引优化查询性能
- 后端业务逻辑：
  - 新增完整的回收站服务层（trash.service.ts）
  - 实现文件移动到回收站、从回收站恢复、永久删除、清空回收站、获取回收站内容等功能
  - 文件夹删除时自动将文件移至回收站，文件夹本身永久删除
  - 文件恢复时自动处理原文件夹已删除的情况（恢复到"全部文件"）
- 后端API接口：
  - POST /api/trash/move-to-trash - 移动文件到回收站
  - POST /api/trash/restore - 从回收站恢复文件
  - POST /api/trash/permanent-delete - 永久删除文件
  - POST /api/trash/empty - 清空回收站
  - GET /api/trash/ - 获取回收站内容
- 前端界面优化：
  - 回收站文件夹特殊样式（垃圾桶图标、灰色主题）
  - 回收站右键菜单添加"清空回收站"选项
  - 回收站内文件操作：恢复到原位置、永久删除
  - 普通文件夹操作菜单从"删除"改为"移至回收站"
  - 移动/复制文件夹功能排除回收站选项
  - 文件列表在回收站模式下显示恢复和永久删除按钮
- 种子数据更新：确保每个用户创建时自动生成回收站文件夹
- 完整功能测试：验证所有核心操作和边界情况

**修改文件：**
- 修改：`packages/server/prisma/schema.prisma`（新增回收站相关字段和索引）
- 修改：`packages/server/prisma/seed.ts`（用户创建时自动生成回收站）
- 新增：`packages/server/src/services/trash.service.ts`（完整的回收站业务逻辑）
- 新增：`packages/server/src/controllers/trash.controller.ts`（回收站控制器）
- 新增：`packages/server/src/routes/trash.routes.ts`（回收站路由）
- 修改：`packages/server/src/routes/index.ts`（注册回收站路由）
- 修改：`packages/server/src/services/folder.service.ts`（文件夹删除改为移文件到回收站）
- 修改：`packages/server/src/services/asset.service.ts`（集成回收站功能）
- 修改：`packages/server/src/controllers/asset.controller.ts`（支持回收站查询）
- 修改：`packages/client/src/types/index.ts`（新增回收站相关类型字段）
- 修改：`packages/client/src/api/asset.api.ts`（新增回收站相关API函数）
- 修改：`packages/client/src/api/folder.api.ts`（新增清空回收站API）
- 修改：`packages/client/src/pages/AssetsPage.tsx`（完整的回收站UI交互）

**与原型一致性：** 功能实现完全符合用户需求和预期，回收站位置和交互设计符合用户要求

**遗留问题：** 无

**技术亮点：**
- 软删除模式：文件先移至回收站，用户可恢复或永久删除
- 级联处理：删除文件夹时自动处理文件迁移
- 智能恢复：恢复文件时自动处理原文件夹已删除的情况
- 完整的边界测试：验证了所有操作的正确性和数据完整性
- 详细的日志记录：便于调试和问题排查

---

### 2026-04-24 — 新增功能：资产管理多选文件类型筛选

**需求背景：**
原先资产管理界面的文件类型选择器只能选择单一文件类型或查看全部文件，用户希望能够：
1. 同时选择多个文件类型查看不同类型的文件
2. 每个文件类型右侧有独立的勾选框
3. 具备"全选"功能快速选择所有文件类型
4. 点击确定按钮应用筛选，避免误操作

**实现内容：**
- 将原来的Select单选组件替换为Dropdown + Checkbox组合
- 实现文件类型多选功能：可以同时选择多个文件类型
- 添加"全选"复选框：一键选择/取消所有文件类型
- 实现半选状态：部分选择时显示半选图标，提供视觉反馈
- 添加确认/取消按钮：避免误操作，提高用户体验
- 动态按钮文本：显示"文件类型"、"全部"或"已选 X 项"
- UI优化：纯白背景框、阴影效果、悬停交互等视觉增强
- 修复回收站文件类型筛选问题：确保回收站中的文件类型筛选功能正常工作

**修改文件：**
- 修改：`packages/server/src/services/asset.service.ts`
  - listAssets函数的fileType参数支持string | string[]类型
  - 使用Prisma的in操作符处理数组查询，保持向后兼容
- 修改：`packages/server/src/services/trash.service.ts`
  - getTrashContents函数新增filters参数，支持文件类型筛选
  - 修复回收站中文件类型筛选不生效的问题
- 修改：`packages/server/src/controllers/trash.controller.ts`
  - getTrashContents控制器提取查询参数并传递给Service层
- 修改：`packages/client/src/api/asset.api.ts`
  - listAssets函数的fileType参数支持string | string[]类型
  - listTrashAssets函数新增筛选参数支持
- 修改：`packages/client/src/pages/AssetsPage.tsx`
  - 导入Checkbox组件
  - fileTypeFilter状态改为string[]类型
  - 新增fileTypeDropdownOpen状态管理下拉菜单显示
  - 实现Dropdown + Checkbox组件，包含全选、文件类型列表、确认/取消按钮
  - UI美化：白色背景、阴影效果、悬停动画、圆角设计
  - 修复回收站分支的文件类型筛选逻辑

**技术亮点：**
- 向后兼容：同时支持string和string[]参数，不破坏现有功能
- 优雅的半选状态：使用indeterminate属性提供部分选择的视觉反馈
- 响应式设计：滚动区域限制高度，防止列表过长
- 类型安全：完整的TypeScript类型定义
- 一致性体验：回收站和普通文件夹使用相同的筛选逻辑
- 性能优化：使用Prisma的in操作符，数据库层面高效查询

**UI优化细节：**
- 纯白背景框：Dropdown内容区域使用#ffffff背景色
- 多层次阴影：精致的阴影效果增强立体感
- 区域背景区分：全选区和按钮区使用浅灰背景#fafafa
- 悬停交互：文件类型选项悬停时背景变色，提供交互反馈
- 合理层级：zIndex设置为1000，适度覆盖文件传输框

**与原型一致性：** 完全符合用户需求描述的交互方式，每个文件类型都有独立勾选框，具备全选功能

**遗留问题：** 无

---

### 2026-04-24 — Bug修复：资产管理文件移动和复制功能优化

**问题1：在"全部文件"中复制文件不应显示"全部文件（不归类）"选项**
**问题2：文件移动到同名文件时无法弹出覆盖警告**

**实现内容：**
1. 修复复制文件时的文件夹选择逻辑：
   - 在"全部文件"中进行复制操作时，不再显示"全部文件（不归类）"选项
   - 与子文件夹中的复制行为保持一致，只显示用户创建的子文件夹
   - 用户体验优化：避免用户选择无效的目标选项

2. 修复文件移动覆盖检测功能：
   - 前端API调用从PUT方法改为POST方法，与后端路由定义保持一致
   - 修复原因：前端`moveAsset`函数使用错误的HTTP方法导致400 Bad Request错误
   - 确保在从test1移动文件到test2（同名文件）时能够正确检测重复并弹出覆盖警告
   - 后端逻辑已正确实现：检测目标文件夹中同名文件，返回409状态码和重复文件信息

**问题原因分析：**
- 问题1：前端复制文件Modal中的条件判断不正确，在"全部文件"中仍然显示"全部文件"选项
- 问题2：前端`moveAsset`函数使用PUT请求`/assets/${id}`，但后端路由定义为POST请求`/assets/${id}/move`

**修改文件：**
- 修改：`packages/client/src/pages/AssetsPage.tsx`
  - 删除复制文件Modal中的"全部文件（不归类）"选项显示逻辑（第945-961行）
  - 保持与移动文件Modal一致的选择逻辑
- 修改：`packages/client/src/api/asset.api.ts`
  - 修改`moveAsset`函数从PUT请求改为POST请求（第38-41行）
  - 请求路径从`/assets/${id}`改为`/assets/${id}/move`

**修复效果：**
- ✅ 在"全部文件"中复制文件时不再显示"全部文件（不归类）"选项
- ✅ 从test1移动文件到test2时能够正确检测同名文件
- ✅ 检测到重复文件时弹出覆盖警告对话框
- ✅ 用户可以选择覆盖或取消移动操作
- ✅ HTTP请求方法与后端路由定义完全匹配

**与原型一致性：** 功能修复符合用户预期的文件管理行为

**遗留问题：** 无

**技术要点：**
- HTTP方法一致性：确保前端API调用与后端路由定义完全一致
- 用户体验一致性：复制和移动操作的UI行为保持统一
- 错误处理完善：重复文件检测返回409状态码，前端正确处理错误并显示提示

---

### 2026-04-25 — 新增功能：文件多选、全选功能完善

**需求背景：**
用户需要在资产管理界面实现文件的多选操作，以便进行批量管理，具体需求包括：
1. 在"文件类型"按钮旁边添加"多选"按钮
2. 多选模式下显示"全选"和"已选"按钮
3. 支持单个文件卡片的点击选中/取消选中
4. 支持批量操作（删除、恢复、复制、移动）
5. 多选模式切换时提供友好提示

**实现内容：**

1. **多选基础功能：**
   - 在资产管理界面添加"多选"按钮
   - 进入多选模式后，显示"全选"和"已选"按钮
   - 点击"多选"按钮切换进入/退出多选模式
   - 支持单个文件卡片的点击选中/取消选中
   - 选中的文件显示橙色边框和背景高亮
   - 文件卡片左侧显示选中指示器

2. **全选功能优化：**
   - "全选"按钮点击后选中当前页面的所有文件
   - "取消全选"按钮显示文件总数，如"取消全选 (20)"
   - 未全选时只显示"全选"文字
   - 修复原有的白色下拉按钮问题，将全选操作直接绑定到橙色按钮

3. **已选按钮功能：**
   - "已选"按钮显示已选文件数量，如"已选 (3)"
   - 点击"已选"按钮时弹出"是否退出多选"警告
   - 如有选中文件，用户确认后退出多选模式并清空选中状态

4. **批量操作支持：**
   - 支持批量删除（移至回收站）
   - 支持批量恢复（从回收站恢复）
   - 支持批量永久删除
   - 支持批量复制到文件夹
   - 支持批量移动到文件夹
   - 根据当前所在文件夹，动态显示不同的批量操作选项

5. **多选模式切换安全机制：**
   - 在多选模式下切换文件夹时，自动弹出确认对话框
   - 提示用户"切换文件夹将退出多选模式，之前勾选的文件将不再被勾选"
   - 用户可选择"继续切换"或"取消"
   - 继续切换会清空选中状态并退出多选模式

6. **批量重复文件检测：**
   - 新增后端API：POST /api/assets/check-batch-duplicates
   - 批量操作前自动检测目标文件夹中的重复文件
   - 如有重复文件，弹出覆盖警告对话框
   - 显示所有会被覆盖的文件列表
   - 统计会覆盖的文件数量和正常操作的文件数量
   - 用户明确确认后才执行覆盖操作

**修改文件：**
- 修改：`packages/client/src/pages/AssetsPage.tsx`
  - 新增多选相关状态：isMultiSelectMode、selectedAssets、selectAllChecked
  - 新增批量操作状态：batchCopyOpen、batchMoveOpen、batchCopyFolderId、batchMoveFolderId
  - 新增批量重复文件状态：batchDuplicateFiles、batchOverrideType、batchOverrideFolderId
  - 新增文件夹切换状态：pendingFolder
  - 实现handleBatchAction函数处理批量操作
  - 实现handleAssetClick函数处理文件卡片点击选中
  - 实现handleAssetHover函数处理悬停效果
  - 实现handleBatchCopy函数处理批量复制
  - 实现handleBatchMove函数处理批量移动
  - 实现handleBatchOverride函数处理批量覆盖确认
  - 实现handleCancelBatchOverride函数取消批量覆盖
  - 实现handleFolderSwitch函数处理文件夹切换（含多选模式检查）
  - 新增多选按钮和全选按钮UI
  - 新增批量复制/移动Modal
  - 新增批量重复文件警告Modal
  - 修改文件卡片UI，添加选中状态样式
  - 修改右键菜单，添加批量操作选项

- 新增：`packages/server/src/services/asset.service.ts`
  - 新增checkBatchDuplicateFiles函数：批量检测重复文件
  - 实现完整的重复文件检查逻辑

- 新增：`packages/server/src/controllers/asset.controller.ts`
  - 新增checkBatchDuplicateFiles控制器函数

- 修改：`packages/server/src/routes/asset.routes.ts`
  - 新增POST /assets/check-batch-duplicates路由

- 新增：`packages/client/src/api/asset.api.ts`
  - 新增checkBatchDuplicateFiles API调用函数

**技术亮点：**
- 状态管理：使用useState管理多选、选中、批量操作等多种状态
- 用户体验：清晰的选中状态视觉反馈（橙色边框、背景高亮、选中指示器）
- 安全机制：切换文件夹时自动退出多选模式，避免跨文件夹操作的复杂性
- 批量检测：智能检测重复文件，避免意外覆盖
- 详细提示：覆盖警告显示所有会被覆盖的文件列表和统计信息
- 交互优化：已选按钮显示选中数量，退出时提供确认对话框

**与原型一致性：** 功能实现完全符合用户需求，多选、全选、批量操作的设计符合预期交互方式

**遗留问题：** 无

**操作流程：**
1. 点击"多选"按钮进入多选模式
2. 点击"全选"按钮全选当前页面所有文件
3. 点击单个文件卡片进行选中/取消选中
4. 右键点击文件选择批量操作（删除、恢复、复制、移动）
5. 批量复制/移动时自动检测重复文件，如有重复则显示覆盖警告
6. 点击"已选"按钮退出多选模式（如有选中文件则弹出确认对话框）
7. 在多选模式下切换文件夹时，自动弹出确认并退出多选模式

---

### 2026-04-26 — Bug修复：文件夹名称重复检测和回收站名称保护

**需求背景：**
用户反馈在资产管理界面中，当创建文件夹时遇到以下问题：
1. 创建同名文件夹时会静默失败，没有给出任何提示
2. 创建名为"回收站"的文件夹时会报错：`Invalid prisma.folder.create() invocation... Unique constraint failed on fields: (user_id,name)`

**问题原因分析：**
1. 问题1：前端没有对文件夹名称进行重复检查，直接调用后端API创建，导致违反数据库唯一约束
2. 问题2：系统已经有一个名为"回收站"的默认文件夹（isTrash: true），当用户尝试创建同名文件夹时会违反唯一约束

**实现内容：**

1. **文件夹名称重复检测：**
   - 前端创建文件夹前，检查当前文件夹列表中是否已存在同名文件夹（排除回收站文件夹）
   - 发现重复时，使用modal.warning()弹出警告对话框
   - 警告信息显示为：`文件夹'XXX'已存在`
   - 警告对话框只有一个"关闭"按钮
   - 检测到重复时直接返回，不执行后续的API调用

2. **"回收站"名称保护机制：**
   - 后端folder.service.ts中的createFolder函数：添加了对"回收站"名称的检查，禁止创建名为"回收站"的文件夹
   - 后端folder.service.ts中的renameFolder函数：添加了对"回收站"名称的检查，禁止重命名为"回收站"
   - 前端AssetsPage.tsx中的handleCreateFolder函数：添加了对"回收站"名称的前端检查
   - 前端AssetsPage.tsx中的handleRenameFolder函数：添加了对"回收站"名称的前端检查

**修改文件：**
- 修改：`packages/server/src/services/folder.service.ts`
  - createFolder函数添加"回收站"名称检查
  - renameFolder函数添加"回收站"名称检查
- 修改：`packages/client/src/pages/AssetsPage.tsx`
  - handleCreateFolder函数添加重复名称检测和"回收站"名称保护
  - handleRenameFolder函数添加"回收站"名称保护

**修复效果：**
- ✅ 创建同名文件夹时，立即弹出警告对话框提示该文件夹已存在
- ✅ 警告对话框只有一个"关闭"按钮，点击后关闭对话框，创建流程被终止
- ✅ 创建名为"回收站"的文件夹时，显示友好提示：`无法创建名为"回收站"的文件夹`
- ✅ 重命名文件夹为"回收站"时，显示友好提示：`无法重命名为"回收站"`
- ✅ 避免了数据库唯一约束冲突错误
- ✅ 提供了清晰的用户反馈，提升用户体验

**与原型一致性：** 功能修复符合用户预期的文件管理行为，警告对话框设计符合原型UI规范

**遗留问题：** 无

**技术亮点：**
- 双重保护：前端和后端同时进行检查，确保数据完整性
- 友好提示：使用modal.warning()提供用户友好的错误提示
- 一致性体验：创建和重命名操作都有相同的名称保护机制
- 安全性：防止用户创建系统保留的特殊文件夹名称

---

### 2026-04-28 — 优化：定时任务触发时间可视化选择器

**需求背景：**
定时任务的触发时间原先使用 Cron 表达式文本框（如 `0 8 * * *`），普通用户不会写 Cron 表达式。需要改为可视化选择器，用户只需选择频率和时间，系统自动生成 Cron 表达式。

**实现内容：**

1. **频率选择** — Select 下拉，提供 4 种预设频率：
   - 每天
   - 每周（选中后出现星期多选）
   - 每月（选中后出现日期输入）
   - 自定义间隔（选中后出现数字 + 单位选择：分钟/小时）

2. **时间选择** — TimePicker 小时:分钟，默认 08:00

3. **星期选择**（仅"每周"）— Checkbox 组：周一~周日

4. **日期输入**（仅"每月"）— InputNumber，1-31

5. **自动生成 Cron** — `buildCron()` 工具函数将用户选择转为标准 Cron 表达式

6. **中文显示** — 任务卡片新增 `cronToLabel()` 工具函数：
   - `0 8 * * *` → "每天 08:00"
   - `0 8 * * 1` → "每周一 08:00"
   - `0 8 1 * *` → "每月 1 日 08:00"
   - `*/30 * * * *` → "每 30 分钟"
   - `0 */2 * * *` → "每 2 小时"

**修改文件：**
- 修改：`packages/client/src/pages/TasksPage.tsx`
  - 新增 buildCron / cronToLabel 工具函数
  - 新增 6 个调度状态变量（频率、时间、星期、日期、间隔值、间隔单位）
  - 替换 Cron 文本框为频率选择 + 时间选择 + 条件显示的辅助输入
  - handleCreate 中自动生成 cronExpression
  - TaskCard 中用 cronToLabel 替换原始 Cron 显示

**与原型一致性：** 符合原型设计理念（用户友好的时间选择，而非原始表达式输入）

**遗留问题：** 无


---

### 2026-04-28 — M4 模板广场 + 智能体生成器 UI

**需求背景：**
按计划书 2.2.4 节要求实现 M4 模块。用户提供了 60+ 个 Dify DSL 模板压缩包，需要在模板广场中展示。智能体生成器先实现 UI 壳子，参考原型设计的对话式向导。

**实现内容：**

1. **后端模板 API：**
   - `template.service.ts` — 扫描 `dsl-templates/` 目录，用 `js-yaml` 解析 YAML 头部提取元数据
   - `GET /templates` 接口，支持 category 筛选

2. **路由和侧边栏改造：**
   - `/agents` 改为 SubMenu，包含：智能体管理、模板广场、智能体生成器

3. **模板广场页面（TemplatesPage）：**
   - 搜索框 + 分类 Tab 筛选
   - 卡片网格：icon、name、description、mode 标签、分类
   - 点击卡片弹出 YAML 预览

4. **智能体生成器页面（GeneratorPage）：**
   - 两面板布局：左侧对话式向导、右侧 YAML 预览
   - 6 步向导：类型 → 描述 → 输入 → 输出 → 模型 → 生成

**修改文件：**
- 新增：template.service.ts, template.controller.ts, template.routes.ts, template.api.ts
- 新增：TemplatesPage.tsx, GeneratorPage.tsx
- 修改：routes/index.ts, router/index.tsx, AppLayout.tsx
- 新增：dsl-templates/ 目录（60+ 模板文件）

**遗留问题：** 生成器仅 UI 壳子，实际 DSL 生成逻辑待开发

---

### 2026-04-28 — Bug修复：模板广场图标显示英文名称而非 Emoji

**问题描述：**
模板广场中"标题党创作"等模板的图标显示为 `face_vomiting` 等英文文本，而非预期的 emoji。原因是 Dify DSL 模板的 `app.icon` 字段有两种格式：直接 emoji 字符（大多数模板）或 Dify 内部图标标识符（如 `clown_face`、`exploding_head`）。

**实现内容：**
- 在 `template.service.ts` 中新增 `ICON_MAP` 映射表，覆盖 5 种 Dify 图标名称：
  - `clown_face` → 🤡
  - `exploding_head` → 🤯
  - `face_vomiting` → 🤮
  - `laughing` → 😆
  - `space_invader` → 👾
- 新增 `resolveIcon()` 函数：先查映射表，已是 emoji 的直接返回，未知文本名回退为 🤖

**修改文件：**
- 修改：`packages/server/src/services/template.service.ts`（新增 ICON_MAP + resolveIcon）

**遗留问题：** 无
