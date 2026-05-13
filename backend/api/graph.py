from fastapi import APIRouter, Depends, Request

from api.auth import get_current_user_id
from api.responses import ok

router = APIRouter()


def _label_for_node(node_id: str, attrs: dict) -> str:
    for field in ("name", "title", "label", "description"):
        value = attrs.get(field)
        if isinstance(value, str) and value.strip():
            return value
    return node_id


def _description_for_node(attrs: dict) -> str:
    for field in ("abstract", "description", "domain", "field"):
        value = attrs.get(field)
        if isinstance(value, str) and value.strip():
            return value
    year = attrs.get("year")
    return str(year) if year else ""


def _position_for_index(index: int) -> dict[str, int]:
    column = index % 4
    row = index // 4
    return {"x": 80 + column * 220, "y": 80 + row * 120}


def _reference_ids(node_id: str, attrs: dict) -> list[str]:
    if attrs.get("type") == "paper":
        return [node_id]
    references = attrs.get("referenceIds")
    if isinstance(references, list):
        return [item for item in references if isinstance(item, str)]
    return []


def _serialize_graph(kg) -> dict[str, list[dict]]:
    if kg is None or not hasattr(kg, "get_graph"):
        return {"nodes": [], "edges": []}

    graph = kg.get_graph()
    if graph is None:
        return {"nodes": [], "edges": []}

    nodes = []
    for index, (node_id, attrs) in enumerate(graph.nodes(data=True)):
        nodes.append({
            "id": str(node_id),
            "label": _label_for_node(str(node_id), attrs),
            "type": str(attrs.get("type") or "concept"),
            "description": _description_for_node(attrs),
            "referenceIds": _reference_ids(str(node_id), attrs),
            "position": _position_for_index(index),
        })

    edges = []
    for index, (source, target, attrs) in enumerate(graph.edges(data=True)):
        edges.append({
            "id": str(attrs.get("id") or f"edge-{source}-{target}-{index}"),
            "source": str(source),
            "target": str(target),
            "label": str(attrs.get("rel") or attrs.get("label") or ""),
        })

    return {"nodes": nodes, "edges": edges}


@router.get("/graph")
async def get_workspace_graph(
    request: Request,
    view: str | None = None,
    user_id: str = Depends(get_current_user_id),
):
    _ = (view, user_id)
    return ok(_serialize_graph(getattr(request.app.state, "kg", None)))
