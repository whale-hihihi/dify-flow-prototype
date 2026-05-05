"""Build Dify DSL if-else node."""
from __future__ import annotations

import re
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from id_mapper import IdMapper


_QUOTED_EQ_PATTERNS = (
    re.compile(r"==\s*['\"]([^'\"]+)['\"]"),
    re.compile(r"=\s*['\"]([^'\"]+)['\"]"),
)
_BARE_EQ_PATTERNS = (
    re.compile(r"==\s*([A-Za-z0-9_\-一-鿿]+)\s*$"),
    re.compile(r"=\s*([A-Za-z0-9_\-一-鿿]+)\s*$"),
)
_ZH_LITERAL_PATTERN = re.compile(r"(?:是否等于|是否为|是否是|等于|为|是)\s*([A-Za-z0-9_\-一-鿿]+)\s*$")


def _infer_var_type(value: str) -> str:
    lowered = str(value or "").strip().lower()
    if lowered in {"true", "false"}:
        return "boolean"
    if re.fullmatch(r"-?\d+(?:\.\d+)?", lowered):
        return "number"
    return "string"


def _coerce_value(value: str):
    vartype = _infer_var_type(value)
    if vartype == "boolean":
        return lowered_bool(value)
    if vartype == "number":
        return float(value) if "." in str(value) else int(value)
    return value


def lowered_bool(value: str) -> bool:
    return str(value or "").strip().lower() == "true"


def _normalize_condition(condition: str) -> tuple[str, str]:
    text = str(condition or "").strip()
    if not text:
        return "contains", ""

    for pattern in _QUOTED_EQ_PATTERNS:
        matched = pattern.search(text)
        if matched:
            return "is", matched.group(1).strip()

    for pattern in _BARE_EQ_PATTERNS:
        matched = pattern.search(text)
        if matched:
            return "is", matched.group(1).strip()

    matched = _ZH_LITERAL_PATTERN.search(text)
    if matched:
        return "is", matched.group(1).strip()

    # If the condition is a simple word/phrase (no operators), treat as "is" comparison
    if re.fullmatch(r"[A-Za-z0-9_\-一-鿿]+", text):
        return "is", text

    return "contains", text


def _remap_selector(selector: list[str], mapper: "IdMapper | None") -> list[str]:
    """Remap declarative node IDs in a selector list."""
    if not selector or not mapper:
        return selector
    if len(selector) >= 2 and selector[0] in mapper._map:
        return [mapper[selector[0]], *selector[1:]]
    return selector


def build_if_else_node(*, node=None, desc: str, x: int, y: int, mapped_id: str,
                       condition: str = "", predecessor_id: str = "",
                       source_output: str = "", **kwargs) -> dict:
    predecessor_selector = kwargs.get("predecessor_selector")
    mapper = kwargs.get("mapper")

    # Check if user provided explicit variable_selector
    user_var_selector = None
    if node is not None:
        user_var_selector = node.variable_selector if hasattr(node, "variable_selector") else node.get("variable_selector")

    comparison_operator, normalized_value = _normalize_condition(condition)
    var_type = _infer_var_type(normalized_value)
    value = _coerce_value(normalized_value)

    # Determine the selector for the condition variable
    if user_var_selector:
        selector = _remap_selector(user_var_selector, mapper)
    elif predecessor_selector:
        selector = predecessor_selector
    else:
        selector = [predecessor_id, source_output or "text"]

    return {
        "id": mapped_id,
        "type": "custom",
        "position": {"x": x, "y": y},
        "data": {
            "type": "if-else",
            "title": desc or "IF/ELSE",
            "desc": "",
            "selected": False,
            "cases": [
                {
                    "case_id": "true",
                    "conditions": [
                        {
                            "id": f"{mapped_id}_cond_1",
                            "variable_selector": selector,
                            "comparison_operator": comparison_operator,
                            "value": value,
                            "varType": var_type,
                        }
                    ],
                    "id": "true",
                    "logical_operator": "and",
                }
            ] if selector and normalized_value != "" else [],
        },
    }
