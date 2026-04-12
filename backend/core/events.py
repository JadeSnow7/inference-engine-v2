import json
from dataclasses import asdict, dataclass
from enum import Enum


class EventType(str, Enum):
    STAGE = "stage"
    PAPERS = "papers"
    GAPS = "gaps"
    TOKEN = "token"
    DONE = "done"
    ERROR = "error"


@dataclass
class SSEEvent:
    type: str
    content: str = ""
    stage: str = ""
    data: object = None


def fmt(event: SSEEvent) -> str:
    return f"data: {json.dumps(asdict(event), ensure_ascii=False)}\n\n"


def extract_token(raw_sse: str) -> str:
    try:
        ev = json.loads(raw_sse.removeprefix("data: ").strip())
        if ev.get("type") == EventType.TOKEN:
            return ev.get("content", "")
    except Exception:
        pass
    return ""

