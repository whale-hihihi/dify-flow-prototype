from __future__ import annotations
"""Map declarative IDs (start_1) to Dify-compatible 13-digit timestamp IDs."""
import time


class IdMapper:
    def __init__(self):
        self._map: dict[str, str] = {}
        self._counter = 0

    def map_id(self, declarative_id: str) -> str:
        if declarative_id not in self._map:
            self._map[declarative_id] = self._generate()
        return self._map[declarative_id]

    def map_edge_source_target(self, source: str, target: str) -> tuple[str, str]:
        return (self.map_id(source), self.map_id(target))

    def __getitem__(self, declarative_id: str) -> str:
        return self._map[declarative_id]

    def _generate(self) -> str:
        self._counter += 1
        return str(int(time.time() * 1000) + self._counter)
