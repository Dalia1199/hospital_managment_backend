import fs from "fs-extra";
import path from "path";
import { generateEmbeddings } from "./gemini.service.js";
import doctormodel from "../../DB/models/doctormodel.js";
import { createRequire } from "module";
import { Pinecone } from "@pinecone-database/pinecone";
import { v4 as uuidv4 } from "uuid";

const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

const VECTOR_DIR = path.resolve("src/DB/vectors");

// Ensure local directory exists
fs.ensureDirSync(VECTOR_DIR);

let pineconeClient = null;
let pineconeIndex = null;

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME;

if (PINECONE_API_KEY && PINECONE_INDEX_NAME) {
    try {
        console.log(`[Pinecone] Initializing Pinecone client with index: ${PINECONE_INDEX_NAME}`);
        pineconeClient = new Pinecone({
            apiKey: PINECONE_API_KEY,
        });
        pineconeIndex = pineconeClient.index(PINECONE_INDEX_NAME);
        console.log("[Pinecone] Client and Index initialized successfully.");
    } catch (error) {
        console.error("[Pinecone] Initialization failed, falling back to local files:", error);
    }
} else {
    console.log("[Pinecone] API key or Index Name not set. Running in local filesystem mode.");
}

function isPineconeActive() {
    return !!(pineconeClient && pineconeIndex);
}

export async function getVectorStorePath(doctorId) {
    const doc = await doctormodel.findOne({ userId: doctorId });
    const activeDbName = doc?.activeVectorDbName || "Default_DB";
    const userVectorDir = path.join(VECTOR_DIR, String(doctorId));
    fs.ensureDirSync(userVectorDir);
    return path.join(userVectorDir, `${activeDbName}.json`);
}

export async function getDatabasesList(doctorId) {
    const doc = await doctormodel.findOne({ userId: doctorId });
    const activeDbName = doc?.activeVectorDbName || "Default_DB";
    
    if (isPineconeActive()) {
        const databases = doc?.vectorDatabases && doc.vectorDatabases.length > 0
            ? doc.vectorDatabases
            : ["Default_DB"];
        return {
            activeDb: activeDbName,
            databases: databases
        };
    }

    const userVectorDir = path.join(VECTOR_DIR, String(doctorId));
    fs.ensureDirSync(userVectorDir);
    
    const activeDbPath = path.join(userVectorDir, `${activeDbName}.json`);
    if (!(await fs.pathExists(activeDbPath))) {
        await fs.writeJson(activeDbPath, []);
    }

    const files = await fs.readdir(userVectorDir);
    const databases = files
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''));
    
    return {
        activeDb: activeDbName,
        databases: databases
    };
}

export async function createDatabase(doctorId, dbName) {
    if (!dbName || typeof dbName !== 'string') throw new Error("Invalid database name");
    const safeDbName = dbName.replace(/[^a-zA-Z0-9_-]/g, "");
    if (!safeDbName) throw new Error("Invalid database name format");
    
    if (isPineconeActive()) {
        const doc = await doctormodel.findOne({ userId: doctorId });
        let databases = doc?.vectorDatabases || [];
        if (!databases.includes(safeDbName)) {
            databases.push(safeDbName);
        }
        await doctormodel.findOneAndUpdate(
            { userId: doctorId },
            { 
                activeVectorDbName: safeDbName,
                vectorDatabases: databases
            },
            { upsert: true, new: true }
        );
        return { success: true, dbName: safeDbName };
    }

    const userVectorDir = path.join(VECTOR_DIR, String(doctorId));
    fs.ensureDirSync(userVectorDir);
    const newDbPath = path.join(userVectorDir, `${safeDbName}.json`);
    
    if (!(await fs.pathExists(newDbPath))) {
        await fs.writeJson(newDbPath, []);
    }
    
    // Sync databases array to MongoDB as well to maintain schema consistency
    const doc = await doctormodel.findOne({ userId: doctorId });
    let databases = doc?.vectorDatabases || [];
    if (!databases.includes(safeDbName)) {
        databases.push(safeDbName);
    }
    await doctormodel.findOneAndUpdate(
        { userId: doctorId }, 
        { 
            activeVectorDbName: safeDbName,
            vectorDatabases: databases
        }
    );
    return { success: true, dbName: safeDbName };
}

