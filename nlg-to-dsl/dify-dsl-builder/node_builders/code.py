from __future__ import annotations
"""Build Dify DSL code node."""

DEFAULT_CODE = 'def main() -> dict:\n    return {"result": ""}'


def build_code_node(*, node=None, desc: str, x: int, y: int, mapped_id: str, **kwargs) -> dict:
    return {
        "id": mapped_id,
        "type": "custom",
        "position": {"x": x, "y": y},
        "data": {
            "type": "code",
            "title": desc or "Code",
            "desc": "",
            "code_language": "python3",
            "code": DEFAULT_CODE,
            "outputs": {
                "result": {
                    "type": "string",
                    "children": None,
                },
            },
            "variables": [],
        },
    }
