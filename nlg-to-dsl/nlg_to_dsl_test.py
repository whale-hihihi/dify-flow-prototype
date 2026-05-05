#!/usr/bin/env python3
"""
NLG → DSL End-to-End Tester (full v8 workflow equivalent)

Pipeline: NL → LLM1(intent+plan) → LLM2(nodes+edges) → deep validate×3
  → select valid → preprocess → POST /generate → DSL validate
  → LLM3 fix → LLM4 fix → final DSL

All LLM nodes use Qwen/Qwen3.6-35B-A3B via SiliconFlow.
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
from collections import defaultdict, deque
from pathlib import Path

import httpx
import yaml

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
SILICONFLOW_API_URL = "https://api.siliconflow.cn/v1/chat/completions"
SILICONFLOW_API_KEY = "sk-jxeedbusmuxbsdkrnzllyoqtpvdwlpgkgplbdpcvofycwnrt"
MODEL = "Qwen/Qwen3.6-35B-A3B"
TEST_RESULTS_DIR = Path.home() / "Desktop" / "test-results"

sys.path.insert(0, str(Path(__file__).parent / "dify-dsl-builder"))

# Direct builder imports (no HTTP needed)
from builder import build_dsl as _build_dsl
from models import NodeDef, EdgeDef, NodeVariable
from llm_validator import validate_llm2_output

# ═══════════════════════════════════════════════════════════════════════════
# SiliconFlow API Client
# ═══════════════════════════════════════════════════════════════════════════
def call_llm(system_prompt: str, user_prompt: str,
             max_tokens: int = 4096, temperature: float = 0.7) -> str:
    headers = {
        "Authorization": f"Bearer {SILICONFLOW_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": max_tokens,
        "temperature": temperature,
        "top_p": 0.9,
    }
    with httpx.Client(timeout=300) as client:
        resp = client.post(SILICONFLOW_API_URL, headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()
    return data["choices"][0]["message"]["content"]


def clean_llm_output(text: str) -> str:
    text = re.sub(r"<think[^>]*>.*?</think\s*>", "", text, flags=re.DOTALL)
    text = re.sub(r"<thought[^>]*>.*?</thought\s*>", "", text, flags=re.DOTALL)
    return text.strip()


def extract_json_from_text(text: str) -> dict:
    text = clean_llm_output(text)
    text = re.sub(r"^```(?:json)?\s*\n?", "", text)
    text = re.sub(r"\n?```\s*$", "", text)
    text = text.strip()

    # Try direct parse first
    try:
        return json.loads(text)
    except Exception:
        pass

    # Find matching braces at depth 0
    start = text.find("{")
    if start != -1:
        depth = 0
        for i in range(start, len(text)):
            if text[i] == "{":
                depth += 1
            elif text[i] == "}":
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(text[start:i + 1])
                    except Exception:
                        continue
                    break

    # Last resort: find largest JSON-like block
    matches = list(re.finditer(r"\{", text))
    for m in reversed(matches):
        s = m.start()
        depth = 0
        for i in range(s, len(text)):
            if text[i] == "{":
                depth += 1
            elif text[i] == "}":
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(text[s:i + 1])
                    except Exception:
                        break
    raise ValueError("Cannot extract JSON from LLM output")


# ═══════════════════════════════════════════════════════════════════════════
# LLM1: Intent + Planning  (equivalent to "LLM1: 意图+规划")
# ═══════════════════════════════════════════════════════════════════════════
LLM1_SYSTEM = r"""你是工作流规划助手。用户会描述想构建的 AI 工作流，或者基于上一版计划提出修改意见。

你的任务：
1. 输出一份中文工作流计划，供用户确认
2. 输出结构化意图 JSON，供后续节点生成 DSL

处理规则：
- 如果当前阶段为空，或用户明显是在提出一个全新的需求，就按新需求重新规划
- 如果用户需求同时包含"指定文档格式/模板"和"原材料/素材/文档内容"，且目标是"情报分析/整编/报告输出"，优先收敛为一个稳定预设：
  `task_type=template_driven_intel_report`
- 对这个预设，默认不要设计 if-else，除非用户明确要求多种输出模式或多路分支
- 对这个预设，建议的稳定步骤是：输入 -> 情报分析整编 -> 按目标格式输出 -> 输出

## 可用节点类型
仅限：start / end / llm / http-request / template-transform / code / if-else / assigner / variable-aggregator

## 通用结构模式（请根据用户需求，优先匹配最合适的模式）
1. **线性链**：适合没有分支、顺序执行的任务。
   示例步骤顺序：start -> llm/code/template -> end
2. **分类分支**：适合根据用户输入的一个分类变量（如"任务类型"）走不同处理路径。
   结构：start（含分类变量） -> if-else（根据该变量分支） -> 各分支处理节点 -> 汇聚（可选 variable-aggregator） -> end
3b. **多路 if-else 链式分支**：适合 3 个或以上分支的场景，必须用多个 if-else 节点链式串联。
   结构：start -> if-else1(true -> A处理, false -> if-else2(true -> B处理, false -> C处理)) -> 汇聚 -> end
   规则：每个 if-else 只有 true/false 两个出口，true 直接走一个分支，false 连接下一个 if-else 继续分流。
   切勿在一个 if-else 上挂 3 个以上的出口。
4. **API 编排**：适合需要调用外部 API 获取数据再处理的场景。
   结构：start -> http-request -> llm/code -> end

## steps 字段要求（极其重要）
每个步骤对象必须包含以下字段：
- "step": "步骤名称"（唯一）
- "node_type": "节点类型"（仅限上述类型）
- "desc": "简要说明"
- "prompt_hint": "仅当 node_type 为 llm 时需要，包含完整的角色设定、任务描述、输出格式和 2-3 个输出示例"
- "connect_to": ["后续步骤名称1", "后续步骤名称2", ...]
- "branch_condition": 如果节点是 if-else，请写清 true 分支的匹配条件，否则填 null

## 新增字段 connection_rules（必须生成）
在 JSON 中增加一个 "connection_rules" 数组，每项格式为：
{"from_step": "前一步step名称", "to_step": "后一步step名称", "branch": "仅当 from_step 为 if-else 且该边为 true 分支时填 'true'，false 分支填 'false'，否则为 null"}

