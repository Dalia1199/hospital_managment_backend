import fs from "fs-extra";
import path from "path";
import { generateEmbeddings } from "./gemini.service.js";
import doctormodel from "../../DB/models/doctormodel.js";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

const VECTOR_DIR = path.resolve("src/DB/vectors");

// Ensure directory exists
fs.ensureDirSync(VECTOR_DIR);

export async function getVectorStorePath(doctorId) {
    const doc = await doctormodel.findOne({ userId: doctorId });
    if (doc && doc.vectorDbPath) {
        fs.ensureDirSync(doc.vectorDbPath);
        return path.join(doc.vectorDbPath, `${doctorId}.json`);
    }
    return path.join(VECTOR_DIR, `${doctorId}.json`);
}

function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Split text into ~500 character chunks with 50 char overlap
function chunkText(text, chunkSize = 500, overlap = 50) {
    const chunks = [];
    let i = 0;
    while (i < text.length) {
        chunks.push(text.slice(i, i + chunkSize));
        i += chunkSize - overlap;
    }
    return chunks;
}

export async function processAndStoreDocument(doctorId, fileBuffer, fileName, fileType) {
    let text = "";

    if (fileType === "application/pdf" || fileName.endsWith(".pdf")) {
        const data = await pdf(fileBuffer);
        text = data.text;
    } else {
        text = fileBuffer.toString("utf-8");
    }

    if (!text || text.trim().length === 0) return;

    const chunks = chunkText(text);
    const vectorStorePath = await getVectorStorePath(doctorId);
    
    let store = [];
    if (await fs.pathExists(vectorStorePath)) {
        for (let i = 0; i < 3; i++) {
            try {
                store = await fs.readJson(vectorStorePath);
                break;
            } catch (error) {
                if (i === 2) throw error;
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }
    }

    // Process chunks in parallel batches to avoid rate limits and timeouts
    const BATCH_SIZE = 20;
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map(async (chunk) => {
            if (chunk.trim().length < 10) return null;
            const embedding = await generateEmbeddings(chunk);
            return {
                fileName,
                text: chunk,
                embedding
            };
        });
        
        const results = await Promise.all(batchPromises);
        results.forEach(res => {
            if (res) store.push(res);
        });
    }

    await fs.writeJson(vectorStorePath, store);
    return store.length; // Returns total chunks stored
}

export async function queryVectorStore(doctorId, query, topK = 3) {
    const vectorStorePath = await getVectorStorePath(doctorId);
    
    if (!(await fs.pathExists(vectorStorePath))) {
        return ""; // No knowledge base for this doctor
    }

    const store = await fs.readJson(vectorStorePath);
    if (store.length === 0) return "";

    const queryEmbedding = await generateEmbeddings(query);

    // Calculate similarities
    const results = store.map(item => ({
        text: item.text,
        fileName: item.fileName,
        score: cosineSimilarity(queryEmbedding, item.embedding)
    }));

    // Sort descending by score
    results.sort((a, b) => b.score - a.score);

    // Get top K results
    const topResults = results.slice(0, topK);

    let context = "";
    topResults.forEach(res => {
        if (res.score > 0.6) { // Only include somewhat relevant context
            context += `[From: ${res.fileName}]\n${res.text}\n\n`;
        }
    });

    return context;
}

export async function getKnowledgeBaseInfo(doctorId) {
    try {
        const vectorStorePath = await getVectorStorePath(doctorId);
        
        if (!(await fs.pathExists(vectorStorePath))) {
            return { files: [], sizeMB: "0.00", path: vectorStorePath };
        }

        let store = [];
        let stats = { size: 0 };
        for (let i = 0; i < 5; i++) {
            try {
                store = await fs.readJson(vectorStorePath);
                stats = await fs.stat(vectorStorePath);
                break;
            } catch (error) {
                if (i === 4) throw error; 
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        }

        const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        const fileNames = Array.isArray(store) ? [...new Set(store.map(item => item.fileName))] : [];

        return {
            files: fileNames,
            sizeMB,
            path: vectorStorePath
        };
    } catch (err) {
        await fs.appendFile("kb_error.txt", new Date().toISOString() + " - " + (err.stack || err.message) + "\n");
        throw err;
    }
}

export async function deleteDocumentFromVectorStore(doctorId, fileName) {
    const vectorStorePath = await getVectorStorePath(doctorId);
    
    if (!(await fs.pathExists(vectorStorePath))) {
        return false;
    }

    let store = [];
    for (let i = 0; i < 3; i++) {
        try {
            store = await fs.readJson(vectorStorePath);
            break;
        } catch (error) {
            if (i === 2) throw error;
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }

    const filteredStore = store.filter(item => item.fileName !== fileName);

    if (store.length === filteredStore.length) {
        return false; // File not found
    }

    await fs.writeJson(vectorStorePath, filteredStore);
    return true;
}

export async function clearVectorStore(doctorId) {
    const vectorStorePath = await getVectorStorePath(doctorId);
    if (await fs.pathExists(vectorStorePath)) {
        await fs.remove(vectorStorePath);
        return true;
    }
    return false;
}
