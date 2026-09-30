from functools import lru_cache

from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams

from config import settings

@lru_cache(maxsize=1)
def getClient() -> QdrantClient:
    return QdrantClient(
        url=settings.qdrantUrl,
        api_key=settings.qdrantApiKey,
    )

def createCollection():
    client = getClient()
    existingCollections = {
        collection.name
        for collection in client.get_collections().collections
    }

    if settings.collectionName in existingCollections:
        return
    
    client.create_collection(
        collection_name= settings.collectionName,
        vectors_config = VectorParams(
            size=settings.embeddingDimension,
            distance=Distance.COSINE,
        )
    )
