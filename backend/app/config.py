from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Reads environment variables from a .env file in the backend root.
    All values are required — the app will fail fast on startup
    if any are missing.
    """

    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str     # anon/public key — used by frontend + smoke tests
    SUPABASE_SERVICE_KEY: str  # service_role key — never expose to clients
    SUPABASE_JWT_SECRET: str   # JWT secret from Supabase Settings → API
    ALLOWED_ORIGINS: str = "http://localhost:5173"  # comma-separated in prod

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",        # silently ignore any unrecognised env vars
    )


# Single settings instance shared across the application
settings = Settings()