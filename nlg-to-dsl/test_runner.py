#!/usr/bin/env python3
"""
NLG → DSL Test Driver

Runs 15 natural language test cases through the full pipeline
and reports syntax + semantic pass/fail results.

Usage:
    python test_runner.py              # run all 15 tests
    python test_runner.py 5            # run only test #5
    python test_runner.py 1 3 5        # run tests 1, 3, 5
"""
from __future__ import annotations

import sys
import time
from pathlib import Path

import httpx
import yaml

from nlg_to_dsl_test import run_pipeline, MODEL

TEST_RESULTS_DIR = Path.home() / "Desktop" / "test-results"

# ═══════════════════════════════════════════════════════════════════════════
# Test Cases (15 natural language prompts)
# ═══════════════════════════════════════════════════════════════════════════
TEST_CASES = [
    # --- Linear chains ---
    {
        "name": "线性链-情报提取",
        "query": "请为我生成一个抓取网页内容并提取关键情报的工作流",
        "expect_nodes": ["start", "end", "llm"],
        "expect_branches": 0,
    },
    {
        "name": "线性链-翻译器",
        "query": "请为我生成一个将中文文本翻译为英文的工作流",
        "expect_nodes": ["start", "end", "llm"],
        "expect_branches": 0,
    },
    {
        "name": "线性链-摘要生成",
        "query": "请为我生成一个接收长文本并自动生成摘要的工作流",
        "expect_nodes": ["start", "end", "llm"],
        "expect_branches": 0,
    },
    # --- Branches ---
    {
        "name": "二路分支-文章处理",
        "query": "请为我生成一个分析文章中心思想或者对文章进行润色的工作流（两路分支）",
        "expect_nodes": ["start", "end", "llm", "if-else"],
        "expect_branches": 2,
    },
    {
        "name": "三路分支-客服分流",
        "query": "请为我生成一个客服分流工作流：退款/技术支持/一般咨询（三路分支）",
        "expect_nodes": ["start", "end", "llm", "if-else"],
        "expect_branches": 3,
    },
    {
        "name": "四路分支-文章四合一",
        "query": "请为我生成一个 分析文章中心思想 或者 对文章进行润色 或者 对文章进行扩写 或者 将文章翻译为英文 的工作流（四路分支）",
        "expect_nodes": ["start", "end", "llm", "if-else"],
        "expect_branches": 4,
    },
    {
        "name": "五路分支-学习资源",
        "query": "请为我生成一个学习资源推荐工作流：视频/文章/书籍/课程/论坛帖子（五路分支）",
        "expect_nodes": ["start", "end", "llm", "if-else"],
        "expect_branches": 5,
    },
    # --- HTTP + LLM ---
    {
        "name": "HTTP+LLM-天气建议",
        "query": "请为我生成一个调用天气API获取天气信息并生成穿衣建议的工作流",
        "expect_nodes": ["start", "end", "llm", "http-request"],
        "expect_branches": 0,
    },
    {
        "name": "HTTP+LLM-新闻摘要",
        "query": "请为我生成一个抓取新闻网页并自动生成新闻摘要的工作流",
        "expect_nodes": ["start", "end", "llm", "http-request"],
        "expect_branches": 0,
    },
    # --- Code node ---
    {
        "name": "代码-文本统计",
        "query": "请为我生成一个接收文本并用代码统计字数、句数、段落数的工作流",
        "expect_nodes": ["start", "end", "code"],
        "expect_branches": 0,
    },
    # --- Template ---
    {
        "name": "模板-数据格式化",
        "query": "请为我生成一个将原始数据格式化为标准报告模板的工作流",
        "expect_nodes": ["start", "end", "llm"],
        "expect_branches": 0,
    },
    # --- Aggregator ---
    {
        "name": "聚合-情感主题",
        "query": "请为我生成一个对文本进行情感分析和主题提取后汇总结果的工作流",
        "expect_nodes": ["start", "end", "llm"],
        "expect_branches": 0,
    },
    # --- Complex mixed ---
    {
        "name": "混合-代码+LLM分析",
        "query": "请为我生成一个先用代码清洗数据再用LLM分析趋势的工作流",
        "expect_nodes": ["start", "end", "code", "llm"],
        "expect_branches": 0,
    },
    {
        "name": "混合-三路HTTP",
        "query": "请为我生成一个根据用户选择调用不同API（天气/汇率/新闻）并汇总结果的工作流",
        "expect_nodes": ["start", "end", "http-request", "if-else"],
        "expect_branches": 3,
    },
    {
        "name": "综合-学术论文分析",
        "query": "请为我生成一个学术论文分析工作流：先用LLM提取摘要和关键词，然后根据学科类型（理工/社科/医学）走不同分析路径，最后汇总输出",
        "expect_nodes": ["start", "end", "llm", "if-else"],
        "expect_branches": 3,
    },
]


