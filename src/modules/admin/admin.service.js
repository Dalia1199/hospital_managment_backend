import usermodel from "../../DB/models/usermodel.js";
import patientmodel from "../../DB/models/patientmodel.js";
import doctormodel from "../../DB/models/doctormodel.js";
import prescrptionmodel from "../../DB/models/prescriptionmodel.js";
import medicalhistorymodel from "../../DB/models/medicalhistorymodel.js";
import appointments_model from "../../DB/models/appointments_model.js";
import * as db_service from "../../DB/db.service.js";
import { successresponse } from "../../common/utilits/responce.success.js";
import { roleenum } from "../../common/enum/user.enum.js";
import { eventemitter } from "../../common/utilits/email/email.events.js";
import { emailenum } from "../../common/enum/emailenum.js";
import { generateotp, sendemail } from "../../common/utilits/email/send email.js";
import { otp_key, max_otp_key, setvalue } from "../../DB/redis/redis.service.js";
import { hash } from "../../common/utilits/security/hash.js";
import { decrypt, encrypt } from "../../common/utilits/security/encrypt.js";
import cloudinary from "../../common/utilits/cloudinary.js";


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
                sort: { createdAt: 1 },
                lean: true
            }
        });

        const doctorsWithLicense = await Promise.all(
            pendingDoctors.map(async (doctor) => {
                const doctorDetails = await db_service.findOne({
                    model: doctormodel,
                    filter: { userId: doctor._id }
                });
                return {
                    ...doctor,
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

        // بعت OTP للدكتور بعد الـ approve
        const otp = await generateotp();
        eventemitter.emit(emailenum.confirmemail, async () => {
            await sendemail({
                to: doctor.email,
                subject: "Your account has been approved - CareHub",
                html: `<p>Congratulations! Your account has been approved. Your OTP is: ${otp}</p>`
            });
            await setvalue({
                key: otp_key({ email: doctor.email, subject: emailenum.confirmemail }),
                value: hash({ plain_text: `${otp}` }),
                ttl: 60 * 10
            });
            await setvalue({
                key: max_otp_key({ email: doctor.email }),
                value: 1,
                ttl: 60 * 3
            });
        });

        return successresponse({ res, message: "Doctor approved successfully", data: updatedDoctor });
    } catch (error) {
        next(error);
    }
};

export const rejectDoctor = async (req, res, next) => {
    try {
        const { reason } = req.body;

        const doctor = await db_service.findOne({
            model: usermodel,
            filter: { _id: req.params.id, role: roleenum.doctor, status: "pending" }
        });

        if (!doctor) {
            throw new Error("No pending doctor found with that ID");
        }

        const updatedDoctor = await usermodel.findByIdAndUpdate(
            req.params.id,
            { status: "rejected" },
            { new: true, select: "-password" }
        );

        // بعت email للدكتور بسبب الرفض
        eventemitter.emit(emailenum.confirmemail, async () => {
            await sendemail({
                to: doctor.email,
                subject: "Your registration was rejected - CareHub",
                html: `
                    <p>Dear ${doctor.fullName},</p>
                    <p>Unfortunately, your registration request has been rejected.</p>
                    ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
                    <p>If you have any questions, please contact support.</p>
                `
            });
        });

        return successresponse({ res, message: "Doctor rejected successfully", data: updatedDoctor });
    } catch (error) {
        next(error);
    }
};

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
                sort: { createdAt: -1 },
                lean: true
            }
        });

        const doctorsWithDetails = await Promise.all(
            doctors.map(async (doctor) => {
                const doctorDetails = await db_service.findOne({
                    model: doctormodel,
                    filter: { userId: doctor._id }
                });
                return {
                    ...doctor,
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
            rejectedDoctors,
            totalPrescriptions,
            totalMedicalHistories,
            totalAppointments
        ] = await Promise.all([
            db_service.count({ model: usermodel, filter: {} }),
            db_service.count({ model: usermodel, filter: { role: roleenum.doctor } }),
            db_service.count({ model: patientmodel, filter: {} }),
            db_service.count({ model: usermodel, filter: { role: roleenum.doctor, status: "pending" } }),
            db_service.count({ model: usermodel, filter: { role: roleenum.doctor, status: "rejected" } }),
            db_service.count({ model: prescrptionmodel, filter: {} }),
            db_service.count({ model: medicalhistorymodel, filter: {} }),
            db_service.count({ model: appointments_model, filter: {} })
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
                rejectedDoctors,
                totalPrescriptions,
                totalMedicalHistories,
                totalAppointments
            }
        });
    } catch (error) { next(error); }
};

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
                select: "-password",
                lean: true
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
        );

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
        );

        if (!user) return next(new Error("User not found"), { cause: 404 });

        return successresponse({ res, status: 200, message: "User deactivated successfully", data: user });
    }
    catch (error) {
        next(error);
    }
};

