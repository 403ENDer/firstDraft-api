import { Router } from "express";
import { chatMessage, getMessages } from "../controllers/chatController";

const router = Router();

router.post("/message", chatMessage);
router.get("/messages/:sessionId", getMessages);

export default router;
