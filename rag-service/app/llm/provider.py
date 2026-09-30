from openai import AsyncOpenAI

from config import settings
from llm.base import LLMProvider

class GroqProvider(LLMProvider):
    def __init__(self, model: str | None = None, ):
        self.model = model or settings.groqModel

        self.client = AsyncOpenAI(
            api_key = settings.groqApiKey,
            base_url = settings.groqBaseUrl,
        )

    async def generate(self, prompt: str, instructions: str | None = None) -> str:
        if not prompt or not prompt.strip():
            raise ValueError("Prompt must not be empty.")

        response = await self.client.responses.create(
            model = self.model,
            instructions = instructions,
            input = prompt,
        )
        content = response.output_text

        if not content:
            raise RuntimeError("LLM returned an empty response")

        return content.strip()