export const resetToPending = async (req, res, next) => {
    try {
        const doctor = await usermodel.findByIdAndUpdate(
            req.params.id,
            { status: "pending" },
            { new: true, select: "-password" }
        );
        if (!doctor) throw new Error("Doctor not found");
        return successresponse({ res, message: "Doctor reset to pending", data: doctor });
    } catch (error) {
        next(error);
    }
};


// ─── GET /admin/profile ───────────────────────────────────────────────────────
export const getAdminProfile = async (req, res, next) => {
    try {
        return successresponse({
            res,
            status: 200,
            message: "Profile fetched successfully",
            data: {
                fullName: req.user.fullName,
                email: req.user.email,
                phoneNumber: req.user.phoneNumber ? decrypt(req.user.phoneNumber) : "",
                address: req.user.address,
                profilepicture: req.user.profilepicture,
            }
        });
    } catch (error) {
        next(error);
    }
};

// ─── PATCH /admin/profile ─────────────────────────────────────────────────────


export const updateAdminProfile = async (req, res, next) => {
    try {
        const { fullName, phoneNumber, address } = req.body;

        if (fullName !== undefined) req.user.fullName = fullName;
        if (address !== undefined) req.user.address = address;
        if (phoneNumber !== undefined) req.user.phoneNumber = encrypt(phoneNumber);
        await req.user.save();

        return successresponse({
            res,
            message: "Profile updated successfully",
            data: {
                fullName: req.user.fullName,
                phoneNumber: decrypt(req.user.phoneNumber),
                address: req.user.address,
            }
        });
    } catch (error) {
        next(error);
    }
};

export const approveDoctorLicense = async (req, res, next) => {
    try {
        const { id } = req.params
        const doctor = await db_service.findOne({
            model: doctormodel,
            filter: { userId: id }
        });

        if (!doctor) {
            throw new Error("doctor not found", { cause: 404 });
        }

        if (!doctor.pendingLicenseImage?.public_id) {
            throw new Error("No pending license update found", { cause: 400 });
        }

        const oldPublicId = doctor.licenseimage?.public_id;
        doctor.licenseimage = doctor.pendingLicenseImage;
        doctor.pendingLicenseImage = null;
        
        await doctor.save();
        
        if (oldPublicId) {
            await cloudinary.uploader.destroy(oldPublicId);
        }

        return successresponse({
            res,
            message: "License approved successfully",
            data: doctor
        });

    }
    catch (error) {
        next(error);
    }
};

export const rejectDoctorLicense = async (req, res, next) => { 
    try {
        const { id } = req.params
        const doctor = await db_service.findOne({
            model: doctormodel,
            filter: { userId: id }
        });
        
        if (!doctor) {
            throw new Error("doctor not found", { cause: 404 });
        }
        
        if (!doctor.pendingLicenseImage?.public_id) {
            throw new Error("No pending license update found", { cause: 400 });
        }
        
        const newPublicId = doctor.pendingLicenseImage?.public_id;
        doctor.pendingLicenseImage = null;
        
        await doctor.save();

        if (newPublicId) {
            await cloudinary.uploader.destroy(newPublicId);
        }

        return successresponse({
            res,
            message: "License is rejected",
            data: doctor
        });

    }
    catch (error) {
        next(error);
    }
}

