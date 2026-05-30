from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # API Keys
    OPENAI_API_KEY: str | None = None
    ANTHROPIC_API_KEY: str | None = None
    GOOGLE_API_KEY: str | None = None
    GROQ_API_KEY: str | None = None

    # Evolution API (WhatsApp)
    EVOLUTION_API_URL: str = ""
    EVOLUTION_API_KEY: str = ""

    # ElevenLabs (TTS)
    ELEVENLABS_API_KEY: str = ""

    # Webhook Security
    WEBHOOK_SECRET_TOKEN: str = "meiflow-webhook-2026"
    ASAAS_WEBHOOK_TOKEN: str = ""

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
        extra = "ignore"

settings = Settings()
