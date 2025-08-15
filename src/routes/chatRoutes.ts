import { Router } from "express";
import { chatMessage, getMessages } from "../controllers/chatController";
import { jwtAuth } from "../middleware/jwtAuth";

const router = Router();

router.post("/message", jwtAuth, chatMessage);
router.get("/session/:sessionId", jwtAuth, getMessages);
router.get(
  "/sessions/:email",
  jwtAuth,
  require("../controllers/chatController").getSessionsByEmail
);

export default router;
