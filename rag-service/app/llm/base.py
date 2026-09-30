from abc import ABC, abstractmethod

class LLMProvider(ABC):
    @abstractmethod
    async def generate(self, prompt: str, instructions: str | None = None) -> str:
        raise NotImplementedError