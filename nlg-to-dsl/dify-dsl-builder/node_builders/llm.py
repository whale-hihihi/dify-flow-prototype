"""Build Dify DSL LLM node."""
from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from id_mapper import IdMapper


def _node_type(node) -> str:
    if node is None:
        return ""
    return node.get("type", "") if isinstance(node, dict) else node.type


def _get_node_variables(node) -> list:
    return node.get("variables", []) if isinstance(node, dict) else getattr(node, "variables", [])


def _get_var_name(variable) -> str:
    if hasattr(variable, "name"):
        return variable.name
    if isinstance(variable, dict):
        return str(variable.get("name", "")).strip()
    return ""


def _build_start_input_section(predecessor_id: str, predecessor_node) -> str:
    if not predecessor_id or _node_type(predecessor_node) != "start":
        return ""

    refs = []
    for variable in _get_node_variables(predecessor_node):
        name = _get_var_name(variable)
        if not name:
            continue
        refs.append(f"{name}：\n{{{{#{predecessor_id}.{name}#}}}}")
    return "\n\n".join(refs)


def _remap_prompt_templates(prompt_templates: list, mapper: "IdMapper | None") -> list:
    """Remap declarative node IDs in prompt template text to mapped IDs."""
    if not prompt_templates or not mapper:
        return prompt_templates
    result = []
    for pt in prompt_templates:
        if isinstance(pt, dict):
            item = dict(pt)
        else:
            item = pt.model_dump()
        text = item.get("text", "")
        for old_id, new_id in mapper._map.items():
            text = text.replace(f"{{{{#{old_id}.", f"{{{{#{new_id}.")
        item["text"] = text
        if not item.get("id"):
            item["id"] = str(uuid.uuid4())
        result.append(item)
    return result


def _remap_selector(selector: list[str], mapper: "IdMapper | None") -> list[str]:
    """Remap declarative node IDs in a selector list."""
    if not selector or not mapper:
        return selector
    if len(selector) >= 2 and selector[0] in mapper._map:
        return [mapper[selector[0]], *selector[1:]]
    return selector


def build_llm_node(*, node=None, desc: str, x: int, y: int, mapped_id: str,
                   prompt_hint: str = "", predecessor_id: str = "",
                   source_output: str = "", **kwargs) -> dict:
    predecessor_selector = kwargs.get("predecessor_selector")
    predecessor_node = kwargs.get("predecessor_node")
    mapper = kwargs.get("mapper")

    # Check if user provided full config
    user_model = None
    user_prompt_template = None
    user_context = None
    user_vision = None
    user_memory = None

    if node is not None:
        user_model = node.model if hasattr(node, "model") else node.get("model")
        user_prompt_template = node.prompt_template if hasattr(node, "prompt_template") else node.get("prompt_template")
        user_context = node.context if hasattr(node, "context") else node.get("context")
        user_vision = node.vision if hasattr(node, "vision") else node.get("vision")
        user_memory = node.memory if hasattr(node, "memory") else node.get("memory")

    # Build model config
    if user_model is not None:
        if hasattr(user_model, "model_dump"):
            model_config = user_model.model_dump()
        elif isinstance(user_model, dict):
            model_config = dict(user_model)
        else:
            model_config = {
                "provider": getattr(user_model, "provider", "langgenius/openai/openai"),
                "name": getattr(user_model, "name", "gpt-3.5-turbo"),
                "mode": getattr(user_model, "mode", "chat"),
                "completion_params": getattr(user_model, "completion_params", {"temperature": 0.7}),
            }
    else:
        model_config = {
            "provider": "langgenius/siliconflow/siliconflow",
            "name": "Qwen/Qwen3.6-35B-A3B",
            "mode": "chat",
            "completion_params": {},
        }

    # Build prompt template
    if user_prompt_template is not None:
        prompt_data = []
        for pt in user_prompt_template:
            if hasattr(pt, "model_dump"):
                prompt_data.append(pt.model_dump())
            elif isinstance(pt, dict):
                entry = dict(pt)
                if not entry.get("id"):
                    entry["id"] = str(uuid.uuid4())
                prompt_data.append(entry)
            else:
                prompt_data.append({"id": str(uuid.uuid4()), "role": "user", "text": str(pt)})
        prompt_data = _remap_prompt_templates(prompt_data, mapper)
    else:
        # Fallback: build prompt from hint
        start_input_section = _build_start_input_section(predecessor_id, predecessor_node)
        if start_input_section:
            input_section = start_input_section
        elif predecessor_selector:
            input_section = f"输入内容：\n{{{{#{'.'.join(predecessor_selector)}#}}}}"
        else:
            input_section = f"输入内容：\n{{{{#{predecessor_id}.{source_output or 'text'}#}}}}" if predecessor_id else ""

        prompt_text = prompt_hint or "请处理输入内容。"
        if input_section:
            prompt_text = f"{input_section}\n\n任务要求：\n{prompt_text}"
        prompt_data = [{"id": str(uuid.uuid4()), "role": "user", "text": prompt_text}]

    # Build context
    if user_context is not None:
        if hasattr(user_context, "model_dump"):
            context_config = user_context.model_dump()
        elif isinstance(user_context, dict):
            context_config = {
                "enabled": user_context.get("enabled", False),
                "variable_selector": _remap_selector(user_context.get("variable_selector", []), mapper),
            }
        else:
            context_config = {"enabled": False, "variable_selector": []}
    else:
        context_config = {"enabled": False, "variable_selector": []}

    # Build vision
    if user_vision is not None:
        if hasattr(user_vision, "model_dump"):
            vision_config = user_vision.model_dump()
        elif isinstance(user_vision, dict):
            vision_config = dict(user_vision)
        else:
            vision_config = {"enabled": False}
    else:
        vision_config = {"enabled": False}

    # Build memory
    if user_memory is not None:
        if hasattr(user_memory, "model_dump"):
            memory_config = user_memory.model_dump()
        elif isinstance(user_memory, dict):
            memory_config = dict(user_memory)
        else:
            memory_config = {
                "query_prompt_template": "",
                "window": {"enabled": False, "size": 10},
            }
    else:
        memory_config = {
            "query_prompt_template": "",
            "window": {"enabled": False, "size": 10},
        }

    return {
        "id": mapped_id,
        "type": "custom",
        "position": {"x": x, "y": y},
        "data": {
            "type": "llm",
            "title": desc or "LLM",
            "desc": "",
            "model": model_config,
            "prompt_template": prompt_data,
            "variables": [],
            "context": context_config,
            "vision": vision_config,
            "memory": memory_config,
        },
    }
