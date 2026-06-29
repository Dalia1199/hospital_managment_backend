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
import { notify } from "../notifications/notification.service.js";


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
                    phoneNumber: doctor.phoneNumber ? decrypt(doctor.phoneNumber) : null,
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

        await notify.doctorApproved(doctor._id);

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

        await notify.doctorRejected(doctor._id , reason);

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
        const { status, startDate, endDate } = req.query;
        const filter = { role: roleenum.doctor };
        if (status) filter.status = status;
        
        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                filter.createdAt.$lte = end;
            }
        }

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
                    _hasPendingLicenseUpdate: !!doctorDetails?.pendingLicenseImage?.public_id,
                };
            })
        );

        // "pending" here means "first-time signup awaiting initial review".
        // An already-approved doctor whose status got bumped to "pending"
        // by a license *update* is a different thing entirely — they
        // belong exclusively on /admin/doctors/licenses, with their NEW
        // image, not mixed in here showing their old/irrelevant license.
        const visible =
            status === "pending"
                ? doctorsWithDetails.filter((d) => !d._hasPendingLicenseUpdate)
                : doctorsWithDetails;

        const data = visible.map(({ _hasPendingLicenseUpdate, ...rest }) => rest);

        return successresponse({ res, data });
    } catch (error) {
        next(error);
    }
};

