import usermodel from "../../DB/models/usermodel.js";
import patientmodel from "../../DB/models/patientmodel.js";
import doctormodel from "../../DB/models/doctormodel.js";
import prescrptionmodel from "../../DB/models/prescriptionmodel.js";
import medicalhistorymodel from "../../DB/models/medicalhistorymodel.js";
import * as db_service from "../../DB/db.service.js";
import { successresponse } from "../../common/utilits/responce.success.js";
import { roleenum } from "../../common/enum/user.enum.js";

export const getDashboard = async (req, res, next) => {
    try {
        const [
            totalUsers,
            totalDoctors,
            totalPatients,
            pendingDoctors,
            totalPrescriptions,
            totalMedicalHistories
        ] = await Promise.all([
            db_service.count({ model: usermodel, filter: {} }),
            db_service.count({ model: usermodel, filter: { role: roleenum.doctor } }),
            db_service.count({ model: patientmodel, filter: {} }),
            db_service.count({ model: usermodel, filter: { role: roleenum.doctor, confirmed: false } }),
            db_service.count({ model: prescrptionmodel, filter: {} }),
            db_service.count({ model: medicalhistorymodel, filter: {} })
        ]);

        return successresponse({
            res,
            status: 200,
            message: "admin dashboard stats fetched successfully",
            data: {
                totalUsers,
                totalDoctors,
                totalPatients,
                pendingDoctors,
                totalPrescriptions,
                totalMedicalHistories
            }
        });
    } catch (error) {
        next(error);
    }
};