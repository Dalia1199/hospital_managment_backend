import { generateResponse } from "./gemini.service.js";
import { processAndStoreDocument, queryVectorStore, getKnowledgeBaseInfo, deleteDocumentFromVectorStore, clearVectorStore } from "./vector.service.js";
import { successresponse } from "../../common/utilits/responce.success.js";
import medicalhistorymodel from "../../DB/models/medicalhistorymodel.js";
import doctormodel from "../../DB/models/doctormodel.js";
import usermodel from "../../DB/models/usermodel.js";
import sessionmodel from "../../DB/models/sessionmodel.js";

// Upload Knowledge Base Document
export const uploadKnowledgeDocument = async (req, res, next) => {
    try {
        const doctorId = req.user._id.toString();
        const file = req.file;

        if (!file) {
            throw new Error("Please upload a document", { cause: 400 });
        }

        const chunksStored = await processAndStoreDocument(doctorId, file.buffer, file.originalname, file.mimetype);

        return successresponse({
            res,
            status: 200,
            message: `Document processed successfully. Extracted ${chunksStored} vector chunks.`,
        });
    } catch (error) {
        next(error);
    }
};

export const bulkUploadKnowledgeDocuments = async (req, res, next) => {
    try {
        const doctorId = req.user._id.toString();
        const files = req.files;

        if (!files || files.length === 0) {
            throw new Error("Please upload at least one document", { cause: 400 });
        }

        let totalChunks = 0;
        for (const file of files) {
            const chunks = await processAndStoreDocument(doctorId, file.buffer, file.originalname, file.mimetype);
            if (chunks) totalChunks += chunks;
        }

        return successresponse({
            res,
            status: 200,
            message: `Processed ${files.length} documents successfully. Extracted ${totalChunks} vector chunks.`,
        });
    } catch (error) {
        next(error);
    }
};

export const clearKnowledgeBase = async (req, res, next) => {
    try {
        const doctorId = req.user._id.toString();
        const success = await clearVectorStore(doctorId);
        return successresponse({ res, status: 200, message: success ? "Knowledge base cleared successfully" : "Knowledge base is already empty" });
    } catch (error) {
        next(error);
    }
};

export const updateKnowledgeBaseSettings = async (req, res, next) => {
    try {
        const doctorId = req.user._id.toString();
        const { vectorDbPath } = req.body;
        
        await doctormodel.findOneAndUpdate({ userId: doctorId }, { vectorDbPath });
        
        return successresponse({ res, status: 200, message: "Settings updated successfully" });
    } catch (error) {
        next(error);
    }
};

export const getKnowledgeBase = async (req, res, next) => {
    try {
        const doctorId = req.user._id.toString();
        const info = await getKnowledgeBaseInfo(doctorId);
        import("fs").then(fs => fs.writeFileSync("kb_success.txt", JSON.stringify(info)));
        return successresponse({ res, status: 200, message: "Knowledge base info retrieved", data: info });
    } catch (error) {
        import("fs").then(fs => fs.writeFileSync("kb_fail.txt", error.stack || error.message));
        next(error);
    }
};

export const deleteFromKnowledgeBase = async (req, res, next) => {
    try {
        const doctorId = req.user._id.toString();
        const { fileName } = req.params;
        if (!fileName) throw new Error("File name is required", { cause: 400 });

        const success = await deleteDocumentFromVectorStore(doctorId, fileName);
        if (!success) {
            throw new Error("File not found in knowledge base", { cause: 404 });
        }
        return successresponse({ res, status: 200, message: "File deleted from knowledge base successfully" });
    } catch (error) {
        next(error);
    }
};