// ─── GET /admin/stats/monthly ────────────────────────────────────────────────
export const getMonthlyStats = async (req, res, next) => {
    try {
        const year = parseInt(req.query.year) || new Date().getFullYear();
        
        // Define start and end of the year
        const startDate = new Date(`${year}-01-01T00:00:00.000Z`);
        const endDate = new Date(`${year}-12-31T23:59:59.999Z`);

        // We will aggregate users (doctors & patients) joined per month in the given year
        const usersAggregation = await usermodel.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: { $month: "$createdAt" },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { _id: 1 }
            }
        ]);

        // Same for appointments to provide more analytical data
        const appointmentsAggregation = await appointments_model.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: { $month: "$createdAt" },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { _id: 1 }
            }
        ]);

        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        
        const data = months.map((month, index) => {
            const userStat = usersAggregation.find(u => u._id === index + 1);
            const appStat = appointmentsAggregation.find(a => a._id === index + 1);
            return {
                month,
                usersCount: userStat ? userStat.count : 0,
                appointmentsCount: appStat ? appStat.count : 0
            };
        });

        return successresponse({
            res,
            status: 200,
            message: "Monthly stats fetched successfully",
            data
        });
    } catch (error) {
        next(error);
    }
};

// ─── GET /admin/stats/daily ──────────────────────────────────────────────────
export const getDailyStats = async (req, res, next) => {
    try {
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 29);
        thirtyDaysAgo.setHours(0, 0, 0, 0);

        const usersAggregation = await usermodel.aggregate([
            {
                $match: {
                    createdAt: { $gte: thirtyDaysAgo, $lte: today }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: "$createdAt" },
                        month: { $month: "$createdAt" },
                        day: { $dayOfMonth: "$createdAt" }
                    },
                    count: { $sum: 1 }
                }
            }
        ]);

        const appointmentsAggregation = await appointments_model.aggregate([
            {
                $match: {
                    createdAt: { $gte: thirtyDaysAgo, $lte: today }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: "$createdAt" },
                        month: { $month: "$createdAt" },
                        day: { $dayOfMonth: "$createdAt" }
                    },
                    count: { $sum: 1 }
                }
            }
        ]);

        const data = [];
        for (let i = 0; i < 30; i++) {
            const date = new Date(thirtyDaysAgo);
            date.setDate(thirtyDaysAgo.getDate() + i);
            const y = date.getFullYear();
            const m = date.getMonth() + 1;
            const d = date.getDate();

            const userStat = usersAggregation.find(u => u._id.year === y && u._id.month === m && u._id.day === d);
            const appStat = appointmentsAggregation.find(a => a._id.year === y && a._id.month === m && a._id.day === d);

            data.push({
                date: `${m}/${d}`,
                usersCount: userStat ? userStat.count : 0,
                appointmentsCount: appStat ? appStat.count : 0
            });
        }

        return successresponse({
            res,
            status: 200,
            message: "Daily stats fetched successfully",
            data
        });
    } catch (error) {
        next(error);
    }
};

