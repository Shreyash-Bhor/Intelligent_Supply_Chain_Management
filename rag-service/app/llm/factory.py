from app.config import settings
from app.llm.base import LLMProvider
from app.llm.provider import GroqProvider

def getLLM() -> LLMProvider:
    if settings.llmProvider == "groq":
        return GroqProvider(settings.groqModel)

    raise ValueError(f"Unsupported LLM provider: {settings.llmProvider}")
