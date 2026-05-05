# NLG → DSL 智能体生成器

通过自然语言描述自动生成可导入 Dify 的工作流 DSL 文件。

## 使用方式

### 安装依赖

```bash
pip install fastapi pydantic pyyaml uvicorn httpx jinja2 eval_type_backport
```

### Web 模式（推荐）

```bash
python3 web_app.py
```

浏览器打开 `http://localhost:5000`，在左侧对话栏用自然语言描述需求，按提示操作即可。生成的 DSL 在右侧面板查看，支持复制和下载 `.dify.yml` 文件。

交互流程：
1. 输入需求描述 → 系统生成工作流规划
2. 确认规划（或提出修改意见）
3. 若规划包含 HTTP 请求节点，系统会先要求提供 URL
4. 提供后自动生成完整 DSL

### CLI 模式

```bash
python3 nlg_to_dsl_test.py "请为我生成一个客服分流工作流（退款/技术/一般）"
```

生成的 DSL 文件保存在 `output/` 目录下。

### 批量测试

```bash
python3 test_runner.py              # 运行全部 15 个测试用例
python3 test_runner.py 5            # 只运行第 5 个
```

## 项目架构

```
nlg-to-dsl-54/
├── web_app.py                  # Web 后端（FastAPI），会话管理与聊天 API
├── static/
│   └── index.html              # 前端单页应用（对话 + DSL 展示）
├── nlg_to_dsl_test.py          # 核心 LLM 管道（4 级 LLM 调用链）
├── test_runner.py              # 15 个端到端测试用例
└── dify-dsl-builder/           # DSL 构建库
    ├── builder.py              # 主入口：节点/边 → 完整 YAML
    ├── models.py               # Pydantic 数据模型（NodeDef, EdgeDef 等）
    ├── id_mapper.py            # 节点 ID 映射（中文 ID → Dify 安全 ID）
    ├── layout.py               # 自动布局计算
    ├── llm_parser.py           # LLM 输出解析器
    ├── llm_validator.py        # 节点图深度校验
    ├── node_io_contract.py     # 节点间数据流契约校验
    └── node_builders/          # 各节点类型的 DSL 生成器
        ├── start.py            #   开始节点
        ├── end.py              #   结束节点
        ├── llm.py              #   LLM 节点
        ├── http_request.py     #   HTTP 请求节点
        ├── code.py             #   代码执行节点
        ├── template.py         #   模板渲染节点
        ├── if_else.py          #   条件分支节点
        ├── assigner.py         #   变量赋值节点
        └── variable_aggregator.py  # 变量聚合节点
```

## 核心管道

自然语言到 DSL 的转换由 4 级 LLM 调用链完成：

```
用户自然语言
    │
    ▼
LLM1: 意图理解 → 输出工作流规划 + 意图 JSON
    │
    ▼ (用户确认/修改)
LLM2: 节点生成 → 输出完整的 nodes/edges JSON（含校验重试）
    │
    ▼
Builder: 直接构建 DSL YAML
    │
    ▼
校验 → 失败则进入 LLM3/LLM4 修复循环
    │
    ▼
最终 DSL
```

| 阶段 | 作用 | 容错机制 |
|------|------|----------|
| LLM1 | 理解自然语言，生成规划与意图 JSON | 解析失败最多重试 3 次 |
| LLM2 | 根据意图生成完整的节点和边定义 | 内置深度校验，最多重试 4 次 |
| Builder | 将节点/边 JSON 转为 Dify DSL YAML | 纯确定性构建，无 LLM 调用 |
| LLM3/4 | 校验失败时修复 DSL | 最多修复 2 轮 |

## 配置

LLM API 配置在 `nlg_to_dsl_test.py` 顶部：

```python
SILICONFLOW_API_URL = "https://api.siliconflow.cn/v1/chat/completions"
SILICONFLOW_API_KEY = "your-api-key"
MODEL = "Qwen/Qwen3.6-35B-A3B"
```

替换 `SILICONFLOW_API_KEY` 为你自己的 SiliconFlow API Key 即可使用。也支持其他 OpenAI 兼容 API，修改 `SILICONFLOW_API_URL` 和 `MODEL` 即可。

## 支持的工作流元素

- **LLM 节点**：大模型调用，含详细提示词（角色设定、任务、输出格式、示例）
- **HTTP 请求**：调用外部 API，URL 由用户在交互中提供
- **条件分支**：if-else 多路分流（支持链式串联实现 3+ 分支）
- **代码执行**：Python/JS 脚本
- **模板渲染**：Jinja2 文本处理
- **变量聚合**：多分支结果汇总
- **变量赋值**：中间变量写入
