
import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { GEMINI_MODEL, SYSTEM_INSTRUCTION_COACH } from "../constants";

// Initialize the API client
// Note: This assumes process.env.API_KEY is available as per instructions
const apiKey = process.env.API_KEY || ''; 
let ai: GoogleGenAI | null = null;

if (apiKey) {
    ai = new GoogleGenAI({ apiKey });
} else {
    console.warn("Gemini API Key is missing.");
}

export const createChatSession = (customInstruction?: string): Chat | null => {
    if (!ai) return null;
    return ai.chats.create({
        model: GEMINI_MODEL,
        config: {
            systemInstruction: customInstruction || SYSTEM_INSTRUCTION_COACH,
        }
    });
};

export const sendMessageToChat = async (chat: Chat, message: string): Promise<string> => {
    try {
        const response: GenerateContentResponse = await chat.sendMessage({ message });
        return response.text || "I couldn't generate a response.";
    } catch (error) {
        console.error("Gemini Chat Error:", error);
        return "Sorry, I'm having trouble connecting to the server right now.";
    }
};

export const parseWorkoutFromAI = (text: string): any | null => {
    let jsonContent = null;

    // 1. Try to extract from code blocks (json optional)
    const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/;
    const match = text.match(codeBlockRegex);
    
    if (match && match[1]) {
        jsonContent = match[1];
    } else {
        // 2. Fallback: Find outermost braces
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start !== -1 && end !== -1 && end > start) {
            jsonContent = text.substring(start, end + 1);
        }
    }

    if (!jsonContent) return null;

    try {
        return JSON.parse(jsonContent);
    } catch (e) {
        console.warn("Initial JSON parse failed, attempting cleanup...", e);
        try {
            // Remove trailing commas (common LLM error) and ensure cleanup
            const cleaned = jsonContent
                .replace(/,\s*}/g, '}')
                .replace(/,\s*]/g, ']');
            return JSON.parse(cleaned);
        } catch (e2) {
            console.error("Failed to parse AI JSON after cleanup", e2);
            return null;
        }
    }
};
