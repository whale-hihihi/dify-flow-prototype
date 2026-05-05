#!/usr/bin/env python3
"""
Web backend for the interactive NLG → DSL generator.

Flow:
  1. User describes workflow in natural language → LLM1 generates plan
  2. User confirms/modifies plan
  3. If HTTP nodes in plan → ask user for URLs first
  4. Run LLM2 → fill URLs → build DSL

Usage:
    python web_app.py
    # then open http://localhost:5000
"""
from __future__ import annotations

import json
import logging
import re
import uuid
from dataclasses import dataclass, field
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
log = logging.getLogger("web_app")

from nlg_to_dsl_test import (
    fill_http_urls,
    run_full_build,
    run_llm1_modify,
    run_llm1_plan,
    run_llm2_from_intent,
)

STATIC_DIR = Path(__file__).parent / "static"

app = FastAPI(title="NLG → DSL Generator")


# ─── Session Management ───────────────────────────────────────────────────
@dataclass
class Session:
    id: str
    state: str = "idle"          # idle | plan_shown | need_urls | complete
    plan_text: str = ""
    intent_json: dict = field(default_factory=dict)
    nodes: list = field(default_factory=list)
    edges: list = field(default_factory=list)
    http_slots: list = field(default_factory=list)  # [{step, desc}, ...] from intent
    url_map: dict = field(default_factory=dict)      # {step_name: url}
    dsl: str = ""


sessions: dict[str, Session] = {}


def get_session(session_id: str | None) -> Session:
    if session_id and session_id in sessions:
        return sessions[session_id]
    sid = uuid.uuid4().hex[:12]
    s = Session(id=sid)
    sessions[sid] = s
    return s


# ─── Request/Response Models ──────────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str = ""
    session_id: str = ""
    action: str = ""  # "confirm" | "modify" | ""


# ─── Chat Handler ─────────────────────────────────────────────────────────
@app.post("/api/chat")
async def chat(req: ChatRequest):
    session = get_session(req.session_id or None)

    # ── State: idle / complete → treat as new request ──
    if session.state in ("idle", "complete"):
        if not req.message.strip():
            return {"reply": "请描述您想要的工作流。", "session_id": session.id,
                    "state": session.state}
        try:
            plan, intent = run_llm1_plan(req.message)
        except Exception as e:
            return {"reply": f"规划失败：{e}", "session_id": session.id, "state": "idle"}

        session.plan_text = plan
        session.intent_json = intent
        session.state = "plan_shown"
        session.dsl = ""
        session.nodes = []
        session.edges = []
        session.http_slots = []
        session.url_map = {}

        reply = _format_plan(plan, intent)
        return {"reply": reply, "session_id": session.id,
                "state": "plan_shown", "options": ["confirm", "modify"]}

    # ── State: plan_shown → confirm or modify ──
    elif session.state == "plan_shown":
        if req.action == "confirm":
            # Check intent for HTTP steps BEFORE running LLM2
            http_slots = _get_http_slots(session.intent_json)
            if http_slots:
                session.http_slots = http_slots
                session.state = "need_urls"
                reply = _format_url_request(http_slots)
                return {"reply": reply, "session_id": session.id,
                        "state": "need_urls", "options": []}

            # No HTTP nodes → build directly
            return _build_dsl(session)

        else:
            # Modify plan
            if not req.message.strip():
                return {"reply": "请描述您想要修改的内容。",
                        "session_id": session.id, "state": "plan_shown",
                        "options": ["confirm", "modify"]}
            try:
                plan, intent = run_llm1_modify(
                    session.plan_text, session.intent_json, req.message)
            except Exception as e:
                return {"reply": f"修改失败：{e}", "session_id": session.id,
                        "state": "plan_shown", "options": ["confirm", "modify"]}

            session.plan_text = plan
            session.intent_json = intent
            reply = _format_plan(plan, intent)
            return {"reply": reply, "session_id": session.id,
                    "state": "plan_shown", "options": ["confirm", "modify"]}

    # ── State: need_urls → user provides URLs, then build ──
    elif session.state == "need_urls":
        url_map = _parse_url_input(req.message, session.http_slots)
        if not url_map:
            return {"reply": "未能解析 URL，请按格式输入，例如：\n网页抓取: https://example.com/api",
                    "session_id": session.id, "state": "need_urls", "options": []}

        session.url_map = url_map
        log.info("URL map from user: %s", url_map)
        return _build_dsl(session)

    return {"reply": "未知状态", "session_id": session.id, "state": session.state}


