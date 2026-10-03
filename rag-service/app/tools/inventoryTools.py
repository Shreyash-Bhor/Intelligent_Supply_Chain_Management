from typing import Any
from app.backendClient import BackendClient

async def getAllInventory(backendClient: BackendClient) -> dict[str, Any]:
    return await backendClient.get("/api/inventory")

async def getInventoryDetails(backendClient: BackendClient, inventoryId: str) -> dict[str, Any]:
    if not inventoryId or not inventoryId.strip():
        raise ValueError("inventoryId must not be empty.")

    return await backendClient.get(f"/api/inventory/{inventoryId}")