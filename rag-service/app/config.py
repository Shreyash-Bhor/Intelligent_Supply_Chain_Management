import os

from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

def getRequiredEnv(name: str) -> str:
    value = os.getenv(name)

    if not value:
        return RuntimeError(f"Required environment variable '{name}' is not set.")

    return value

class Settings:
    #Qdrant
    qdrantUrl: str = getRequiredEnv("QDRANT_URL")
    qdrantApiKey: str | None = os.getenv("QDRANT_API_KEY")
    collectionName: str = getRequiredEnv("COLLECTION_NAME")

    #Embeddings
    embeddingModel: str = getRequiredEnv("EMBEDDING_MODEL")
    embeddingDimension: int = int(getRequiredEnv("EMBEDDING_DIMENSION"))
    embeddingDevice: str = os.getenv("EMBEDDING_DEVICE","cpu")

    #LLM
    llmProvider: str = os.getenv("LLM_PROVIDER","groq")
    groqApiKey: str = getRequiredEnv("GROQ_API_KEY")
    groqBaseUrl: str = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")
    groqModel: str = getRequiredEnv("GROQ_MODEL")
    llmTemperature: float = float(os.getenv("LLM_TEMPERATURE","0.2"))

    #RAG
    retrievalTopK: int = int(os.getenv("RETRIEVAL_TOP_K", "5"))
    knowledgeBaseDirectory: Path = Path(os.getenv("KNOWLEDGE_BASE_DIRECTORY","knowledge_base"))

    #Agent
    maxAgentIterations: int = int(os.getenv("MAX_AGENT_ITERATIONS", "5"))

settings = Settings()