严格按以下格式输出，用 ===PLAN=== 和 ===JSON=== 分隔，不要输出任何额外说明，不要用 ``` 代码围栏包裹 JSON。

示例1（线性链）：
===PLAN===
1. 输入：接收网页URL
2. 网页抓取：HTTP请求获取网页内容
3. 情报提取：LLM从内容中提取关键信息
4. 输出：结构化情报报告
===JSON===
{"task_type":"intel_compilation","input_type":"url","steps":[{"step":"输入","node_type":"start","desc":"接收网页URL","connect_to":["网页抓取"],"branch_condition":null},{"step":"网页抓取","node_type":"http-request","desc":"获取网页内容","connect_to":["情报提取"],"branch_condition":null},{"step":"情报提取","node_type":"llm","desc":"提取关键信息","prompt_hint":"你是一个专业的情报分析助手。\n任务：从网页内容中提取关键情报。\n提取维度：人物、事件、时间、地点、原因。\n输出格式（JSON）：{\"person\":\"...\",\"event\":\"...\",\"time\":\"...\",\"location\":\"...\",\"reason\":\"...\"}\n输出示例：\n示例1：{\"person\":\"张三\",\"event\":\"出席会议\",\"time\":\"2024年3月\",\"location\":\"北京\",\"reason\":\"年度峰会\"}\n示例2：{\"person\":\"李四\",\"event\":\"发表演讲\",\"time\":\"2024年6月\",\"location\":\"上海\",\"reason\":\"技术大会\"}","connect_to":["输出"],"branch_condition":null},{"step":"输出","node_type":"end","desc":"输出结构化报告"}],"output_format":"structured_report","connection_rules":[{"from_step":"输入","to_step":"网页抓取","branch":null},{"from_step":"网页抓取","to_step":"情报提取","branch":null},{"from_step":"情报提取","to_step":"输出","branch":null}]}

示例2（分类分支）：
===PLAN===
1. 输入：接收文章内容和操作类型（中心思想分析 / 文章润色）
2. 路由：根据操作类型分派
3. 中心思想分析：LLM分析文章中心思想
4. 文章润色：LLM对文章进行润色
5. 结果汇聚：聚合两路结果
6. 输出：最终输出
===JSON===
{"task_type":"article_processing","input_type":"text_and_choice","steps":[{"step":"输入","node_type":"start","desc":"接收文章内容和操作类型","connect_to":["路由"],"branch_condition":null},{"step":"路由","node_type":"if-else","desc":"根据操作类型分流","connect_to":["中心思想分析","文章润色"],"branch_condition":"操作类型 == '中心思想分析'"},{"step":"中心思想分析","node_type":"llm","desc":"分析中心思想","prompt_hint":"你是一个专业的文章分析助手。\n任务：分析文章的中心思想、论据结构和主旨。\n输出格式（JSON）：{\"thesis\":\"中心思想\",\"arguments\":[\"论据1\",\"论据2\"]}\n输出示例：\n示例1：{\"thesis\":\"AI重塑教育\",\"arguments\":[\"效率提升30%\",\"覆盖90%知识点\"]}\n示例2：{\"thesis\":\"数字化转型加速\",\"arguments\":[\"云计算普及\",\"远程办公常态化\"]}","connect_to":["结果汇聚"],"branch_condition":null},{"step":"文章润色","node_type":"llm","desc":"润色文章","prompt_hint":"你是一个专业的文字润色编辑。\n任务：对文章进行润色，保留原意提升表达。\n输出格式：直接输出润色后全文\n输出示例：\n示例1原文：技术很好用。示例1润色：该技术凭借出色的易用性赢得了广泛认可。\n示例2原文：天气不好没去玩。示例2润色：由于天气欠佳，我们未能按计划外出。","connect_to":["结果汇聚"],"branch_condition":null},{"step":"结果汇聚","node_type":"variable-aggregator","desc":"聚合两路输出","connect_to":["输出"],"branch_condition":null},{"step":"输出","node_type":"end","desc":"最终输出"}],"output_format":"text","connection_rules":[{"from_step":"输入","to_step":"路由","branch":null},{"from_step":"路由","to_step":"中心思想分析","branch":"true"},{"from_step":"路由","to_step":"文章润色","branch":"false"},{"from_step":"中心思想分析","to_step":"结果汇聚","branch":null},{"from_step":"文章润色","to_step":"结果汇聚","branch":null},{"from_step":"结果汇聚","to_step":"输出","branch":null}]}

示例3（三路链式 if-else）：
===PLAN===
1. 输入：接收用户消息和问题类型（退款/技术/一般）
2. 一级路由：判断是否为退款问题
3. 退款处理：LLM处理退款请求
4. 二级路由：判断是技术问题还是一般问题
5. 技术支持：LLM处理技术问题
6. 一般回复：LLM处理一般咨询
7. 结果汇聚：聚合三路结果
8. 输出：最终输出
===JSON===
{"task_type":"customer_service","input_type":"text_and_choice","steps":[{"step":"输入","node_type":"start","desc":"接收用户消息和问题类型","connect_to":["一级路由"],"branch_condition":null},{"step":"一级路由","node_type":"if-else","desc":"判断是否为退款","connect_to":["退款处理","二级路由"],"branch_condition":"问题类型 == '退款'"},{"step":"退款处理","node_type":"llm","desc":"处理退款请求","connect_to":["结果汇聚"],"branch_condition":null,"prompt_hint":"你是一个专业的客服退款处理助手。\n任务：处理用户退款请求，确认金额和到账时间。\n输出格式：退款方案：[摘要]\n退款金额：[金额]\n预计到账：[时间]\n示例1：退款方案：全额退款 退款金额：¥299 预计到账：3-5个工作日\n示例2：退款方案：部分退款 退款金额：¥100 预计到账：1-3个工作日"},{"step":"二级路由","node_type":"if-else","desc":"判断技术/一般","connect_to":["技术支持","一般回复"],"branch_condition":"问题类型 == '技术'"},{"step":"技术支持","node_type":"llm","desc":"处理技术问题","connect_to":["结果汇聚"],"branch_condition":null,"prompt_hint":"你是一个专业的技术支持工程师。\n任务：解答技术问题，给出解决步骤。\n输出格式：问题分析：[原因]\n解决步骤：1.[步骤1] 2.[步骤2]\n示例1：问题分析：网络超时 解决步骤：1.检查连接 2.重置DNS\n示例2：问题分析：应用闪退 解决步骤：1.清缓存 2.更新版本"},{"step":"一般回复","node_type":"llm","desc":"处理一般咨询","connect_to":["结果汇聚"],"branch_condition":null,"prompt_hint":"你是一个友好的客服助手。\n任务：回复一般咨询，礼貌热情。\n输出格式：直接回复文本\n示例1：您好！营业时间为周一至周五9:00-18:00。\n示例2：感谢关注！可在官网查看最新活动详情。"},{"step":"结果汇聚","node_type":"variable-aggregator","desc":"聚合三路输出","connect_to":["输出"],"branch_condition":null},{"step":"输出","node_type":"end","desc":"最终输出"}],"output_format":"text","connection_rules":[{"from_step":"输入","to_step":"一级路由","branch":null},{"from_step":"一级路由","to_step":"退款处理","branch":"true"},{"from_step":"一级路由","to_step":"二级路由","branch":"false"},{"from_step":"二级路由","to_step":"技术支持","branch":"true"},{"from_step":"二级路由","to_step":"一般回复","branch":"false"},{"from_step":"退款处理","to_step":"结果汇聚","branch":null},{"from_step":"技术支持","to_step":"结果汇聚","branch":null},{"from_step":"一般回复","to_step":"结果汇聚","branch":null},{"from_step":"结果汇聚","to_step":"输出","branch":null}]}"""


def run_llm1(user_query: str) -> tuple[str, dict]:
    """LLM1: intent + planning → (plan_text, intent_dict)."""
    user_prompt = f"当前阶段：\n\n上一版计划：\n\n上一版意图 JSON：\n\n用户最新输入：\n{user_query}"
    print("  [LLM1] Calling...")
    raw = ""
    for llm1_attempt in range(3):
        raw = call_llm(LLM1_SYSTEM, user_prompt, max_tokens=4096, temperature=0.7)
        raw = clean_llm_output(raw)

        result = _parse_llm1_output(raw)
        if result:
            plan, intent = result
            print(f"  [LLM1] OK: task_type={intent.get('task_type','?')}, "
                  f"steps={len(intent.get('steps',[]))}")
            return plan, intent
        print(f"  [LLM1] Parse failed, retrying... ({llm1_attempt + 1}/3)")

    raise ValueError(f"LLM1 failed after 3 attempts\nRaw (first 800):\n{raw[:800]}")


def _parse_llm1_output(raw: str):
    """Try to parse LLM1 output. Returns (plan, intent) or None."""
    plan_match = re.search(r"===PLAN===\s*\n(.*?)\n\s*===JSON===", raw, re.DOTALL)
    json_match = re.search(r"===JSON===\s*\n?(.*)", raw, re.DOTALL)

    if not plan_match:
        plan_match = re.search(r"(?:===PLAN===|计划[：:])\s*\n(.*?)\n\s*(?:===JSON===|意图)", raw, re.DOTALL)
    if not json_match:
        json_match = re.search(r"(?:===JSON===|意图.*?JSON[：:])\s*\n?(.*)", raw, re.DOTALL)
    if not json_match:
        json_match = re.search(r"(\{[^{}]*\"task_type\".*\})", raw, re.DOTALL)

    if plan_match and json_match:
        plan = plan_match.group(1).strip()
        json_str = json_match.group(1).strip()
    elif json_match:
        json_str = json_match.group(1).strip()
        idx = raw.find(json_str[:30])
        plan = raw[:idx].strip() if idx > 0 else ""
    else:
        brace_depth, json_start, json_end = 0, -1, -1
        for i, ch in enumerate(raw):
            if ch == "{":
                if brace_depth == 0: json_start = i
                brace_depth += 1
            elif ch == "}":
                brace_depth -= 1
                if brace_depth == 0 and json_start >= 0: json_end = i
        if json_start >= 0 and json_end > json_start:
            json_str = raw[json_start:json_end + 1].strip()
            plan = raw[:json_start].strip()
        else:
            return None

    json_str = re.sub(r"^```(?:json)?\s*\n?", "", json_str)
    json_str = re.sub(r"\n?```\s*$", "", json_str)
    try:
        intent = json.loads(json_str)
    except json.JSONDecodeError:
        json_str = re.sub(r",\s*([}\]])", r"\1", json_str).replace("'", '"')
        try:
            intent = json.loads(json_str)
        except json.JSONDecodeError:
            return None

    if "task_type" not in intent and "steps" not in intent:
        return None
    return plan, intent


