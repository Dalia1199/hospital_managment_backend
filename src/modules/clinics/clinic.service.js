import clinicmodel from "../../DB/models/clinic_model.js";
import * as db_service from "../../DB/db.service.js";
import { successresponse } from "../../common/utilits/responce.success.js";

// POST /clinics — doctor adds a clinic
export const addClinic = async (req, res, next) => {
    try {
        const { name, address, phone } = req.body;

        const clinic = await db_service.create({
            model: clinicmodel,
            data: { doctorId: req.user._id, name, address, phone }
        });

        return successresponse({ res, status: 201, message: "clinic added successfully", data: clinic });
    } catch (error) {
        next(error);
    }
};

// GET /clinics — doctor gets their own clinics
export const getMyClinics = async (req, res, next) => {
    try {
        const clinics = await db_service.find({
            model: clinicmodel,
            filter: { doctorId: req.user._id, isActive: true },
            sort: { createdAt: -1 }
        });

        return successresponse({ res, status: 200, message: "clinics fetched successfully", data: clinics });
    } catch (error) {
        next(error);
    }
};

// PATCH /clinics/:clinicId — doctor updates a clinic
export const updateClinic = async (req, res, next) => {
    try {
        const { clinicId } = req.params;

        const clinic = await db_service.findOne({
            model: clinicmodel,
            filter: { _id: clinicId, doctorId: req.user._id }
        });

        if (!clinic) throw new Error("clinic not found", { cause: 404 });

        const updated = await db_service.findOneAndUpdate({
            model: clinicmodel,
            filter: { _id: clinicId },
            update: req.body,
            options: { new: true }
        });

        return successresponse({ res, status: 200, message: "clinic updated successfully", data: updated });
    } catch (error) {
        next(error);
    }
};

// DELETE /clinics/:clinicId — doctor deletes a clinic (soft delete)
export const deleteClinic = async (req, res, next) => {
    try {
        const { clinicId } = req.params;

        const clinic = await db_service.findOne({
            model: clinicmodel,
            filter: { _id: clinicId, doctorId: req.user._id }
        });

        if (!clinic) throw new Error("clinic not found", { cause: 404 });

        await db_service.findOneAndUpdate({
            model: clinicmodel,
            filter: { _id: clinicId },
            update: { isActive: false }
        });

        return successresponse({ res, status: 200, message: "clinic deleted successfully" });
    } catch (error) {
        next(error);
    }
};

// GET /clinics/doctor/:doctorId — patient gets doctor clinics
export const getDoctorClinics = async (req, res, next) => {
    try {
        const { doctorId } = req.params;

        const clinics = await db_service.find({
            model: clinicmodel,
            filter: { doctorId, isActive: true }
        });

        return successresponse({ res, status: 200, message: "clinics fetched successfully", data: clinics });
    } catch (error) {
        next(error);
    }
};