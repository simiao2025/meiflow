from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # API Keys
    OPENAI_API_KEY: str | None = None
    ANTHROPIC_API_KEY: str | None = None
    GOOGLE_API_KEY: str | None = None

    # Evolution API (WhatsApp)
    EVOLUTION_API_URL: str = "https://evolution-api.brasilonthebox.shop"
    EVOLUTION_API_KEY: str = "abcslirm2026"

    # Supabase
    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Default Models
    DEFAULT_LLM_PROVIDER: str = "openai" # "openai", "anthropic", "google"
    DEFAULT_LLM_MODEL: str = "gpt-4o"

    class Config:
        env_file = ".env"

settings = Settings()
