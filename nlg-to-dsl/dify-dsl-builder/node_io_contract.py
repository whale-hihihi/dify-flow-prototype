"""Shared node I/O contracts and semantic validation helpers for the DSL builder."""

from __future__ import annotations

from dataclasses import dataclass


ALLOWED_NODE_TYPES = {
    "start",
    "end",
    "llm",
    "http-request",
    "template-transform",
    "code",
    "if-else",
    "assigner",
    "variable-aggregator",
}

CONTROL_NODE_TYPES = {"if-else"}


@dataclass(frozen=True)
class SelectorRef:
    selector: list[str]
    output_name: str


def node_type(node) -> str:
    if node is None:
        return ""
    return node.get("type", "") if isinstance(node, dict) else node.type


def get_variable_name(variable) -> str:
    if hasattr(variable, "name"):
        return variable.name
    if isinstance(variable, dict):
        return str(variable.get("name", "")).strip()
    return ""


def get_variable_type(variable) -> str:
    if hasattr(variable, "type"):
        return variable.type
    if isinstance(variable, dict):
        return str(variable.get("type", "string")).strip()
    return "string"


def get_node_variables(node) -> list:
    return node.get("variables", []) if isinstance(node, dict) else getattr(node, "variables", [])


def get_assigner_target_name(node) -> str:
    variables = get_node_variables(node)
    if not variables:
        return "result"
    target_name = get_variable_name(variables[0])
    return target_name or "result"


def is_control_node(node) -> bool:
    return node_type(node) in CONTROL_NODE_TYPES


def pick_start_variable_from_condition(predecessor_node, condition: str) -> str:
    if not predecessor_node or node_type(predecessor_node) != "start":
        return ""

    names = [get_variable_name(v) for v in get_node_variables(predecessor_node) if get_variable_name(v)]
    if not names:
        return ""

    lowered_condition = str(condition or "").lower()
    for name in names:
        if name.lower() in lowered_condition:
            return name

    for preferred in ("task_type", "action", "mode", "intent", "route"):
        if preferred in names:
            return preferred

    return names[0]


def pick_primary_start_variable(node) -> str:
    names = [get_variable_name(v) for v in get_node_variables(node) if get_variable_name(v)]
    if not names:
        return "input"

    for name in names:
        lowered = name.lower()
        if not any(keyword in lowered for keyword in ("task_type", "action", "mode", "intent", "route")):
            return name
    return names[0]


def infer_default_output_name(node, *, condition: str = "") -> str:
    ntype = node_type(node)
    if not ntype:
        return "text"
    if ntype == "start":
        if condition:
            return pick_start_variable_from_condition(node, condition) or pick_primary_start_variable(node)
        return pick_primary_start_variable(node)
    if ntype == "assigner":
        return get_assigner_target_name(node)
    if ntype == "code":
        return "result"
    if ntype == "template-transform":
        return "output"
    if ntype == "http-request":
        return "body"
    if ntype == "variable-aggregator":
        return "output"
    return "text"


def resolve_output_selector(node, *, mapped_id: str, explicit_output: str = "", condition: str = "") -> SelectorRef | None:
    if not node:
        return None

    ntype = node_type(node)
    output_name = explicit_output or infer_default_output_name(node, condition=condition)

    if ntype == "assigner":
        return SelectorRef(["conversation", output_name], output_name)
    if ntype == "end":
        return None
    return SelectorRef([mapped_id, output_name], output_name)


def validate_node_graph(nodes, edges) -> list[str]:
    """Validate LLM2 node/edge JSON against node I/O contracts."""
    errors: list[str] = []
    node_map = {node.get("id", ""): node for node in nodes}

    for node in nodes:
        nid = node.get("id", "")
        ntype = node.get("type", "")
        if ntype not in ALLOWED_NODE_TYPES:
            errors.append(f"Unknown node type '{ntype}' in node '{nid}'")
            continue

        if ntype == "if-else" and not node.get("condition"):
            errors.append(f"If-else node '{nid}' is missing condition")

        if ntype == "assigner" and not node.get("variables"):
            errors.append(f"Assigner node '{nid}' is missing target variable definition")

        if ntype == "start":
            seen_names = set()
            for variable in node.get("variables", []):
                name = get_variable_name(variable)
                if not name:
                    errors.append(f"Start node '{nid}' has an empty input variable name")
                    continue
                if name in seen_names:
                    errors.append(f"Start node '{nid}' has duplicate input variable '{name}'")
                seen_names.add(name)

    outgoing_by_source: dict[str, list[dict]] = {}
    for edge in edges:
        src = edge.get("source", "")
        tgt = edge.get("target", "")
        if src not in node_map:
            errors.append(f"Edge source '{src}' does not match any node")
        if tgt not in node_map:
            errors.append(f"Edge target '{tgt}' does not match any node")
        outgoing_by_source.setdefault(src, []).append(edge)

    for node in nodes:
        nid = node.get("id", "")
        ntype = node.get("type", "")
        outgoing = outgoing_by_source.get(nid, [])
        if ntype == "if-else":
            branches = {str(edge.get("branch", "")).strip() for edge in outgoing}
            if "true" not in branches or "false" not in branches:
                errors.append(f"If-else node '{nid}' must have explicit true/false branch edges")

    return errors
