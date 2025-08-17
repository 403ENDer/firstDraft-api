import { Request, Response } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ChatSession } from "../models/ChatSession";

// This is a new function to handle retries with exponential backoff
const retryWithExponentialBackoff = async (
  func: () => Promise<any>,
  retries = 3,
  delay = 1000
) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await func();
    } catch (error: any) {
      if (error.status === 503 && i < retries - 1) {
        console.warn(`[503 Service Unavailable] Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2; // Double the delay for the next retry
      } else {
        throw error; // Re-throw the error if it's not a 503 or we've run out of retries
      }
    }
  }
};

export const chatMessage = async (req: Request, res: Response) => {
  const { message, sessionId, email, sessionTitle } = req.body;
  if (!message || !sessionId || !email) {
    return res
      .status(400)
      .json({ message: "Message, sessionId, and email are required" });
  }

  // The prompt is updated to explicitly request a JSON object with specific keys.
  const prompt = `Act like an elite AI prompt architect and cinematic content director with expert-level mastery in OpenAI prompt engineering and Google VEO3 video generation. Your task is to do the following:

1. If the user's request relates to creating a VEO3-optimized prompt for cinematic video script generation:
   a. Follow the systematic multi-phase process described in the "AI-Powered Cinematic Video Script Generator" framework, integrating the best practices from OpenAI's prompt engineering guide.
   b. Extract and analyze the given concept, feature description, or idea. If the user has not provided sufficient detail, think creatively to infer plausible, contextually relevant details while maintaining narrative coherence.
   c. Develop an 8-chunk cinematic sequence, where each chunk includes:
      - B-roll description (with vivid, realistic, and varied environments, avoiding repetition of roles or settings).
      - Voiceover script (1–2 sentences, emotionally engaging, conversational tone).
      - Specific scene-setting details: time of day, location, character actions, camera angles, ambient sounds.
      - Explicit "do not include" constraints to prevent unwanted AI generation errors (e.g., no captions, no direct-to-camera looks, avoid out-of-place gestures).
      - Cinematic style notes: lighting, mood, pacing, and diversity.
   d. Format your VEO3 prompts in the structure:
   Setting → Action → Camera/Angle → Audio → Don'ts → Style
   e. Apply VEO3 technical mastery: character consistency, scene flow, and realism.
   f. Ensure your script is ready for immediate VEO3 input without manual editing.

2. If the user's request is unrelated to VEO3 prompt generation:
   - Simply answer the question in full, using the clearest, most complete, and relevant explanation possible.
   - Follow the principles of clarity, completeness, and persona alignment from the OpenAI prompt engineering guide.

3. Always:
   - Ask for missing critical details when necessary, but if unavailable, use logical inference and creative expansion to maintain output quality.
   - Think step-by-step, reasoning internally before producing the final output.
   - Ensure final outputs are long, rich in detail, and professionally structured.

Take a deep breath and work on this problem step-by-step.

User message: ${message}

Your output should be a valid json format.
Json example:
{
  "steps": ["List of steps you have taken to process"],
  "result": "Result of the process as a string"
}`;

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const generationConfig = {
    responseMimeType: "application/json",
  };

  const chatHistory = await ChatSession.findOne({ sessionId });
  const historyContents =
    chatHistory?.messages.slice(-4).map((m) => ({
      role: m.role,
      parts: [{ text: m.content }],
    })) || [];

  const contents = [
    ...historyContents,
    { role: "user", parts: [{ text: prompt }] },
  ];

  try {
    const result = await retryWithExponentialBackoff(() =>
      model.generateContent({
        contents,
        generationConfig,
      })
    );

    // Parse the JSON response and extract the result
    const jsonResponse = JSON.parse(result.response.text());
    const assistantReply =
      typeof jsonResponse.result === "string"
        ? jsonResponse.result
        : JSON.stringify(jsonResponse.result);

    // Find or create session
    let session = await ChatSession.findOne({ sessionId });
    if (!session) {
      // Create new session with userId (email)
      session = new ChatSession({
        sessionId,
        userId: email,
        sessionTitle: sessionTitle || "New Chat",
        messages: [
          { role: "user", content: message, timestamp: new Date() },
          { role: "assistant", content: assistantReply, timestamp: new Date() },
        ],
      });
    } else {
      // Add to existing session
      session.messages.push(
        { role: "user", content: message, timestamp: new Date() },
        { role: "assistant", content: assistantReply, timestamp: new Date() }
      );
    }
    await session.save();

    res.json({ response: assistantReply, sessionId });
  } catch (error) {
    console.error("Error generating or parsing content:", error);
    res
      .status(500)
      .json({ message: "Failed to generate a structured response." });
  }
};

export const getSessionsByEmail = async (req: Request, res: Response) => {
  const { email } = req.params;
  if (!email) {
    return res.status(400).json({ message: "email is required" });
  }
  try {
    const sessions = await ChatSession.find({ userId: email }).select(
      "sessionId userId messages.timestamp sessionTitle"
    );
    res.json({ email, sessions });
  } catch (error) {
    console.error("Error fetching sessions by email:", error);
    res.status(500).json({ message: "Failed to fetch sessions." });
  }
};

export const getMessages = async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  if (!sessionId) {
    return res.status(400).json({ message: "sessionId is required" });
  }
  try {
    const session = await ChatSession.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }
    res.json({ sessionId, messages: session.messages });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ message: "Failed to fetch messages." });
  }
};