// General Doctor Clinical Assistant (RAG)
export const askClinicalAssistant = async (req, res, next) => {
    try {
        const { symptoms, sessionId, patientId: inputPatientId } = req.body;
        const doctorId = req.user._id.toString();

        if (!symptoms) {
            throw new Error("Please provide symptoms or query.", { cause: 400 });
        }

        // --- Context Logic ---
        let patientId = inputPatientId;
        if (sessionId) {
            const session = await sessionmodel.findById(sessionId);
            if (session && session.patientId) {
                patientId = session.patientId.toString();
            }
        }

        let patientContextText = "";
        if (patientId) {
            const patient = await usermodel.findById(patientId).select("fullName gender bloodType");
            
            const currentDoctor = await doctormodel.findOne({ userId: req.user._id });
            const specialty = currentDoctor ? currentDoctor.specialization : null;

            let finalEncounters = [];

            if (specialty) {
                const peerDoctors = await doctormodel.find({ specialization: specialty }).select("userId");
                const peerDoctorIds = peerDoctors.map(d => d.userId);

                const specialtyEncounters = await medicalhistorymodel.find({ 
                    patientId, 
                    doctorId: { $in: peerDoctorIds }
                }).sort({ createdAt: -1 }).limit(5).lean();

                finalEncounters = [...specialtyEncounters];

                if (finalEncounters.length < 5) {
                    const gap = 5 - finalEncounters.length;
                    const otherEncounters = await medicalhistorymodel.find({
                        patientId,
                        doctorId: { $nin: peerDoctorIds }
                    }).sort({ createdAt: -1 }).limit(gap).lean();
                    
                    finalEncounters = [...finalEncounters, ...otherEncounters];
                }
            } else {
                finalEncounters = await medicalhistorymodel.find({ patientId })
                    .sort({ createdAt: -1 }).limit(5).lean();
            }

            if (patient || finalEncounters.length > 0) {
                patientContextText = `
--- CURRENT PATIENT CONTEXT ---
Name: ${patient?.fullName || "Unknown"}
Gender: ${patient?.gender || "Unknown"}
Blood Type: ${patient?.bloodType || "N/A"}

Recent Encounters (Specialty-Filtered):
${finalEncounters.map((enc, idx) => `[Encounter ${idx + 1} - ${new Date(enc.createdAt).toLocaleDateString()}] Diagnosis/Complaint: ${enc.diagnosis || enc.complaint || "N/A"} | Notes: ${enc.notes || "N/A"}`).join("\n")}
-------------------------------
                `;
            }
        }

        // Get context from Vector DB
        const medicalContext = await queryVectorStore(doctorId, symptoms);

        const systemInstruction = `
            You are a Clinical Assistant helping a doctor (your colleague). 
            Always address the user respectfully as "Doctor" and speak in a professional, medical-grade tone. Do NOT address the user as a patient.
            
            ${patientContextText}
            
            If the KNOWLEDGE BASE below contains an answer, you MUST prioritize it.
            
            KNOWLEDGE BASE:
            ${medicalContext || "No specific protocols found in database."}
        `;

        const response = await generateResponse(`User Query: ${symptoms}`, systemInstruction);

        return successresponse({
            res,
            status: 200,
            message: "AI Response generated",
            data: { response, usedContext: !!medicalContext }
        });

    } catch (error) {
        next(error);
    }
};

// -------------------------------------------------------------
// Bakry's Features: Doctor AI Insights & Interactions
// -------------------------------------------------------------

export const getPatientInsights = async (req, res, next) => {
    try {
        const { patientId } = req.params;

        if (!patientId) {
            throw new Error("Patient ID is required", { cause: 400 });
        }

        // Fetch last 5 encounters
        const encounters = await medicalhistorymodel.find({ patientId: patientId, status: "completed" })
            .sort({ date: -1 })
            .limit(5)
            .lean();

        if (!encounters || encounters.length === 0) {
            return successresponse({
                res,
                status: 200,
                message: "No history found for insights.",
                data: { insights: "No previous medical history available to analyze." }
            });
        }

        // Format history for AI
        const historyText = encounters.map((enc, index) => `
            Encounter ${index + 1} (${enc.date || "Unknown Date"}):
            Complaint: ${enc.complaint || "N/A"}
            Diagnosis: ${enc.diagnosis || "N/A"}
            Treatment/Prescription: ${enc.treatmentPlan || enc.notes || "N/A"}
        `).join("\n");

        const systemInstruction = `
            You are a highly skilled Medical AI Assistant helping a doctor.
            Analyze the patient's last 5 encounters and provide a concise, bullet-point summary of key medical insights.
            Highlight any recurring patterns, chronic issues, or warnings the doctor should be aware of today.
        `;

        const prompt = `Here is the patient's history:\n${historyText}\n\nPlease provide your clinical insights.`;
        const aiResponse = await generateResponse(prompt, systemInstruction);

        return successresponse({
            res,
            status: 200,
            message: "Patient insights generated successfully.",
            data: { insights: aiResponse }
        });

    } catch (error) {
        next(error);
    }
};

