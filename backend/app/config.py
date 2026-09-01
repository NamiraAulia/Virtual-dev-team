"""
Centralized application settings.
Loads environment variables from .env file using Pydantic BaseSettings.
"""

from functools import lru_cache
# pyrefly: ignore [missing-import]
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    google_generative_ai_api_key: str
    github_personal_access_token: str
    supabase_url: str
    supabase_service_role_key: str

    # Default target repository — can be overridden per task
    target_repo: str = "NamiraAulia/Virtual-dev-team"


@lru_cache
def get_settings() -> Settings:
    """Singleton accessor for application settings."""
    return Settings()
