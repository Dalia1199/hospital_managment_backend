import usermodel from "../../DB/models/usermodel.js";
import { successresponse } from "../../common/utilits/responce.success.js";
import { roleenum } from "../../common/enum/user.enum.js";
import * as db_service from "../../DB/db.service.js";

export const getPendingDoctors = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const pendingDoctors = await db_service.find({
            model: usermodel,
            filter: { 
                role: roleenum.doctor,
                status: "pending"
            }, 
            options: {
                skip,
                limit,
                select: "-password",
                sort: { createdAt: 1 }
            }
        });
        return successresponse({ res, data: pendingDoctors });
    } catch (error) {
        next(error);
    }
};



///////////for approve and reject doctor 

export const approveDoctor = async (req, res, next) => {
    try {
        const doctor = await db_service.findOne({
            model: usermodel,
            filter: { _id: req.params.id, role: roleenum.doctor, status: "pending" }
        });

        if (!doctor) {
            throw new Error("No pending doctor found with that ID");
        }

        const updatedDoctor = await db_service.findOneAndUpdate({
            model: usermodel,
            filter: { _id: req.params.id, role: roleenum.doctor, status: "pending" },
            update: { status: "approved" },
            options: { new: true, select: "-password" }
        });

        return successresponse({ res, message: "Doctor approved successfully", data: updatedDoctor });
    } catch (error) {
        next(error);
    }
};

export const rejectDoctor = async (req, res, next) => {
    try {
        const doctor = await db_service.findOne({
            model: usermodel,
            filter: { _id: req.params.id, role: roleenum.doctor, status: "pending" }
        });

        if (!doctor) {
            throw new Error("No pending doctor found with that ID");
        }

        const updatedDoctor = await db_service.findOneAndUpdate({
            model: usermodel,
            filter: { _id: req.params.id, role: roleenum.doctor, status: "pending" },
            update: { status: "rejected" },
            options: { new: true, select: "-password" }
        });

        return successresponse({ res, message: "Doctor rejected successfully", data: updatedDoctor });
    } catch (error) {
        next(error);
    }
};