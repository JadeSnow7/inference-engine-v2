def format_rag_context(papers: list[dict], gaps: list[dict]) -> str:
    paper_lines = [f"- {item['title']}（{item['year']}，相关度 {item.get('score', 0):.2f}）" for item in papers]
    gap_lines = [f"- {item['description']}（严重度 {item['severity']}）" for item in gaps]
    return "相关论文：\n" + ("\n".join(paper_lines) or "- 暂无") + "\n\n研究空白：\n" + ("\n".join(gap_lines) or "- 暂无")


def teaching_style_hint(style: str) -> str:
    mapping = {
        "step_by_step": "只给大纲框架，不代写正文",
        "directional": "每节附 2-3 句写作方向提示",
        "rewrite_first": "每节给一句示例开头供用户参考修改",
    }
    return mapping.get(style, mapping["directional"])

