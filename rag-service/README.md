# RAG service

FastAPI assistant service backed by Qdrant, sentence-transformers, and a Groq compatible API.

## Production deployment

Build the image from the repository root with `docker build -f rag-service/Dockerfile -t rag-service:latest rag-service`. Provide the required variables from `.env.example` through the deployment platform's secret and environment configuration. Do not include a `.env` file in the image or commit production credentials.

Run one worker per container by default. The embedding model is loaded lazily on the first chat request, so allow for a slower initial response and ensure the deployment can reach the Hugging Face model registry unless the model cache is preloaded in the image. For larger deployments, scale containers horizontally and keep Qdrant and the inventory/pricing services on private network paths. Set `WEB_CONCURRENCY` only after accounting for the memory cost of one embedding model per worker.

The process listens on `PORT` (default `8000`). `GET /health` is a lightweight liveness check. Chat is served at `POST /api/chat`; document ingestion is an explicit operator command, `python -m app.ingest`, and should run as a separate deployment job when the knowledge base changes.

## Local setup

Create a virtual environment, install `requirements.txt`, copy `.env.example` to `.env`, fill in service credentials, and run `uvicorn app.main:app --host 0.0.0.0 --port 8000` from this directory. Keep secrets out of source control.
