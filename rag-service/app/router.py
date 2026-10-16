from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from app.agent import runAgent
from app.memory import getHistory, saveTurn

router = APIRouter()


class AgentRequest(BaseModel):
    query: str = Field(min_length=1, max_length=4000)
    conversationId: str | None = Field(default=None, min_length=1, max_length=128)


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

    history = getHistory(request.conversationId, accessToken)
    response = await runAgent(
        query=request.query,
        accessToken=accessToken,
        history=history,
    )
    saveTurn(request.conversationId, accessToken, request.query.strip(), response)

    return {
        "status": "success",
        "data": {
            "answer": response,
        },
    }
