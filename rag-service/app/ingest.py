from pathlib import Path
import uuid

from qdrant_client.models import PointStruct

from config import settings
from documentLoader import loadDocuments
from chunker import createChunks
from embeddings import generateEmbeddings
from vectorStore import createCollection, getClient

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
            id = str(uuid.uuid4()),
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