# ═══════════════════════════════════════════════════════════════════════════
# Deep Validation  (equivalent to "Code: 深度校验1/2/3")
# ═══════════════════════════════════════════════════════════════════════════
ALLOWED_TYPES = {
    "start", "end", "llm", "http-request", "template-transform",
    "code", "if-else", "assigner", "variable-aggregator",
}
REQUIRED_FIELDS = {
    "start": [], "end": [], "llm": [],  # llm: prompt_hint or prompt_template accepted
    "http-request": ["desc"], "template-transform": ["desc"],
    "code": ["desc"], "if-else": ["condition"],
    "assigner": ["variables"], "variable-aggregator": [],
}
RESERVED_ASSIGNER_NAMES = {
    "mode", "conversation", "conversation.mode", "sys", "system",
    "session", "memory", "state",
}


def deep_validate_nodes_edges(corrected_json: str) -> tuple[bool, str, str]:
    """Replicate the full 'Code: 深度校验' logic.
    Returns (valid, error_msg, node_edges_json).
    """
    try:
        data = extract_json_from_text(corrected_json)
    except Exception as e:
        return False, f"JSON解析失败: {e}", ""

    if not isinstance(data, dict):
        return False, f"JSON顶层不是对象: {type(data).__name__}", ""

    # Normalize keys: handle "node"/"edge" variants
    if "nodes" not in data and "node" in data:
        data["nodes"] = data.pop("node")
    if "edges" not in data and "edge" in data:
        data["edges"] = data.pop("edge")

    if "nodes" not in data or "edges" not in data:
        keys = list(data.keys())
        return False, f"JSON缺少 nodes/edges 键 (有: {keys})", ""

    errors = []
    node_ids = set()
    seen_ids = set()

    for node in data.get("nodes", []):
        nid = node.get("id", "")
        ntype = node.get("type", "")
        if nid in seen_ids:
            errors.append(f"重复节点ID: '{nid}'")
        seen_ids.add(nid)
        node_ids.add(nid)
        if ntype not in ALLOWED_TYPES:
            errors.append(f"未知节点类型: '{ntype}' (节点: '{nid}')")
        # Required fields
        for field in REQUIRED_FIELDS.get(ntype, []):
            if not node.get(field):
                errors.append(f"节点 '{nid}'({ntype}) 缺少必填字段: {field}")
        # Variable ref checks
        for fld in ("prompt_hint", "desc", "condition", "template"):
            val = node.get(fld, "")
            if isinstance(val, str):
                for ref in re.findall(r"\{\{#([^#]+)#\}\}", val):
                    if len(ref.split(".")) < 2:
                        errors.append(f"节点 '{nid}' 变量引用格式错误: {{{{#{ref}#}}}}")
        # LLM validation: accept prompt_hint or prompt_template
        if ntype == "llm":
            pt = node.get("prompt_template")
            hint = node.get("prompt_hint", "")
            if not hint and not pt:
                errors.append(f"llm 节点 '{nid}' 缺少 prompt_hint 或 prompt_template")
            # Only validate prompt_template format if it exists and is a list
            if pt and isinstance(pt, list):
                if len(pt) < 2:
                    errors.append(f"llm 节点 '{nid}' prompt_template 应至少含 system+user")
                else:
                    if pt[0].get("role") != "system":
                        errors.append(f"llm 节点 '{nid}' 第一条消息必须是 system")
                    if pt[1].get("role") != "user":
                        errors.append(f"llm 节点 '{nid}' 第二条消息必须是 user")
                for msg in pt:
                    if isinstance(msg, dict):
                        for var in re.findall(r"\{\{(.*?)\}\}", msg.get("text", "")):
                            if "#" not in var.strip():
                                errors.append(
                                    f"llm 节点 '{nid}' 非法变量引用: {{{{ {var} }}}}")

    # Edge checks
    for i, edge in enumerate(data.get("edges", [])):
        src, tgt = edge.get("source", ""), edge.get("target", "")
        if src and src not in node_ids:
            errors.append(f"边[{i}] 引用了不存在的源节点: '{src}'")
        if tgt and tgt not in node_ids:
            errors.append(f"边[{i}] 引用了不存在的目标节点: '{tgt}'")

    # If-else branch edge checks
    if_else_ids = [n.get("id") for n in data.get("nodes", []) if n.get("type") == "if-else"]
    for nid in if_else_ids:
        outgoing = [e for e in data.get("edges", []) if e.get("source") == nid]
        if not outgoing:
            errors.append(f"if-else 节点 '{nid}' 缺少分支边")
            continue
        branches = [str(e.get("branch", "")).strip() for e in outgoing]
        if any(b not in ("true", "false") for b in branches):
            errors.append(f"if-else 节点 '{nid}' 分支边必须包含 branch=true/false")
            continue
        if "true" not in branches or "false" not in branches:
            errors.append(f"if-else 节点 '{nid}' 缺少 true/false 分支边")

    # Reachability
    nodes_map = {n.get("id"): n.get("type") for n in data.get("nodes", [])}
    if nodes_map:
        start_ids = [nid for nid, nt in nodes_map.items() if nt == "start"]
        if start_ids:
            adj = {nid: set() for nid in nodes_map}
            for edge in data.get("edges", []):
                s, t = edge.get("source", ""), edge.get("target", "")
                if s in adj: adj[s].add(t)
            visited = set()
            queue = deque(start_ids)
            while queue:
                curr = queue.popleft()
                if curr in visited: continue
                visited.add(curr)
                for nxt in adj.get(curr, set()):
                    if nxt not in visited: queue.append(nxt)
            unreachable = set(nodes_map.keys()) - visited
            if unreachable:
                errors.append(f"不可达节点: {', '.join(unreachable)}")

    # Semantic checks
    edges = data.get("edges", [])
    incoming = defaultdict(list)
    for edge in edges:
        incoming[str(edge.get("target", ""))].append(str(edge.get("source", "")))
    for node in data.get("nodes", []):
        nid, ntype = str(node.get("id", "")), str(node.get("type", ""))
        if ntype == "assigner":
            upstream_types = {
                str(data.get("nodes", [{}])[0].get("type", ""))
                if nodes_map.get(src) == "start" else ""
                for src in incoming.get(nid, [])
            }
            if "start" in {nodes_map.get(s, "") for s in incoming.get(nid, [])}:
                errors.append(f"assigner 节点 '{nid}' 直接承接 start，属于无效中转")
        if ntype == "if-else":
            cond = str(node.get("condition", ""))
            if any(t in cond.lower() for t in ["conversation.", "#conversation", "$input.variables", "#sys."]):
                errors.append(f"if-else 节点 '{nid}' condition 含非法会话/系统变量")

    if errors:
        return False, "; ".join(errors), ""
    return True, "", json.dumps(data, ensure_ascii=False)


