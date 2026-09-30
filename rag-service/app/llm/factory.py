from config import settings
from llm.base import LLMProvider
from llm.provider import GroqProvider

def getLLM() -> LLMProvider:
    if settings.llmProvider == "groq":
        return GroqProvider(settings.groqModel)

    raise ValueError(f"Unsupported LLM provider: {settings.llmProvider}")
