from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from app.agent import runAgent

router = APIRouter()


class AgentRequest(BaseModel):
    query: str


@router.post("/chat")
async def chat(
    request: AgentRequest,
    authorization: str | None = Header(default=None),
):
    if not request.query.strip():
        raise HTTPException(
            status_code=400,
            detail="Query must not be empty.",
        )

    accessToken = None

    if authorization:
        scheme, _, token = authorization.partition(" ")

        if scheme.lower() != "bearer" or not token:
            raise HTTPException(
                status_code=401,
                detail="Invalid authorization header.",
            )

        accessToken = token

    response = await runAgent(
        query=request.query,
        accessToken=accessToken,
    )

    return {
        "status": "success",
        "data": {
            "answer": response,
        },
    }