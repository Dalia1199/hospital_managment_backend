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

export async function generateResponse(prompt, systemInstruction = "", history = [], retryCount = 0) {
    const ai = getGenAI();
    if (!ai) throw new Error("AI Service is not configured. Missing API Key.");

    const MAX_RETRIES = 3;
    try {
        const model = ai.getGenerativeModel({ 
            model: "gemini-2.5-flash" 
        });

        const contents = [];
        if (systemInstruction) {
            contents.push({ role: 'user', parts: [{ text: systemInstruction }] });
            contents.push({ role: 'model', parts: [{ text: "Understood. I will follow these instructions." }] });
        }

        if (Array.isArray(history) && history.length > 0) {
            history.forEach(msg => {
                contents.push({ 
                    role: msg.role === 'user' ? 'user' : 'model', 
                    parts: [{ text: msg.content || "" }] 
                });
            });
        }

        contents.push({ role: 'user', parts: [{ text: prompt }] });

        const result = await model.generateContent({ contents });
        const response = await result.response;
        return response.text();

    } catch (error) {
        if ((error?.message?.includes("429") || error?.message?.includes("503")) && retryCount < MAX_RETRIES) {
            const waitTime = Math.pow(2, retryCount) * 2000;
            console.log(`AI is busy. Waiting ${waitTime/1000}s...`);
            await sleep(waitTime);
            return generateResponse(prompt, systemInstruction, history, retryCount + 1);
        }
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
