import { roleenum } from "../enum/user.enum.js";
import { AssistantModel } from "../../DB/models/assistant_model.js";
import { ActionLogModel } from "../../DB/models/action_log_model.js";
import sessionmodel from "../../DB/models/sessionmodel.js";

// Middleware to check if user has a specific assistant permission (if they are an assistant)
// If they are a doctor, they bypass this check.
export const requirePermission = (permissionKeys) => {
    return async (req, res, next) => {
        try {
            if (req.user.role === roleenum.assistant) {
                const assistant = await AssistantModel.findOne({ userId: req.user._id });
                if (!assistant) {
                    return res.status(403).json({ message: "Assistant record not found." });
                }
                
                if (assistant.isActive === false) {
                    return res.status(403).json({ message: "Account suspended. Please contact your doctor." });
                }

                const keys = Array.isArray(permissionKeys) ? permissionKeys : [permissionKeys];
                const hasPermission = keys.some(key => assistant.permissions && assistant.permissions[key]);

                if (!hasPermission) {
                    return res.status(403).json({ message: `Access denied. Missing permission: ${keys.join(' or ')}` });
                }

                // Attach assistant to request for later use (e.g., logging)
                req.assistant = assistant;
                req.originalUserId = req.user._id;
                req.user._id = assistant.doctorId; // Trick downstream services to use doctor's data
                req.originalRole = req.user.role;
                req.user.role = roleenum.doctor; // Spoof role so authorization([...]) passes
                
                return next();
            }

            // For all other roles (doctor, patient, admin), let the normal authorization middleware handle it
            return next();
        } catch (error) {
            return res.status(500).json({ message: "Server error in permission check.", error: error.message });
        }
    };
};

export const spoofAssistantToDoctor = async (req, res, next) => {
    try {
        if (req.user.role === roleenum.assistant) {
            const assistant = await AssistantModel.findOne({ userId: req.user._id });
            if (!assistant) {
                return res.status(403).json({ message: "Assistant record not found." });
            }

            if (assistant.isActive === false) {
                return res.status(403).json({ message: "Account suspended. Please contact your doctor." });
            }

            req.assistant = assistant;
            req.originalUserId = req.user._id;
            req.user._id = assistant.doctorId; // Trick downstream services to use doctor's data
            req.originalRole = req.user.role;
            req.user.role = roleenum.doctor; // Spoof role
            
            return next();
        }
        return next();
    } catch (error) {
        return res.status(500).json({ message: "Server error in role spoofing.", error: error.message });
    }
};

export const logAction = async (req, action, details = {}) => {
    try {
        if (req.originalRole === roleenum.assistant && req.assistant) {
            let enrichedDetails = { ...details };
            
            // Auto-resolve sessionId to Patient Name
            if (enrichedDetails.sessionId) {
                try {
                    const session = await sessionmodel.findById(enrichedDetails.sessionId).populate("patientId", "fullName");
                    if (session) {
                        enrichedDetails.patientName = session.isOfflinePatient ? session.guestName : (session.patientId ? session.patientId.fullName : "Unknown");
                        if (!session.isOfflinePatient && session.patientId) {
                            enrichedDetails.patientId = session.patientId._id.toString();
                        }
                    }
                } catch (err) {
                    console.error("Failed to enrich log details with session data:", err);
                }
            }

            await ActionLogModel.create({
                assistantId: req.assistant.userId,
                doctorId: req.assistant.doctorId,
                action,
                details: enrichedDetails
            });
        }
    } catch (error) {
        console.error("Failed to log action:", error);
    }
};

export const auditLogger = (action) => {
    return (req, res, next) => {
        const originalJson = res.json;
        res.json = function (body) {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                // Filter out sensitive info from details if needed, but for now log params and body
                const details = { ...req.params, ...req.body };
                delete details.password; // basic sanitization
                logAction(req, action, details);
            }
            return originalJson.apply(this, arguments);
        };
        next();
    };
};
