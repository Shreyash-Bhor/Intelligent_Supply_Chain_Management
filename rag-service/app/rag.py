from app.llm.factory import getLLM
from app.retriever import retrieve

SYSTEM_INSTRUCTION = """

You are an AI assistant for an e-commerce and supply chain management system.
You are to answer user's question using only the provided rules and context.
Rules:
- Do not invent new information.
- If the context does not contain the answer then say that the information is not available in the knowledge base.
- Keep the answer short and factual.
- Do not assume any information related to products and their description, use only provided information.
- Always give a suggestion or recommendation related to the user's original query to keep engagement.
- Use the minimum number of tool calls necessary.
- Once you have enough information to answer, stop using tools.
- Do not call a tool again for information already obtained.

The goal is to answer the user's query using information from the knowledge base. Be short and to the point.
""".strip()

def buildInput( query: str, contexts: list[dict]) -> str:
    contextText = "\n\n".join(
        item["text"]
        for item in contexts
    )

    return f"""
Context:{contextText}
User question: {query}
""".strip()

async def answer(query:str) -> str:
    if not query or not query.strip():
        raise ValueError("Query must not be empty.")

    contexts = retrieve( query= query, topK=3)

    llm = getLLM()

    return await llm.generate(
        prompt = buildInput(
            query = query,
            contexts = contexts,
        ),
        instructions = SYSTEM_INSTRUCTION
    )