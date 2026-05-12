from __future__ import annotations

from openai import OpenAI

from config import settings


EMBED_MODEL = "text-embedding-v3"


class DashScopeEmbedder:
    def __init__(self) -> None:
        self._client = OpenAI(api_key=settings.DASHSCOPE_API_KEY, base_url=settings.DASHSCOPE_BASE_URL)

    def embed(self, text: str) -> list[float]:
        response = self._client.embeddings.create(
            model=EMBED_MODEL,
            input=[text],
            encoding_format="float",
        )
        return response.data[0].embedding
