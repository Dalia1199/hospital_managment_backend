import { GoogleGenerativeAI } from "@google/generative-ai";

let genAI = null;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function getGenAI() {
    if (!genAI) {
        if (!process.env.GEMINI_API_KEY) {
            console.warn("⚠️ GEMINI_API_KEY is not set in environment variables!");
            return null;
        }
        genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
    return genAI;
}

const FALLBACK_MODELS = [
    "gemini-3.1-flash-lite", 
    "gemini-2.5-flash",
    "gemini-3.5-flash",
    "gemini-3-flash",
    "gemini-2.5-flash-lite",
    "gemini-1.5-flash"
];

export async function generateResponse(prompt, systemInstruction = "", history = [], modelIndex = 0) {
    const ai = getGenAI();
    if (!ai) throw new Error("AI Service is not configured. Missing API Key.");

    if (modelIndex >= FALLBACK_MODELS.length) {
        throw new Error("All AI models have exhausted their quotas or are currently unavailable.");
    }

    const currentModelName = FALLBACK_MODELS[modelIndex];

    try {
        const model = ai.getGenerativeModel({ 
            model: currentModelName,
            ...(systemInstruction ? { systemInstruction: { role: "system", parts: [{ text: systemInstruction }] } } : {})
        });

        let formattedHistory = Array.isArray(history) ? history.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content || "" }]
        })) : [];

        // Normalize history to strictly alternate between 'user' and 'model'
        let normalizedHistory = [];
        let expectedRole = 'user';
        for (const msg of formattedHistory) {
            if (msg.role === 'model' && normalizedHistory.length === 0) {
                // Skip leading model messages
                continue;
            }
            if (msg.role === expectedRole) {
                normalizedHistory.push(msg);
                expectedRole = expectedRole === 'user' ? 'model' : 'user';
            } else if (normalizedHistory.length > 0) {
                // Same role as previous, merge text
                normalizedHistory[normalizedHistory.length - 1].parts[0].text += "\n" + msg.parts[0].text;
            }
        }

        const chat = model.startChat({ history: normalizedHistory });
        const result = await chat.sendMessage([{ text: prompt }]);
        
        const response = await result.response;
        return response.text();

    } catch (error) {
        const errorMsg = error?.message?.toLowerCase() || "";
        
        if (errorMsg.includes("429") || errorMsg.includes("404") || errorMsg.includes("503") || errorMsg.includes("not found")) {
            console.warn(`⚠️ Model ${currentModelName} failed (${errorMsg.includes("429") ? "Quota Limit" : "Unavailable"}). Switching to next model...`);
            if (errorMsg.includes("503")) await sleep(1500); // Small delay for 503 overloads
            return generateResponse(prompt, systemInstruction, history, modelIndex + 1);
        }

        console.error(`Gemini API Error on ${currentModelName}:`, error.message || error);
        throw error;
    }
}

export async function generateEmbeddings(text) {
    const ai = getGenAI();
    if (!ai) throw new Error("AI Service is not configured. Missing API Key.");

    try {
        const model = ai.getGenerativeModel({ model: "gemini-embedding-2" });
        const result = await model.embedContent(text);
        return result.embedding.values;
    } catch (error) {
        console.error("Error generating embeddings:", error);
        throw error;
    }
}
