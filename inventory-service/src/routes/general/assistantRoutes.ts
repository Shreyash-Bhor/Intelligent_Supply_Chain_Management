import { Router } from "express";
import {
  appendAssistantTurn,
  getAssistantConversation,
} from "../../controllers/general/assistantController";

const router = Router();
router.get("/conversations/:conversationId", getAssistantConversation);
router.post("/conversations/:conversationId/turns", appendAssistantTurn);
export default router;
