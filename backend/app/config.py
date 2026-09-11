from __future__ import annotations

"""
Centralized application settings.
Loads environment variables from .env file using Pydantic BaseSettings.
"""

from functools import lru_cache
from typing import Optional
# pyrefly: ignore [missing-import]
from pydantic import Field, AliasChoices
# pyrefly: ignore [missing-import]
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    google_generative_ai_api_key: str = Field(
        ...,
        validation_alias=AliasChoices(
            "google_generative_ai_api_key",
            "gemini_api_key",
        ),
    )
    openrouter_api_key: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices(
            "openrouter_api_key",
            "open_router_api_key",
        ),
    )
    github_personal_access_token: str = Field(
        ...,
        validation_alias=AliasChoices(
            "github_personal_access_token",
            "github_token",
        ),
    )
    supabase_url: str = Field(
        ...,
        validation_alias=AliasChoices(
            "supabase_url",
            "next_public_supabase_url",
            "vite_supabase_url",
        ),
    )
    supabase_service_role_key: str = Field(
        ...,
        validation_alias=AliasChoices(
            "supabase_service_role_key",
            "supabase_key",
            "next_public_supabase_publishable_key",
        ),
    )

    # Default target repository — can be overridden per task
    target_repo: str = "NamiraAulia/Virtual-dev-team"


@lru_cache
def get_settings() -> Settings:
    """Singleton accessor for application settings."""
    return Settings()
