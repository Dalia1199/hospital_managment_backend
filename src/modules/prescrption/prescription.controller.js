import { Router } from "express";
import { createPrescriptionSchema } from "./prescription.validation.js";
import { createPrescription } from "./prescription.service.js";
import { authentication } from "../../common/middleware/authenticataiaon.js";

const prescrptionrouter = Router()

export const createPrescriptionController = async (req, res) => {
    // ── 1. Role guard ─────────────────────────────────────────────────────────
    if (req.user?.role !== "doctor") {
        return res.status(403).json({
            success: false,
            message: "Access denied. Only doctors can create prescriptions.",
        });
    }

    // ── 2. Validate request body ──────────────────────────────────────────────
    const { error, value } = createPrescriptionSchema.validate(req.body, {
        abortEarly: false,  // collect ALL validation errors at once
        stripUnknown: true, // drop any fields not in the schema
    });

    if (error) {
        return res.status(400).json({
            success: false,
            message: "Validation failed",
            errors: error.details.map((d) => d.message),
        });
    }

    // ── 3. Create prescription ─────────────────────────────────────────────────
    const prescription = await createPrescription({
        patientId: value.patientId,
        doctorId: "6650c8b12ab34f56cd789012",
        diagnosis: value.diagnosis,
        medicines: value.medicines,
        notes: value.notes,
    });

    // ── 4. Respond ────────────────────────────────────────────────────────────
    return res.status(201).json({
        success: true,
        message: "Prescription created successfully",
        data: { prescription },
    });
};

prescrptionrouter.post(
    "/create",
    authentication,
    createPrescriptionController
)

export default prescrptionrouter