// ─── GET /admin/stats/analytics ──────────────────────────────────────────────
export const getAnalyticsStats = async (req, res, next) => {
    try {
        const { startDate, endDate } = req.query;
        let matchStage = {};
        let baseMatchStage = {}; // To calculate cumulative totals before startDate

        if (startDate || endDate) {
            matchStage.createdAt = {};
            if (startDate) {
                matchStage.createdAt.$gte = new Date(startDate);
                baseMatchStage.createdAt = { $lt: new Date(startDate) };
            }
            if (endDate) matchStage.createdAt.$lte = new Date(endDate);
            
            // If the dates are identical or invalid, ensure fallback or remove
            if (Object.keys(matchStage.createdAt).length === 0) {
                delete matchStage.createdAt;
            }
        }

        // 0. Base counts for cumulative chart (Counts before startDate)
        const baseUsersCount = startDate ? await db_service.count({ model: usermodel, filter: baseMatchStage }) : 0;
        const baseAppointmentsCount = startDate ? await db_service.count({ model: appointments_model, filter: baseMatchStage }) : 0;

        // 1. Chart Data (Group by Month or Day)
        let isDaily = false;
        if (startDate && endDate) {
            const diffDays = (new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24);
            if (diffDays <= 60) isDaily = true;
        }

        const groupStage = isDaily
            ? { year: { $year: "$createdAt" }, month: { $month: "$createdAt" }, day: { $dayOfMonth: "$createdAt" } }
            : { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } };

        const usersChart = await usermodel.aggregate([
            { $match: matchStage },
            { $group: { _id: groupStage, count: { $sum: 1 } } },
            { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
        ]);

        const appointmentsChart = await appointments_model.aggregate([
            { $match: matchStage },
            { $group: { _id: groupStage, count: { $sum: 1 } } },
            { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
        ]);

        // Merge keys to ensure we have a sequence
        const chartDataMap = {};
        
        usersChart.forEach(u => {
            const key = isDaily 
                ? `${u._id.year}-${u._id.month.toString().padStart(2, '0')}-${u._id.day.toString().padStart(2, '0')}`
                : `${u._id.year}-${u._id.month.toString().padStart(2, '0')}`;
            if (!chartDataMap[key]) chartDataMap[key] = { label: key, newUsers: 0, newAppointments: 0 };
            chartDataMap[key].newUsers = u.count;
        });

        appointmentsChart.forEach(a => {
            const key = isDaily 
                ? `${a._id.year}-${a._id.month.toString().padStart(2, '0')}-${a._id.day.toString().padStart(2, '0')}`
                : `${a._id.year}-${a._id.month.toString().padStart(2, '0')}`;
            if (!chartDataMap[key]) chartDataMap[key] = { label: key, newUsers: 0, newAppointments: 0 };
            chartDataMap[key].newAppointments = a.count;
        });

        // Convert to sorted array and calculate running totals
        let sortedKeys = Object.keys(chartDataMap).sort();
        let runningUsers = baseUsersCount;
        let runningAppointments = baseAppointmentsCount;

        const finalChartData = sortedKeys.map(key => {
            runningUsers += chartDataMap[key].newUsers;
            runningAppointments += chartDataMap[key].newAppointments;
            return {
                label: key,
                usersCount: runningUsers,
                appointmentsCount: runningAppointments
            };
        });

        // If the chart is empty (no activity in range), we might still want to return a flat line representing the base.
        if (finalChartData.length === 0 && startDate) {
            finalChartData.push({
                label: "Period Start",
                usersCount: baseUsersCount,
                appointmentsCount: baseAppointmentsCount
            });
        }

        // 2. Summary Totals (System Activity)
        const totalAppointments = await db_service.count({ model: appointments_model, filter: matchStage });
        const totalPrescriptions = await db_service.count({ model: prescrptionmodel, filter: matchStage });
        const totalMedicalHistories = await db_service.count({ model: medicalhistorymodel, filter: matchStage });
        
        // 2b. Cumulative Summary Totals (Users)
        let cumulativeMatchStage = {};
        if (endDate) {
            cumulativeMatchStage.createdAt = { $lte: new Date(endDate) };
        }

        const totalUsers = await db_service.count({ model: usermodel, filter: cumulativeMatchStage });
        const totalDoctors = await db_service.count({ model: usermodel, filter: { ...cumulativeMatchStage, role: "doctor" } });
        const totalPatients = await db_service.count({ model: usermodel, filter: { ...cumulativeMatchStage, role: "patient" } });

        // 3. Doctors by Specialty
        const specialtyAggregation = await doctormodel.aggregate([
            {
                $lookup: {
                    from: "users",
                    localField: "userId",
                    foreignField: "_id",
                    as: "user"
                }
            },
            { $unwind: "$user" },
            { $match: { "user.createdAt": cumulativeMatchStage.createdAt ? cumulativeMatchStage.createdAt : { $exists: true } } },
            {
                $group: {
                    _id: "$specialization",
                    count: { $sum: 1 }
                }
            }
        ]);

        const doctorsBySpecialty = specialtyAggregation.map(s => ({
            name: s._id || "Unspecified",
            value: s.count
        })).sort((a, b) => b.value - a.value);

        return successresponse({
            res,
            status: 200,
            message: "Analytics stats fetched successfully",
            data: {
                chartData: finalChartData,
                summary: {
                    totalAppointments,
                    totalPrescriptions,
                    totalMedicalHistories,
                    totalUsers,
                    totalDoctors,
                    totalPatients
                },
                doctorsBySpecialty
            }
        });
    } catch (error) {
        next(error);
    }
};