"""Build Dify DSL variable-aggregator node."""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from id_mapper import IdMapper


def _remap_selector(selector: list[str], mapper: "IdMapper | None") -> list[str]:
    """Remap declarative node IDs in a selector list."""
    if not selector or not mapper:
        return selector
    if len(selector) >= 2 and selector[0] in mapper._map:
        return [mapper[selector[0]], *selector[1:]]
    return selector


def build_variable_aggregator_node(*, node=None, desc: str, x: int, y: int, mapped_id: str,
                                   predecessor_ids: list[str] | None = None,
                                   predecessor_id: str = "", source_output: str = "",
                                   output_type: str = "string", **kwargs) -> dict:
    predecessor_ids = predecessor_ids or ([predecessor_id] if predecessor_id else [])
    source_field = source_output or "text"
    mapper = kwargs.get("mapper")

    # Check if user provided detailed variables with value_selector
    user_variables = None
    if node is not None:
        user_variables = node.variables if hasattr(node, "variables") else node.get("variables")

    agg_variables = []
    if user_variables:
        for var in user_variables:
            if isinstance(var, dict):
                value_selector = var.get("value_selector", [])
            elif hasattr(var, "value_selector"):
                value_selector = var.value_selector
            else:
                value_selector = []
            if value_selector:
                remapped = _remap_selector(value_selector, mapper)
                agg_variables.append(remapped)
            elif isinstance(var, dict) and var.get("variable") and var.get("name"):
                # Format from user's example: {variable: "output", value_selector: [...], name: "result_1"}
                remapped = _remap_selector(var.get("value_selector", []), mapper)
                if remapped:
                    agg_variables.append(remapped)

    if not agg_variables:
        # Fallback: use predecessor IDs
        agg_variables = [[pid, source_field] for pid in predecessor_ids]

    return {
        "id": mapped_id,
        "type": "custom",
        "position": {"x": x, "y": y},
        "data": {
            "type": "variable-aggregator",
            "title": desc or "Variable Aggregator",
            "desc": "",
            "output_type": output_type or "string",
            "variables": agg_variables,
        },
    }