export const checkDrugInteractions = async (req, res, next) => {
    try {
        const { currentDrugs, newDrugs, newComplaint } = req.body;

        if (!currentDrugs && !newDrugs && !newComplaint) {
            throw new Error("Please provide current drugs, new drugs, or a new complaint to check.", { cause: 400 });
        }

        const systemInstruction = `
            You are a Clinical Pharmacist AI. Your job is to check for:
            1. Drug-Drug Interactions (if multiple drugs are provided).
            2. Side Effects: If a new complaint is provided alongside current drugs, check if the complaint is a known side effect.
            3. Safe Alternatives: If there is an interaction, briefly suggest a safer alternative class of medication.
            
            Keep your analysis professional, concise, and medical-grade. 
            
            CRITICAL: You MUST respond in pure JSON format exactly like this:
            {
                "severity": "SAFE" | "WARNING" | "DANGER",
                "analysis": "Your detailed markdown analysis here"
            }
            Use "SAFE" if no issues or very minor theoretical interactions.
            Use "WARNING" if there are moderate interactions or side effects to monitor.
            Use "DANGER" if there are severe, contraindicated interactions.
            Do not wrap the JSON in markdown code blocks, output pure JSON only.
        `;

        const prompt = `
            Current Medications: ${currentDrugs ? currentDrugs.join(", ") : "None"}
            New Medications being considered: ${newDrugs ? newDrugs.join(", ") : "None"}
            Patient's New Complaint (to check against side effects): ${newComplaint || "None"}
        `;

        const aiResponse = await generateResponse(prompt, systemInstruction);

        let parsedResult;
        try {
            // Strip any markdown json blocks if the LLM ignores instructions
            const cleaned = aiResponse.replace(/```json/gi, '').replace(/```/gi, '').trim();
            parsedResult = JSON.parse(cleaned);
        } catch (e) {
            // Fallback if not pure JSON
            parsedResult = {
                severity: "WARNING",
                analysis: aiResponse
            };
        }

        return successresponse({
            res,
            status: 200,
            message: "Interaction check completed.",
            data: { 
                analysis: parsedResult.analysis,
                severity: parsedResult.severity
            }
        });

    } catch (error) {
        next(error);
    }
};

// -------------------------------------------------------------
// User/Patient Features: Booking Chatbot
// -------------------------------------------------------------

export const patientChatbot = async (req, res, next) => {
    try {
        const { message } = req.body;

        if (!message) {
            throw new Error("Message is required", { cause: 400 });
        }

        // Step 1: Extract filters using AI
        const extractionPrompt = `
            Extract the requested doctor specialty and location from the following user message.
            Return ONLY a valid JSON object with keys "specialty" and "address". 
            If a field is not mentioned, leave it empty string "". Do not include markdown code blocks.
            Message: "${message}"
        `;
        
        const extractedText = await generateResponse(extractionPrompt, "You are a JSON parser. Output only JSON.");
        let filters = { specialty: "", address: "" };
        try {
            filters = JSON.parse(extractedText.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim());
        } catch (e) {
            console.error("AI JSON Parse Error:", e);
        }

        // Step 2: Query DB
        const matchQuery = {};
        if (filters.specialty) {
            matchQuery.specialization = { $regex: filters.specialty, $options: "i" };
        }

        const doctors = await doctormodel.find(matchQuery)
            .populate({
                path: "userId",
                match: { status: "approved" },
                select: "fullName address phoneNumber profilepicture"
            })
            .lean();

        // Filter out null userIds (doctors who aren't approved) and match address if provided
        const availableDoctors = doctors.filter(doc => {
            if (!doc.userId) return false;
            if (filters.address && doc.userId.address) {
                return doc.userId.address.toLowerCase().includes(filters.address.toLowerCase());
            }
            return true;
        }).slice(0, 5); // Limit to top 5 matches

        // Step 3: Formulate final response
        const doctorsContext = availableDoctors.map(doc => 
            `- Dr. ${doc.userId?.fullName} (${doc.specialization}). Address: ${doc.userId?.address || "N/A"}. Phone: ${doc.userId?.phoneNumber || "N/A"}`
        ).join("\n");

        const finalSystemPrompt = `
            You are a polite, helpful patient assistant chatbot for CareHub.
            A patient asked: "${message}"
            
            We searched our database and found these doctors:
            ${doctorsContext || "No doctors found matching the criteria."}
            
            Write a friendly, empathetic response in Arabic suggesting these doctors to the patient. 
            If no doctors were found, politely ask them to modify their search.
        `;

        const finalResponse = await generateResponse("Respond to the patient based on the search results.", finalSystemPrompt);

        return successresponse({
            res,
            status: 200,
            message: "Chatbot replied",
            data: { reply: finalResponse, filters, foundCount: availableDoctors.length }
        });

    } catch (error) {
        next(error);
    }
};
