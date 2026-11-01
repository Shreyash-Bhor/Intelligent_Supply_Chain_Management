# RAG service

FastAPI assistant service backed by Qdrant, Cloudflare Workers AI embeddings, and a Groq compatible API.

## Production deployment

Build the image from the repository root with `docker build -f rag-service/Dockerfile -t rag-service:latest rag-service`. Provide the required variables from `.env.example` through the deployment platform's secret and environment configuration. Do not include a `.env` file in the image or commit production credentials.

Embedding requests use Cloudflare Workers AI's REST API for `@cf/baai/bge-small-en-v1.5`; no model weights or local ML runtime are loaded into Render memory. Configure `EMBEDDING_PROVIDER=cloudflare`, `EMBEDDING_MODEL=@cf/baai/bge-small-en-v1.5`, `EMBEDDING_DIMENSION=384`, `CLOUDFLARE_ACCOUNT_ID`, and `CLOUDFLARE_API_TOKEN` in the deployment environment. Keep the API token secret. `EMBEDDING_BATCH_SIZE` defaults to 100 and can be lowered if needed.

Set `COLLECTION_NAME=supply-chain-knowledge-cloudflare-bge-small-en-v1-5` (the default) to keep Cloudflare vectors separate from the previous Sentence Transformers collection. Do not point this service at the old collection: matching dimensions do not make vectors from different models compatible. Once the environment is configured, re-embed and upsert the checked-in knowledge base from `rag-service` with `python -m app.ingest`. Ingestion preserves the existing text and metadata fields and uses stable chunk IDs so reruns update the same points.

Run one worker per container by default. For larger deployments, scale containers horizontally and keep Qdrant and the inventory/pricing services on private network paths.

The process listens on `PORT` (default `8000`). `GET /health` is a lightweight liveness check. Chat is served at `POST /api/chat`; document ingestion is an explicit operator command, `python -m app.ingest`, and should run as a separate deployment job when the knowledge base changes.

## Local setup

Create a virtual environment, install `requirements.txt`, copy `.env.example` to `.env`, fill in service credentials, and run `uvicorn app.main:app --host 0.0.0.0 --port 8000` from this directory. Keep secrets out of source control.

Cloudflare credentials are required at startup. The free Workers AI plan has usage limits; ingestion can be rerun safely after an interrupted run.