# ═══════════════════════════════════════════════════════════════════════════
# Semantic Check
# ═══════════════════════════════════════════════════════════════════════════
def check_semantic(result: dict, tc: dict) -> list[str]:
    errors = []
    dsl_text = result.get("dsl", "")
    if not dsl_text:
        return ["No DSL for semantic check"]
    try:
        parsed = yaml.safe_load(dsl_text)
    except Exception:
        return ["DSL not valid YAML for semantic check"]

    nodes = parsed.get("workflow", {}).get("graph", {}).get("nodes", [])
    node_types = {n.get("data", {}).get("type", "") for n in nodes}

    for expected in tc.get("expect_nodes", []):
        if expected not in node_types:
            errors.append(f"Expected '{expected}' not found (have: {sorted(node_types)})")

    expect_branches = tc.get("expect_branches", 0)
    if expect_branches > 0:
        ie_count = sum(1 for t in node_types if t == "if-else")
        if ie_count < 1:
            errors.append(
                f"Expected >= 1 if-else for {expect_branches}-branch workflow, got {ie_count}")

    return errors


# ═══════════════════════════════════════════════════════════════════════════
# Test Runner
# ═══════════════════════════════════════════════════════════════════════════
def find_next_run_dir() -> Path:
    TEST_RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    n = 0
    while (TEST_RESULTS_DIR / f"test{n}").exists():
        n += 1
    d = TEST_RESULTS_DIR / f"test{n}"
    d.mkdir()
    return d


def main():
    print("=" * 70)
    print("NLG -> DSL Test Driver")
    print(f"Model: {MODEL}")
    print("=" * 70)

    # Verify builder module import works
    try:
        from nlg_to_dsl_test import build_dsl_direct
        print("Builder module: OK (direct import)")
    except Exception as e:
        print(f"ERROR: Builder module import failed: {e}")
        sys.exit(1)

    # Select which tests to run
    if len(sys.argv) > 1:
        indices = [int(x) - 1 for x in sys.argv[1:]]
        cases = [(i, TEST_CASES[i]) for i in indices if 0 <= i < len(TEST_CASES)]
    else:
        cases = list(enumerate(TEST_CASES))

    run_dir = find_next_run_dir()
    print(f"Results: {run_dir}")
    print(f"Running {len(cases)} test(s)\n")

    all_results = []
    t0_total = time.time()

    for seq, (i, tc) in enumerate(cases):
        print(f"\n{'━' * 60}")
        print(f"Test {i + 1}/{len(TEST_CASES)}: {tc['name']}")
        print(f"  Query: {tc['query']}")
        test_dir = run_dir / f"{i + 1:02d}_{tc['name']}"
        test_dir.mkdir(exist_ok=True)

        t0 = time.time()
        result = run_pipeline(tc["query"], tc["name"], test_dir)
        elapsed = time.time() - t0
        result["elapsed"] = elapsed

        # Semantic check
        if result["passed"]:
            sem = check_semantic(result, tc)
            if sem:
                result["passed"] = False
                result["errors"].extend(sem)

        status = "PASS" if result["passed"] else "FAIL"
        print(f"\n  ══ {status} ({elapsed:.1f}s) ══")
        for err in result["errors"][:3]:
            print(f"    - {err}")

        all_results.append(result)

    # Summary
    total_elapsed = time.time() - t0_total
    passed = sum(1 for r in all_results if r["passed"])
    total = len(all_results)

    print(f"\n{'=' * 70}")
    print(f"SUMMARY  {passed}/{total} passed  ({total_elapsed:.0f}s total)")
    print(f"Saved to: {run_dir}")
    print("=" * 70)

    for r in all_results:
        s = "PASS" if r["passed"] else "FAIL"
        print(f"  [{s}] {r['name']} ({r['elapsed']:.1f}s, stage: {r.get('stage', '?')})")
        if not r["passed"]:
            for err in r["errors"][:2]:
                print(f"       {err[:120]}")

    summary = [f"Results: {passed}/{total} passed ({total_elapsed:.0f}s)\n"]
    for r in all_results:
        s = "PASS" if r["passed"] else "FAIL"
        summary.append(f"[{s}] {r['name']} ({r['elapsed']:.1f}s, stage: {r.get('stage', '?')})")
        if not r["passed"]:
            for err in r["errors"]:
                summary.append(f"  - {err}")
    (run_dir / "_summary.txt").write_text("\n".join(summary), encoding="utf-8")

    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
