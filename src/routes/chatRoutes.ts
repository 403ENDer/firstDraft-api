import { Router } from "express";
import {
  chatMessage,
  getMessages,
  getSessionsByEmail,
} from "../controllers/chatController";
import { jwtAuth } from "../middleware/jwtAuth";

const router = Router();

router.post("/message", jwtAuth, chatMessage);
router.get("/session/:sessionId", jwtAuth, getMessages);
router.get("/sessions/:email", jwtAuth, getSessionsByEmail);

export default router;
