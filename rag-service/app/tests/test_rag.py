import asyncio
from rag import answer

query = "What happens when inventory falls below the reorder threshold?"

response = asyncio.run(answer(query))

print("\nAnswer:")
print(response)