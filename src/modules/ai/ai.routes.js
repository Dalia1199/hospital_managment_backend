import { Router } from "express";
import { 
    uploadKnowledgeDocument, 
    bulkUploadKnowledgeDocuments, 
    clearKnowledgeBase, 
    createDatabaseController, 
    setActiveDatabaseController, 
    askClinicalAssistant, 
    getPatientInsights, 
    checkDrugInteractions, 
    patientChatbot, 
    getKnowledgeBase, 
    deleteFromKnowledgeBase, 
    getDifferentialDiagnosis 
} from "./ai.controller.js";
import { authentication } from "../../common/middleware/authenticataiaon.js";
import { authorization } from "../../common/middleware/authorization.js";
import { requireFeature } from "../../common/middleware/subscriptionGuard.js";
import multer from "multer";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() }); // Process in memory to send to PDF parser

// Routes
router.post("/upload", authentication, authorization(["doctor"]), requireFeature("ai"), upload.single("file"), uploadKnowledgeDocument);
router.post("/upload/bulk", authentication, authorization(["doctor"]), requireFeature("ai"), upload.array("files", 100), bulkUploadKnowledgeDocuments);
router.get("/knowledge-base", authentication, authorization(["doctor"]), requireFeature("ai"), getKnowledgeBase);
router.post("/knowledge-base/databases", authentication, authorization(["doctor"]), requireFeature("ai"), createDatabaseController);
router.put("/knowledge-base/databases/active", authentication, authorization(["doctor"]), requireFeature("ai"), setActiveDatabaseController);
router.delete("/knowledge-base/clear", authentication, authorization(["doctor"]), requireFeature("ai"), clearKnowledgeBase);
router.delete("/knowledge-base/:fileName", authentication, authorization(["doctor"]), requireFeature("ai"), deleteFromKnowledgeBase);
router.post("/ask", authentication, authorization(["doctor"]), requireFeature("ai"), askClinicalAssistant);
router.get("/patient/:patientId/insights", authentication, authorization(["doctor"]), requireFeature("ai"), getPatientInsights);
router.post("/interactions", authentication, authorization(["doctor", "pharmacist"]), requireFeature("ai"), checkDrugInteractions);
router.post("/chatbot", authentication, authorization(["patient", "user"]), patientChatbot);
router.post("/differential-diagnosis", authentication, authorization(["doctor"]), requireFeature("ai"), getDifferentialDiagnosis);

export default router;
