from pathlib import Path

def loadDocuments(directory: Path) -> list[dict]:
    if not directory.exists():
        raise FileNotFoundError(
            f"Knowledge Base directory not found: {directory}"
        )
    documents = []
    for filePath in directory.rglob("*.md"):
        content = filePath.read_text(encoding="utf-8").strip()

        if not content:
            continue

        documents.append({
            "fileName": filePath.name,
            "filePath": str(filePath),
            "content": content,
        })
    return documents
        