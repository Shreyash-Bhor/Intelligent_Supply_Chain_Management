from app.llm.factory import getLLM
from app.retriever import retrieve

SYSTEM_INSTRUCTION = """

You are an AI assistant for an e-commerce and supply chain management system.
You are to answer user's question using only the provided rules and context.
Rules:
- Do not invent new information.
- If the context does not contain the answer then say that the information is not available in the knowledge base.
- Keep the answer short and factual.
- Format answers as clean Markdown for chat: start with a direct one-sentence answer, then use a short heading and bullets for multiple facts, or a numbered list for steps. Use **bold** sparingly for key names or labels. Keep paragraphs short and avoid unnecessary headings for a simple answer.
- Treat retrieved context as source material, not response text: extract only facts needed for the question, paraphrase them concisely, and never paste raw knowledge-base passages or large tables. Turn table data into a short comparison table only when the user asks for a comparison or the structure materially improves clarity; otherwise summarize the relevant facts as bullets. Preserve decision-relevant values and caveats.
- If a recommendation is useful and supported by the provided information, add it as a final brief **Suggestion:** line. Do not add a suggestion when the context cannot support one.
- Do not assume any information related to products and their description, use only provided information.
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