export async function setActiveDatabase(doctorId, dbName) {
    if (!dbName || typeof dbName !== 'string') throw new Error("Invalid database name");
    const safeDbName = dbName.replace(/[^a-zA-Z0-9_-]/g, "");
    
    if (isPineconeActive()) {
        const doc = await doctormodel.findOne({ userId: doctorId });
        const databases = doc?.vectorDatabases || ["Default_DB"];
        if (!databases.includes(safeDbName)) {
            throw new Error("Database not found");
        }
        await doctormodel.findOneAndUpdate({ userId: doctorId }, { activeVectorDbName: safeDbName });
        return { success: true, activeDb: safeDbName };
    }

    const userVectorDir = path.join(VECTOR_DIR, String(doctorId));
    const targetDbPath = path.join(userVectorDir, `${safeDbName}.json`);
    
    if (!(await fs.pathExists(targetDbPath))) {
        throw new Error("Database not found");
    }
    
    await doctormodel.findOneAndUpdate({ userId: doctorId }, { activeVectorDbName: safeDbName });
    return { success: true, activeDb: safeDbName };
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
    if (!text || text.trim().length === 0) {
        console.log("[processAndStoreDocument] Empty text extracted from file.");
        return;
    }

    const chunks = chunkText(text);
    console.log(`[processAndStoreDocument] Text length: ${text.length}, Chunks count: ${chunks.length}`);

    if (isPineconeActive()) {
        const doc = await doctormodel.findOne({ userId: doctorId });
        const activeDbName = doc?.activeVectorDbName || "Default_DB";
        const namespace = `doctor_${doctorId}_db_${activeDbName}`;

        const vectors = [];
        const BATCH_SIZE = 20;
        for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
            const batch = chunks.slice(i, i + BATCH_SIZE);
            const batchPromises = batch.map(async (chunk) => {
                if (chunk.trim().length < 10) {
                    console.log(`[processAndStoreDocument] Chunk too short: "${chunk}"`);
                    return null;
                }
                const embedding = await generateEmbeddings(chunk);
                console.log(`[processAndStoreDocument] Generated embedding. Length: ${embedding?.length}`);
                return {
                    id: uuidv4(),
                    values: embedding,
                    metadata: {
                        fileName,
                        text: chunk
                    }
                };
            });
            
            const results = await Promise.all(batchPromises);
            results.forEach(res => {
                if (res) vectors.push(res);
            });
        }

        console.log(`[processAndStoreDocument] Prepared ${vectors.length} vectors to upsert to Pinecone namespace: ${namespace}`);
        if (vectors.length > 0) {
            await pineconeIndex.namespace(namespace).upsert({ records: vectors });

            // Update doctor's knowledgeBaseFiles in MongoDB
            const fileExists = doc?.knowledgeBaseFiles?.some(
                f => f.fileName === fileName && f.dbName === activeDbName
            );
            if (!fileExists) {
                await doctormodel.findOneAndUpdate(
                    { userId: doctorId },
                    {
                        $push: {
                            knowledgeBaseFiles: {
                                fileName,
                                dbName: activeDbName,
                                uploadedAt: new Date()
                            }
                        }
                    }
                );
            }
        }
        return vectors.length;
    }

    // Local fallback
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
    return store.length;
}

