from fastapi import APIRouter, Depends, Request

from api.auth import get_current_user_id
from api.responses import ok
from store.redis_store import RedisCourseStore

router = APIRouter()


def _course_store(request: Request) -> RedisCourseStore:
    return request.app.state.course_store


def _course_meta(space: dict) -> str:
    topic = space.get("topic") or "未设置研究主题"
    literature_count = space.get("literatureCount") or 0
    return f"研究主题：{topic} · {literature_count} 篇文献"


@router.get("/dashboard/summary")
async def get_dashboard_summary(
    request: Request,
    user_id: str = Depends(get_current_user_id),
):
    spaces = await _course_store(request).list_research_spaces(user_id)
    evidence_sources = sum(int(space.get("literatureCount") or 0) for space in spaces)
    graph_updates = sum(int(space.get("graphUpdates") or 0) for space in spaces)
    norm_reminders = sum(1 for space in spaces if "规范" in str(space.get("status", "")) or "引用" in str(space.get("status", "")))

    tasks = [
        {
            "id": f"task-{space.get('id')}",
            "title": f"推进 {space.get('title', '研究空间')} 的写作任务",
            "meta": f"{space.get('status', '待处理')} · {space.get('graphUpdates', 0)} 个图谱更新",
            "target": "/workbench",
        }
        for space in spaces[:3]
    ]

    recent_courses = [
        {
            "id": space.get("id"),
            "title": space.get("title"),
            "meta": _course_meta(space),
        }
        for space in spaces[:2]
    ]

    recent_documents = [
        {
            "id": f"document-{space.get('id')}",
            "title": (space.get("material") or {}).get("title") or space.get("title"),
            "meta": f"{(space.get('material') or {}).get('type', '课程材料')} · {space.get('status', '最近更新')}",
        }
        for space in spaces[:3]
    ]

    return ok({
        "metrics": {
            "documentBlocks": 0,
            "evidenceSources": evidence_sources,
            "graphUpdates": graph_updates,
            "normReminders": norm_reminders,
        },
        "focus": {
            "title": spaces[0].get("topic") if spaces else "暂无研究焦点",
            "summary": spaces[0].get("status") if spaces else "课程研究空间载入后会显示当前研究焦点。",
            "tags": ["进行中", "课程研究"] if spaces else [],
        },
        "tasks": tasks,
        "recentCourses": recent_courses,
        "recentDocuments": recent_documents,
    })
