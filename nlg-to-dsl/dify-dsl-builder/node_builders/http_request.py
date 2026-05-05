from __future__ import annotations
"""Build Dify DSL HTTP request node."""


def build_http_request_node(*, node=None, desc: str, x: int, y: int, mapped_id: str, **kwargs) -> dict:
    url = ""
    if node is not None:
        url = getattr(node, "url", "") or ""
    return {
        "id": mapped_id,
        "type": "custom",
        "position": {"x": x, "y": y},
        "data": {
            "type": "http-request",
            "title": desc or "HTTP Request",
            "desc": "",
            "method": "get",
            "url": url,
            "authorization": {"type": "no-auth", "config": {}},
            "headers": "",
            "params": "",
            "body": {"type": "none", "data": ""},
            "timeout": {"max_connect_timeout": 10, "max_read_timeout": 60, "max_write_timeout": 10},
            "variables": [],
        },
    }
