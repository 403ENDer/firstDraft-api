import os
import json
import logging
from dotenv import load_dotenv
from langchain.prompts import PromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI

# Load environment variables
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Simple logger setup
def get_logger(name: str):
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler()
        formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
        handler.setFormatter(formatter)
        logger.addHandler(handler)
        logger.setLevel(logging.DEBUG)
    return logger

logger = get_logger(__name__)

def clean_text(text: str) -> str:
    """Clean and format text output from AI models."""
    if not text:
        return ""
    
    # First, try to extract JSON from markdown code blocks
    import re
    json_match = re.search(r'```json\s*(\{.*?\})\s*```', text, re.DOTALL)
    if json_match:
        text = json_match.group(1)
    else:
        # Remove markdown code blocks if no JSON found
        text = text.replace('```json', '').replace('```', '')
        
        # Try to extract JSON if it's wrapped in other text
        json_match = re.search(r'\{.*\}', text, re.DOTALL)
        if json_match:
            text = json_match.group(0)
    
    # Remove leading/trailing whitespace
    text = text.strip()
    
    # Handle escaped characters
    text = text.replace('\\n', '\n')
    text = text.replace('\\t', '\t')
    text = text.replace('\\"', '"')
    text = text.replace('\\\\', '\\')
    text = text.replace("\\'", "'")  # Handle escaped apostrophes
    
    return text

def classify_input(user_input: str) -> dict:
    """
    Classify user input into either "General Conversation" or "Feature Description".
    """
    prompt_template = PromptTemplate(
        input_variables=["user_input"],
        template=("""
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
- The JSON must have exactly one key: `"classification"`.  
- The value must be **either** `"General Conversation"` **or** `"Feature Description"`.  
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

"""
        )
    )

    prompt = prompt_template.format(
        user_input=user_input
    )

    # Initialize Gemini model
    model = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        temperature=0.2,
        google_api_key=GEMINI_API_KEY
    )

    raw_output = model.invoke(prompt)

    logger.debug("Raw model output: %s", raw_output)

    # Extract text only
    text_output = str(raw_output)

    # Clean and parse JSON
    cleaned = clean_text(text_output)
    
    # Try to parse the cleaned JSON
    try:
        parsed_json = json.loads(cleaned)
        logger.info("Successfully parsed JSON")
        return parsed_json
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse JSON: {e}")
        
        # Try to extract JSON from the raw output more aggressively
        import re
        # Look for JSON between ```json and ``` markers
        json_match = re.search(r'```json\s*(\{.*?\})\s*```', text_output, re.DOTALL)
        if json_match:
            try:
                extracted_json = json_match.group(1)
                # Clean the extracted JSON
                extracted_json = extracted_json.replace('\\n', '\n').replace('\\"', '"').replace('\\\\', '\\').replace("\\'", "'")
                return json.loads(extracted_json)
            except json.JSONDecodeError:
                pass
        
        # Try to find just the JSON object without extra metadata
        json_match = re.search(r'(\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})', text_output, re.DOTALL)
        if json_match:
            try:
                extracted_json = json_match.group(1)
                # Clean the extracted JSON
                extracted_json = extracted_json.replace('\\n', '\n').replace('\\"', '"').replace('\\\\', '\\').replace("\\'", "'")
                return json.loads(extracted_json)
            except json.JSONDecodeError:
                pass
        
        # If all else fails, return the raw output
        return {"raw_output": cleaned, "error": "Failed to parse JSON"}