# ═══════════════════════════════════════════════════════════════════════════
# LLM2: Node Planning  (equivalent to "LLM2: 节点规划" + retries)
# ═══════════════════════════════════════════════════════════════════════════
LLM2_BASE_SYSTEM = r"""你是一个 Dify workflow DSL 的节点规划器。根据意图 JSON，输出完整的 nodes / edges JSON。

可用节点类型仅限：
- start: 入口节点
- end: 终止节点
- llm: 大语言模型调用，必须提供 prompt_hint，格式为"基于 {{#上游节点.变量名#}} 完成具体任务描述"。
- http-request: HTTP 请求，必须提供 desc
- template-transform: Jinja2 模板渲染，必须提供 desc
- code: Python/JS 代码执行，必须提供 desc
- if-else: 条件分支，必须提供 condition 和 variable_selector
- if-else 多路分支链式规则：当分支数 >= 3 时，必须使用多个 if-else 节点链式串联，每个 if-else 的 true 走一个分支，false 连接下一个 if-else。
- variable-aggregator: 聚合多分支输出，variables 列表里的 variable 字段名必须统一（例如都叫 output）
- assigner: 仅在确实需要写入中间变量时才可使用

这是 workflow 产物，不是 chatflow。必须遵守：
-所有变量引用必须使用 {{#节点ID.变量名#}} 格式
- 所有用户输入都要直接定义在 start.variables
- 如果需求里有"模式/类型/操作选择"，直接把它作为 start 变量，例如 task_type
- 不要为了搬运 start 输入而新增 assigner
- 不要输出 conversation_variables、answer 节点、memory 更新逻辑
- 不要依赖 conversation.*、sys.*、env.*、#conversation.xxx# 这类变量
- if-else 只能判断 start 变量或上游 llm/code/http/template-transform 的结果
- if-else.condition 对于用户分支场景，应写成"期望匹配的字面值"

====== if-else 边格式铁律 ======
每一条从 if-else 节点出发的边，必须包含 "branch": "true" 或 "branch": "false" 字段。
不允许 branch 为 null、缺失或任何其他值。

====== 核心修正规则 ======
- ID 来源锁定：主业务节点的 id 应尽量使用 intent_json 中对应步骤的 "step" 字段值。
- 可添加 variable-aggregator 节点用于汇聚多路分支。
- 数据流转铁律：if-else 节点仅做逻辑判断，没有 output 变量。LLM 节点禁止在 prompt_hint 中引用 if-else 节点。
  分支数据源：必须回溯引用 start 节点变量或上游处理节点输出。
- 严格格式：输出一个完整的 JSON 对象，不要 Markdown 代码围栏，不要解释。

====== 严禁事项 ======
- 严禁使用 assigner 搬运 start 变量
- 严禁在 workflow 模式下使用 conversation.*、sys.* 等
- 严禁分支后让 end 节点直接引用不同分支输出，必须通过 variable-aggregator 合并
- 严禁 if-else 出边缺少 branch 字段
- 严禁在 if-else 的条件中使用非字面值表达式

====== prompt_hint 质量铁律（极其重要）======
每个 LLM 节点的 prompt_hint 必须是一段完整、详细的工作提示词。严禁只写一句话概括。

必须包含以下部分（用换行分隔）：
1. 角色设定：开头明确专业角色（如"你是一个专业的情报分析助手"）
2. 任务描述：详细说明要完成的具体任务，包括分析维度、处理步骤
3. 输出格式：用 JSON 或结构化文本明确指定输出的格式和字段
4. 输出示例：提供 2-3 个符合格式的输出样例
5. 数据引用：用 {{#节点ID.变量名#}} 引用上游数据

好的示例（情报提取节点）：
"你是一个专业的情报分析助手。\n\n任务：从给定内容中提取关键情报。\n\n提取维度：\n1. 人物：涉及的主要人物及角色\n2. 事件：核心事件描述\n3. 时间：事件发生时间\n4. 地点：事件发生地点\n\n输出格式（JSON）：\n{\"person\":\"人物\",\"event\":\"事件\",\"time\":\"时间\",\"location\":\"地点\"}\n\n输出示例：\n示例1：{\"person\":\"张三，CEO\",\"event\":\"出席技术峰会\",\"time\":\"2024年3月\",\"location\":\"北京\"}\n示例2：{\"person\":\"李四，教授\",\"event\":\"发表研究成果\",\"time\":\"2024年6月\",\"location\":\"上海\"}\n\n请从以下内容提取情报：\n{{#内容抓取.body#}}"

坏的示例（严禁）：
"从内容中提取情报"
"分析文本并输出结果"

示例 1：线性链
{"nodes":[{"id":"网页输入","type":"start","variables":[{"name":"url","label":"链接","type":"string"}]},{"id":"内容抓取","type":"http-request","desc":"获取网页内容"},{"id":"情报提取","type":"llm","desc":"提取情报","prompt_hint":"你是一个专业的情报分析助手。\n\n任务：从给定网页内容中提取关键情报信息。\n\n提取维度：\n1. 人物：涉及的主要人物及其角色\n2. 事件：核心事件描述\n3. 时间：事件发生的时间\n4. 地点：事件发生的地点\n\n输出格式（JSON）：\n{\"person\":\"人物\",\"event\":\"事件\",\"time\":\"时间\",\"location\":\"地点\"}\n\n输出示例：\n示例1：{\"person\":\"张三，科技公司CEO\",\"event\":\"出席年度技术峰会\",\"time\":\"2024年3月15日\",\"location\":\"北京国家会议中心\"}\n示例2：{\"person\":\"李四，大学教授\",\"event\":\"发表人工智能研究成果\",\"time\":\"2024年6月\",\"location\":\"上海\"}\n\n请从以下内容中提取情报：\n{{#内容抓取.body#}}"},{"id":"结果输出","type":"end","outputs":[{"variable":"result","value_selector":["情报提取","text"]}]}],"edges":[{"source":"网页输入","target":"内容抓取"},{"source":"内容抓取","target":"情报提取"},{"source":"情报提取","target":"结果输出"}]}

示例 2：分支+聚合
{"nodes":[{"id":"开始","type":"start","variables":[{"name":"article_text","label":"文章内容","type":"string"},{"name":"task_type","label":"操作类型","type":"choice","options":["生成摘要","关键点提取"]}]},{"id":"路由","type":"if-else","desc":"判断操作类型","variable_selector":["开始","task_type"],"condition":"生成摘要"},{"id":"摘要生成","type":"llm","desc":"生成摘要","prompt_hint":"你是一个专业的内容摘要助手。\n\n任务：为给定文章生成简洁、准确的摘要。\n\n要求：\n1. 摘要不超过200字\n2. 保留文章的核心观点和关键信息\n3. 语言简洁流畅\n\n输出格式：直接输出摘要文本\n\n输出示例：\n示例1：本文讨论了人工智能在医疗领域的应用前景。作者指出AI技术在疾病诊断、药物研发和患者管理方面展现出巨大潜力，但也面临数据隐私和伦理挑战。\n示例2：报告分析了2024年全球能源转型趋势。主要发现包括可再生能源投资增长35%、电动汽车市场份额翻倍，以及碳捕获技术取得重大突破。\n\n请为以下文章生成摘要：\n{{#开始.article_text#}}"},{"id":"关键点提取","type":"llm","desc":"提取关键点","prompt_hint":"你是一个专业的文本分析助手。\n\n任务：从给定文章中提取关键要点。\n\n要求：\n1. 提取3-7个关键点\n2. 每个关键点用一句话概括\n3. 按重要性排序\n\n输出格式（JSON数组）：\n[\"关键点1\",\"关键点2\",\"关键点3\"]\n\n输出示例：\n示例1：[\"人工智能在医疗影像诊断中准确率超过95%\",\"深度学习模型可提前预测患者病情变化\",\"数据隐私是AI医疗应用的主要挑战\"]\n示例2：[\"2024年可再生能源投资增长35%\",\"电动汽车全球市场份额首次突破20%\",\"碳捕获技术成本降低40%\"]\n\n请从以下文章中提取关键点：\n{{#开始.article_text#}}"},{"id":"结果汇聚","type":"variable-aggregator","variables":[{"variable":"output","value_selector":["摘要生成","text"]},{"variable":"output","value_selector":["关键点提取","text"]}]},{"id":"结束","type":"end","outputs":[{"variable":"final_result","value_selector":["结果汇聚","output"]}]}],"edges":[{"source":"开始","target":"路由"},{"source":"路由","target":"摘要生成","branch":"true"},{"source":"路由","target":"关键点提取","branch":"false"},{"source":"摘要生成","target":"结果汇聚"},{"source":"关键点提取","target":"结果汇聚"},{"source":"结果汇聚","target":"结束"}]}

示例 3（三路链式 if-else — 客服分流）：
{"nodes":[{"id":"输入","type":"start","variables":[{"name":"user_msg","label":"用户消息","type":"string"},{"name":"issue_type","label":"问题类型","type":"choice","options":["退款","技术","一般"]}]},{"id":"一级路由","type":"if-else","desc":"判断是否为退款","variable_selector":["输入","issue_type"],"condition":"退款"},{"id":"退款处理","type":"llm","desc":"处理退款","prompt_hint":"你是一个专业的客服退款处理助手。\n\n任务：根据用户的退款请求，生成退款处理方案。\n\n处理步骤：\n1. 确认退款原因和订单信息\n2. 核对退款金额和方式\n3. 生成退款确认回复\n\n输出格式：\n退款方案：[方案摘要]\n退款金额：[金额]\n预计到账：[时间]\n\n输出示例：\n示例1：退款方案：商品质量问题全额退款\n退款金额：¥299.00\n预计到账：3-5个工作日\n示例2：退款方案：七天无理由退货\n退款金额：¥158.00\n预计到账：1-3个工作日\n\n请处理以下退款请求：\n{{#输入.user_msg#}}"},{"id":"二级路由","type":"if-else","desc":"判断技术/一般","variable_selector":["输入","issue_type"],"condition":"技术"},{"id":"技术支持","type":"llm","desc":"技术支持","prompt_hint":"你是一个专业的技术支持工程师。\n\n任务：解答用户的技术问题。\n\n要求：\n1. 分析问题原因\n2. 给出具体解决步骤\n3. 提供预防建议\n\n输出格式：\n问题分析：[原因]\n解决步骤：\n1. [步骤1]\n2. [步骤2]\n预防建议：[建议]\n\n输出示例：\n示例1：问题分析：网络连接超时\n解决步骤：\n1. 检查网络连接状态\n2. 重置DNS缓存\n预防建议：定期更新网卡驱动\n示例2：问题分析：应用程序闪退\n解决步骤：\n1. 清除应用缓存数据\n2. 更新到最新版本\n预防建议：保持足够的存储空间\n\n请解答以下技术问题：\n{{#输入.user_msg#}}"},{"id":"一般回复","type":"llm","desc":"一般回复","prompt_hint":"你是一个友好的客服助手。\n\n任务：回复用户的一般咨询问题。\n\n要求：\n1. 礼貌热情\n2. 回答准确\n3. 如需转接请说明\n\n输出格式：直接回复文本\n\n输出示例：\n示例1：您好！我们的营业时间是周一至周五 9:00-18:00。如有其他问题，欢迎随时咨询。\n示例2：感谢您的关注！您可以在官网或APP上查看最新活动详情。如有疑问，可拨打客服热线400-000-0000。\n\n请回复以下咨询：\n{{#输入.user_msg#}}"},{"id":"结果汇聚","type":"variable-aggregator","variables":[{"variable":"output","value_selector":["退款处理","text"]},{"variable":"output","value_selector":["技术支持","text"]},{"variable":"output","value_selector":["一般回复","text"]}]},{"id":"结束","type":"end","outputs":[{"variable":"result","value_selector":["结果汇聚","output"]}]}],"edges":[{"source":"输入","target":"一级路由"},{"source":"一级路由","target":"退款处理","branch":"true"},{"source":"一级路由","target":"二级路由","branch":"false"},{"source":"二级路由","target":"技术支持","branch":"true"},{"source":"二级路由","target":"一般回复","branch":"false"},{"source":"退款处理","target":"结果汇聚"},{"source":"技术支持","target":"结果汇聚"},{"source":"一般回复","target":"结果汇聚"},{"source":"结果汇聚","target":"结束"}]}

示例 4（四分支链式 if-else — 文章处理四合一）：
{"nodes":[{"id":"输入","type":"start","variables":[{"name":"article","label":"文章","type":"string"},{"name":"op","label":"操作","type":"choice","options":["分析中心思想","润色","扩写","翻译"]}]},{"id":"一级路由","type":"if-else","desc":"分析中心思想?","variable_selector":["输入","op"],"condition":"分析中心思想"},{"id":"分析中心思想","type":"llm","desc":"分析中心思想","prompt_hint":"你是一个专业的文章分析助手。\n\n任务：分析文章的中心思想、论据结构和主旨。\n\n分析维度：\n1. 中心思想：用一句话概括文章核心论点\n2. 论据结构：列出主要论据及其逻辑关系\n3. 写作手法：分析作者使用的修辞和论证方法\n\n输出格式（JSON）：\n{\"thesis\":\"中心思想\",\"arguments\":[\"论据1\",\"论据2\"],\"rhetoric\":\"写作手法\"}\n\n输出示例：\n示例1：{\"thesis\":\"人工智能将重塑教育模式\",\"arguments\":[\"AI个性化学习提高效率30%\",\"智能评测系统覆盖90%知识点\"],\"rhetoric\":\"对比论证+数据支撑\"}\n示例2：{\"thesis\":\"乡村振兴需要数字化赋能\",\"arguments\":[\"电商助农增收显著\",\"智慧农业降低成本\"],\"rhetoric\":\"案例分析+政策解读\"}\n\n请分析以下文章：\n{{#输入.article#}}"},{"id":"二级路由","type":"if-else","desc":"润色?","variable_selector":["输入","op"],"condition":"润色"},{"id":"润色","type":"llm","desc":"润色文章","prompt_hint":"你是一个专业的文字润色编辑。\n\n任务：对文章进行润色，保留原意的同时提升表达质量。\n\n润色维度：\n1. 用词精准度：替换模糊或重复用词\n2. 句式流畅度：优化长句，增强节奏感\n3. 逻辑连贯性：增加过渡词，改善段落衔接\n\n输出格式：直接输出润色后的全文\n\n输出示例：\n示例1原文：这个技术很好用，很多人都喜欢。\n示例1润色：该技术凭借出色的易用性，赢得了广大用户的青睐。\n示例2原文：因为天气不好所以我们没去玩。\n示例2润色：由于天气条件欠佳，我们未能按计划外出活动。\n\n请润色以下文章：\n{{#输入.article#}}"},{"id":"三级路由","type":"if-else","desc":"扩写?","variable_selector":["输入","op"],"condition":"扩写"},{"id":"扩写","type":"llm","desc":"扩写文章","prompt_hint":"你是一个专业的内容创作助手。\n\n任务：对文章进行扩写，丰富细节和内容。\n\n扩写维度：\n1. 补充背景信息：增加时代背景、相关数据\n2. 丰富细节描述：添加具体案例、场景描写\n3. 深化观点论述：展开论证，加入多角度分析\n\n输出格式：直接输出扩写后的全文\n\n输出示例：\n示例1原文：AI改变了教育。\n示例1扩写：人工智能技术正在深刻地改变着传统教育模式。从智能题库到个性化学习路径推荐，从自动批改作业到学情分析预警，AI正在各个环节提升教育效率和质量。\n示例2原文：城市绿化很重要。\n示例2扩写：城市绿化不仅是美化市容的手段，更是提升市民生活品质的关键举措。研究表明，城市绿地覆盖率每提高10%，周边居民的幸福指数就提升约15%。\n\n请扩写以下文章：\n{{#输入.article#}}"},{"id":"翻译","type":"llm","desc":"翻译文章","prompt_hint":"你是一个专业的中英文翻译助手。\n\n任务：将中文文章翻译为英文。\n\n翻译要求：\n1. 忠实原文：准确传达原文含义，不遗漏关键信息\n2. 表达自然：使用地道的英语表达，避免中式英语\n3. 风格一致：保持原文的语气和文体风格\n\n输出格式：直接输出英文翻译\n\n输出示例：\n示例1原文：人工智能正在改变我们的生活方式。\n示例1翻译：Artificial intelligence is transforming the way we live.\n示例2原文：这家公司专注于开发智能家居产品。\n示例2翻译：The company specializes in developing smart home products.\n\n请翻译以下文章：\n{{#输入.article#}}"},{"id":"结果汇聚","type":"variable-aggregator","variables":[{"variable":"output","value_selector":["分析中心思想","text"]},{"variable":"output","value_selector":["润色","text"]},{"variable":"output","value_selector":["扩写","text"]},{"variable":"output","value_selector":["翻译","text"]}]},{"id":"结束","type":"end","outputs":[{"variable":"result","value_selector":["结果汇聚","output"]}]}],"edges":[{"source":"输入","target":"一级路由"},{"source":"一级路由","target":"分析中心思想","branch":"true"},{"source":"一级路由","target":"二级路由","branch":"false"},{"source":"二级路由","target":"润色","branch":"true"},{"source":"二级路由","target":"三级路由","branch":"false"},{"source":"三级路由","target":"扩写","branch":"true"},{"source":"三级路由","target":"翻译","branch":"false"},{"source":"分析中心思想","target":"结果汇聚"},{"source":"润色","target":"结果汇聚"},{"source":"扩写","target":"结果汇聚"},{"source":"翻译","target":"结果汇聚"},{"source":"结果汇聚","target":"结束"}]}"""

