from __future__ import annotations
"""Main DSL builder: orchestrates node building, edge assembly, and template rendering."""
import yaml

from id_mapper import IdMapper
from layout import LayoutCalculator
from models import EdgeDef, NodeDef
from node_io_contract import is_control_node, resolve_output_selector
from node_builders import build_node

# Real Dify node dimensions
NODE_HEIGHTS = {
    "start": 90,
    "end": 116,
    "llm": 167,
    "if-else": 167,
    "variable-aggregator": 116,
    "code": 131,
    "http-request": 167,
    "template-transform": 116,
    "assigner": 116,
}
NODE_WIDTH = 242


def select_template(nodes: list[NodeDef]) -> str:
    """Auto-select template based on node types present."""
    node_types = {n.type for n in nodes}
    if "if-else" in node_types:
        return "if_else_branch"
    if "variable-aggregator" in node_types:
        return "aggregator_merge"
    return "linear_chain"


def _find_predecessors(node_id: str, edges: list[EdgeDef], id_map: dict[str, str]) -> list[str]:
    """Find all mapped predecessor IDs for node_id."""
    predecessors = []
    for edge in edges:
        if edge.target == node_id:
            predecessors.append(id_map[edge.source])
    return predecessors


def _find_semantic_predecessor(node_id: str, edges: list[EdgeDef], node_type_map: dict[str, str]) -> str:
    """Skip control nodes like if-else and return the nearest data-producing predecessor."""
    current_sources = [edge.source for edge in edges if edge.target == node_id]
    if not current_sources:
        return ""

    current = current_sources[0]
    visited = set()
    while current and current not in visited and is_control_node({"type": node_type_map.get(current, "")}):
        visited.add(current)
        upstream = [edge.source for edge in edges if edge.target == current]
        if not upstream:
            return current
        current = upstream[0]
    return current


def _node_type_str(node) -> str:
    if isinstance(node, dict):
        return node.get("type", "")
    return node.type


def build_dsl(
    nodes: list[NodeDef],
    edges: list[EdgeDef],
    app_name: str = "Generated Workflow",
    mode: str = "workflow",
) -> str:
    """Build complete .dify.yml content from node and edge definitions."""
    mapper = IdMapper()
    layout = LayoutCalculator()

    for node in nodes:
        mapper.map_id(node.id)

    node_type_map = {n.id: n.type for n in nodes}

    for edge in edges:
        if edge.source not in node_type_map:
            raise ValueError(f"Edge references unknown source node: {edge.source}")
        if edge.target not in node_type_map:
            raise ValueError(f"Edge references unknown target node: {edge.target}")

    # Detect branch structure for layout
    if_else_nodes = [n.id for n in nodes if n.type == "if-else"]
    branch_targets = {}
    for ie_id in if_else_nodes:
        true_targets = [e.target for e in edges if e.source == ie_id and e.branch == "true"]
        false_targets = [e.target for e in edges if e.source == ie_id and e.branch == "false"]
        branch_targets[ie_id] = {"true": true_targets, "false": false_targets}

    node_id_order = [n.id for n in nodes]
    positions = layout.calculate(node_id_order, branch_targets=branch_targets)

    dsl_nodes = []
    node_def_map = {n.id: n for n in nodes}
    for node in nodes:
        mapped_id = mapper[node.id]
        x, y = positions[node.id]
        predecessor_edges = [e for e in edges if e.target == node.id]
        predecessor_ids = _find_predecessors(node.id, edges, mapper._map)
        semantic_predecessor_id = _find_semantic_predecessor(node.id, edges, node_type_map)
        semantic_predecessor_mapped_id = mapper[semantic_predecessor_id] if semantic_predecessor_id else ""
        predecessor_node = node_def_map.get(semantic_predecessor_id, None) if semantic_predecessor_id else None
        predecessor_nodes = [node_def_map[e.source] for e in predecessor_edges if e.source in node_def_map]
        predecessor_selector = None
        if predecessor_node and semantic_predecessor_mapped_id:
            ref = resolve_output_selector(
                predecessor_node,
                mapped_id=semantic_predecessor_mapped_id,
                explicit_output=node.source_output,
                condition=node.condition,
            )
            predecessor_selector = ref.selector if ref else None

        predecessor_selectors = []
        for edge in predecessor_edges:
            predecessor = node_def_map.get(edge.source)
            mapped_predecessor = mapper[edge.source]
            if not predecessor:
                continue
            ref = resolve_output_selector(
                predecessor,
                mapped_id=mapped_predecessor,
                explicit_output=node.source_output,
                condition=node.condition,
            )
            if ref:
                predecessor_selectors.append(ref.selector)

        dsl_node = build_node(
            node,
            x=x,
            y=y,
            mapped_id=mapped_id,
            predecessor_id=semantic_predecessor_mapped_id or (predecessor_ids[0] if predecessor_ids else ""),
            predecessor_ids=predecessor_ids,
            predecessor_node=predecessor_node,
            predecessor_nodes=predecessor_nodes,
            predecessor_selector=predecessor_selector,
            predecessor_selectors=predecessor_selectors,
            mapper=mapper,
        )

        # Add missing Dify structure fields
        node_type = _node_type_str(node)
        dsl_node["height"] = NODE_HEIGHTS.get(node_type, 95)
        dsl_node["width"] = NODE_WIDTH
        dsl_node["sourcePosition"] = "right"
        dsl_node["targetPosition"] = "left"
        if "selected" not in dsl_node:
            dsl_node["selected"] = False

        dsl_nodes.append(dsl_node)

    dsl_edges = []
    for edge in edges:
        src_mapped, tgt_mapped = mapper.map_edge_source_target(edge.source, edge.target)
        source_handle = edge.branch if edge.branch else "source"
        src_type = node_type_map[edge.source]
        tgt_type = node_type_map[edge.target]
        dsl_edge = {
            "id": f"{src_mapped}-{source_handle}-{tgt_mapped}-target",
            "source": src_mapped,
            "sourceHandle": source_handle,
            "target": tgt_mapped,
            "targetHandle": "target",
            "type": "custom",
            "zIndex": 0,
            "selected": False,
            "data": {
                "sourceType": src_type,
                "targetType": tgt_type,
                "isInIteration": False,
                "isInLoop": False,
            },
        }
        dsl_edges.append(dsl_edge)

    dsl_dict = {
        "version": "0.6.0",
        "kind": "app",
        "app": {
            "name": app_name,
            "mode": mode,
            "description": app_name,
            "icon": "\U0001F916",
            "icon_background": "#FFEAD5",
            "icon_type": "emoji",
            "use_icon_as_answer_icon": False,
        },
        "dependencies": [],
        "workflow": {
            "environment_variables": [],
            "conversation_variables": [],
            "features": {
                "file_upload": {"enabled": False},
                "opening_statement": "",
                "retriever_resource": {"enabled": False},
                "sensitive_word_avoidance": {"enabled": False},
                "speech_to_text": {"enabled": False},
                "suggested_questions": [],
                "suggested_questions_after_answer": {"enabled": False},
                "text_to_speech": {"enabled": False},
            },
            "graph": {
                "nodes": dsl_nodes,
                "edges": dsl_edges,
                "viewport": {"x": 0, "y": 0, "zoom": 0.7},
            },
        },
    }
    return yaml.dump(dsl_dict, allow_unicode=True, default_flow_style=False, sort_keys=False)
