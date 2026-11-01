import os

from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

def getRequiredEnv(name: str) -> str:
    value = os.getenv(name)

    if not value:
        raise RuntimeError(f"Required environment variable '{name}' is not set.")

    return value

class Settings:
    #Qdrant
    qdrantUrl: str = getRequiredEnv("QDRANT_URL")
    qdrantApiKey: str | None = os.getenv("QDRANT_API_KEY")
    # Keep provider-specific vectors isolated from collections created with local models.
    collectionName: str = os.getenv(
        "COLLECTION_NAME", "supply-chain-knowledge-cloudflare-bge-small-en-v1-5"
    )

    #Embeddings
    embeddingProvider: str = os.getenv("EMBEDDING_PROVIDER", "cloudflare")
    embeddingModel: str = os.getenv(
        "EMBEDDING_MODEL", "@cf/baai/bge-small-en-v1.5"
    )
    embeddingDimension: int = int(os.getenv("EMBEDDING_DIMENSION", "384"))
    cloudflareAccountId: str = os.getenv("CLOUDFLARE_ACCOUNT_ID", "")
    cloudflareApiToken: str = os.getenv("CLOUDFLARE_API_TOKEN", "")
    embeddingBatchSize: int = int(os.getenv("EMBEDDING_BATCH_SIZE", "100"))

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
    maxAgentIterations: int = int(os.getenv("MAX_AGENT_ITERATIONS", "10"))
    maxShoppingAgentIterations: int = int(os.getenv("MAX_SHOPPING_AGENT_ITERATIONS", "20"))

    #Backend Client
    inventoryServiceUrl: str = getRequiredEnv("INVENTORY_SERVICE_URL")
    pricingServiceUrl: str = getRequiredEnv("PRICING_SERVICE_URL")
    authTokenSecret: str = getRequiredEnv("AUTH_TOKEN_SECRET")

settings = Settings()
if settings.embeddingProvider != "cloudflare":
    raise RuntimeError("EMBEDDING_PROVIDER must be 'cloudflare'.")
if settings.embeddingModel != "@cf/baai/bge-small-en-v1.5":
    raise RuntimeError("EMBEDDING_MODEL must be '@cf/baai/bge-small-en-v1.5'.")
if settings.embeddingDimension != 384:
    raise RuntimeError("EMBEDDING_DIMENSION must be 384 for the configured model.")
if not settings.cloudflareAccountId:
    raise RuntimeError("Required environment variable 'CLOUDFLARE_ACCOUNT_ID' is not set.")
if not settings.cloudflareApiToken:
    raise RuntimeError("Required environment variable 'CLOUDFLARE_API_TOKEN' is not set.")
if settings.embeddingBatchSize <= 0:
    raise RuntimeError("EMBEDDING_BATCH_SIZE must be greater than 0.")
if not settings.collectionName.endswith("-cloudflare-bge-small-en-v1-5"):
    raise RuntimeError(
        "COLLECTION_NAME must identify a Cloudflare BGE collection and end with "
        "'-cloudflare-bge-small-en-v1-5' to prevent mixing embedding providers."
    )