def analyze_feature(feature_input: dict) -> dict:
    """
    Analyze a given feature description using Gemini model and extract insights in JSON format.
    """
    prompt_template = PromptTemplate(
        input_variables=["description"],
        template=("""
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
"""
        )
    )

    prompt = prompt_template.format(
        description=feature_input.get("description", "")
    )

    # Initialize Gemini model
    model = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        temperature=0.2,
        google_api_key=GEMINI_API_KEY
    )

    raw_output = model.invoke(prompt)

    logger.debug("Raw model output: %s", raw_output)

    # Extract text only
    text_output = str(raw_output)

    # Clean and parse JSON
    cleaned = clean_text(text_output)
    
    # Try to parse the cleaned JSON
    try:
        parsed_json = json.loads(cleaned)
        logger.info("Successfully parsed JSON")
        return parsed_json
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse JSON: {e}")
        
        # Try to extract JSON from the raw output more aggressively
        import re
        # Look for JSON between ```json and ``` markers
        json_match = re.search(r'```json\s*(\{.*?\})\s*```', text_output, re.DOTALL)
        if json_match:
            try:
                extracted_json = json_match.group(1)
                # Clean the extracted JSON
                extracted_json = extracted_json.replace('\\n', '\n').replace('\\"', '"').replace('\\\\', '\\').replace("\\'", "'")
                return json.loads(extracted_json)
            except json.JSONDecodeError:
                pass
        
        # Try to find just the JSON object without extra metadata
        json_match = re.search(r'(\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})', text_output, re.DOTALL)
        if json_match:
            try:
                extracted_json = json_match.group(1)
                # Clean the extracted JSON
                extracted_json = extracted_json.replace('\\n', '\n').replace('\\"', '"').replace('\\\\', '\\').replace("\\'", "'")
                return json.loads(extracted_json)
            except json.JSONDecodeError:
                pass
        
        # If all else fails, return the raw output
        return {"raw_output": cleaned, "error": "Failed to parse JSON"}

def generate_tech_layer(feature_analysis: dict) -> dict:
    """
    Generate 8 cinematic video chunks based on feature analysis JSON.
    """
    prompt_template = PromptTemplate(
        input_variables=["feature_analysis_json", "user_prompt"],
        template=("""
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
  "chunk1": {{ "environment": "", "characters": [], "activity": "", "camera_direction": "", "audio_visual_sync": "" }},
  "chunk2": {{ "environment": "", "characters": [], "activity": "", "camera_direction": "", "audio_visual_sync": "" }},
  ...
  "chunk8": {{ "environment": "", "characters": [], "activity": "", "camera_direction": "", "audio_visual_sync": "" }}
}}

### Inputs:
- Feature Analysis JSON: {feature_analysis_json}
- User Prompt: {user_prompt}

"""
        )
    )

    prompt = prompt_template.format(
        feature_analysis_json=json.dumps(feature_analysis, indent=2),
        user_prompt="Generate 8 unique video chunks (~8s each) following cinematic/narrative principles, optimized for VEO3."
    )

    # Initialize Gemini model
    model = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        temperature=0.2,
        google_api_key=GEMINI_API_KEY
    )

    raw_output = model.invoke(prompt)

    logger.debug("Raw model output: %s", raw_output)

    # Extract text only
    text_output = str(raw_output)

    # Clean and parse JSON
    cleaned = clean_text(text_output)
    
    # Try to parse the cleaned JSON
    try:
        parsed_json = json.loads(cleaned)
        logger.info("Successfully parsed JSON")
        return parsed_json
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse JSON: {e}")
        
        # Try to extract JSON from the raw output more aggressively
        import re
        # Look for JSON between ```json and ``` markers
        json_match = re.search(r'```json\s*(\{.*?\})\s*```', text_output, re.DOTALL)
        if json_match:
            try:
                extracted_json = json_match.group(1)
                # Clean the extracted JSON
                extracted_json = extracted_json.replace('\\n', '\n').replace('\\"', '"').replace('\\\\', '\\').replace("\\'", "'")
                return json.loads(extracted_json)
            except json.JSONDecodeError:
                pass
        
        # Try to find just the JSON object without extra metadata
        json_match = re.search(r'(\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})', text_output, re.DOTALL)
        if json_match:
            try:
                extracted_json = json_match.group(1)
                # Clean the extracted JSON
                extracted_json = extracted_json.replace('\\n', '\n').replace('\\"', '"').replace('\\\\', '\\').replace("\\'", "'")
                return json.loads(extracted_json)
            except json.JSONDecodeError:
                pass
        
        # If all else fails, return the raw output
        return {"raw_output": cleaned, "error": "Failed to parse JSON"}

