from __future__ import annotations
"""Build Dify DSL template-transform node."""


def build_template_transform_node(*, node=None, desc: str, x: int, y: int,
                                  mapped_id: str, predecessor_id: str = "",
                                  source_output: str = "", **kwargs) -> dict:
    predecessor_selector = kwargs.get("predecessor_selector")
    if predecessor_selector:
        var_ref = f"{{{{#{'.'.join(predecessor_selector)}#}}}}"
    else:
        var_ref = f"{{{{#{predecessor_id}.{source_output or 'text'}#}}}}" if predecessor_id else ""
    return {
        "id": mapped_id,
        "type": "custom",
        "position": {"x": x, "y": y},
        "data": {
            "type": "template-transform",
            "title": desc or "Template",
            "desc": "",
            "template": var_ref,
            "variables": [],
        },
    }
