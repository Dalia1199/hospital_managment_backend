import { Router } from "express";
import { uploadKnowledgeDocument, bulkUploadKnowledgeDocuments, clearKnowledgeBase, updateKnowledgeBaseSettings, askClinicalAssistant, getPatientInsights, checkDrugInteractions, patientChatbot, getKnowledgeBase, deleteFromKnowledgeBase, getDifferentialDiagnosis } from "./ai.controller.js";
import { authentication } from "../../common/middleware/authenticataiaon.js";
import { authorization } from "../../common/middleware/authorization.js";
import multer from "multer";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() }); // Process in memory to send to PDF parser

// Routes
router.post("/upload", authentication, authorization(["doctor"]), upload.single("file"), uploadKnowledgeDocument);
router.post("/upload/bulk", authentication, authorization(["doctor"]), upload.array("files", 100), bulkUploadKnowledgeDocuments);
router.get("/knowledge-base", authentication, authorization(["doctor"]), getKnowledgeBase);
router.delete("/knowledge-base/clear", authentication, authorization(["doctor"]), clearKnowledgeBase);
router.put("/knowledge-base/settings", authentication, authorization(["doctor"]), updateKnowledgeBaseSettings);
router.delete("/knowledge-base/:fileName", authentication, authorization(["doctor"]), deleteFromKnowledgeBase);
router.post("/ask", authentication, authorization(["doctor"]), askClinicalAssistant);
router.get("/patient/:patientId/insights", authentication, authorization(["doctor"]), getPatientInsights);
router.post("/interactions", authentication, authorization(["doctor", "pharmacist"]), checkDrugInteractions);
router.post("/chatbot", authentication, authorization(["patient", "user"]), patientChatbot);
router.post("/differential-diagnosis", authentication, authorization(["doctor"]), getDifferentialDiagnosis);

export default router;
