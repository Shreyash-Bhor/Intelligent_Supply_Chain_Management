from rag import answer

async def runAgent(query: str) -> str:
    if not query or not query.strip():
        return ValueError("Query must not be empty")

    return await answer(query.strip())