def process_user_input(user_input: str) -> dict:
    """
    Main workflow function that integrates all three agents:
    1. Classification Agent runs first
    2. If "Feature Description" -> Feature2 -> TechLayer
    3. If "General Conversation" -> return classification result
    """
    logger.info(f"Processing user input: {user_input}")
    
    # Step 1: Run Classification Agent first
    logger.info("Step 1: Running Classification Agent...")
    classification_result = classify_input(user_input)
    
    if "error" in classification_result:
        logger.error(f"Classification failed: {classification_result}")
        return {"error": "Classification failed", "details": classification_result}
    
    classification = classification_result.get("classification", "")
    logger.info(f"Classification result: {classification}")
    
    # Step 2: Handle based on classification
    if classification == "General Conversation":
        logger.info("Returning general conversation result")
        return {
            "workflow": "general_conversation",
            "classification": classification,
            "result": classification_result
        }
    
    elif classification == "Feature Description":
        logger.info("Step 2: Running Feature Analysis...")
        
        # Step 2a: Run Feature2 function
        feature_input = {"description": user_input}
        feature_analysis = analyze_feature(feature_input)
        
        if "error" in feature_analysis:
            logger.error(f"Feature analysis failed: {feature_analysis}")
            return {"error": "Feature analysis failed", "details": feature_analysis}
        
        logger.info("Feature analysis completed successfully")
        
        # Step 2b: Run TechLayer function with feature analysis result
        logger.info("Step 3: Running Tech Layer...")
        tech_layer_result = generate_tech_layer(feature_analysis)
        
        if "error" in tech_layer_result:
            logger.error(f"Tech layer failed: {tech_layer_result}")
            return {"error": "Tech layer failed", "details": tech_layer_result}
        
        logger.info("Tech layer completed successfully")
        
        return {
            "workflow": "feature_processing",
            "classification": classification,
            "feature_analysis": feature_analysis,
            "tech_layer_result": tech_layer_result
        }
    
    else:
        logger.error(f"Unknown classification: {classification}")
        return {"error": "Unknown classification", "classification": classification}

# Example usage
if __name__ == "__main__":
    print("🤖 AI Video Creation Assistant")
    print("=" * 50)
    print("Enter your input below. Type 'quit' or 'exit' to stop.")
    print("=" * 50)
    
    results = []
    test_count = 0
    
    while True:
        try:
            # Get user input
            user_input = input("\n💬 Enter your input: ").strip()
            
            # Check for exit commands
            if user_input.lower() in ['quit', 'exit', 'q']:
                print("\n👋 Goodbye! Thanks for using the AI Video Creation Assistant.")
                break
            
            # Skip empty inputs
            if not user_input:
                print("⚠️  Please enter some text.")
                continue
            
            test_count += 1
            print(f"\n{'='*60}")
            print(f"PROCESSING INPUT #{test_count}: '{user_input}'")
            print(f"{'='*60}")
            
            # Process the user input
            result = process_user_input(user_input)
            results.append({
                "input": user_input,
                "result": result
            })
            
            # Display results
            print(f"\n📊 RESULTS:")
            print(f"   Workflow: {result.get('workflow', 'Error')}")
            print(f"   Classification: {result.get('classification', 'Error')}")
            
            if result.get('workflow') == 'feature_processing':
                print(f"   ✅ Feature Analysis completed")
                print(f"   ✅ Tech Layer completed")
                print(f"   📁 Feature Analysis Keys: {list(result.get('feature_analysis', {}).keys())}")
                print(f"   📁 Tech Layer Keys: {list(result.get('tech_layer_result', {}).keys())}")
            elif result.get('workflow') == 'general_conversation':
                print(f"   💬 General conversation detected")
            
            # Check for errors
            if "error" in result:
                print(f"   ❌ Error: {result.get('error')}")
            
            print(f"\n📋 Full result keys: {list(result.keys())}")
            
            # Ask if user wants to save results
            save_choice = input("\n💾 Save results to file? (y/n): ").strip().lower()
            if save_choice in ['y', 'yes']:
                output_filename = f"workflow_result_{test_count}.json"
                with open(output_filename, 'w', encoding='utf-8') as f:
                    json.dump(result, f, indent=2, ensure_ascii=False)
                print(f"✅ Results saved to: {output_filename}")
            
        except KeyboardInterrupt:
            print("\n\n👋 Interrupted by user. Goodbye!")
            break
        except Exception as e:
            print(f"\n❌ An error occurred: {e}")
            continue
    
    # Save all results to a summary file if there are any
    if results:
        summary_filename = "all_workflow_results.json"
        with open(summary_filename, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        print(f"\n📊 Summary: Processed {len(results)} inputs. All results saved to: {summary_filename}")
        
        print("\n=== All Results Summary ===")
        for i, result in enumerate(results, 1):
            workflow = result['result'].get('workflow', 'Error')
            classification = result['result'].get('classification', 'Error')
            print(f"Input {i}: {result['input'][:50]}... -> {workflow} ({classification})")
    else:
        print("\n📊 No inputs were processed.")
