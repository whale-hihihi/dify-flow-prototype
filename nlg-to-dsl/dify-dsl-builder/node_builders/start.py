from __future__ import annotations
"""Build Dify DSL start node."""


def _get_var_name(variable) -> str:
    if hasattr(variable, "name"):
        return variable.name
    return variable.get("name", "")


def _get_var_label(variable) -> str:
    if hasattr(variable, "label"):
        return variable.label or _get_var_name(variable)
    return variable.get("label", "") or _get_var_name(variable)


def _get_var_type(variable) -> str:
    if hasattr(variable, "type"):
        return variable.type
    return variable.get("type", "string")


def _get_var_options(variable) -> list[str]:
    if hasattr(variable, "options"):
        return [str(option) for option in (variable.options or []) if str(option).strip()]
    return [str(option) for option in variable.get("options", []) if str(option).strip()]


def _friendly_branch_label(label: str, options: list[str]) -> str:
    if not options:
        return label
    if any(option in label for option in options):
        return label
    return f"{label}（填写：{' / '.join(options)}）"


def _map_start_input_type(name: str, raw_type: str, options: list[str]) -> tuple[str, int | None]:
    raw = str(raw_type or "string").lower()
    lowered_name = str(name or "").lower()

    if raw in {"number", "int", "integer", "float", "double"}:
        return "number", None
    if raw in {"bool", "boolean", "checkbox"}:
        return "checkbox", None
    if raw in {"object", "json"}:
        return "object", None
    if raw in {"file", "single-file"}:
        return "file", 5
    if raw in {"file-list", "files"}:
        return "file-list", 5

    long_text_markers = {
        "article", "content", "text", "body", "message", "input", "query",
        "material", "template", "format", "document",
    }
    if raw in {"choice", "select", "enum"}:
        # Emit a proper select when options are available; otherwise keep a text input but rely on a friendly label.
        return ("select", None) if options else ("text-input", 256)

    if any(marker in lowered_name for marker in long_text_markers):
        return "paragraph", 5000
    return "text-input", 256


def build_start_node(*, node=None, desc: str, x: int, y: int, mapped_id: str,
                     variables: list = None, **kwargs) -> dict:
    variables = variables or []
    result = {
        "id": mapped_id,
        "type": "custom",
        "position": {"x": x, "y": y},
        "data": {
            "type": "start",
            "title": "Start",
            "desc": "",
            "variables": [],
        },
    }

    for variable in variables:
        name = _get_var_name(variable)
        label = _get_var_label(variable) or name
        raw_type = _get_var_type(variable)
        options = _get_var_options(variable)
        mapped_type, max_length = _map_start_input_type(name, raw_type, options)

        if str(raw_type or "").lower() in {"choice", "select", "enum"}:
            label = _friendly_branch_label(label, options)

        result["data"]["variables"].append({
            "label": label,
            "variable": name,
            "type": mapped_type,
            "required": False,
            "options": options,
            "max_length": max_length,
        })

    return result
