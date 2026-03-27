from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

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
