from __future__ import annotations
"""Node builder registry: maps node type to builder function."""
from models import NodeDef
from node_io_contract import (infer_default_output_name,
                              pick_start_variable_from_condition)
from node_builders.assigner import build_assigner_node
from node_builders.code import build_code_node
from node_builders.end import build_end_node
from node_builders.http_request import build_http_request_node
from node_builders.if_else import build_if_else_node
from node_builders.llm import build_llm_node
from node_builders.start import build_start_node
from node_builders.template import build_template_transform_node
from node_builders.variable_aggregator import build_variable_aggregator_node


_BUILDERS = {
    "start": build_start_node,
    "end": build_end_node,
    "llm": build_llm_node,
    "http-request": build_http_request_node,
    "template-transform": build_template_transform_node,
    "code": build_code_node,
    "if-else": build_if_else_node,
    "assigner": build_assigner_node,
    "variable-aggregator": build_variable_aggregator_node,
}


def _node_type(node) -> str:
    if isinstance(node, dict):
        return node.get("type", "")
    return node.type


def _node_attr(node, name: str, default=None):
    if isinstance(node, dict):
        return node.get(name, default)
    return getattr(node, name, default)


def build_node(node: NodeDef | dict, x: int, y: int, mapped_id: str,
               predecessor_id: str = "", predecessor_ids: list[str] | None = None,
               **extra_kwargs) -> dict:
    """Build a DSL node dict from a node definition."""
    predecessor_ids = predecessor_ids or []
    explicit_source_output = extra_kwargs.pop("source_output", "")
    node_type = _node_type(node)
    desc = _node_attr(node, "desc", "")
    variables = _node_attr(node, "variables", [])
    prompt_hint = _node_attr(node, "prompt_hint", "")
    condition = _node_attr(node, "condition", "")
    source_output = _node_attr(node, "source_output", "")
    write_mode = _node_attr(node, "write_mode", "over-write")
    output_type = _node_attr(node, "output_type", "string")

    predecessor_node = extra_kwargs.get("predecessor_node")
    if node_type == "if-else" and predecessor_node:
        resolved_source_output = explicit_source_output or source_output or pick_start_variable_from_condition(predecessor_node, condition)
        resolved_source_output = resolved_source_output or infer_default_output_name(predecessor_node, condition=condition)
    else:
        resolved_source_output = explicit_source_output or source_output or infer_default_output_name(predecessor_node, condition=condition)

    builder = _BUILDERS.get(node_type)
    if not builder:
        raise ValueError(f"Unsupported node type: {node_type}")

    return builder(
        node=node,
        desc=desc,
        x=x,
        y=y,
        mapped_id=mapped_id,
        variables=variables,
        prompt_hint=prompt_hint,
        predecessor_id=predecessor_id,
        predecessor_ids=predecessor_ids,
        condition=condition,
        source_output=resolved_source_output,
        write_mode=write_mode,
        output_type=output_type,
        **extra_kwargs,
    )