export const getDashboard = async (req, res, next) => {
    try {
        const { last30Days } = req.query;
        let matchStage = {};
        if (last30Days === 'true') {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 29);
            startDate.setHours(0, 0, 0, 0);
            matchStage.createdAt = { $gte: startDate, $lte: new Date() };
        }

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
            db_service.count({ model: usermodel, filter: matchStage }),
            db_service.count({ model: usermodel, filter: { ...matchStage, role: roleenum.doctor, status: { $nin: ["pending", "rejected"] } } }),
            db_service.count({ model: usermodel, filter: { ...matchStage, role: roleenum.patient } }),
            db_service.count({ model: usermodel, filter: { role: roleenum.doctor, status: "pending" } }),
            db_service.count({ model: usermodel, filter: { role: roleenum.doctor, status: "rejected" } }),
            db_service.count({ model: prescrptionmodel, filter: matchStage }),
            db_service.count({ model: medicalhistorymodel, filter: matchStage }),
            db_service.count({ model: appointments_model, filter: matchStage })
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

        // Move current license to previousLicenseImage (keep it, don't delete)
        if (doctor.licenseimage?.public_id) {
            doctor.previousLicenseImage = doctor.licenseimage;
        }

        // Promote pending to active
        doctor.licenseimage = doctor.pendingLicenseImage;
        doctor.pendingLicenseImage = null;

        await doctor.save();

        // Update doctor user status to approved
        const updatedUser = await db_service.findOneAndUpdate({
            model: usermodel,
            filter: { _id: id },
            update: { status: "approved" }
        });

        // Notify doctor that license was approved
        await notify.licenseApproved(id);

        // Notify the admin who took the action, so they have a record
        // confirming the decision (instead of the request just vanishing
        // from the pending list with no trace)
        await notify.licenseReviewed(req.user._id, updatedUser?.fullName, "approved");
        await notify.licenseApproved(doctor.userId);
        
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
        const { reason } = req.body;
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
        await notify.licenseRejected(doctor.userId);

        if (newPublicId) {
            await cloudinary.uploader.destroy(newPublicId);
        }

        // the doctor still has a valid, previously-approved licenseimage —
        // rejecting the *update* must not lock them out of login, which
        // requires status === "approved"
        const updatedUser = await db_service.findOneAndUpdate({
            model: usermodel,
            filter: { _id: id },
            update: { status: "approved" }
        });

        // notify the doctor, including the reason if the admin gave one
        await notify.licenseRejected(id, reason);

        // Notify the admin who took the action, so they have a record
        // confirming the decision
        await notify.licenseReviewed(req.user._id, updatedUser?.fullName, "rejected");

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

// GET /admin/doctors/pending-licenses — doctors with a license UPDATE
// awaiting review (different from /admin/doctors/pending, which is the
// initial-signup approval queue)
export const getPendingLicenseDoctors = async (req, res, next) => {
    try {
        const doctors = await db_service.find({
            model: doctormodel,
            filter: {
                "pendingLicenseImage.public_id": { $exists: true, $ne: null }
            },
            populate: [{ path: "userId", select: "fullName email" }],
            sort: { updatedAt: -1 },
        });

        const data = doctors.map((doc) => {
            const d = doc.toObject ? doc.toObject() : doc;
            return {
                _id: d._id,
                userId: d.userId?._id ?? d.userId,
                fullName: d.userId?.fullName,
                email: d.userId?.email,
                specialty: d.specialization,
                pendingLicenseImage: d.pendingLicenseImage,
                licenseimage: d.licenseimage,
                updatedAt: d.updatedAt,
            };
        });

        return successresponse({
            res,
            message: "pending license doctors fetched successfully",
            data,
        });
    } catch (error) {
        next(error);
    }
};

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
        const { startDate, endDate, defaultAllTime } = req.query;
        let start, end;
        if (startDate || endDate) {
            start = startDate ? new Date(startDate) : new Date();
            if (!startDate) {
                start.setDate(start.getDate() - 30);
            }
            start.setHours(0, 0, 0, 0);

            end = endDate ? new Date(endDate) : new Date();
            if (endDate) end.setHours(23, 59, 59, 999);
        } else if (defaultAllTime === 'true') {
            const firstUser = await usermodel.findOne().sort({ createdAt: 1 }).select("createdAt").lean();
            const firstAppt = await appointments_model.findOne().sort({ createdAt: 1 }).select("createdAt").lean();
            
            let earliest = new Date();
            if (firstUser && new Date(firstUser.createdAt) < earliest) earliest = new Date(firstUser.createdAt);
            if (firstAppt && new Date(firstAppt.createdAt) < earliest) earliest = new Date(firstAppt.createdAt);

            start = earliest;
            start.setHours(0, 0, 0, 0);
            end = new Date();
        } else {
            end = new Date();
            start = new Date();
            start.setDate(end.getDate() - 29);
            start.setHours(0, 0, 0, 0);
        }

        const users = await usermodel.find({
            createdAt: { $gte: start, $lte: end }
        }).select("createdAt role status").lean();

        const appointments = await appointments_model.find({
            createdAt: { $gte: start, $lte: end }
        }).select("createdAt").lean();

        const diffTime = end.getTime() - start.getTime();
        const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

        const data = [];
        for (let i = 0; i <= diffDays; i++) {
            const date = new Date(start);
            date.setDate(start.getDate() + i);
            if (date > end) break;
            
            const y = date.getFullYear();
            const m = date.getMonth() + 1;
            const d = date.getDate();

            let patientsCount = 0;
            let doctorsCount = 0;
            let appointmentsCount = 0;

            users.forEach(u => {
                const ud = new Date(u.createdAt);
                if (ud.getFullYear() === y && ud.getMonth() + 1 === m && ud.getDate() === d) {
                    if (u.role === "patient") patientsCount++;
                    if (u.role === "doctor" && u.status !== "pending" && u.status !== "rejected") doctorsCount++;
                }
            });

            appointments.forEach(a => {
                const ad = new Date(a.createdAt);
                if (ad.getFullYear() === y && ad.getMonth() + 1 === m && ad.getDate() === d) {
                    appointmentsCount++;
                }
            });

            data.push({
                date: `${m}/${d}`,
                patientsCount,
                doctorsCount,
                appointmentsCount
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
        const { startDate, endDate, interval = "week" } = req.query;
        let matchStage = {};
        let baseMatchStage = {}; // To calculate cumulative totals before startDate

        if (startDate || endDate) {
            matchStage.createdAt = {};
            if (startDate) {
                const s = new Date(startDate);
                s.setHours(0, 0, 0, 0);
                matchStage.createdAt.$gte = s;
                baseMatchStage.createdAt = { $lt: s };
            }
            if (endDate) {
                const e = new Date(endDate);
                e.setHours(23, 59, 59, 999);
                matchStage.createdAt.$lte = e;
            }
            
            // If the dates are identical or invalid, ensure fallback or remove
            if (Object.keys(matchStage.createdAt).length === 0) {
                delete matchStage.createdAt;
            }
        }

        // 0. Base counts for cumulative chart (Counts before startDate)
        const baseUsersCount = startDate ? await db_service.count({ model: usermodel, filter: baseMatchStage }) : 0;
        const basePatientsCount = startDate ? await db_service.count({ model: usermodel, filter: { ...baseMatchStage, role: "patient" } }) : 0;
        const baseAppointmentsCount = startDate ? await db_service.count({ model: appointments_model, filter: baseMatchStage }) : 0;

        // 1. Chart Data (Group by interval: day, week, month, year)
        let groupStage = {};
        switch (interval) {
            case "day":
                groupStage = { year: { $year: "$createdAt" }, month: { $month: "$createdAt" }, day: { $dayOfMonth: "$createdAt" } };
                break;
            case "week":
                groupStage = { year: { $isoWeekYear: "$createdAt" }, week: { $isoWeek: "$createdAt" } };
                break;
            case "month":
                groupStage = { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } };
                break;
            case "year":
                groupStage = { year: { $year: "$createdAt" } };
                break;
            default:
                groupStage = { year: { $isoWeekYear: "$createdAt" }, week: { $isoWeek: "$createdAt" } };
        }

        const usersChart = await usermodel.aggregate([
            { $match: matchStage },
            { $group: { 
                _id: groupStage, 
                count: { $sum: 1 },
                patientsCount: { $sum: { $cond: [{ $eq: ["$role", "patient"] }, 1, 0] } }
            } },
            { $sort: { "_id.year": 1, "_id.month": 1, "_id.week": 1, "_id.day": 1 } }
        ]);

        const appointmentsChart = await appointments_model.aggregate([
            { $match: matchStage },
            { $group: { _id: groupStage, count: { $sum: 1 } } },
            { $sort: { "_id.year": 1, "_id.month": 1, "_id.week": 1, "_id.day": 1 } }
        ]);

        // Merge keys to ensure we have a sequence
        const chartDataMap = {};

        const formatKey = (id) => {
            if (interval === "day") return `${id.year}-${id.month.toString().padStart(2, '0')}-${id.day.toString().padStart(2, '0')}`;
            if (interval === "week") return `${id.year}-W${id.week.toString().padStart(2, '0')}`;
            if (interval === "month") return `${id.year}-${id.month.toString().padStart(2, '0')}`;
            if (interval === "year") return `${id.year}`;
            return `${id.year}-W${id.week.toString().padStart(2, '0')}`;
        };
        
        usersChart.forEach(u => {
            const key = formatKey(u._id);
            if (!chartDataMap[key]) chartDataMap[key] = { label: key, newUsers: 0, newPatients: 0, newAppointments: 0 };
            chartDataMap[key].newUsers = u.count;
            chartDataMap[key].newPatients = u.patientsCount;
        });

        appointmentsChart.forEach(a => {
            const key = formatKey(a._id);
            if (!chartDataMap[key]) chartDataMap[key] = { label: key, newUsers: 0, newPatients: 0, newAppointments: 0 };
            chartDataMap[key].newAppointments = a.count;
        });

        // Convert to sorted array and calculate running totals
        let sortedKeys = Object.keys(chartDataMap).sort();
        let runningUsers = baseUsersCount;
        let runningPatients = basePatientsCount;
        let runningAppointments = baseAppointmentsCount;

        const finalChartData = sortedKeys.map(key => {
            runningUsers += chartDataMap[key].newUsers;
            runningPatients += chartDataMap[key].newPatients;
            runningAppointments += chartDataMap[key].newAppointments;
            return {
                label: key,
                usersCount: runningUsers,
                patientsCount: runningPatients,
                appointmentsCount: runningAppointments
            };
        });

        // If the chart is empty (no activity in range), we might still want to return a flat line representing the base.
        if (finalChartData.length === 0 && startDate) {
            finalChartData.push({
                label: "Period Start",
                usersCount: baseUsersCount,
                patientsCount: basePatientsCount,
                appointmentsCount: baseAppointmentsCount
            });
        }

        // 2. Summary Totals (System Activity)
        const totalAppointments = await db_service.count({ model: appointments_model, filter: matchStage });
        const totalPrescriptions = await db_service.count({ model: prescrptionmodel, filter: matchStage });
        const totalMedicalHistories = await db_service.count({ model: medicalhistorymodel, filter: matchStage });
        
        // 2b. Summary Totals (Users) - Filtered by exact date range
        const totalUsers = await db_service.count({ model: usermodel, filter: matchStage });
        const totalDoctors = await db_service.count({ model: usermodel, filter: { ...matchStage, role: "doctor" } });
        const totalPatients = await db_service.count({ model: usermodel, filter: { ...matchStage, role: "patient" } });

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
            { $match: { "user.createdAt": matchStage.createdAt ? matchStage.createdAt : { $exists: true } } },
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



// ─── PATCH /admin/profile-image ──────────────────────────────────────────────
export const uploadAdminProfileImage = async (req, res, next) => {
    try {
        if (!req.file) {
            throw new Error("image required", { cause: 400 });
        }
 
        // احذف الصورة القديمة لو موجودة
        if (req.user.profilepicture?.public_id) {
            await cloudinary.uploader.destroy(req.user.profilepicture.public_id);
        }
 
        const { secure_url, public_id } = await cloudinary.uploader.upload(
            req.file.path,
            { folder: "carehub/admins" }
        );
 
        const user = await db_service.findOneAndUpdate({
            model: usermodel,
            filter: { _id: req.user._id },
            update: { profilepicture: { secure_url, public_id } },
            options: { new: true }
        });
 
        return successresponse({
            res,
            message: "Profile image uploaded successfully",
            data: { profilepicture: user.profilepicture }
        });
    } catch (error) {
        next(error);
    }
};
 
// ─── DELETE /admin/profile-image ─────────────────────────────────────────────
export const deleteAdminProfileImage = async (req, res, next) => {
    try {
        if (!req.user.profilepicture?.public_id) {
            throw new Error("image not found", { cause: 404 });
        }
 
        await cloudinary.uploader.destroy(req.user.profilepicture.public_id);
 
        await db_service.findOneAndUpdate({
            model: usermodel,
            filter: { _id: req.user._id },
            update: { profilepicture: null },
            options: { new: true }
        });
 
        return successresponse({
            res,
            message: "Profile picture deleted successfully",
            data: null
        });
    } catch (error) {
        next(error);
    }
};