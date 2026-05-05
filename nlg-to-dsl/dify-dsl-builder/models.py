from __future__ import annotations
"""Pydantic models for DSL Builder API requests and responses."""
from typing import Any, Literal

from pydantic import BaseModel, Field


class NodeVariable(BaseModel):
    name: str = ""
    label: str = ""
    type: str = "string"
    options: list[str] = Field(default_factory=list)
    value_selector: list[str] = Field(default_factory=list)
    variable: str = ""
    value: Any = None


class LLMModelConfig(BaseModel):
    provider: str = "langgenius/siliconflow/siliconflow"
    name: str = "Qwen/Qwen3.6-35B-A3B"
    mode: str = "chat"
    completion_params: dict[str, Any] = Field(default_factory=dict)


class PromptMessage(BaseModel):
    id: str = ""
    role: str = "user"
    text: str = ""


class ContextConfig(BaseModel):
    enabled: bool = False
    variable_selector: list[str] = Field(default_factory=list)


class VisionConfig(BaseModel):
    enabled: bool = False


class MemoryConfig(BaseModel):
    query_prompt_template: str = ""
    window: dict[str, Any] = Field(default_factory=lambda: {"enabled": False, "size": 10})


class NodeDef(BaseModel):
    id: str
    type: Literal[
        "start", "end", "llm", "http-request",
        "template-transform", "code", "if-else",
        "assigner", "variable-aggregator",
    ]
    desc: str = ""
    prompt_hint: str = ""
    model: LLMModelConfig | None = None
    prompt_template: list[PromptMessage] | None = None
    context: ContextConfig | None = None
    vision: VisionConfig | None = None
    memory: MemoryConfig | None = None
    variable_selector: list[str] | None = None
    variables: list[NodeVariable | dict[str, Any]] = Field(default_factory=list)
    outputs: list[dict[str, Any]] | None = None
    condition: str = ""
    source_output: str = ""
    write_mode: Literal["over-write", "append", "clear"] = "over-write"
    output_type: str = "string"
    url: str = ""


class EdgeDef(BaseModel):
    source: str
    target: str
    branch: str = ""


class GenerateRequest(BaseModel):
    nodes: list[NodeDef]
    edges: list[EdgeDef]
    app_name: str = "Generated Workflow"
    mode: Literal["workflow", "advanced-chat"] = "workflow"


class GenerateResponse(BaseModel):
    dsl: str
    filename: str


class ErrorResponse(BaseModel):
    error: str
    message: str
    node_id: str = ""


class ValidateRequest(BaseModel):
    dsl: str


class ValidationError(BaseModel):
    path: str
    message: str


class ValidateResponse(BaseModel):
    valid: bool
    errors: list[ValidationError] = Field(default_factory=list)
