from __future__ import annotations
"""Parse LLM1 output: extract plan text and intent JSON using ===PLAN===/===JSON=== delimiters."""
import json
import re


def parse_llm1_output(text: str) -> tuple[str, dict]:
    """Parse LLM1 output into (plan_text, intent_dict)."""
    plan_match = re.search(r"===PLAN===\s*\n(.*?)\n\s*===JSON===", text, re.DOTALL)
    json_match = re.search(r"===JSON===\s*\n?(.*)", text, re.DOTALL)

    if plan_match and json_match:
        plan = plan_match.group(1).strip()
        json_str = json_match.group(1).strip()
    else:
        json_blocks = re.findall(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', text, re.DOTALL)
        if not json_blocks:
            raise ValueError("No JSON found in LLM1 output")
        json_str = json_blocks[-1]
        last_json_pos = text.rfind(json_str)
        plan = text[:last_json_pos].strip()

    # Clean potential markdown code fences
    json_str = re.sub(r'^```(?:json)?\s*\n?', '', json_str)
    json_str = re.sub(r'\n?```\s*$', '', json_str)

    try:
        intent = json.loads(json_str)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in LLM1 output: {e}")

    return plan, intent