LLM2_RETRY_PREFIX = r"""【修复铁律 — 必须遵守，违反将导致工作流损坏】
1. 你收到的是一份"已生成但存在少量错误的 JSON"和"校验器报出的具体错误列表"。
2. 你的唯一任务：仅修复错误信息中明确列出的问题，保持其他所有节点、边、字段、提示词、变量名、条件值完全原样。
3. 严禁重新规划工作流，严禁增删节点（除非错误信息要求删除或补全），严禁调换节点顺序，严禁改写未报错的提示词内容。
4. 修复后必须输出完整 nodes / edges JSON，但未提及的部分必须与输入 JSON 完全一致。
5. 如果错误信息指出缺少某个字段，请补全该字段，但不要改动同节点其他已有字段。

---

"""


def run_llm2(intent_json: dict, plan_text: str) -> tuple[list, list]:
    """LLM2: generate nodes+edges. 1 initial + up to 3 retries with deep validation."""
    intent_str = json.dumps(intent_json, ensure_ascii=False, indent=2)
    user_prompt = f"请根据以下意图生成工作流节点和边定义：\n\n{intent_str}"

    last_json_str = ""
    valid_result = None  # store first valid result

    for attempt in range(4):
        if attempt == 0:
            sys_prompt = LLM2_BASE_SYSTEM
            usr_prompt = user_prompt
        else:
            sys_prompt = LLM2_RETRY_PREFIX + LLM2_BASE_SYSTEM
            usr_prompt = (
                "请修正后重新输出完整JSON：\n\n"
                f"下面是上次生成的 JSON：{last_json_str}\n\n"
                f"错误信息：{error_msg}\n\n"
                "请基于上述「上次生成的 JSON」，只修正错误信息中指出的问题，"
                "其他部分一字不改，然后输出完整 JSON。\n\n"
                f"原始意图：{intent_str}"
            )
            print(f"  [LLM2] Retry #{attempt}, fixing: {error_msg[:80]}...")

        raw = call_llm(sys_prompt, usr_prompt, max_tokens=16384,
                       temperature=0.5 if attempt > 0 else 0.7)

        # Deep validation (equivalent to Code: 深度校验)
        valid, error_msg, node_edges_json = deep_validate_nodes_edges(raw)
        if valid and node_edges_json:
            try:
                data = json.loads(node_edges_json)
                if isinstance(data, dict) and "nodes" in data and "edges" in data:
                    valid_result = data
                    print(f"  [LLM2] OK: {len(data['nodes'])} nodes, "
                          f"{len(data['edges'])} edges (attempt {attempt + 1})")
                    break  # stop on first valid result
                else:
                    print(f"  [LLM2] Valid JSON but missing nodes/edges keys")
                    error_msg = "Valid JSON but missing nodes/edges keys"
            except json.JSONDecodeError as e:
                error_msg = f"Valid JSON re-parse failed: {e}"

        print(f"  [LLM2] Validation errors: {error_msg[:100]}...")
        # Store raw for retry context
        try:
            last_json_str = json.dumps(extract_json_from_text(raw), ensure_ascii=False)
        except Exception:
            last_json_str = raw[:2000]

    if valid_result is None:
        raise RuntimeError(f"LLM2 failed after 4 attempts. Last errors: {error_msg}")

    return valid_result["nodes"], valid_result["edges"]


