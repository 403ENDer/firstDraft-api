"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMessages = exports.getSessionsByEmail = exports.chatMessage = void 0;
const ChatSession_1 = require("../models/ChatSession");
const llm_1 = require("../repositories/llm");
// This is a new function to handle retries with exponential backoff
const retryWithExponentialBackoff = async (func, retries = 3, delay = 1000) => {
    for (let i = 0; i < retries; i++) {
        try {
            return await func();
        }
        catch (error) {
            if (error.status === 503 && i < retries - 1) {
                console.warn(`[503 Service Unavailable] Retrying in ${delay}ms...`);
                await new Promise((resolve) => setTimeout(resolve, delay));
                delay *= 2;
            }
            else {
                throw error;
            }
        }
    }
};
const chatMessage = async (req, res) => {
    const { message, sessionId, email, sessionTitle } = req.body;
    if (!message || !sessionId || !email) {
        return res
            .status(400)
            .json({ message: "Message, sessionId, and email are required" });
    }
    try {
        const llm = new llm_1.LLM();
        const response = await llm.processUserInput(message, sessionId);
        // Parse the JSON response and extract the result
        if (response.error) {
            return res.status(500).json({ message: response.error });
        }
        // Ensure we have a result
        if (!response.result) {
            return res
                .status(500)
                .json({ message: "No response generated from AI model" });
        }
        const assistantReply = typeof response.result === "string"
            ? response.result
            : JSON.stringify(response.result);
        // Validate that the response is not empty
        if (!assistantReply ||
            assistantReply.trim() === "" ||
            assistantReply === "null" ||
            assistantReply === "undefined") {
            return res
                .status(500)
                .json({ message: "AI model generated an empty response" });
        }
        // Log response details for debugging
        console.log("Processing response:", {
            workflow: response.workflow,
            classification: response.classification,
            resultType: typeof response.result,
            assistantReplyLength: assistantReply.length,
        });
        // Find or create session
        let session = await ChatSession_1.ChatSession.findOne({ sessionId });
        if (!session) {
            // Create new session with userId (email)
            session = new ChatSession_1.ChatSession({
                sessionId,
                userId: email,
                sessionTitle: sessionTitle || "New Chat",
                messages: [
                    { role: "user", content: message.trim(), timestamp: new Date() },
                    { role: "assistant", content: assistantReply, timestamp: new Date() },
                ],
            });
        }
        else {
            // Add to existing session
            session.messages.push({ role: "user", content: message.trim(), timestamp: new Date() }, { role: "assistant", content: assistantReply, timestamp: new Date() });
        }
        // Validate the session before saving
        try {
            await session.save();
        }
        catch (saveError) {
            console.error("Failed to save chat session:", saveError);
            return res.status(500).json({ message: "Failed to save chat session" });
        }
        res.json({ response: assistantReply, sessionId });
    }
    catch (error) {
        console.error("Error generating or parsing content:", error);
        res
            .status(500)
            .json({ message: "Failed to generate a structured response." });
    }
};
exports.chatMessage = chatMessage;
const getSessionsByEmail = async (req, res) => {
    const { email } = req.params;
    if (!email) {
        return res.status(400).json({ message: "email is required" });
    }
    try {
        const sessions = await ChatSession_1.ChatSession.find({ userId: email }).select("sessionId userId messages.timestamp sessionTitle");
        res.json({ email, sessions });
    }
    catch (error) {
        console.error("Error fetching sessions by email:", error);
        res.status(500).json({ message: "Failed to fetch sessions." });
    }
};
exports.getSessionsByEmail = getSessionsByEmail;
const getMessages = async (req, res) => {
    const { sessionId } = req.params;
    if (!sessionId) {
        return res.status(400).json({ message: "sessionId is required" });
    }
    try {
        const session = await ChatSession_1.ChatSession.findOne({ sessionId });
        if (!session) {
            return res.status(404).json({ message: "Session not found" });
        }
        res.json({ sessionId, messages: session.messages });
    }
    catch (error) {
        console.error("Error fetching messages:", error);
        res.status(500).json({ message: "Failed to fetch messages." });
    }
};
exports.getMessages = getMessages;
//# sourceMappingURL=chatController.js.map