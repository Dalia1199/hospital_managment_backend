import medicalhistorymodel from "../../DB/models/medicalhistorymodel.js";
import answermodel from "../../DB/models/answermodel.js";
import { successresponse } from "../../common/utilits/responce.success.js";
import { roleenum } from "../../common/enum/user.enum.js";
import cloudinary from "../../common/utilits/cloudinary.js";
import { checkDoctorAccess } from "../doctor/doctor.service.js";

export const createMedicalHistory = async (req, res, next) => {
    const { isOfflinePatient, patientId, guestName, guestPhone, diagnosis, notes } = req.body;

    let answers = [];
    if (!isOfflinePatient && patientId) {
        answers = await answermodel.find({ patientId });
    }

    const history = await medicalhistorymodel.create({
        isOfflinePatient,
        patientId: isOfflinePatient ? undefined : patientId,
        guestName,
        guestPhone,
        doctorId: req.user._id,
        diagnosis,
        notes,
        answers: answers.map((a) => a._id)
    });

    successresponse({
        res,
        message: "medical history created",
        data: history
    });
};


export const getMedicalHistory = async (req, res, next) => {
    try {
        const { patientId } = req.params;

        if (
            req.user.role === roleenum.patient &&
            req.user._id.toString() !== patientId
        ) {
            throw new Error("not authorized", { cause: 403 });
        }

        let filter = { patientId };

        if (req.user.role === "doctor") {
            const { hasAccess, sharingSetting } = await checkDoctorAccess(req.user._id, patientId);
            if (!hasAccess) {
                throw new Error("Access denied. Patient's medical history is protected.", { cause: 403 });
            }
            if (sharingSetting === "own_only") {
                filter.doctorId = req.user._id;
            }
        }

        const history = await medicalhistorymodel
            .find(filter)
            .sort({ createdAt: -1 })
            .populate("answers")
            .populate("doctorId")
            .populate("prescriptions");
        successresponse({
            res,
            data: history
        });
    } catch (error) {
        next(error);
    }
};


export const uploadDocument = async (req, res, next) => {
    const { historyId } = req.params;

    const files = req.files;

    const uploadedDocs = await Promise.all(
        files.map(async (file, index) => {
            const { secure_url, public_id } =
                await cloudinary.uploader.upload(file.path, {
                    folder: "carehub/medical-history"
                });

            return {
                type: req.body.type?.[index] || "",
                title: req.body.title?.[index] || "",
                notes: req.body.notes?.[index] || "",
                secure_url,
                public_id,
                uploadedBy: req.user._id
            };
        })
    );

    const history = await medicalhistorymodel.findByIdAndUpdate(
        historyId,
        {
            $push: {
                documents: { $each: uploadedDocs }
            }
        },
        { new: true }
    );

    successresponse({
        res,
        message: "documents uploaded successfully",
        data: history
    });
};
export const deleteMedicalHistory = async (req, res, next) => {
    const { historyId } = req.params;

    const history = await medicalhistorymodel.findById(historyId);

    if (!history) {
        throw new Error("medical history not found");
    }

    if (history.documents?.length) {
        await Promise.all(
            history.documents.map((doc) =>
                cloudinary.uploader.destroy(doc.public_id)
            )
        );
    }

    await medicalhistorymodel.findByIdAndDelete(historyId);

    successresponse({
        res, message: "medical history deleted successfully"
    });
};