import os

from pydantic_settings import BaseSettings, SettingsConfigDict

# Load base .env first, then overlay the environment-specific file.
# DEPLOY_ENV must be set before the process starts (e.g. in docker-compose or CI).
_DEPLOY_ENV = os.getenv("DEPLOY_ENV", "development")
_ENV_FILES = (".env", f".env.{_DEPLOY_ENV}")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_ENV_FILES,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Deployment tier — carried through so code can inspect it at runtime
    DEPLOY_ENV: str = _DEPLOY_ENV

    # GCP / BigQuery
    GCP_PROJECT_ID: str = ""
    GCP_CLIENT_EMAIL: str = ""
    GCP_PRIVATE_KEY: str = ""
    BQ_DATASET: str = ""
    BQ_TABLE: str = ""

    # Anthropic
    ANTHROPIC_API_KEY: str

    # Redis
    REDIS_URL: str = ""

    # Runtime
    LOG_LEVEL: str = "info"
    NODE_ENV: str = "production"


settings = Settings()