# ═══════════════════════════════════════════════════════════════════════════
# Preprocess + Call Builder  (equivalent to Code: 组装Builder请求 + HTTP: 生成DSL)
# ═══════════════════════════════════════════════════════════════════════════
def preprocess_for_builder(nodes: list, edges: list) -> dict:
    """Replicate 'Code: 组装Builder请求' from v8 workflow."""
    start_node = next((n for n in nodes if n.get("type") == "start"), None)
    for node in nodes:
        if node.get("type") == "http-request" and not node.get("url"):
            if start_node and start_node.get("variables"):
                vn = start_node["variables"][0].get("name", "input")
                node["url"] = "{{#" + start_node["id"] + "." + vn + "#}}"
            else:
                node["url"] = "{{#start.input#}}"
    for node in nodes:
        if node.get("type") == "llm":
            if not node.get("prompt_template"):
                hint = node.get("prompt_hint", "") or "处理输入"
                desc = node.get("desc", "智能处理")
                node["prompt_template"] = [
                    {"role": "system", "text": f"你是一个专业的{desc}助手。请严格按照要求完成任务，按照指定格式输出。"},
                    {"role": "user", "text": hint},
                ]
            node.pop("prompt_hint", None)
    for node in nodes:
        if node.get("type") == "variable-aggregator":
            for idx, var in enumerate(node.get("variables", [])):
                if not var.get("name"):
                    var["name"] = f"result_{idx + 1}"
    for node in nodes:
        if node.get("type") == "end":
            if not node.get("outputs"):
                preds = [e.get("source") for e in edges if e.get("target") == node["id"]]
                up = preds[-1] if preds else "llm"
                node["outputs"] = [{"variable": "output", "value_selector": [up, "text"]}]
            else:
                for out in node["outputs"]:
                    if not out.get("value_selector"):
                        preds = [e.get("source") for e in edges if e.get("target") == node["id"]]
                        up = preds[-1] if preds else "llm"
                        out["value_selector"] = [up, "text"]
                    if not out.get("variable"):
                        out["variable"] = "output"
    return {"nodes": nodes, "edges": edges, "app_name": "Generated Workflow", "mode": "workflow"}


def _dict_to_node_def(d: dict) -> NodeDef:
    """Convert a plain dict to a NodeDef Pydantic model."""
    kwargs = {"id": d["id"], "type": d["type"]}
    for key in ("desc", "prompt_hint", "condition", "source_output",
                "write_mode", "output_type"):
        if key in d:
            kwargs[key] = d[key]
    if "url" in d:
        kwargs["desc"] = d.get("desc", "")
    if "variables" in d:
        vs = []
        for v in d["variables"]:
            if isinstance(v, dict):
                vs.append(NodeVariable(**{k: v[k] for k in v if k in
                    ("name", "label", "type", "options", "value_selector", "variable", "value")}))
            else:
                vs.append(v)
        kwargs["variables"] = vs
    if "prompt_template" in d:
        kwargs["prompt_template"] = d["prompt_template"]
    if "variable_selector" in d:
        kwargs["variable_selector"] = d["variable_selector"]
    if "outputs" in d:
        kwargs["outputs"] = d["outputs"]
    if "url" in d:
        kwargs["url"] = d["url"]
    return NodeDef(**kwargs)


