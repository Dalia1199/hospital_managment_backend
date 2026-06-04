import prescrptionmodel from "../../DB/models/prescriptionmodel.js";
import * as db_service from "../../DB/db.service.js";
import { successresponse } from "../../common/utilits/responce.success.js"

export const getPatientPrescriptions = async (req, res, next) => {
    try {
        const { patientId } = req.params;

        // patient can only access their own prescriptions
        if (req.user.role === "patient" && req.user._id.toString() !== patientId) {
            return res.status(403).json({ message: "not authorized to access this patient's prescriptions" });
        }

        const prescriptions = await db_service.find({
            model: prescrptionmodel,
            filter: { patientId },
            options: {
                populate: [
                    { path: "doctorId", select: "userName email" },
                    { path: "medicalHistoryId" }
                ],
                sort: { createdAt: -1 }
            }
        });

        return successresponse({
            res,
            status: 200,
            message: "prescriptions fetched successfully",
            data: prescriptions
        });
    } catch (error) {
        next(error);
    }
};