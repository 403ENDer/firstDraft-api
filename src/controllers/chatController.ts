import { Request, Response } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ChatSession } from "../models/ChatSession";
import { AuthenticatedRequest } from "../middleware/jwtAuth";

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

export const chatMessage = async (req: AuthenticatedRequest, res: Response) => {
  const { message, sessionId } = req.body;
  const email = req.user?.email;
  if (!message || !sessionId || !email) {
    return res
      .status(400)
      .json({ message: "Message, sessionId, and email are required" });
  }

  // Ensure message and assistantReply are strings
  const userMessageContent =
    typeof message === "string" ? message : JSON.stringify(message);

  // The prompt is updated to explicitly request a JSON object with specific keys.
  const prompt = `Act like an elite AI prompt architect and cinematic content director with expert-level mastery in OpenAI prompt engineering and Google VEO3 video generation. Your output must always be a valid JSON object with two keys: "steps" and "result".

1.  **If the user’s request is for a VEO3-optimized prompt:**
    a.  **Task:** Generate a cinematic video script based on the user's concept.
    b.  **Process:** Develop an 8-chunk cinematic sequence where each chunk is unique and includes:
        * B-roll description (vivid and varied environments).
        * Voiceover script (1–2 emotionally engaging sentences).
        * Scene-setting details (time, location, character actions, etc.).
        * Explicit "do not include" constraints.
        * Cinematic style notes (lighting, mood, pacing).
    c.  **Format:** Structure the VEO3 prompts as: "Setting → Action → Camera/Angle → Audio → Don’ts → Style".
    d.  **Output:** The "result" key in your JSON should contain the complete, ready-for-input VEO3 prompt as a single string.
    e.  **Steps:** The "steps" key should be a list of strings detailing the key steps you took to generate the cinematic script.

2.  **If the user’s request is to ask a question, modify the prompt, or is unrelated to VEO3 generation:**
    a.  **Task:** Answer the question directly, provide clarification, or confirm the prompt modification.
    b.  **Process:** Use your expertise to provide a clear, complete, and relevant explanation.
    c.  **Output:** The "result" key in your JSON should contain the answer to the user's question or the confirmation of the prompt modification as a single string.
    d.  **Steps:** The "steps" key should be a list of strings explaining the process you followed to address the user's non-VEO3-related request.

**Always:**

* Return your full response as a single JSON object. Do not include any other text, code, or explanations outside the JSON block.
* The "steps" key should be a list of strings describing your internal reasoning or actions.
* The "result" key should contain the final, polished output.

**Take a deep breath and work on this problem step-by-step.**

User message: ${message}

Json example for VEO3 request:
{
"steps": ["Analyzing the user's concept of...", "Developing an 8-chunk cinematic sequence...", "Structuring the VEO3 prompt with cinematic details..."],
"result": "Setting: [Vivid B-roll description] → Action: [Character actions] → Camera/Angle: [Camera shots] → Audio: [Ambient sounds and voiceover] → Don’ts: [Constraints] → Style: [Cinematic notes]."
}

Json example for a general question:
{
"steps": ["Analyzing the user's question...", "Formulating a clear and complete answer..."],
"result": "A clear and complete explanation to the user's question about prompt engineering or a confirmation of their requested prompt modification."
}
`;

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const generationConfig = {
    responseMimeType: "application/json",
  };

  try {
    const result = await retryWithExponentialBackoff(() =>
      model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: generationConfig,
      })
    );
    const jsonResponse = JSON.parse(result.response.text());
    let assistantReply = jsonResponse.result;
    const assistantMessageContent =
      typeof assistantReply === "string"
        ? assistantReply
        : JSON.stringify(assistantReply);

    // Find or create session
    let session = await ChatSession.findOne({ sessionId });
    if (!session) {
      // Create new session with userId (email)
      session = new ChatSession({
        sessionId,
        userId: email,
        sessionTitle: userMessageContent,
        messages: [
          { role: "user", content: userMessageContent, timestamp: new Date() },
          {
            role: "assistant",
            content: assistantMessageContent,
            timestamp: new Date(),
          },
        ],
      });
    } else {
      // Add to existing session
      session.messages.push(
        { role: "user", content: userMessageContent, timestamp: new Date() },
        {
          role: "assistant",
          content: assistantMessageContent,
          timestamp: new Date(),
        }
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

export const getSessionsByEmail = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  const email = req.user?.email;
  if (!email) {
    return res.status(400).json({ message: "email is required" });
  }
  try {
    const sessions = await ChatSession.find({ userId: email }).select(
      "sessionId userId messages.timestamp sessionTitle"
    );
    console.log(sessions);
    res.json({ email, sessions });
  } catch (error) {
    console.error("Error fetching sessions by email:", error);
    res.status(500).json({ message: "Failed to fetch sessions." });
  }
};
