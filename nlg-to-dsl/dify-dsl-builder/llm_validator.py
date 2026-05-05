from __future__ import annotations
"""Validate LLM2 JSON output: node type whitelist + edge reference integrity."""
import json

from node_io_contract import validate_node_graph


def validate_llm2_output(data: dict | str) -> list[str]:
    """Validate LLM2 output. Returns list of error strings (empty = valid)."""
    errors = []

    if isinstance(data, str):
        try:
            data = json.loads(data)
        except json.JSONDecodeError as e:
            return [f"Invalid JSON: {e}"]

    if not isinstance(data, dict):
        return ["Top level must be a JSON object"]

    nodes = data.get("nodes", [])
    edges = data.get("edges", [])
    errors.extend(validate_node_graph(nodes, edges))
    return errors
