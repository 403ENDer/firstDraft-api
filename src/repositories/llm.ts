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
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      text = jsonMatch[1]!;
    } else {
      text = text.replace(/```json|```/g, "");
      const fallback = text.match(/\{[\s\S]*\}/);
      if (fallback) text = fallback[0];
    }
    text = text
      .trim()
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\")
      .replace(/\\'/g, "'");
    return text;
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

    this.logger.debug(`Raw model output: ${rawOutput.content}`);
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

    this.logger.debug(`Raw model output: ${rawOutput.content}`);
    const cleaned = this.cleanText(rawOutput.content?.toString() || "");

    try {
      return JSON.parse(cleaned);
    } catch (err) {
      this.logger.error(`Failed to parse feature analysis JSON: ${err}`);
      return { raw_output: cleaned, error: "Failed to parse JSON" };
    }
  }

  /** Tech Layer Agent */
  public async generateTechLayer(featureAnalysis: object) {
    const template = new PromptTemplate({
      inputVariables: ["feature_analysis_json", "user_prompt"],
      template: `
You are an AI Video Story Architect.  

You are given two inputs:  
1. A **feature analysis JSON file** that contains structured insights (creative layer + technical layer).  
2. A **user request** for generating 8 cinematic video chunks.  

Your task:  
- Use the **feature analysis JSON** as the foundation for storytelling, emotional arcs, scene design, and VEO3 optimization.  
- Apply the **user's prompt** requirements strictly:  
  - Exactly 8 chunks  
  - Each ~8 seconds  
  - Completely different environments (no repetition)  
  - Diverse global characters and professions  
  - Authentic human activities (no talking heads, no text overlays)  
  - Optimized for VEO3 generation  

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
- Feature Analysis JSON: {feature_analysis_json}
- User Prompt: {user_prompt}
`,
    });

    const prompt = await template.format({
      feature_analysis_json: JSON.stringify(featureAnalysis, null, 2),
      user_prompt:
        "Generate 8 unique video chunks (~8s each), cinematic/narrative, optimized for VEO3.",
    });

    const model = this.getModel();
    const rawOutput = await model.invoke(prompt);

    this.logger.debug(`Raw model output: ${rawOutput.content}`);
    const cleaned = this.cleanText(rawOutput.content?.toString() || "");

    try {
      return JSON.parse(cleaned);
    } catch (err) {
      this.logger.error(`Failed to parse tech layer JSON: ${err}`);
      return { raw_output: cleaned, error: "Failed to parse JSON" };
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

      const techLayer = await this.generateTechLayer(featureAnalysis);
      if ("error" in techLayer) {
        return { error: "Tech layer failed", details: techLayer };
      }
      return {
        workflow: "feature_processing",
        classification,
        feature_analysis: featureAnalysis,
        result: techLayer,
      };
    } else {
      return { error: "Unknown classification", classification };
    }
  }
}
