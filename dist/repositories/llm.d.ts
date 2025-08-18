export declare class LLM {
    private GEMINI_API_KEY;
    private logger;
    constructor();
    /** Setup logger */
    private getLogger;
    /** Utility: clean text and extract JSON */
    private cleanText;
    /** Try to fix common JSON issues */
    private tryFixJSON;
    /** Try to reconstruct JSON from severely malformed text */
    private reconstructJSON;
    /** Initialize Gemini model */
    private getModel;
    /** Classification Agent */
    classifyInput(userInput: string): Promise<any>;
    /** Feature Analysis Agent */
    analyzeFeature(description: string): Promise<any>;
    /** Tech Layer Agent */
    generateTechLayer(feature_analysis: any, user_prompt: string): Promise<any>;
    generateScreenplay(chunks: any): Promise<any>;
    generatePreviousResponse(sessionId: string, userInput: string): Promise<string | {
        error: string;
    }>;
    /** Main workflow */
    processUserInput(userInput: string, sessionId: string): Promise<{
        workflow: string;
        classification: any;
        result: string | {
            error: string;
        };
        error?: never;
        details?: never;
        feature_analysis?: never;
    } | {
        error: string;
        details: any;
        workflow?: never;
        classification?: never;
        result?: never;
        feature_analysis?: never;
    } | {
        workflow: string;
        classification: any;
        feature_analysis: any;
        result: any;
        error?: never;
        details?: never;
    } | {
        error: string;
        classification: any;
        workflow?: never;
        result?: never;
        details?: never;
        feature_analysis?: never;
    }>;
}
//# sourceMappingURL=llm.d.ts.map