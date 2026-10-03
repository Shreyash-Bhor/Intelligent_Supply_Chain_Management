from functools import lru_cache
from sentence_transformers import SentenceTransformer
from app.config import settings

@lru_cache(maxsize=1)
def getEmbeddingModel() -> SentenceTransformer:
    return SentenceTransformer(
        settings.embeddingModel,
        device = settings.embeddingDevice
    )

def generateEmbedding(text: str) -> list[float]:
    if not isinstance(text, str) or not text.strip():
        raise ValueError("Text must be a non-empty string.")

    model = getEmbeddingModel()

    embedding = model.encode(
        text.strip(),
        normalize_embeddings=True,
        convert_to_numpy=True,
        show_progress_bar=False,
    )
    return embedding.tolist()

def generateEmbeddings(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    
    if any(not isinstance(text, str) or not text.strip() for text in texts):
        raise ValueError("All texts must be non empty strings.")

    model = getEmbeddingModel()

    embeddings = model.encode(
        [text.strip() for text in texts],
        normalize_embeddings=True,
        convert_to_numpy=True,
    )
    return embeddings.tolist()