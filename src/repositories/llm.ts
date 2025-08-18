// src/LLM.ts
import dotenv from "dotenv";
import winston from "winston";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";
import { ChatSession } from "../models/ChatSession";
import { HumanMessage, AIMessage } from "@langchain/core/messages";

dotenv.config();

export class LLM {
  private GEMINI_API_KEY: string;
  private logger: winston.Logger;

  constructor() {
    this.GEMINI_API_KEY = process.env.GOOGLE_API_KEY || "";
    this.logger = this.getLogger("LLM-Assistant");
  }

  /** Setup logger */
  private getLogger(name: string): winston.Logger {
    return winston.createLogger({
      level: "debug",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
          return `${timestamp} - ${name} - ${level.toUpperCase()} - ${message}`;
        })
      ),
      transports: [new winston.transports.Console()],
    });
  }

  /** Utility: clean text and extract JSON */
  private cleanText(text: string): string {
    if (!text) return "";

    // First, try to extract JSON from markdown code blocks
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      text = jsonMatch[1]!;
    } else {
      // Remove markdown formatting
      text = text.replace(/```json|```/g, "");
      // Try to find JSON object - look for the largest JSON object
      const jsonMatches = text.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
      if (jsonMatches && jsonMatches.length > 0) {
        // Find the largest JSON object (most likely the main response)
        text = jsonMatches.reduce((largest, current) =>
          current && largest && current.length > largest.length
            ? current
            : largest
        );
      }
    }

    // Clean up the text more thoroughly
    text = text
      .trim()
      // Handle escaped characters
      .replace(/\\n/g, " ")
      .replace(/\\t/g, " ")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\")
      .replace(/\\'/g, "'")
      // Remove actual control characters that could break JSON
      .replace(/[\x00-\x1F\x7F]/g, " ")
      // Replace multiple spaces with single space
      .replace(/\s+/g, " ")
      // Ensure proper quote handling
      .replace(/([^\\])"/g, '$1"')
      // Remove any trailing commas before closing braces/brackets
      .replace(/,(\s*[}\]])/g, "$1");

    return text;
  }

  /** Try to fix common JSON issues */
  private tryFixJSON(text: string): string {
    try {
      // Try to parse as-is first
      JSON.parse(text);
      return text;
    } catch (err) {
      // If that fails, try some common fixes
      let fixed = text;

      // Fix common quote issues
      fixed = fixed.replace(/"/g, '"').replace(/"/g, '"');

      // Fix common apostrophe issues
      fixed = fixed.replace(/'/g, "'");

      // Try to fix unescaped quotes in content - more aggressive approach
      // Look for quotes that are not properly escaped in content fields
      fixed = fixed.replace(
        /"content":\s*"([^"]*(?:[^\\]"[^"]*)*)"/g,
        (match, content) => {
          // Escape all quotes in the content field
          const escapedContent = content.replace(/"/g, '\\"');
          return `"content": "${escapedContent}"`;
        }
      );

      // Fix quotes in other string fields that might have unescaped quotes
      fixed = fixed.replace(
        /"([^"]+)":\s*"([^"]*(?:[^\\]"[^"]*)*)"/g,
        (match, key, value) => {
          // Skip if this is already a content field (handled above)
          if (key === "content") return match;

          // Escape quotes in other string values
          const escapedValue = value.replace(/"/g, '\\"');
          return `"${key}": "${escapedValue}"`;
        }
      );

      // Remove any remaining problematic characters
      fixed = fixed.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

      // Try to fix trailing commas before closing braces/brackets
      fixed = fixed.replace(/,(\s*[}\]])/g, "$1");

      // Try to fix missing quotes around property names
      fixed = fixed.replace(
        /([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g,
        '$1"$2":'
      );

      return fixed;
    }
  }

  /** Try to reconstruct JSON from severely malformed text */
  private reconstructJSON(text: string): string {
    try {
      // Look for the basic structure: scenes array
      if (text.includes('"scenes"') || text.includes("scenes")) {
        // Try to extract scene objects
        const sceneMatches = text.match(
          /"scene_number":\s*(\d+)[^}]*"content":\s*"([^"]*(?:[^\\]"[^"]*)*)"/g
        );

        if (sceneMatches && sceneMatches.length > 0) {
          const scenes = sceneMatches.map((match, index) => {
            const sceneNumber = index + 1;
            const contentMatch = match.match(
              /"content":\s*"([^"]*(?:[^\\]"[^"]*)*)"/
            );
            const content = contentMatch
              ? contentMatch[1]!.replace(/"/g, '\\"')
              : "Scene content could not be parsed";

            return `{"scene_number": ${sceneNumber}, "content": "${content}"}`;
          });

          return `{"scenes": [${scenes.join(", ")}]}`;
        }
      }

      // If we can't reconstruct, return a minimal valid JSON
      return '{"scenes": [{"scene_number": 1, "content": "Scene content could not be parsed due to JSON formatting issues"}]}';
    } catch (error) {
      // Return a fallback JSON structure
      return '{"scenes": [{"scene_number": 1, "content": "Scene content could not be parsed due to JSON formatting issues"}]}';
    }
  }

  /** Initialize Gemini model */
  private getModel() {
    return new ChatGoogleGenerativeAI({
      model: "gemini-2.5-flash",
      temperature: 0.2,
      apiKey: this.GEMINI_API_KEY,
    });
  }

  /** Classification Agent */
  public async classifyInput(userInput: string) {
    const template = new PromptTemplate({
      inputVariables: ["user_input"],
      template: `
You are an AI Input Classifier.  

Your ONLY job is to read the user input and classify it into **exactly one** of the following categories:  

1. "General Conversation"  
   - Greetings ("hi", "hello", "bye", etc.)  
   - Small talk or chit-chat  
   - Questions or dialogue unrelated to video feature creation  

2. "Feature Description"  
   - Any input that provides descriptions intended for **video creation**  
   - Inputs describing environments, characters, story ideas, creative directions, or cinematic elements  

### Critical Instructions:
- You MUST return output in **strict JSON format only**.  
- The JSON must have exactly one key: "classification".  
- The value must be **either** "General Conversation" **or** "Feature Description".  
- No explanations, no extra text, no variations in casing, no additional keys.  
- Do not invent categories. Do not output anything outside the two allowed values.  

### JSON Output Format:
{{
  "classification": "General Conversation"
}}

OR

{{
  "classification": "Feature Description"
}}

### User Input to Classify:
{user_input}

`,
    });

    const prompt = await template.format({ user_input: userInput });
    const model = this.getModel();
    const rawOutput = await model.invoke(prompt);

    const cleaned = this.cleanText(rawOutput.content?.toString() || "");

    try {
      return JSON.parse(cleaned);
    } catch (err) {
      this.logger.error(`Failed to parse classification JSON: ${err}`);
      return { raw_output: cleaned, error: "Failed to parse JSON" };
    }
  }

  /** Feature Analysis Agent */
  public async analyzeFeature(description: string) {
    const template = new PromptTemplate({
      inputVariables: ["description"],
      template: `
You are an AI Feature Analysis Assistant.  
Your task is to analyze the provided feature description and documentation, then produce a structured JSON output.  

Follow these two phases:

### Phase 1: Concept Analysis
- Parse feature descriptions and technical documentation  
- Extract **core value propositions**  
- Extract **pain points addressed**  
- Identify **key stakeholders**  
- Identify **main use cases**  

### Phase 2: Narrative Design
- Propose **story arcs** for communicating the feature  
- Suggest **emotional beats and transitions**  
- Plan **visual and audio synchronization ideas** for presentations or videos  

### Input:
{description}

### Output (strict JSON only, no extra text):
{{
  "concept_analysis": {{
    "core_value_propositions": [],
    "pain_points": [],
    "stakeholders": [],
    "use_cases": []
  }},
  "narrative_design": {{
    "story_arcs": [],
    "emotional_beats": [],
    "visual_audio_sync": []
  }}
}}
      `,
    });

    const prompt = await template.format({ description });
    const model = this.getModel();
    const rawOutput = await model.invoke(prompt);

    const cleaned = this.cleanText(rawOutput.content?.toString() || "");

    try {
      return JSON.parse(cleaned);
    } catch (err) {
      this.logger.error(`Failed to parse feature analysis JSON: ${err}`);
      return { raw_output: cleaned, error: "Failed to parse JSON" };
    }
  }

  /** Tech Layer Agent */
  public async generateTechLayer(feature_analysis: any, user_prompt: string) {
    const template = new PromptTemplate({
      inputVariables: ["user_prompt", "feature_analysis"],
      template: `Act like an AI Video Story Architect. You will be given  inputs: 
1. A user request for generating cinematic video output. 

Your task is to generate exactly 8 cinematic video chunks, each lasting 8 seconds, forming a continuous story with a linear screenplay. Follow these strict requirements:

1. Characters:
   - Do not create global or disconnected characters. 
   - Follow the SAME main characters consistently across all 8 chunks. 
   - Characters must evolve through the storyline with emotional depth, authenticity, and continuity in appearance, voice, gestures, and personality. 
   - Ensure character resemblance and consistency across all scenes.

2. Storytelling:
   - Build a continuous narrative arc across 8 chunks with a beginning, development, climax, and resolution. 
   - Each chunk should feel self-contained but clearly connect to the next.
   - Ensure emotional progression (hope, struggle, tension, release, resolution).

3. Scene & Activity Design:
   - Focus on authentic human activities (e.g., working, traveling, cooking, playing, repairing, discovering). 
   - No talking heads. 
   - No text overlays.
   - Use realistic interactions, props, and environmental storytelling.
   - Anchor each scene in grounded human experiences rather than abstract visuals.

4. Technical & Cinematic Layer (VEO3 Optimization):
   - Optimize lighting to stay consistent across all 8 chunks. 
   - Ensure audio overlays (ambient sounds, natural dialogues, music cues) match scene transitions smoothly. 
   - Keep camera movement cinematic: varied shots (wide, close-up, tracking) for immersive storytelling. 
   - Ensure visual continuity (clothing, props, weather, and setting consistency).
   - Apply cinematic pacing: balance quiet emotional beats with dynamic sequences.

5. Output Structure:
   - Provide the output as a structured screenplay divided into 8 clearly marked chunks (Chunk 1 to Chunk 8).
   - For each chunk, specify: 
     a) Scene setting (location, time of day, mood, lighting). 
     b) Characters present and their actions. 
     c) Emotional tone and progression. 
     d) Suggested camera angles and movement. 
     e) Audio/ambient sound cues. 
     f) Continuity notes to ensure seamless flow into the next chunk.

6. Goal:
   - Create a single cinematic narrative optimized for VEO3 generation where characters remain consistent across all chunks.
   - The final product should feel like an 8-part short film series with cinematic cohesion.

Take a deep breath and work on this problem step-by-step.


Output Rules:  
- Return **ONLY JSON**, nothing else  
- JSON format must be:  

{{
  "chunk1": {{"heading": "", "environment": "", "characters": [], "activity": "", "camera_direction": "", "audio_visual_sync": "" }},
  "chunk2": {{ "heading": "", "environment": "", "characters": [], "activity": "", "camera_direction": "", "audio_visual_sync": "" }},
  ...
  "chunk8": {{ "heading": "", "environment": "", "characters": [], "activity": "", "camera_direction": "", "audio_visual_sync": "" }}
}}

### Inputs:
- User Prompt: {user_prompt}
`,
    });

    const prompt = await template.format({
      user_prompt: user_prompt,
      feature_analysis: feature_analysis,
    });

    const model = this.getModel();
    const rawOutput = await model.invoke(prompt);

    const cleaned = this.cleanText(rawOutput.content?.toString() || "");

    try {
      return JSON.parse(cleaned);
    } catch (err) {
      return { raw_output: cleaned, error: "Failed to parse JSON" };
    }
  }

  public async generateScreenplay(chunks: any) {
    const template = new PromptTemplate({
      inputVariables: ["chunks"],
      template: `
      Act like a professional screenplay writer and cinematic scene designer. 
You will be given an AI-generated structured output divided into 8 chunks (chunk1 to chunk8). 
Each chunk contains details such as heading, environment, characters, activity, camera direction, and audio/visual sync. 

Your task is to transform these 8 chunks into a screenplay formatted as 8 scenes (Scene 1 to Scene 8). 

Instructions:
1. For each chunk, create a corresponding scene (Scene 1 through Scene 8). 
2. Rewrite in cinematic screenplay style with immersive detail, while preserving the information given in each chunk. 
   - Scene heading (location + time + mood). 
   - Environment description in rich cinematic detail. 
   - Character presence and actions in natural screenplay narrative. 
   - Emotional tone that matches the progression across scenes. 
   - Camera direction written in film language (establishing shots, pans, close-ups, tracking shots, crane shots). 
   - Audio/visual sync integrated naturally into scene descriptions (ambient sounds, music cues, emotional resonance). 
   - Continuity notes embedded as subtle cues (e.g., clothing, props, emotional carryover). 
3. Ensure seamless narrative flow across all 8 scenes, maintaining character continuity and emotional arcs. 
4. Do not summarize — expand each chunk into a fully written cinematic scene description. 
5. Use the same characters and environment across all scenes.
6. Mention the charecter details like who all are present what is their dress colurm and skin tone in each scene.
7. Use same colur of attire  and skin tonefor a charecter across all scenes.
8. Use same hair style and color for a charecter across all scenes.
9. Use same facial features and expressions for a charecter across all scenes.
10. Use same body type and height for a charecter across all scenes.
11. Use same voice and speech patterns for a charecter across all scenes.
12. Use same personality and behavior for a charecter across all scenes.
Goal: Deliver a cinematic screenplay where each scene corresponds to one chunk, making the story ready for VEO3 video generation. 

Take a deep breath and work on this problem step-by-step.

Output Rules:  
- Return **ONLY JSON**, nothing else  
- JSON format must be:  

json format:
 {{
    {{"scene_number": 1, "content": "..."}},
    {{"scene_number": 2, "content": "..."}},
    {{"scene_number": 8, "content": "..."}}
}}



### User Input:
{chunks}
      `,
    });

    const prompt = await template.format({ chunks });
    const model = this.getModel();
    const rawOutput = await model.invoke(prompt);

    const cleaned = this.cleanText(rawOutput.content?.toString() || "");
    console.log("Cleaned text:", cleaned);

    try {
      return JSON.parse(cleaned);
    } catch (err) {
      console.error("JSON parsing error:", err);
      console.error("Failed to parse cleaned text:", cleaned);

      // Try to fix the JSON and parse again
      const fixed = this.tryFixJSON(cleaned);
      console.log("Attempting to fix JSON:", fixed);

      try {
        return JSON.parse(fixed);
      } catch (secondErr) {
        console.error("Second JSON parsing attempt failed:", secondErr);

        // Third attempt: Try to reconstruct the JSON structure
        try {
          const reconstructed = this.reconstructJSON(cleaned);
          console.log("Attempting to reconstruct JSON:", reconstructed);
          return JSON.parse(reconstructed);
        } catch (thirdErr) {
          console.error(
            "Third JSON parsing attempt (reconstruction) failed:",
            thirdErr
          );

          // Try to provide a more helpful error message
          if (err instanceof SyntaxError) {
            return {
              raw_output: cleaned,
              error: "Failed to parse JSON after all cleanup attempts",
              details: err.message,
              position: err.message.match(/position (\d+)/)?.[1] || "unknown",
              fixed_attempt: fixed,
            };
          }

          return {
            raw_output: cleaned,
            error: "Failed to parse JSON after all cleanup attempts",
            details: err,
          };
        }
      }
    }
  }

  public async generatePreviousResponse(sessionId: string, userInput: string) {
    const chatHistory = await ChatSession.findOne({ sessionId });
    if (!chatHistory) {
      return { error: "Chat history not found" };
    }

    // Convert your DB messages into LangChain-compatible messages
    const historyContents = chatHistory.messages.slice(-4).map((m) => {
      if (m.role === "user") {
        return new HumanMessage(m.content);
      }
      if (m.role === "assistant") {
        return new AIMessage(m.content);
      }
      // fallback: treat unknown roles as system messages
      return new HumanMessage(m.content);
    });

    // Add the current user input
    const contents = [...historyContents, new HumanMessage(userInput)];

    const model = this.getModel();
    const rawOutput = await model.invoke(contents);

    const cleaned = this.cleanText(rawOutput.content?.toString() || "");
    return cleaned;
  }

  /** Main workflow */
  public async processUserInput(userInput: string, sessionId: string) {
    this.logger.info(`Processing user input: ${userInput}`);

    // Step 1: Classification
    const classificationResult = await this.classifyInput(userInput);
    const classification = classificationResult.classification || "";

    if (classification === "General Conversation") {
      const response = await this.generatePreviousResponse(
        sessionId,
        userInput
      );
      return {
        workflow: "general_conversation",
        classification,
        result: response,
      };
    } else if (classification === "Feature Description") {
      const featureAnalysis = await this.analyzeFeature(userInput);
      if ("error" in featureAnalysis) {
        return { error: "Feature analysis failed", details: featureAnalysis };
      }

      const techLayer = await this.generateTechLayer(
        featureAnalysis,
        userInput
      );
      if ("error" in techLayer) {
        return { error: "Tech layer failed", details: techLayer };
      }
      const screenplay = await this.generateScreenplay(techLayer);
      if ("error" in screenplay) {
        console.error("Screenplay generation failed, using fallback response");
        // Return a fallback response instead of failing completely
        return {
          workflow: "feature_processing",
          classification,
          feature_analysis: featureAnalysis,
          result: {
            message:
              "I've analyzed your request and created a structured breakdown. However, I encountered an issue generating the final screenplay format. Here's what I was able to process:",
            analysis: featureAnalysis,
            chunks: techLayer,
            note: "Please try rephrasing your request or ask for a specific part of the analysis.",
          },
        };
      }

      return {
        workflow: "feature_processing",
        classification,
        feature_analysis: featureAnalysis,
        result: screenplay,
      };
    } else {
      return { error: "Unknown classification", classification };
    }
  }
}
