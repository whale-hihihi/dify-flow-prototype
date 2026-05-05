"""Build Dify DSL end node."""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from id_mapper import IdMapper


def _node_type(node) -> str:
    return node.get("type", "") if isinstance(node, dict) else node.type


def _get_variable_name(variable) -> str:
    if hasattr(variable, "name"):
        return variable.name
    if isinstance(variable, dict):
        return str(variable.get("name", "")).strip()
    return ""


def _default_output_name(node) -> str:
    node_type = _node_type(node)
    if node_type == "start":
        variables = node.get("variables", []) if isinstance(node, dict) else node.variables
        first_name = _get_variable_name(variables[0]) if variables else ""
        return first_name or "input"
    if node_type == "code":
        return "result"
    if node_type == "template-transform":
        return "output"
    if node_type == "http-request":
        return "body"
    return "text"


def _remap_selector(selector: list[str], mapper: "IdMapper | None") -> list[str]:
    """Remap declarative node IDs in a selector list."""
    if not selector or not mapper:
        return selector
    if len(selector) >= 2 and selector[0] in mapper._map:
        return [mapper[selector[0]], *selector[1:]]
    return selector


def build_end_node(*, node=None, desc: str, x: int, y: int, mapped_id: str,
                   predecessor_id: str = "", source_output: str = "", **kwargs) -> dict:
    predecessor_ids = kwargs.get("predecessor_ids", []) or ([predecessor_id] if predecessor_id else [])
    predecessor_nodes = kwargs.get("predecessor_nodes", [])
    predecessor_selectors = kwargs.get("predecessor_selectors", [])
    mapper = kwargs.get("mapper")

    # Check if user provided explicit outputs
    user_outputs = None
    if node is not None:
        user_outputs = node.outputs if hasattr(node, "outputs") else node.get("outputs")

    outputs = []

    if user_outputs:
        # Use user-provided outputs, remapping IDs
        for i, out in enumerate(user_outputs):
            if isinstance(out, dict):
                var_name = out.get("variable", f"output_{i+1}")
                value_selector = out.get("value_selector", [])
            else:
                var_name = getattr(out, "variable", f"output_{i+1}")
                value_selector = getattr(out, "value_selector", [])
            remapped_selector = _remap_selector(value_selector, mapper)
            outputs.append({
                "value_selector": remapped_selector,
                "variable": var_name,
            })
    else:
        # Auto-generate outputs from predecessors
        output_selectors = [selector for selector in predecessor_selectors if selector]

        if not output_selectors:
            output_pairs = []
            for pid, pnode in zip(predecessor_ids, predecessor_nodes):
                if _node_type(pnode) == "if-else":
                    continue
                output_pairs.append([pid, source_output or _default_output_name(pnode)])
            if not output_pairs and predecessor_id:
                output_pairs.append([predecessor_id, source_output or "text"])
            output_selectors = output_pairs

        for index, selector in enumerate(output_selectors, start=1):
            outputs.append({
                "value_selector": selector,
                "variable": "output" if index == 1 else f"output_{index}",
            })

    return {
        "id": mapped_id,
        "type": "custom",
        "position": {"x": x, "y": y},
        "data": {
            "type": "end",
            "title": "End",
            "desc": "",
            "selected": False,
            "outputs": outputs,
        },
    }
