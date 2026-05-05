from __future__ import annotations
"""Auto-layout calculator for Dify workflow nodes."""
from dataclasses import dataclass, field


@dataclass
class LayoutConfig:
    start_x: int = 80
    start_y: int = 282
    spacing_x: int = 300
    spacing_y: int = 200
    branch_offset_y: int = 150


class LayoutCalculator:
    def __init__(self, config: LayoutConfig | None = None):
        self.config = config or LayoutConfig()

    def calculate(self, node_ids: list[str], branch_targets: dict | None = None) -> dict[str, tuple[int, int]]:
        """Calculate positions for nodes, with vertical offsets for if-else branches."""
        branch_targets = branch_targets or {}
        positions = {}

        # First pass: assign horizontal columns via BFS
        # Build adjacency from edges (we only have node_ids, so use branch_targets)
        column_map: dict[str, int] = {}
        if node_ids:
            column_map[node_ids[0]] = 0

        # Simple sequential assignment as baseline
        for i, nid in enumerate(node_ids):
            if nid not in column_map:
                column_map[nid] = i

        # Refine columns: branch targets should be in the column after if-else
        for ie_id, branches in branch_targets.items():
            ie_col = column_map.get(ie_id, 0)
            next_col = ie_col + 1
            for branch_list in branches.values():
                for target_id in branch_list:
                    if target_id in column_map:
                        column_map[target_id] = max(column_map[target_id], next_col)

        # Assign y-offsets for branch targets
        y_offsets: dict[str, int] = {}
        for ie_id, branches in branch_targets.items():
            ie_y = self.config.start_y
            true_targets = branches.get("true", [])
            false_targets = branches.get("false", [])

            for i, tid in enumerate(true_targets):
                y_offsets[tid] = -self.config.branch_offset_y * (i + 1)
            for i, fid in enumerate(false_targets):
                y_offsets[fid] = self.config.branch_offset_y * (i + 1)

        for nid in node_ids:
            col = column_map.get(nid, 0)
            x = self.config.start_x + col * self.config.spacing_x
            y = self.config.start_y + y_offsets.get(nid, 0)
            positions[nid] = (x, y)

        return positions