export async function queryVectorStore(doctorId, query, topK = 3) {
    if (isPineconeActive()) {
        const doc = await doctormodel.findOne({ userId: doctorId });
        const activeDbName = doc?.activeVectorDbName || "Default_DB";
        const namespace = `doctor_${doctorId}_db_${activeDbName}`;

        const queryEmbedding = await generateEmbeddings(query);
        
        try {
            const queryResponse = await pineconeIndex.namespace(namespace).query({
                vector: queryEmbedding,
                topK: topK,
                includeMetadata: true
            });

            let context = "";
            if (queryResponse.matches && queryResponse.matches.length > 0) {
                queryResponse.matches.forEach(match => {
                    if (match.score > 0.25) {
                        const file = match.metadata?.fileName || "Unknown";
                        const txt = match.metadata?.text || "";
                        context += `[From: ${file}]\n${txt}\n\n`;
                    }
                });
            }
            return context;
        } catch (error) {
            console.error("[Pinecone] Query error, falling back to local search if exists:", error);
        }
    }

    // Local fallback
    const vectorStorePath = await getVectorStorePath(doctorId);
    
    if (!(await fs.pathExists(vectorStorePath))) {
        return "";
    }

    const store = await fs.readJson(vectorStorePath);
    if (store.length === 0) return "";

    const queryEmbedding = await generateEmbeddings(query);

    const results = store.map(item => ({
        text: item.text,
        fileName: item.fileName,
        score: cosineSimilarity(queryEmbedding, item.embedding)
    }));

    results.sort((a, b) => b.score - a.score);
    const topResults = results.slice(0, topK);

    let context = "";
    topResults.forEach(res => {
        if (res.score > 0.25) {
            context += `[From: ${res.fileName}]\n${res.text}\n\n`;
        }
    });

    return context;
}

export async function getKnowledgeBaseInfo(doctorId) {
    try {
        const { activeDb, databases } = await getDatabasesList(doctorId);
        
        if (isPineconeActive()) {
            const doc = await doctormodel.findOne({ userId: doctorId });
            const files = doc?.knowledgeBaseFiles
                ? doc.knowledgeBaseFiles
                    .filter(f => f.dbName === activeDb)
                    .map(f => f.fileName)
                : [];
            
            return {
                files: [...new Set(files)],
                sizeMB: "N/A (Pinecone Index)",
                activeDb,
                databases
            };
        }

        const vectorStorePath = await getVectorStorePath(doctorId);
        
        if (!(await fs.pathExists(vectorStorePath))) {
            return { files: [], sizeMB: "0.00", activeDb, databases };
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
            activeDb,
            databases
        };
    } catch (err) {
        await fs.appendFile("kb_error.txt", new Date().toISOString() + " - " + (err.stack || err.message) + "\n");
        throw err;
    }
}

export async function deleteDocumentFromVectorStore(doctorId, fileName) {
    if (isPineconeActive()) {
        const doc = await doctormodel.findOne({ userId: doctorId });
        const activeDbName = doc?.activeVectorDbName || "Default_DB";
        const namespace = `doctor_${doctorId}_db_${activeDbName}`;

        try {
            await pineconeIndex.namespace(namespace).deleteMany({
                filter: {
                    fileName: { '$eq': fileName }
                }
            });

            await doctormodel.findOneAndUpdate(
                { userId: doctorId },
                {
                    $pull: {
                        knowledgeBaseFiles: {
                            fileName: fileName,
                            dbName: activeDbName
                        }
                    }
                }
            );
            return true;
        } catch (error) {
            console.error("[Pinecone] Delete vector error:", error);
            return false;
        }
    }

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
        return false;
    }

    await fs.writeJson(vectorStorePath, filteredStore);
    return true;
}

export async function clearVectorStore(doctorId) {
    if (isPineconeActive()) {
        const doc = await doctormodel.findOne({ userId: doctorId });
        const activeDbName = doc?.activeVectorDbName || "Default_DB";
        const namespace = `doctor_${doctorId}_db_${activeDbName}`;

        try {
            await pineconeIndex.deleteNamespace(namespace);
        } catch (error) {
            console.log("[Pinecone] Clear namespace info/warning:", error.message);
        }

        await doctormodel.findOneAndUpdate(
            { userId: doctorId },
            {
                $pull: {
                    knowledgeBaseFiles: {
                        dbName: activeDbName
                    }
                }
            }
        );
        return true;
    }

    const vectorStorePath = await getVectorStorePath(doctorId);
    if (await fs.pathExists(vectorStorePath)) {
        await fs.remove(vectorStorePath);
        return true;
    }
    return false;
}