# ─── Build DSL (shared by confirm and need_urls) ──────────────────────────
def _build_dsl(session: Session) -> dict:
    """Run LLM2 → fill URLs → build DSL. Returns API response dict."""
    try:
        nodes, edges = run_llm2_from_intent(session.intent_json)
    except Exception as e:
        return {"reply": f"节点生成失败：{e}", "session_id": session.id,
                "state": "plan_shown", "options": ["confirm", "modify"]}

    session.nodes = nodes
    session.edges = edges

    # Fill user-provided URLs into HTTP nodes
    if session.url_map:
        _fill_urls_from_intent(nodes, session.url_map)
        log.info("After fill, HTTP node URLs: %s",
                 [(n.get("id"), n.get("url")) for n in nodes
                  if n.get("type") == "http-request"])

    dsl, err = run_full_build(nodes, edges)
    if err:
        return {"reply": f"DSL 生成失败：{err}", "session_id": session.id,
                "state": "plan_shown", "options": ["confirm", "modify"]}

    session.dsl = dsl
    session.state = "complete"
    return {"reply": "DSL 已生成！您可以在右侧面板查看、复制或下载。",
            "dsl": dsl, "session_id": session.id, "state": "complete",
            "options": []}


# ─── DSL Download ─────────────────────────────────────────────────────────
@app.get("/api/dsl/{session_id}")
async def get_dsl(session_id: str):
    session = sessions.get(session_id)
    if not session or not session.dsl:
        return JSONResponse({"error": "No DSL available"}, status_code=404)
    return {"dsl": session.dsl, "filename": "workflow.dify.yml"}


# ─── Frontend ─────────────────────────────────────────────────────────────
@app.get("/", response_class=HTMLResponse)
async def index():
    html_path = STATIC_DIR / "index.html"
    return HTMLResponse(html_path.read_text(encoding="utf-8"))


# ─── Helpers ──────────────────────────────────────────────────────────────
def _get_http_slots(intent: dict) -> list[dict]:
    """Extract HTTP-request steps from intent JSON (before LLM2 runs)."""
    slots = []
    for step in intent.get("steps", []):
        if step.get("node_type") == "http-request":
            step_name = step.get("step", "")
            desc = step.get("desc", step_name)
            slots.append({"step": step_name, "desc": desc})
    return slots


def _fill_urls_from_intent(nodes: list, url_map: dict[str, str]) -> None:
    """Fill URLs into HTTP nodes. url_map keys are intent step names;
    match by node id (which LLM2 derives from step name) or desc substring."""
    for node in nodes:
        if node.get("type") != "http-request":
            continue
        nid = node.get("id", "")
        desc = node.get("desc", "")
        for step_name, url in url_map.items():
            if nid == step_name or step_name in nid or step_name in desc:
                node["url"] = url
                log.info("Filled URL into node '%s': %s", nid, url)
                break


def _format_plan(plan_text: str, intent: dict) -> str:
    steps = intent.get("steps", [])
    lines = ["📋 **工作流规划：**\n"]
    lines.append(plan_text)
    if steps:
        lines.append("\n**节点概览：**")
        for s in steps:
            name = s.get("step", s.get("desc", "?"))
            ntype = s.get("node_type", "?")
            lines.append(f"  - {name} ({ntype})")
    lines.append("\n请选择 **确认** 生成，或 **修改** 调整规划。")
    return "\n".join(lines)


def _format_url_request(http_slots: list[dict]) -> str:
    lines = ["检测到以下 HTTP 请求节点需要提供 URL：\n"]
    for s in http_slots:
        lines.append(f"  - **{s['desc']}**")
    lines.append("\n请按以下格式提供 URL（每行一个）：")
    lines.append("```")
    for s in http_slots:
        lines.append(f"{s['desc']}: https://api.example.com/endpoint")
    lines.append("```")
    return "\n".join(lines)


def _parse_url_input(text: str, http_slots: list[dict]) -> dict[str, str]:
    """Parse user URL input. Returns {step_name: url}."""
    result = {}
    lines = [l.strip() for l in text.strip().split("\n") if l.strip()]

    # Try key:value format
    for line in lines:
        if ":" in line and "://" in line:
            parts = re.split(r":\s*", line, maxsplit=1)
            if len(parts) == 2 and "://" in parts[1]:
                key = parts[0].strip()
                url = parts[1].strip()
                for s in http_slots:
                    if key in s["desc"] or key in s["step"]:
                        result[s["step"]] = url
                        break

    # Fallback: assign URLs in order
    if not result:
        urls = re.findall(r"https?://\S+", text)
        for i, s in enumerate(http_slots):
            if i < len(urls):
                result[s["step"]] = urls[i]

    return result


# ─── Main ─────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    print("Starting NLG → DSL Generator at http://localhost:5000")
    uvicorn.run(app, host="0.0.0.0", port=5000, timeout_keep_alive=300)
