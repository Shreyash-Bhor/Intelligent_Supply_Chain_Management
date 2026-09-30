from langchain_text_splitters import RecursiveCharacterTextSplitter

splitter = RecursiveCharacterTextSplitter(
    chunk_size = 600,
    chunk_overlap = 100,
    separators=[
        "\n## ",
        "\n### ",
        "\n\n",
        "\n",
        ". ",
        " ",
    ],
)

def createChunks(documents: list[dict]) -> list[dict]:
    chunks=[]

    for document in documents:
        documentChunks = splitter.split_text(
            document["content"]
        )

        for index, text in enumerate(documentChunks):
            chunks.append({
                "text": text,
                "fileName": document["fileName"],
                "filePath": document["filePath"],
                "chunkIndex": index,
            })
    return chunks