def build_dsl_direct(nodes_list: list, edges_list: list,
                     app_name: str = "Generated Workflow",
                     mode: str = "workflow") -> tuple[str, str]:
    """Build DSL via direct Python import. Returns (dsl_yaml, error_msg)."""
    try:
        nodes = [_dict_to_node_def(n) for n in nodes_list]
        edges = [EdgeDef(source=e["source"], target=e["target"],
                         branch=e.get("branch", "")) for e in edges_list]
    except Exception as ex:
        return "", f"Model conversion error: {ex}"
    # Validate using dict format (validate_llm2_output expects dicts)
    validation = validate_llm2_output({
        "nodes": [n.model_dump() for n in nodes],
        "edges": [e.model_dump() for e in edges],
    })
    if validation:
        return "", "; ".join(validation)
    try:
        dsl = _build_dsl(nodes=nodes, edges=edges, app_name=app_name, mode=mode)
        return dsl, ""
    except Exception as ex:
        return "", f"Build error: {ex}"


# ═══════════════════════════════════════════════════════════════════════════
# Interactive Pipeline Functions
# ═══════════════════════════════════════════════════════════════════════════
def run_llm1_plan(query: str) -> tuple[str, dict]:
    """Run LLM1 for a new query. Returns (plan_text, intent_json)."""
    return run_llm1(query)


def run_llm1_modify(plan_text: str, intent_json: dict, feedback: str) -> tuple[str, dict]:
    """Re-run LLM1 with previous plan + user modification feedback."""
    user_prompt = (
        f"当前阶段：修改规划\n\n"
        f"上一版计划：\n{plan_text}\n\n"
        f"上一版意图 JSON：\n{json.dumps(intent_json, ensure_ascii=False)}\n\n"
        f"用户最新输入：\n{feedback}"
    )
    raw = ""
    for attempt in range(3):
        raw = call_llm(LLM1_SYSTEM, user_prompt, max_tokens=4096, temperature=0.7)
        raw = clean_llm_output(raw)
        result = _parse_llm1_output(raw)
        if result:
            plan, intent = result
            print(f"  [LLM1 Modify] OK (attempt {attempt + 1})")
            return plan, intent
        print(f"  [LLM1 Modify] Parse failed, retrying... ({attempt + 1}/3)")
    raise ValueError(f"LLM1 modify failed after 3 attempts\nRaw: {raw[:800]}")


def run_llm2_from_intent(intent_json: dict) -> tuple[list, list]:
    """Run LLM2 from confirmed intent JSON. Returns (nodes, edges)."""
    return run_llm2(intent_json, "")


def check_http_nodes(nodes: list) -> list[dict]:
    """Return HTTP nodes that need user-provided URLs."""
    return [n for n in nodes
            if n.get("type") == "http-request" and not n.get("url")]


def fill_http_urls(nodes: list, url_map: dict[str, str]) -> None:
    """Fill user-provided URLs into HTTP nodes. url_map: {node_id: url_string}."""
    for node in nodes:
        if node.get("type") == "http-request" and node.get("id") in url_map:
            node["url"] = url_map[node["id"]]


def run_full_build(nodes: list, edges: list) -> tuple[str, str]:
    """Preprocess + build DSL + validate + LLM3/LLM4 fix if needed.
    Returns (dsl_yaml, error_msg)."""
    preprocess_for_builder(nodes, edges)
    dsl_text, builder_error = build_dsl_direct(nodes, edges)
    if builder_error:
        return "", builder_error

    valid, error_msg = validate_dsl_full(dsl_text)
    if valid:
        return dsl_text, ""

    # LLM3 fix
    try:
        raw = call_llm(LLM3_SYSTEM,
            "请直接输出修复后的完整 YAML。\n\n"
            f"校验错误：\n{error_msg}\n\n"
            f"待修复 DSL：\n{dsl_text}",
            max_tokens=4096, temperature=0.3)
        fixed_dsl = _clean_yaml_output(raw)
    except Exception:
        return dsl_text, f"DSL validation errors: {error_msg}"

    valid, error_msg2 = validate_dsl_full(fixed_dsl)
    if valid:
        return fixed_dsl, ""

    # LLM4 fix
    try:
        raw = call_llm(LLM4_SYSTEM,
            "请直接输出修复后的完整 YAML。\n\n"
            f"仍存在的错误：\n{error_msg2}\n\n"
            f"DSL：\n{fixed_dsl}",
            max_tokens=4096, temperature=0.2)
        fixed_dsl2 = _clean_yaml_output(raw)
    except Exception:
        return fixed_dsl, f"DSL errors after LLM3 fix: {error_msg2}"

    valid, _ = validate_dsl_full(fixed_dsl2)
    if valid:
        return fixed_dsl2, ""
    return fixed_dsl2, f"DSL errors after LLM3+LLM4: {error_msg2}"


# ═══════════════════════════════════════════════════════════════════════════
# DSL Validation  (equivalent to Code: 校验最终DSL)
# ═══════════════════════════════════════════════════════════════════════════
def validate_dsl_full(dsl_text: str) -> tuple[bool, str]:
    """Full DSL structural validation matching v8 'Code: 校验最终DSL'."""
    text = (dsl_text or "").strip()
    if not text:
        return False, "DSL 为空"

    errors = []
    app_mode = "workflow"

    # Global checks
    if "```" in text:
        errors.append("DSL 不应包含代码围栏")
    if "\t" in text:
        errors.append("DSL 不应包含 TAB 缩进")
    if re.search(r"<think\s*/?>", text):
        errors.append("DSL 不应包含思考标签")

    for marker in ["version:", "kind: app", "app:", "workflow:", "graph:", "nodes:", "edges:"]:
        if marker not in text:
            errors.append(f"缺少顶层字段: {marker}")

    # Parse mode
    app_section = re.search(r"app:\n(.*?)\ndependencies:", text, flags=re.DOTALL)
    if app_section:
        mm = re.search(r"(?m)^  mode:\s*([^\n]+)$", app_section.group(1))
        if mm:
            app_mode = mm.group(1).strip().strip("'\"")

    try:
        parsed = yaml.safe_load(text)
    except yaml.YAMLError as e:
        return False, f"YAML 解析失败: {e}"

    if not isinstance(parsed, dict):
        return False, "Top level must be a mapping"

    graph = parsed.get("workflow", {}).get("graph", {})
    nodes = graph.get("nodes", [])
    edges_list = graph.get("edges", [])

    if not nodes:
        errors.append("没有节点")
        return (len(errors) == 0), "; ".join(errors) if errors else ""

    node_ids = set()
    node_types = {}
    for node in nodes:
        data = node.get("data", {})
        nid = node.get("id", "")
        ntype = data.get("type", "")
        node_ids.add(nid)
        if ntype:
            node_types[nid] = ntype

    # Edge checks
    for edge in edges_list:
        src = edge.get("source", "")
        tgt = edge.get("target", "")
        src_handle = edge.get("sourceHandle", "")
        if src and src not in node_ids:
            errors.append(f"边引用了不存在的源节点: {src}")
        if tgt and tgt not in node_ids:
            errors.append(f"边引用了不存在的目标节点: {tgt}")
        if node_types.get(src) == "if-else" and src_handle not in ("true", "false"):
            errors.append(f"if-else 节点 '{src}' 的边必须使用 true/false sourceHandle")

    # If-else checks
    if_else_ids = {nid for nid, nt in node_types.items() if nt == "if-else"}
    for ie_id in if_else_ids:
        handles = {e.get("sourceHandle") for e in edges_list if e.get("source") == ie_id}
        if "true" not in handles or "false" not in handles:
            errors.append(f"if-else 节点 '{ie_id}' 缺少 true/false 分支连线")

    # Node count checks
    start_count = sum(1 for t in node_types.values() if t == "start")
    end_count = sum(1 for t in node_types.values() if t == "end")
    if start_count != 1:
        errors.append(f"start 节点数量异常: {start_count}")
    if end_count < 1:
        errors.append("缺少 end 节点")

    # Per-node type checks
    for node in nodes:
        data = node.get("data", {})
        nid = node.get("id", "")
        ntype = data.get("type", "")

        if ntype == "llm":
            pt = data.get("prompt_template", [])
            if not pt:
                errors.append(f"llm 节点 '{nid}' 缺少 prompt_template")
            elif isinstance(pt, list) and len(pt) >= 2:
                if pt[0].get("role") != "system":
                    errors.append(f"llm 节点 '{nid}' 第一条消息必须是 system")
                if pt[1].get("role") != "user":
                    errors.append(f"llm 节点 '{nid}' 第二条消息必须是 user")

        if ntype == "end":
            outputs = data.get("outputs", [])
            if not outputs:
                errors.append(f"end 节点 '{nid}' 缺少 outputs")

    if errors:
        return False, "; ".join(errors)
    return True, ""


