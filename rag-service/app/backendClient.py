from typing import Any

import httpx


class BackendClient:
    def __init__(
        self,
        baseUrl: str,
        accessToken: str | None = None,
    ) -> None:
        self.accessToken = accessToken
        self.client = httpx.AsyncClient(
            base_url=baseUrl,
            timeout=httpx.Timeout(
                connect=5.0,
                read=15.0,
                write=10.0,
                pool=5.0,
            ),
            limits=httpx.Limits(
                max_connections=100,
                max_keepalive_connections=20,
            ),
        )

    def _getHeaders(self) -> dict[str, str]:
        headers = {"Accept": "application/json"}

        if self.accessToken:
            headers["Authorization"] = f"Bearer {self.accessToken}"

        return headers

    async def get(
        self,
        path: str,
        params: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        response = await self.client.get(
            path,
            params=params,
            headers=self._getHeaders(),
        )
        response.raise_for_status()
        return response.json()

    async def close(self) -> None:
        await self.client.aclose()

    async def __aenter__(self):
        return self

    async def __aexit__(self, excType, excValue, traceback):
        await self.close()