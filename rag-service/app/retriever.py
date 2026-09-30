from config import settings
from embeddings import generateEmbedding
from vectorStore import getClient

def retrieve(query: str,topK: int | None = None,)-> list[dict]:
    if not query or not query.strip():
        raise ValueError("Query must not be empty")
    
    limit = topK or settings.retrievalTopK

    if limit <= 0:
        raise ValueError("topK must be greater than 0.")

    queryVector = generateEmbedding(query)

    client = getClient()

    results = client.query_points(
        collection_name = settings.collectionName,
        query = queryVector,
        limit = limit,
        with_payload = True,
    ).points

    retrievedChunks = []

    for result in results:
        payload = result.payload or {}

        retrievedChunks.append({
            "score": result.score,
            "text": payload.get("text",""),
            "fileName": payload.get("fileName", ""),
            "filePath": payload.get("filePath", ""),
            "chunkIndex": payload.get("chunkIndex", -1),
        })

    return retrievedChunks