# ═══════════════════════════════════════════════════════════════════════════
# LLM3: Fix DSL  (equivalent to "LLM3: 修复最终DSL")
# ═══════════════════════════════════════════════════════════════════════════
LLM3_SYSTEM = r"""【修复铁律 — 必须遵守，违反将导致工作流损坏】

1. 你收到的是一份"已生成的 DSL 文件"和"校验器报出的具体错误列表"。
2. 你的唯一任务：仅修复这些错误信息中明确列出的结构问题，不要改动任何未报错的节点、边、字段、提示词、变量名或条件值。
3. 严禁重新规划工作流，严禁增删节点（除非错误要求删除或补全），严禁调换节点顺序，严禁重写或润色提示词内容。
4. 修复后必须输出完整 YAML，但未提及的部分必须与输入 DSL 完全一致。

【输出格式绝对命令】
- 你的输出中唯一允许存在的内容就是一份完整的 .dify.yml 文本。
- 严禁包含任何分析、总结、注解、思考标签。
- 输出不能以 ``` 开头或结尾。

你是 Dify DSL 修复器。

你的任务：
1. 修复 DSL 结构问题，使其成为可导入的 Dify DSL
2. 尽量保留原始工作流意图和节点功能
3. 优先在原 DSL 基础上做最小必要修改
4. 每个 if-else 节点必须包含 variable_selector，cases 中每个 condition 也必须是数组格式
5. LLM 节点的 prompt_template 必须至少包含 system + user 两条消息

【完整性强制要求】
- 必须生成完整 YAML，包含 version、kind、app、workflow、graph、nodes、edges
- 如果无法完成完整输出，也必须输出最简合法骨架（start -> end）

额外修复要求：
- 目标 app.mode: workflow
- 严禁 conversation.*、sys.* 等会话变量
- 不要让 llm/template-transform/end 读取 if-else/assigner 控制节点输出
- end.outputs[].variable 不能为空"""


# ═══════════════════════════════════════════════════════════════════════════
# LLM4: Second DSL Fix  (equivalent to "LLM4: 再次修复最终DSL")
# ═══════════════════════════════════════════════════════════════════════════
LLM4_SYSTEM = r"""【修复铁律 — 必须遵守】
1. 你收到的是一份"第一次修复后的 DSL"和"仍存在的错误列表"。
2. 仅修复错误信息中明确列出的问题，不要改动未报错部分。
3. 严禁重新规划工作流。

你是 Dify DSL 二次修复器。

任务：
- 在第一次修复稿基础上继续修复
- 优先局部修补，不要重新生成
- 确保 if-else 节点的 cases、conditions、variable_selector、true/false 分支边完整
- 严禁 conversation.*/sys.* 会话变量
- llm/template-transform/end 只能引用 start 或数据产出节点
- end.outputs[].variable 必须非空

【完整性强制要求】
- 必须生成完整 YAML
- 不要使用 ``` 代码围栏
- 移除所有非标准字段
- LLM prompt_template 引用变量必须用 {{#节点ID.变量名#}} 格式"""


def _clean_yaml_output(raw: str) -> str:
    raw = re.sub(r"^```(?:ya?ml)?\s*\n?", "", raw)
    raw = re.sub(r"\n?```\s*$", "", raw)
    raw = re.sub(
        r"query_prompt_template:\s*['\"]\{\{#sys\.query#\}\}['\"]",
        "query_prompt_template: ''", raw)
    version_idx = raw.find("version:")
    if version_idx > 0:
        raw = raw[version_idx:]
    return raw.strip()


# ═══════════════════════════════════════════════════════════════════════════
# Full Pipeline
# ═══════════════════════════════════════════════════════════════════════════
def run_pipeline(user_query: str, test_name: str, run_dir: Path) -> dict:
    result = {"name": test_name, "query": user_query, "passed": False, "errors": [],
              "stage": ""}

    # ─── Step 1: LLM1 ───
    result["stage"] = "LLM1"
    try:
        plan_text, intent_json = run_llm1(user_query)
    except Exception as e:
        result["errors"].append(f"LLM1 failed: {e}")
        return result

    result["plan"] = plan_text
    result["intent"] = intent_json
    (run_dir / "01_plan.txt").write_text(plan_text, encoding="utf-8")
    (run_dir / "01_intent.json").write_text(
        json.dumps(intent_json, ensure_ascii=False, indent=2), encoding="utf-8")

    # ─── Step 2: LLM2 ───
    result["stage"] = "LLM2"
    try:
        nodes, edges = run_llm2(intent_json, plan_text)
    except Exception as e:
        result["errors"].append(f"LLM2 failed: {e}")
        return result

    (run_dir / "02_nodes_edges.json").write_text(
        json.dumps({"nodes": nodes, "edges": edges}, ensure_ascii=False, indent=2),
        encoding="utf-8")

    # ─── Step 3: Build DSL (preprocess + build + validate + LLM3/LLM4 fix) ───
    result["stage"] = "Builder"
    dsl_text, builder_error = run_full_build(nodes, edges)
    if builder_error:
        result["errors"].append(f"Build: {builder_error}")
        (run_dir / "03_builder_error.txt").write_text(builder_error, encoding="utf-8")
        return result

    result["dsl"] = dsl_text
    result["passed"] = True
    (run_dir / "03_dsl_raw.dify.yml").write_text(dsl_text, encoding="utf-8")
    (run_dir / "04_dsl_final.dify.yml").write_text(dsl_text, encoding="utf-8")
    print("  [DSL] Generated successfully")
    return result


# ═══════════════════════════════════════════════════════════════════════════
# Public Entry Point
# ═══════════════════════════════════════════════════════════════════════════
def generate_dsl(user_query: str, output_dir=None) -> dict:
    """Generate a Dify DSL workflow from natural language.

    Args:
        user_query: Natural language description of the desired workflow.
        output_dir: Directory to save intermediate and final results.
                    If None, uses /tmp/nlg-dsl-latest.

    Returns:
        dict with keys: passed, dsl, errors, plan, intent, stage
    """
    if output_dir is not None:
        run_dir = Path(output_dir)
    else:
        run_dir = Path("/tmp/nlg-dsl-latest")
    run_dir.mkdir(parents=True, exist_ok=True)

    result = run_pipeline(user_query, "DSL Generation", run_dir)
    return result


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python nlg_to_dsl_test.py \"你的工作流需求描述\"")
        print("       python nlg_to_dsl_test.py \"抓取网页并提取情报\"")
        sys.exit(1)
    query = " ".join(sys.argv[1:])
    print(f"Generating DSL for: {query}\n")
    result = generate_dsl(query)
    if result["passed"]:
        print("\n=== SUCCESS ===")
        if result.get("dsl"):
            dsl = result["dsl"]
            print(dsl[:500] + "..." if len(dsl) > 500 else dsl)
    else:
        print("\n=== FAILED ===")
        for err in result["errors"]:
            print(f"  - {err}")
        sys.exit(1)
