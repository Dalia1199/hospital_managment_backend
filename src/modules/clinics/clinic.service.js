import clinicmodel from "../../DB/models/clinic_model.js";
import * as db_service from "../../DB/db.service.js";
import { successresponse } from "../../common/utilits/responce.success.js";

// POST /clinics — doctor adds a clinic
export const addClinic = async (req, res, next) => {
    try {
        const { name, address, phone , governorate, whatsapp, landline } = req.body;

        const clinic = await db_service.create({
            model: clinicmodel,
            data: { doctorId: req.user._id, name, address, phone , governorate, whatsapp, landline}
        });

        return successresponse({ res, status: 201, message: "clinic added successfully", data: clinic });
    } catch (error) {
        next(error);
    }
};

// GET /clinics — doctor gets their own clinics
export const getMyClinics = async (req, res, next) => {
    try {
        const filter = { doctorId: req.user._id, isActive: true };

        // If accessed by an assistant, restrict to their assigned clinic only
        if (req.assistant && req.assistant.clinicId) {
            filter._id = req.assistant.clinicId;
        }

        const clinics = await db_service.find({
            model: clinicmodel,
            filter,
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
        const { governorate } = req.query;

         const filter = { doctorId, isActive: true };
        if (governorate) filter.governorate = governorate;

        const clinics = await db_service.find({
            model: clinicmodel,
            filter,
        });

        return successresponse({ res, status: 200, message: "clinics fetched successfully", data: clinics });
    } catch (error) {
        next(error);
    }
};


// ─── Services (embedded in clinic) ───────────────────────────────────────────

// POST /clinics/:clinicId/services
export const addService = async (req, res, next) => {
    try {
        const { clinicId } = req.params;
        const { name, price } = req.body;

        const clinic = await db_service.findOne({
            model: clinicmodel,
            filter: { _id: clinicId, doctorId: req.user._id, isActive: true }
        });
        if (!clinic) throw new Error("clinic not found", { cause: 404 });

        clinic.services.push({ name, price });
        await clinic.save();

        const newService = clinic.services[clinic.services.length - 1];
        return successresponse({ res, status: 201, message: "service added successfully", data: newService });
    } catch (error) {
        next(error);
    }
};

// PATCH /clinics/:clinicId/services/:serviceId
export const updateService = async (req, res, next) => {
    try {
        const { clinicId, serviceId } = req.params;
        const { name, price } = req.body;

        const clinic = await db_service.findOne({
            model: clinicmodel,
            filter: { _id: clinicId, doctorId: req.user._id, isActive: true }
        });
        if (!clinic) throw new Error("clinic not found", { cause: 404 });

        const service = clinic.services.id(serviceId);
        if (!service) throw new Error("service not found", { cause: 404 });

        if (name  !== undefined) service.name  = name;
        if (price !== undefined) service.price = price;
        await clinic.save();

        return successresponse({ res, status: 200, message: "service updated successfully", data: service });
    } catch (error) {
        next(error);
    }
};

// DELETE /clinics/:clinicId/services/:serviceId
export const deleteService = async (req, res, next) => {
    try {
        const { clinicId, serviceId } = req.params;

        const clinic = await db_service.findOne({
            model: clinicmodel,
            filter: { _id: clinicId, doctorId: req.user._id, isActive: true }
        });
        if (!clinic) throw new Error("clinic not found", { cause: 404 });

        const service = clinic.services.id(serviceId);
        if (!service) throw new Error("service not found", { cause: 404 });

        service.deleteOne();
        await clinic.save();

        return successresponse({ res, status: 200, message: "service deleted successfully" });
    } catch (error) {
        next(error);
    }
};
