from langchain_anthropic import ChatAnthropic
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI
from langchain_groq import ChatGroq

from .config import settings


class LLMFactory:
    @staticmethod
    def get_model(provider: str = None, model_name: str = None, temperature: float = 0.7):
        provider = provider or settings.DEFAULT_LLM_PROVIDER

        if provider == "openai":
            return ChatOpenAI(
                model=model_name or "gpt-4o",
                temperature=temperature,
                api_key=settings.OPENAI_API_KEY
            )
        elif provider == "anthropic":
            return ChatAnthropic(
                model=model_name or "claude-3-5-sonnet-20240620",
                temperature=temperature,
                api_key=settings.ANTHROPIC_API_KEY
            )
        elif provider == "google":
            return ChatGoogleGenerativeAI(
                model=model_name or "gemini-1.5-pro",
                temperature=temperature,
                google_api_key=settings.GOOGLE_API_KEY
            )
        elif provider == "groq":
            return ChatGroq(
                model=model_name or "llama-3.3-70b-versatile",
                temperature=temperature,
                api_key=settings.GROQ_API_KEY
            )
        else:
            raise ValueError(f"Provedor de LLM desconhecido: {provider}")
