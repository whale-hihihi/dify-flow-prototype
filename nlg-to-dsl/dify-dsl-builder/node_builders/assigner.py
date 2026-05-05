from __future__ import annotations
"""Build Dify DSL assigner node."""


def build_assigner_node(*, node=None, desc: str, x: int, y: int, mapped_id: str,
                        variables: list | None = None, predecessor_id: str = "",
                        source_output: str = "", write_mode: str = "over-write",
                        **kwargs) -> dict:
    variables = variables or []
    predecessor_selector = kwargs.get("predecessor_selector")
    target_name = "result"
    if variables:
        first = variables[0]
        target_name = first.name if hasattr(first, "name") else first.get("name", target_name)
    return {
        "id": mapped_id,
        "type": "custom",
        "position": {"x": x, "y": y},
        "data": {
            "type": "assigner",
            "title": desc or "Assigner",
            "desc": "",
            "assigned_variable_selector": ["conversation", target_name],
            "input_variable_selector": predecessor_selector or ([predecessor_id, source_output or "text"] if predecessor_id else []),
            "write_mode": write_mode or "over-write",
        },
    }
