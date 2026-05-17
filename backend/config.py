import os
from pathlib import Path

try:
    from pydantic_settings import BaseSettings, SettingsConfigDict
    from pydantic import AliasChoices, Field
except ImportError:  # pragma: no cover - local fallback for environments without dependencies
    BaseSettings = object
    SettingsConfigDict = dict
    AliasChoices = None
    Field = None


class Settings(BaseSettings):
    DASHSCOPE_API_KEY: str
    DASHSCOPE_BASE_URL: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    DASHSCOPE_APP_ID: str = "b3102617f35a4ffbab5befabebdcacc4"
    ENABLE_BAILIAN_APP: bool = True
    DEEPSEEK_API_KEY: str = ""
    DEEPSEEK_BASE_URL: str = "https://api.deepseek.com"
    DEEPSEEK_V4_PRO_MODEL: str = "deepseek-v4-pro"
    DEEPSEEK_V4_FLASH_MODEL: str = "deepseek-v4-flash"
    MODEL_NAME: str = "qwen3.6-plus"
    SECRET_KEY: str = Field(default="", validation_alias=AliasChoices("SECRET_KEY", "JWT_SECRET")) if Field else ""
    REDIS_URL: str = "redis://localhost:6379/0"
    MAX_HISTORY_TOKENS: int = 6000
    AI_PROVIDER_PREFERENCE: str = "bailian_first"
    RAG_PROVIDER: str = "disabled"
    DASHSCOPE_KNOWLEDGE_BASE_ID: str = ""
    DASHSCOPE_RAG_MODEL: str = "qwen3.6-plus"
    RAG_TOP_K: int = 5
    ENABLE_LOCAL_RAG: bool = False
    EMBED_MODEL: str = "BAAI/bge-small-zh-v1.5"
    MODELSCOPE_EMBED_MODEL_PATH: str = ""
    GRAPH_PERSIST_PATH: str = "data/knowledge_graph.gpickle"
    CORS_ORIGINS: str = "http://localhost:5173"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    def __init__(self):
        if BaseSettings is object:
            self.DASHSCOPE_API_KEY = os.environ["DASHSCOPE_API_KEY"]
            self.DASHSCOPE_BASE_URL = os.getenv("DASHSCOPE_BASE_URL", self.DASHSCOPE_BASE_URL)
            self.DASHSCOPE_APP_ID = os.getenv("DASHSCOPE_APP_ID", self.DASHSCOPE_APP_ID)
            self.ENABLE_BAILIAN_APP = os.getenv("ENABLE_BAILIAN_APP", "1").lower() in {"1", "true", "yes", "on"}
            self.DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", self.DEEPSEEK_API_KEY)
            self.DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", self.DEEPSEEK_BASE_URL)
            self.DEEPSEEK_V4_PRO_MODEL = os.getenv("DEEPSEEK_V4_PRO_MODEL", self.DEEPSEEK_V4_PRO_MODEL)
            self.DEEPSEEK_V4_FLASH_MODEL = os.getenv("DEEPSEEK_V4_FLASH_MODEL", self.DEEPSEEK_V4_FLASH_MODEL)
            self.MODEL_NAME = os.getenv("MODEL_NAME", self.MODEL_NAME)
            self.SECRET_KEY = os.getenv("SECRET_KEY") or os.getenv("JWT_SECRET") or ""
            if not self.SECRET_KEY:
                raise KeyError("SECRET_KEY")
            self.REDIS_URL = os.getenv("REDIS_URL", self.REDIS_URL)
            self.MAX_HISTORY_TOKENS = int(os.getenv("MAX_HISTORY_TOKENS", str(self.MAX_HISTORY_TOKENS)))
            self.AI_PROVIDER_PREFERENCE = os.getenv("AI_PROVIDER_PREFERENCE", self.AI_PROVIDER_PREFERENCE)
            self.RAG_PROVIDER = os.getenv("RAG_PROVIDER", self.RAG_PROVIDER)
            self.DASHSCOPE_KNOWLEDGE_BASE_ID = os.getenv("DASHSCOPE_KNOWLEDGE_BASE_ID", self.DASHSCOPE_KNOWLEDGE_BASE_ID)
            self.DASHSCOPE_RAG_MODEL = os.getenv("DASHSCOPE_RAG_MODEL", self.DASHSCOPE_RAG_MODEL)
            self.RAG_TOP_K = int(os.getenv("RAG_TOP_K", str(self.RAG_TOP_K)))
            self.ENABLE_LOCAL_RAG = os.getenv("ENABLE_LOCAL_RAG", "0").lower() in {"1", "true", "yes", "on"}
            self.EMBED_MODEL = os.getenv("EMBED_MODEL", self.EMBED_MODEL)
            self.MODELSCOPE_EMBED_MODEL_PATH = os.getenv("MODELSCOPE_EMBED_MODEL_PATH", self.MODELSCOPE_EMBED_MODEL_PATH)
            self.GRAPH_PERSIST_PATH = os.getenv("GRAPH_PERSIST_PATH", self.GRAPH_PERSIST_PATH)
            self.CORS_ORIGINS = os.getenv("CORS_ORIGINS", self.CORS_ORIGINS)
        else:
            super().__init__()

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def local_embed_model_path(self) -> str:
        for candidate in (self.MODELSCOPE_EMBED_MODEL_PATH, self.EMBED_MODEL):
            value = candidate.strip()
            if not value:
                continue
            path = Path(value).expanduser()
            if path.exists():
                return str(path)
        return ""

    @property
    def bailian_app_configured(self) -> bool:
        return bool(self.ENABLE_BAILIAN_APP and self.DASHSCOPE_API_KEY and self.DASHSCOPE_APP_ID)

    @property
    def dashscope_app_base_url(self) -> str:
        return f"https://dashscope.aliyuncs.com/api/v2/apps/agent/{self.DASHSCOPE_APP_ID}/compatible-mode/v1"

    @property
    def deepseek_configured(self) -> bool:
        return bool(self.DEEPSEEK_API_KEY)

    @property
    def editing_model_configured(self) -> bool:
        return bool(self.DEEPSEEK_API_KEY or self.DASHSCOPE_API_KEY)

    @property
    def active_ai_provider(self) -> str:
        if self.AI_PROVIDER_PREFERENCE == "bailian_first" and self.bailian_app_configured:
            return "bailian_app"
        return "standard_llm"


settings = Settings()
