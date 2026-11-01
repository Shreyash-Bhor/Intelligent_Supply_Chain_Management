from pathlib import Path
import uuid

from qdrant_client.models import PointStruct

from app.config import settings
from app.documentLoader import loadDocuments
from app.chunker import createChunks
from app.embeddings import generateEmbeddings
from app.vectorStore import createCollection, getClient

def ingest():
    createCollection()

    documents = loadDocuments(
        Path(settings.knowledgeBaseDirectory)
    )

    print(f"Documents found: {len(documents)}")

    chunks = createChunks(documents)

    print(f"Chunks created: {len(chunks)}")

    if not chunks:
        print("No chunks to ingest.")
        return

    texts = [chunk["text"] for chunk in chunks]
    vectors = generateEmbeddings(texts)

    points = [
        PointStruct(
            # Stable IDs make re-ingestion an upsert instead of duplicating chunks.
            id = str(uuid.uuid5(
                uuid.NAMESPACE_URL,
                f"{chunk['filePath']}::{chunk['chunkIndex']}::{chunk['text']}",
            )),
            vector = vector,
            payload = {
                "text": chunk["text"],
                "fileName": chunk["fileName"],
                "filePath": chunk["filePath"],
                "chunkIndex": chunk["chunkIndex"],
            },
        )
        for chunk, vector in zip(chunks, vectors)
    ]

    client = getClient()

    client.upsert(
        collection_name = settings.collectionName,
        points = points,
        wait=True,
    )
    print(f"Successfully ingested {len(points)} chunks.")

if __name__ == "__main__":
    ingest()
