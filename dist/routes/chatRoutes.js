"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const chatController_1 = require("../controllers/chatController");
const jwtAuth_1 = require("../middleware/jwtAuth");
const router = (0, express_1.Router)();
router.post("/message", jwtAuth_1.jwtAuth, chatController_1.chatMessage);
router.get("/session/:sessionId", jwtAuth_1.jwtAuth, chatController_1.getMessages);
router.get("/sessions/:email", jwtAuth_1.jwtAuth, chatController_1.getSessionsByEmail);
exports.default = router;
//# sourceMappingURL=chatRoutes.js.map