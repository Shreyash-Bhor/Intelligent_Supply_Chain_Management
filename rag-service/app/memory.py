"""Small, process-local conversation memory for follow-up questions."""

from collections import OrderedDict
from hashlib import sha256
from time import time

MAX_CONVERSATIONS = 2_000
MAX_MESSAGES = 12
MEMORY_TTL_SECONDS = 60 * 60
_conversations: OrderedDict[str, tuple[float, list[dict[str, str]]]] = OrderedDict()


def _key(conversationId: str, accessToken: str | None) -> str:
    return sha256(f"{accessToken or 'anonymous'}:{conversationId}".encode()).hexdigest()


def getHistory(conversationId: str | None, accessToken: str | None) -> list[dict[str, str]]:
    if not conversationId:
        return []
    key = _key(conversationId, accessToken)
    entry = _conversations.get(key)
    if not entry:
        return []
    updatedAt, messages = entry
    if time() - updatedAt > MEMORY_TTL_SECONDS:
        del _conversations[key]
        return []
    _conversations.move_to_end(key)
    return list(messages)


def saveTurn(conversationId: str | None, accessToken: str | None, query: str, answer: str) -> None:
    if not conversationId:
        return
    key = _key(conversationId, accessToken)
    messages = getHistory(conversationId, accessToken)
    messages.extend([{"role": "user", "content": query}, {"role": "assistant", "content": answer}])
    _conversations[key] = (time(), messages[-MAX_MESSAGES:])
    _conversations.move_to_end(key)
    while len(_conversations) > MAX_CONVERSATIONS:
        _conversations.popitem(last=False)
