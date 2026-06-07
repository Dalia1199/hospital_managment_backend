import usermodel from "../../DB/models/usermodel.js";
import patientmodel from "../../DB/models/patientmodel.js";
import doctormodel from "../../DB/models/doctormodel.js";
import prescrptionmodel from "../../DB/models/prescriptionmodel.js";
import medicalhistorymodel from "../../DB/models/medicalhistorymodel.js";
import * as db_service from "../../DB/db.service.js";
import { successresponse } from "../../common/utilits/responce.success.js";
import { roleenum } from "../../common/enum/user.enum.js";




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

        //علشان اجيب ال license بتاع كل doctor لازم اعمل loop عشان اجيب ال details بتاعه من ال doctormodel
        const doctorsWithLicense = await Promise.all(
            pendingDoctors.map(async (doctor) => {
                const doctorDetails = await db_service.findOne({
                    model: doctormodel,
                    filter: { userId: doctor._id }
                });
                return {
                    ...doctor.toObject(),
                    licenseUrl: doctorDetails?.licenseimage?.secure_url ?? null,
                    specialty: doctorDetails?.specialization ?? null,
                };
            })
        );

        return successresponse({ res, data: doctorsWithLicense });
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

///////////get all doctors for admin for show them at approval page and filter them by status pending or approved or rejected or blocked
export const getAllDoctors = async (req, res, next) => {
    try {
        const { status } = req.query;
        const filter = { role: roleenum.doctor };
        if (status) filter.status = status;

        const doctors = await db_service.find({
            model: usermodel,
            filter,
            options: {
                select: "-password",
                sort: { createdAt: -1 }
            }
        });

        const doctorsWithDetails = await Promise.all(
            doctors.map(async (doctor) => {
                const doctorDetails = await db_service.findOne({
                    model: doctormodel,
                    filter: { userId: doctor._id }
                });
                return {
                    ...doctor.toObject(),
                    licenseUrl: doctorDetails?.licenseimage?.secure_url ?? null,
                    nationalIdUrl: doctorDetails?.nationalId?.secure_url ?? null,
                    specialty: doctorDetails?.specialization ?? null,
                };
            })
        );

        return successresponse({ res, data: doctorsWithDetails });
    } catch (error) {
        next(error);
    }
};


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
;

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
                totalMedicalHistories}
});
    } catch (error) { next(error); }
};
                               // get all users by role with pagination
export const getallusers = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, role } = req.query;

        const currentPage = parseInt(page);
        const itemsPerPage = parseInt(limit);

        const skip = (currentPage - 1) * itemsPerPage;

        const filter = role ? { role } : {};

        const users = await db_service.find({
            model: usermodel,
            filter: filter,
            options: {
                skip: skip,
                limit: itemsPerPage,
                select: "-password"
            }
        });

        const totalCount = await db_service.count({
            model: usermodel,
            filter: filter
        });

        const totalPages = Math.ceil(totalCount / itemsPerPage);
      return successresponse({
            res,
            status: 200,
      
            message: "Users fetched successfully",
            data: {
                users,
                pagination: {
                    totalCount,
                    totalPages,
                    currentPage,
                    itemsPerPage
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

export const activateUser = async (req, res, next) => {
    try {
        const { id } = req.params;

        const user = await usermodel.findByIdAndUpdate(
            id,
            { status: "active" },
            { new: true }
        )

        if (!user) return next(new Error("User not found"), { cause: 404 });

        return successresponse({ res, status: 200, message: "User activated successfully", data: user });
    }
    catch (error) {
        next(error);
    }
};

export const deactivateUser = async (req, res, next) => {
    try {
        const { id } = req.params;

        const user = await usermodel.findByIdAndUpdate(
            id,
            { status: "blocked" },
            { new: true }
        )
        
        if (!user) return next(new Error("User not found"), { cause: 404 });
        
        return successresponse({ res, status: 200, message: "User deactivated successfully", data: user });
    }
    catch (error) {
        next(error);
    }
};
