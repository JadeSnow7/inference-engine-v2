import os

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
    MODEL_NAME: str = "qwen3.6-plus"
    SECRET_KEY: str = Field(default="", validation_alias=AliasChoices("SECRET_KEY", "JWT_SECRET")) if Field else ""
    REDIS_URL: str = "redis://localhost:6379/0"
    MAX_HISTORY_TOKENS: int = 6000
    EMBED_MODEL: str = "BAAI/bge-small-zh-v1.5"
    GRAPH_PERSIST_PATH: str = "data/knowledge_graph.gpickle"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    def __init__(self):
        if BaseSettings is object:
            self.DASHSCOPE_API_KEY = os.environ["DASHSCOPE_API_KEY"]
            self.DASHSCOPE_BASE_URL = os.getenv("DASHSCOPE_BASE_URL", self.DASHSCOPE_BASE_URL)
            self.MODEL_NAME = os.getenv("MODEL_NAME", self.MODEL_NAME)
            self.SECRET_KEY = os.getenv("SECRET_KEY") or os.getenv("JWT_SECRET") or ""
            if not self.SECRET_KEY:
                raise KeyError("SECRET_KEY")
            self.REDIS_URL = os.getenv("REDIS_URL", self.REDIS_URL)
            self.MAX_HISTORY_TOKENS = int(os.getenv("MAX_HISTORY_TOKENS", str(self.MAX_HISTORY_TOKENS)))
            self.EMBED_MODEL = os.getenv("EMBED_MODEL", self.EMBED_MODEL)
            self.GRAPH_PERSIST_PATH = os.getenv("GRAPH_PERSIST_PATH", self.GRAPH_PERSIST_PATH)
        else:
            super().__init__()


settings = Settings()
