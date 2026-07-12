import doctormodel from "../../DB/models/doctormodel.js";
import usermodel from "../../DB/models/usermodel.js";
import patientmodel from "../../DB/models/patientmodel.js";
import medicalhistorymodel from "../../DB/models/medicalhistorymodel.js";
import sessionmodel from "../../DB/models/sessionmodel.js";
import prescrptionmodel from "../../DB/models/prescriptionmodel.js";
import appointmentsmodel from "../../DB/models/appointments_model.js";
import slotmodel from "../../DB/models/slot_model.js";
import clinicmodel from "../../DB/models/clinic_model.js";
import transactionmodel from "../../DB/models/transactionmodel.js";
import { sendemail, generateotp } from "../../common/utilits/email/send email.js";
import * as db_service from "../../DB/db.service.js";
import { successresponse } from "../../common/utilits/responce.success.js";
import { roleenum } from "../../common/enum/user.enum.js";
import cloudinary from "../../common/utilits/cloudinary.js";
import { decrypt, encrypt } from "../../common/utilits/security/encrypt.js";
import { notify } from "../notifications/notification.service.js";
import mongoose from "mongoose";
import medicationtrackingmodel from "../../DB/models/medicationtrackingmodel.js";
import { parseDuration, parseFrequency } from "../../common/utilits/medicationHelper.js";
import notificationmodel from "../../DB/models/notificationmodel.js";

export const getDashboard = async (req, res, next) => {
    try {
        const { startDate, endDate } = req.query;

        const doctor = await db_service.findOne({
            model: doctormodel,
            filter: { userId: req.user._id }
        });

        if (!doctor) {
            return res.status(404).json({ message: "doctor profile not found" });
        }

        const dateFilter = {};
        if (startDate || endDate) {
            dateFilter.createdAt = {};
            if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
            if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
        }

        const baseFilter = { doctorId: req.user._id, ...dateFilter };
        if (req.assistant && req.assistant.clinicId) {
            baseFilter.clinicId = new mongoose.Types.ObjectId(req.assistant.clinicId);
        } else if (req.query.clinicId && req.query.clinicId !== "all") {
            baseFilter.clinicId = new mongoose.Types.ObjectId(req.query.clinicId);
        }

        const [totalPatients, totalPrescriptions, totalMedicalHistories] = await Promise.all([
            prescrptionmodel.distinct("patientId", baseFilter).then(r => r.length),
            db_service.count({ model: prescrptionmodel, filter: baseFilter }),
            db_service.count({ model: medicalhistorymodel, filter: baseFilter })
        ]);

        return successresponse({
            res,
            status: 200,
            message: "dashboard stats fetched successfully",
            data: { totalPatients, totalPrescriptions, totalMedicalHistories }
        });
    } catch (error) {
        next(error);
    }
};


// GET /doctor/profile — merged user + doctor doc
export const getDoctorProfile = async (req, res, next) => {
    try {
        const doctor = await db_service.findOne({
            model: doctormodel,
            filter: { userId: req.user._id }
        });

        if (!doctor) {
            return res.status(404).json({ message: "Doctor profile not found" });
        }

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
                specialization: doctor.specialization,
                experience: doctor.experience,
                bio: doctor.bio,
                licenseimage: doctor.licenseimage ?? null,
                pendingLicenseImage: doctor.pendingLicenseImage ?? null,
                previousLicenseImage: doctor.previousLicenseImage ?? null,
                certificates: doctor.certificates || [],
            }
        });
    } catch (error) {
        next(error);
    }
};

// add update doctor profile logic
export const updatedoctorprofile = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { fullName, address, phoneNumber, bio, specialization, experience } = req.body;

        const doctor = await db_service.findOne({
            model: doctormodel,
            filter: { userId: req.user._id },
            session
        });

        if (!doctor) {
            throw new Error("Doctor profile not found", { cause: 404 });
        }

        // Update user model fields (fullName, address)
        if (fullName !== undefined) req.user.fullName = fullName;
        if (address !== undefined) req.user.address = address;
        if (phoneNumber !== undefined) req.user.phoneNumber = encrypt(phoneNumber);
        await req.user.save({ session });


        // Update doctor model fields
        if (bio !== undefined) doctor.bio = bio;
        if (specialization !== undefined) doctor.specialization = specialization;
        if (experience !== undefined) doctor.experience = experience;
        await doctor.save({ session });

        // if all work (user and doctor --> commit session)
        await session.commitTransaction();

        return successresponse({
            res,
            message: "Profile updated successfully",
            data: {
                fullName: req.user.fullName,
                address: req.user.address,
                phoneNumber: decrypt(req.user.phoneNumber),
                bio: doctor.bio,
                specialization: doctor.specialization,
                experience: doctor.experience
            }
        });
    } catch (error) {
        await session.abortTransaction();
        next(error);
    } finally {
        session.endSession();
    }
};

// Implement doctor license upload service 
export const uploadLicense = async (req, res, next) => {
    try {
        if (!req.file) {
            throw new Error("image/pdf file is required", { cause: 400 });
        }

        const doctor = await db_service.findOne({
            model: doctormodel,
            filter: { userId: req.user._id }
        });

        // Save old public_id before uploading new one
        const oldPublicId = doctor?.licenseimage?.public_id ?? null;
        // 1. Upload new image
        const { secure_url, public_id } = await cloudinary.uploader.upload(req.file.path, {
            folder: "carehub/doctors/licenses"
        });

        try {
            const updatedDoctor = await db_service.findOneAndUpdate({
                model: doctormodel,
                filter: { userId: req.user._id },
                update: { pendingLicenseImage: { secure_url, public_id } },
                options: { new: true }
            });

            // NOTE: we intentionally do NOT touch the user's status here.
            // This doctor is already approved and can keep working normally
            // while the new license is under review — only
            // pendingLicenseImage marks it as needing admin attention (see
            // GET /admin/doctors/pending-licenses). Flipping status to
            // "pending" used to lock the doctor out of login entirely until
            // the admin acted, and it also leaked into the general
            // first-time-signup approvals queue.
            await notify.newLicenseUnderReview(updatedDoctor.userId);

            const admins = await db_service.find({
                model: usermodel,
                filter: { role: roleenum.admin }
            });

            // Send notification to all admins
            await Promise.all(
                admins.map(admin =>
                    notify.licenseUpdated(admin._id, req.user.fullName)
                )
            );

            // Note: old licenseimage is kept as-is until admin approves the new one

            return successresponse({
                res,
                message: "license submitted successfully and is awaiting admin review",
                data: updatedDoctor
            });

        } catch (dbError) {
            console.error("License upload dbError:", dbError);
            await cloudinary.uploader.destroy(public_id);
            throw new Error("Failed to save license. Please try again.", { cause: 500 });
        }

    } catch (error) {
        return next(error);
    }
};

export const searchPatient = async (req, res, next) => {
    try {
        const { searchTerm } = req.query;
        let filter = { role: roleenum.patient };

        if (searchTerm.match(/^[0-9a-fA-F]{24}$/)) {
            filter._id = searchTerm;
        } else if (!/^\d+$/.test(searchTerm)) {
            filter.fullName = { $regex: searchTerm, $options: "i" };
        }
        // If it's a phone number (/^\d+$/), we don't add it to filter because phone numbers are encrypted.
        // We will fetch all patients and filter them in memory.

        const patients = await db_service.find({
            model: usermodel,
            filter
        });

        let decryptedPatients = patients.map(p => {
            const patientObj = p.toObject ? p.toObject() : p;
            if (patientObj.phoneNumber) {
                try {
                    patientObj.phoneNumber = decrypt(patientObj.phoneNumber);
                } catch (err) {
                    console.error("Failed to decrypt phone number for user", patientObj._id);
                }
            }
            return patientObj;
        });

        // In-memory filter for phone numbers
        if (/^\d+$/.test(searchTerm)) {
            decryptedPatients = decryptedPatients.filter(p => p.phoneNumber && p.phoneNumber.includes(searchTerm));
        }

        return successresponse({
            res,
            message: "Patients fetched successfully",
            data: decryptedPatients
        });
    } catch (error) {
        return next(error);
    }
};

export const getPatientCompliance = async (req, res, next) => {
    try {
        const { patientId } = req.params;
        const { hasAccess, sharingSetting } = await checkDoctorAccess(req.user._id, patientId);

        let rxFilter = { patientId, status: "active" };
        if (!hasAccess || sharingSetting === "own_only") {
            rxFilter.doctorId = req.user._id;
        }

        const prescriptions = await db_service.find({
            model: prescrptionmodel,
            filter: rxFilter
        });

        const activeMeds = [];
        const pastMeds = [];
        const now = new Date();

        for (const rx of prescriptions) {
            const rxDate = new Date(rx.createdAt);
            for (const med of rx.medications) {
                const durationInfo = parseDuration(med.duration);
                let isActive = false;
                let daysCompleted = 0;
                let totalDays = durationInfo.days;
                let endDate = new Date(rxDate);

                if (durationInfo.isLifelong) {
                    isActive = true;
                    daysCompleted = Math.floor(Math.abs(now - rxDate) / (1000 * 60 * 60 * 24));
                    endDate = null;
                } else {
                    endDate.setDate(endDate.getDate() + totalDays);
                    if (now <= endDate || (now > endDate && (now - endDate) < 24 * 60 * 60 * 1000)) {
                        isActive = true;
                        daysCompleted = Math.floor(Math.abs(now - rxDate) / (1000 * 60 * 60 * 24));
                        if (daysCompleted > totalDays) daysCompleted = totalDays;
                    }
                }

                if (isActive) {
                    let adjustedDaysCompleted = Math.max(1, daysCompleted);
                    let progress = durationInfo.isLifelong ? 100 : Math.min(100, Math.floor((adjustedDaysCompleted / totalDays) * 100));
                    activeMeds.push({
                        medicineName: med.medicineName,
                        dosage: med.dosage,
                        frequency: med.frequency,
                        startDate: rxDate,
                        progress
                    });
                } else {
                    pastMeds.push({
                        medicineName: med.medicineName,
                        dosage: med.dosage,
                        frequency: med.frequency,
                        startDate: rxDate,
                        endDate: endDate
                    });
                }
            }
        }

        let trackFilter = { patientId };
        if (!hasAccess || sharingSetting === "own_only") {
            trackFilter.prescriptionId = { $in: prescriptions.map(p => p._id) };
        }

        const trackingRecords = await db_service.find({
            model: medicationtrackingmodel,
            filter: trackFilter,
            options: { sort: { scheduledDoseDateTime: -1 } }
        });

        let totalTaken = 0;
        let totalMissed = 0;

        trackingRecords.forEach(r => {
            if (r.status === 'taken') totalTaken++;
            else if (r.status === 'missed') totalMissed++;
        });

        const totalExpected = totalTaken + totalMissed;
        let adherencePercentage = totalExpected > 0 ? Math.round((totalTaken / totalExpected) * 100) : 0;

        let complianceStatus = "Poor";
        if (adherencePercentage > 90) complianceStatus = "Excellent";
        else if (adherencePercentage >= 70) complianceStatus = "Good";

        let currentStreak = 0;
        const recordsByDay = {};
        trackingRecords.forEach(r => {
            const dayStr = r.scheduledDoseDateTime.toISOString().split('T')[0];
            if (!recordsByDay[dayStr]) recordsByDay[dayStr] = { taken: 0, missed: 0 };
            if (r.status === 'taken') recordsByDay[dayStr].taken++;
            else if (r.status === 'missed') recordsByDay[dayStr].missed++;
        });

        const sortedDays = Object.keys(recordsByDay).sort((a, b) => new Date(b) - new Date(a));
        let consecutiveMissedDays = 0;

        for (const day of sortedDays) {
            if (recordsByDay[day].missed > 0 && recordsByDay[day].taken === 0) {
                consecutiveMissedDays++;
            }
            if (recordsByDay[day].missed > 0) {
                break;
            }
            if (recordsByDay[day].taken > 0) {
                currentStreak++;
            }
        }

        const alerts = [];
        if (adherencePercentage > 0 && adherencePercentage < 80) {
            alerts.push({ type: "warning", message: "Adherence is below 80%." });
        }
        if (consecutiveMissedDays >= 3) {
            alerts.push({ type: "critical", message: "Treatment abandoned (missed >3 consecutive days)." });
        } else if (consecutiveMissedDays > 0) {
            alerts.push({ type: "warning", message: `Multiple missed doses (${consecutiveMissedDays} days).` });
        }

        return successresponse({
            res, data: {
                adherencePercentage,
                complianceStatus,
                totalTaken,
                totalMissed,
                currentStreak,
                activeMedicationsCount: activeMeds.length,
                alerts,
                activeMeds
            }
        });
        return successresponse({ res, data: {
            adherencePercentage,
            complianceStatus,
            totalTaken,
            totalMissed,
            currentStreak,
            activeMedicationsCount: activeMeds.length,
            alerts,
            activeMeds,
            pastMeds
        }});

    } catch (error) {
        next(error);
    }
};

export const createSession = async (req, res, next) => {
    try {
        const { isOfflinePatient, patientId, guestName, guestPhone, guestAge, appointmentId, skipQueue } = req.body;
        // clinicId can come from the request body OR as a query param (auto-injected by fetchClient)
        const resolvedClinicId = req.body.clinicId || req.query.clinicId || undefined;
        const doctorId = req.user._id;
        const doctor = await db_service.findOne({
            model: doctormodel,
            filter: { userId: doctorId }
        });
        if (!doctor) {
            throw new Error("Doctor not found", { cause: 404 });
        }

        if (isOfflinePatient) {
            // Check for existing active session for the same offline patient
            const existingSession = await db_service.findOne({
                model: sessionmodel,
                filter: { doctorId, isOfflinePatient: true, guestPhone, status: "in_progress", validUntil: { $gt: new Date() } }
            });

            if (existingSession) {
                throw new Error("This patient already has an active session in the queue.", { cause: 400 });
            }

            let finalOrder = Date.now();
            if (skipQueue) finalOrder = 0;
            else if (appointmentId) {
                const slot = await slotmodel.findById(appointmentId);
                if (slot) {
                    finalOrder = slot.startDateTime.getTime();
                    await slotmodel.findByIdAndUpdate(appointmentId, { isBooked: true });
                }
            }

            const session = await db_service.create({
                model: sessionmodel,
                data: {
                    doctorId,
                    isOfflinePatient,
                    isOfflineEntry: true,
                    guestName,
                    guestPhone,
                    guestAge,
                    clinicId: resolvedClinicId,
                    // In a real flow, you should look up the clinic fee here too,
                    // but since this is just mock data generation, we can use 0 or fetch clinic.
                    fees: 0,
                    status: "in_progress",
                    validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
                    order: finalOrder
                }
            });
            return successresponse({
                res,
                message: "Offline session created and activated successfully",
                data: session
            });
        } else {
            const patient = await db_service.findOne({
                model: usermodel,
                filter: { _id: patientId, role: roleenum.patient }
            });
            if (!patient) {
                throw new Error("Patient not found", { cause: 404 });
            }

            const patientProfile = await db_service.findOne({
                model: patientmodel,
                filter: { userId: patientId }
            });
            const sharingSetting = patientProfile?.sharingSetting ?? "all";

            // Check for existing session
            const existingSession = await db_service.findOne({
                model: sessionmodel,
                filter: { doctorId, patientId, status: { $in: ["pending_otp", "in_progress"] } }
            });

            if (existingSession) {
                if (existingSession.status === "in_progress" && existingSession.validUntil > new Date()) {
                    throw new Error("Access already granted for this patient", { cause: 400 });
                }

                if (existingSession.status === "pending_otp") {
                    if (sharingSetting === "otp") {
                        // Resend OTP logic
                        const otp = generateotp().toString();
                        existingSession.otp = otp;
                        existingSession.validUntil = new Date(Date.now() + 10 * 60 * 1000);
                        await existingSession.save();

                        return successresponse({
                            res,
                            message: "OTP resent successfully",
                            data: { session: existingSession, temp_otp: otp }
                        });
                    }
                }

                // If it was pending_otp but sharingSetting is now all/own_only, or if it is completed/expired,
                // delete it and create a fresh one.
                await sessionmodel.findByIdAndDelete(existingSession._id);
            }

            let order = Date.now();
            let lastAppointment = null;
            if (skipQueue) {
                order = 0;
            } else if (appointmentId) {
                const slot = await slotmodel.findById(appointmentId);
                if (slot) {
                    order = slot.startDateTime.getTime();
                    await slotmodel.findByIdAndUpdate(appointmentId, { isBooked: true });
                }
            } else {
                const startOfDay = new Date();
                startOfDay.setHours(0, 0, 0, 0);
                const endOfDay = new Date();
                endOfDay.setHours(23, 59, 59, 999);

                lastAppointment = await appointmentsmodel.findOne({
                    patientId,
                    doctorId,
                    status: "booked",
                    startDateTime: { $gte: startOfDay, $lte: endOfDay }
                }).sort({ startDateTime: 1 });
                if (lastAppointment) {
                    order = lastAppointment.startDateTime.getTime();
                }
            }

            let fallbackFee = 0;
            if (resolvedClinicId) {
                const clinic = await clinicmodel.findById(resolvedClinicId);
                if (clinic && clinic.consultationFee !== undefined && clinic.consultationFee !== null) {
                    fallbackFee = clinic.consultationFee;
                }
            }

            if (sharingSetting === "all" || sharingSetting === "own_only") {
                const session = await db_service.create({
                    model: sessionmodel,
                    data: {
                        doctorId,
                        patientId,
                        clinicId: resolvedClinicId,
                        otp: "AUTO",
                        fees: lastAppointment && lastAppointment.paymentStatus === "paid" ? lastAppointment.paidAmount : fallbackFee,
                        isFeesFinalized: lastAppointment && lastAppointment.paymentStatus === "paid" ? true : false,
                        status: "in_progress",
                        validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
                        order,
                        isOfflineEntry: !lastAppointment
                    }
                });
                
                // Notify patient
                await notify.profileViewed(patientId, req.user.fullName);

                return successresponse({
                    res,
                    message: "Session activated successfully without OTP due to privacy setting",
                    data: session
                });
            }

            const otp = generateotp().toString();

            const session = await db_service.create({
                model: sessionmodel,
                data: {
                    doctorId,
                    patientId,
                    clinicId: resolvedClinicId,
                    otp,
                    fees: lastAppointment && lastAppointment.paymentStatus === "paid" ? lastAppointment.paidAmount : fallbackFee,
                    isFeesFinalized: lastAppointment && lastAppointment.paymentStatus === "paid" ? true : false,
                    status: "pending_otp",
                    validUntil: new Date(Date.now() + 10 * 60 * 1000),
                    order,
                    isOfflineEntry: !lastAppointment
                }
            });
            // Notify patient with the OTP
            await notify.accessRequested(patientId, req.user.fullName, otp);

            return successresponse({
                res,
                message: "OTP generated successfully and sent via notification",
                data: { session } // Removed temp_otp from response
            });
        }
    } catch (error) {
        return next(error);
    }
};

export const verifySession = async (req, res, next) => {
    try {
        const { sessionId, otp } = req.body;
        const session = await db_service.findOne({
            model: sessionmodel,
            filter: { _id: sessionId }
        });
        if (!session) {
            throw new Error("Session not found", { cause: 404 });
        }
        if (session.status !== "pending_otp") {
            throw new Error("Session is not waiting for OTP", { cause: 400 });
        }
        if (session.otp !== otp) {
            throw new Error("Invalid OTP", { cause: 400 });
        }
        if (session.validUntil < new Date()) {
            throw new Error("OTP expired", { cause: 400 });
        }

        session.status = "in_progress";
        session.validUntil = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours access
        await session.save();

        return successresponse({
            res,
            message: "session verified successfully, doctor access granted",
            data: session
        });
    } catch (error) {
        return next(error);
    }
};

export const updatePatientAlerts = async (req, res, next) => {
    try {
        const { patientId } = req.params;
        const { allergies, chronic, surgeries } = req.body;

        const { hasAccess } = await checkDoctorAccess(req.user._id, patientId);
        if (!hasAccess) {
            throw new Error("Access denied. Patient's medical history is protected.", { cause: 403 });
        }

        const patient = await patientmodel.findOne({ userId: patientId });
        if (!patient) {
            throw new Error("Patient not found", { cause: 404 });
        }

        let parsedAllergies = undefined;
        let parsedChronic = undefined;
        let parsedSurgeries = undefined;

        if (allergies !== undefined) {
            try { parsedAllergies = Array.isArray(allergies) ? allergies : JSON.parse(allergies); } catch (e) { parsedAllergies = [allergies]; }
        }
        if (chronic !== undefined) {
            try { parsedChronic = Array.isArray(chronic) ? chronic : JSON.parse(chronic); } catch (e) { parsedChronic = [chronic]; }
        }
        if (surgeries !== undefined) {
            try { parsedSurgeries = Array.isArray(surgeries) ? surgeries : JSON.parse(surgeries); } catch (e) { parsedSurgeries = surgeries ? [surgeries] : []; }
        }

        if (parsedAllergies !== undefined) patient.allergies = parsedAllergies;
        if (parsedChronic !== undefined) patient.chronic = parsedChronic;
        if (parsedSurgeries !== undefined) patient.surgeries = parsedSurgeries;

        await patient.save();

        return res.status(200).json({
            success: true,
            message: "Patient alerts and surgeries updated successfully",
            data: {
                allergies: patient.allergies,
                chronic: patient.chronic,
                surgeries: patient.surgeries
            }
        });
    } catch (error) {
        return next(error);
    }
};

export const endSession = async (req, res, next) => {
    try {
        const { sessionId } = req.params;
        const { fees, isFeesFinalized, diagnosis, notes, prescriptionText, height, weight, bloodPressure, sugarLevel, pulse, temperature, bloodType, allergies, chronic, surgeries, followUpDays } = req.body;
        const doctorId = req.user._id;

        const existingSession = await db_service.findOne({
            model: sessionmodel,
            filter: { _id: sessionId, doctorId }
        });

        if (!existingSession) {
            throw new Error("Session not found", { cause: 404 });
        }

        if (fees !== undefined && existingSession.isFeesFinalized) {
            throw new Error("Fees are already finalized and cannot be modified.", { cause: 403 });
        }

        const updateObj = { status: "completed" };
        if (fees !== undefined) updateObj.fees = fees;
        if (isFeesFinalized !== undefined) updateObj.isFeesFinalized = isFeesFinalized;

        const session = await db_service.findOneAndUpdate({
            model: sessionmodel,
            filter: { _id: sessionId, doctorId },
            update: updateObj,
            options: { new: true }
        });

        if (!session) {
            throw new Error("Session not found or already completed", { cause: 404 });
        }

        const documents = [];
        const folderName = session.isOfflinePatient ? `guest_${session.guestName}` : `patient_${session.patientId}`;

        if (req.files && req.files.prescriptionImage && req.files.prescriptionImage[0]) {
            const { secure_url, public_id } = await cloudinary.uploader.upload(req.files.prescriptionImage[0].path, {
                folder: `carehub/medicalhistory/prescriptions/${folderName}`,
                resource_type: req.files.prescriptionImage[0].mimetype === "application/pdf" ? "raw" : "auto",
                use_filename: true,
                unique_filename: true
            });
            documents.push({
                type: "prescription",
                title: "Handwritten Prescription",
                secure_url,
                public_id,
                uploadedBy: doctorId
            });
        }

        if (req.files && req.files.attachments && req.files.attachments.length > 0) {
            let parsedMetadata = [];
            if (req.body.attachmentsMetadata) {
                try { parsedMetadata = JSON.parse(req.body.attachmentsMetadata); } catch (e) { console.error("Failed to parse attachments metadata", e); }
            }

            for (let i = 0; i < req.files.attachments.length; i++) {
                const file = req.files.attachments[i];
                const meta = parsedMetadata[i] || { title: `Document ${i + 1}`, type: "other" };

                const { secure_url, public_id } = await cloudinary.uploader.upload(file.path, {
                    folder: `carehub/medicalhistory/documents/${folderName}`,
                    resource_type: file.mimetype === "application/pdf" ? "raw" : "auto",
                    use_filename: true,
                    unique_filename: true
                });

                documents.push({
                    type: meta.type,
                    title: meta.title,
                    secure_url,
                    public_id,
                    uploadedBy: doctorId
                });
            }
        }

        let parsedAllergies = [];
        let parsedChronic = [];
        let parsedSurgeries = [];
        if (allergies) {
            try { parsedAllergies = Array.isArray(allergies) ? allergies : JSON.parse(allergies); } catch (e) { parsedAllergies = [allergies]; }
        }
        if (chronic) {
            try { parsedChronic = Array.isArray(chronic) ? chronic : JSON.parse(chronic); } catch (e) { parsedChronic = [chronic]; }
        }
        if (surgeries) {
            try { parsedSurgeries = Array.isArray(surgeries) ? surgeries : JSON.parse(surgeries); } catch (e) { parsedSurgeries = [surgeries]; }
        }

        let parsedMedications = [];
        if (req.body.medications) {
            try { parsedMedications = Array.isArray(req.body.medications) ? req.body.medications : JSON.parse(req.body.medications); } catch (e) { console.error("Failed to parse medications", e); }
        }

        const medicalHistoryData = {
            doctorId,
            diagnosis,
            notes,
            prescriptionText,
            height,
            weight,
            bloodPressure,
            sugarLevel,
            pulse,
            temperature,
            allergies: parsedAllergies,
            chronic: parsedChronic,
            surgeries: parsedSurgeries,
            documents,
            clinicId: session.clinicId
        };

        if (session.isOfflinePatient) {
            medicalHistoryData.isOfflinePatient = true;
            medicalHistoryData.guestName = session.guestName;
            medicalHistoryData.guestPhone = session.guestPhone;
        } else {
            medicalHistoryData.patientId = session.patientId;
            
            // Calculate ageAtEncounter
            const patientRec = await patientmodel.findOne({ userId: session.patientId });
            if (patientRec) {
                if (patientRec.dateOfBirth) {
                    const ageDiffMs = Date.now() - new Date(patientRec.dateOfBirth).getTime();
                    const ageDate = new Date(ageDiffMs);
                    medicalHistoryData.ageAtEncounter = Math.abs(ageDate.getUTCFullYear() - 1970);
                } else if (patientRec.age != null) {
                    medicalHistoryData.ageAtEncounter = patientRec.age;
                }
            }

            // Update patient model vitals if any exist
            if (height || weight || bloodType || parsedAllergies.length > 0 || parsedChronic.length > 0 || parsedSurgeries.length > 0) {
                const updateData = {};
                if (height) updateData.height = height;
                if (weight) updateData.weight = weight;
                if (bloodType) updateData.bloodType = bloodType;
                if (parsedAllergies.length > 0) updateData.allergies = parsedAllergies;
                if (parsedChronic.length > 0) updateData.chronic = parsedChronic;
                if (parsedSurgeries.length > 0) updateData.surgeries = parsedSurgeries;

                await db_service.findOneAndUpdate({
                    model: patientmodel,
                    filter: { userId: session.patientId },
                    update: updateData
                });
            }
        }

        let medicalHistory = await medicalhistorymodel.findOne({ sessionId });
        if (medicalHistory) {
            Object.assign(medicalHistory, medicalHistoryData);
            await medicalHistory.save();
        } else {
            medicalHistoryData.sessionId = sessionId;
            medicalHistory = await db_service.create({
                model: medicalhistorymodel,
                data: medicalHistoryData
            });
        }

        if (!session.isOfflinePatient) {
            await notify.medicalHistoryAdded(session.patientId);
        }

        // If structured medications were provided, create a prescription record
        let prescriptionRecord = null;
        if (parsedMedications.length > 0) {
            const rxData = {
                doctorId,
                diagnosis: diagnosis || "General",
                medications: parsedMedications,
                medicalHistoryId: medicalHistory._id,
                notes: prescriptionText
            };
            if (session.isOfflinePatient) {
                rxData.isOfflinePatient = true;
                rxData.guestName = session.guestName;
                rxData.guestPhone = session.guestPhone;
            } else {
                rxData.patientId = session.patientId;
            }

            prescriptionRecord = await db_service.create({
                model: prescrptionmodel,
                data: rxData
            });

            // Link prescription back to medical history
            await db_service.findOneAndUpdate({
                model: medicalhistorymodel,
                filter: { _id: medicalHistory._id },
                update: { $push: { prescriptions: prescriptionRecord._id } }
            });

            if (!session.isOfflinePatient) {
                await notify.prescriptionIssued(session.patientId);
            }
        }
        if (!session.isOfflinePatient) {
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date();
            endOfDay.setHours(23, 59, 59, 999);

            const lastAppointment = await appointmentsmodel.findOne({
                patientId: session.patientId,
                doctorId: doctorId,
                status: "booked",
                startDateTime: { $gte: startOfDay, $lte: endOfDay }
            }).sort({ startDateTime: 1 }); // Ascending to find the closest upcoming/today appointment

            if (lastAppointment) {
                lastAppointment.status = "completed"; 
                
                if (followUpDays) {
                    lastAppointment.followUpDeadline = new Date(Date.now() + parseInt(followUpDays) * 24 * 60 * 60 * 1000);
                    lastAppointment.followUpStatus = "scheduled";
                    lastAppointment.followUpSetBy = doctorId;
                }
                
                await lastAppointment.save();

                // If paid online, release the doctor's share from pending to available
                if (lastAppointment.paymentStatus === "paid") {
                    const transactionmodel = (await import('../../DB/models/transactionmodel.js')).default;
                    const { releasePendingToAvailable } = await import('../wallet/wallet.service.js');
                    
                    const transaction = await transactionmodel.findOne({
                        userId: doctorId,
                        referenceId: lastAppointment._id,
                        purpose: 'online_booking_revenue'
                    });
                    
                    if (transaction) {
                        await releasePendingToAvailable(doctorId, transaction.amount);
                    } else {
                        const { getAppConfig } = await import('../appconfig/appconfig.service.js');
                        const config = await getAppConfig();
                        let platformFee = config.platformFeePercentage > 0 
                            ? (session.fees * config.platformFeePercentage) / 100 
                            : config.platformFeeFixed;
                            
                        const doctorShare = Math.max(0, session.fees - platformFee);
                        await releasePendingToAvailable(doctorId, doctorShare);
                    }
                }
            }
        }

        return successresponse({
            res,
            message: "Session ended and medical history saved successfully",
            data: { session, medicalHistory }
        });
    } catch (error) {
        return next(error);
    }
};

export const cancelSession = async (req, res, next) => {
    try {
        const { sessionId } = req.params;
        const doctorId = req.user._id;

        const session = await db_service.findOne({
            model: sessionmodel,
            filter: { _id: sessionId, doctorId }
        });

        if (!session) {
            throw new Error("Session not found", { cause: 404 });
        }

        if (session.status !== "pending_otp") {
            if (session.status === "in_progress" && session.isOfflineEntry) {
                // Allowed to cancel offline session in-progress
            } else {
                throw new Error("Only pending sessions (or in-progress offline sessions) can be cancelled", { cause: 400 });
            }
        }

        await sessionmodel.findByIdAndDelete(sessionId);

        return successresponse({
            res,
            message: "Session request cancelled successfully",
            data: null
        });
    } catch (error) {
        return next(error);
    }
};

export const getActiveSessions = async (req, res, next) => {
    try {
        const doctorId = req.user._id;
        let statuses = ["pending_otp", "in_progress"];
        if (req.query.status === "completed") {
            statuses = ["completed"];
        } else if (req.query.status === "all") {
            statuses = ["pending_otp", "in_progress", "completed"];
        }

        const filterQuery = { 
            doctorId, 
            status: { $in: statuses }
        };
        
        if (req.query.clinicId && req.query.clinicId !== "all") {
            // Include sessions that belong to this clinic OR have no clinic set (e.g. added without clinic context)
            filterQuery.$or = [
                { clinicId: req.query.clinicId },
                { clinicId: { $exists: false } },
                { clinicId: null }
            ];
        }

        if (req.query.status === "completed" || req.query.status === "all") {
            filterQuery.isFeesFinalized = { $ne: true };
        }
        
        // If fetching completed or all, only fetch for today to limit scope
        if (req.query.status === "completed" || req.query.status === "all") {
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            filterQuery.createdAt = { $gte: startOfDay };
        }

        const sessions = await db_service.find({
            model: sessionmodel,
            filter: filterQuery,
            options: {
                populate: { path: "patientId", select: "fullName phoneNumber profileImage bloodType height weight allergies chronic surgeries" },
                sort: { order: 1, createdAt: 1 }
            }
        });

        // Decrypt phone numbers for online patients
        const decryptedSessions = await Promise.all(sessions.map(async (s) => {
            const sObj = s.toObject ? s.toObject() : s;
            if (sObj.patientId && sObj.patientId.phoneNumber) {
                try {
                    sObj.patientId.phoneNumber = decrypt(sObj.patientId.phoneNumber);
                } catch (err) {
                    console.error("Failed to decrypt phone");
                }
            }
            if (!sObj.isOfflinePatient && sObj.patientId && sObj.patientId._id) {
                const profile = await db_service.findOne({
                    model: patientmodel,
                    filter: { userId: sObj.patientId._id }
                });
                if (profile) {
                    sObj.patientProfile = profile;
                }

                // Check if this session is associated with a follow-up appointment today
                const startOfDay = new Date();
                startOfDay.setHours(0, 0, 0, 0);
                const endOfDay = new Date();
                endOfDay.setHours(23, 59, 59, 999);
                
                const todaysAppointment = await appointmentsmodel.findOne({
                    patientId: sObj.patientId._id,
                    doctorId: doctorId,
                    appointmentDate: { $gte: startOfDay, $lte: endOfDay }
                });
                
                if (todaysAppointment) {
                    sObj.appointmentId = todaysAppointment._id;
                    sObj.isFollowUp = todaysAppointment.isFollowUp;
                }
            }
            return sObj;
        }));

        return successresponse({
            res,
            message: "Active sessions fetched successfully",
            data: decryptedSessions
        });
    } catch (error) {
        return next(error);
    }
};

export const getMedicationHistory = async (req, res, next) => {
    try {
        const { patientId, isOfflinePatient, guestName, guestPhone, scope } = req.query;

        let filter = {};
        if (isOfflinePatient === 'true') {
            filter.isOfflinePatient = true;
            filter.doctorId = req.user._id; // Scope to current doctor
            if (guestName) filter.guestName = guestName;
            if (guestPhone) filter.guestPhone = guestPhone;
        } else {
            if (scope === 'global') {
                const { hasAccess, sharingSetting } = await checkDoctorAccess(req.user._id, patientId);
                
                filter.patientId = patientId;
                
                if (!hasAccess || sharingSetting === "own_only") {
                    filter.doctorId = req.user._id;
                }
            } else {
                filter.patientId = patientId;
                filter.doctorId = req.user._id;
            }
        }

        const prescriptions = await db_service.find({
            model: prescrptionmodel,
            filter,
            options: {
                sort: { createdAt: -1 },
                populate: [{ path: "doctorId", select: "fullName" }]
            }
        });

        const activeMeds = [];
        const pastMeds = [];
        const seenDrugs = new Set();

        prescriptions.forEach(rx => {
            const recordDate = new Date(rx.createdAt);

            if (!rx.medications) return;

            rx.medications.forEach(med => {
                const medNameLower = med.medicineName.toLowerCase().trim();
                if (seenDrugs.has(medNameLower)) return;
                seenDrugs.add(medNameLower);

                const durStr = med.duration.toLowerCase();
                const isLifelong = durStr.includes("lifelong") || durStr.includes("always");

                let isActive = false;

                if (isLifelong) {
                    isActive = true;
                } else {
                    const match = durStr.match(/(\d+)/);
                    if (match) {
                        const num = parseInt(match[1], 10);
                        let days = 0;
                        if (durStr.includes("week")) days = num * 7;
                        else if (durStr.includes("month")) days = num * 30;
                        else days = num;

                        const endDate = new Date(recordDate);
                        endDate.setDate(endDate.getDate() + days);

                        if (new Date() <= endDate) {
                            isActive = true;
                        }
                    } else {
                        const endDate = new Date(recordDate);
                        endDate.setDate(endDate.getDate() + 30);
                        isActive = new Date() <= endDate;
                    }
                }

                const drugObj = {
                    name: med.medicineName,
                    dosage: med.dosage,
                    duration: med.duration,
                    date: recordDate.toLocaleDateString(),
                    doctorId: rx.doctorId?.fullName || "Unknown",
                    originalRx: rx,
                    isLifelong
                };

                if (isActive) activeMeds.push(drugObj);
                else pastMeds.push(drugObj);
            });
        });

        return successresponse({
            res,
            message: "Medication history fetched successfully",
            data: { activeMeds, pastMeds }
        });
    } catch (error) {
        return next(error);
    }
};

export const getPatientMedicalHistory = async (req, res, next) => {
    try {
        const { patientId, isOfflinePatient, guestName, guestPhone, page = 1, limit = 10, search, startDate, endDate, sortOrder, scope } = req.query;

        let filter = {};
        if (isOfflinePatient === 'true') {
            filter.isOfflinePatient = true;
            filter.doctorId = req.user._id; // Scope to current doctor
            if (guestName) filter.guestName = guestName;
            if (guestPhone) filter.guestPhone = guestPhone;
        } else {
            if (scope === 'global') {
                const { hasAccess, sharingSetting } = await checkDoctorAccess(req.user._id, patientId);
                
                filter.patientId = patientId;
                
                // If the doctor doesn't have global access (due to OTP or strict privacy),
                // OR if the setting is explicitly 'own_only', they can STILL see their own records.
                if (!hasAccess || sharingSetting === "own_only") {
                    filter.doctorId = req.user._id;
                }
            } else {
                // Default to own records for safety (prevents URL manipulation IDOR)
                filter.patientId = patientId;
                filter.doctorId = req.user._id;
            }
        }

        if (search) {
            // Scope prescription search
            let rxFilter = { 'medications.medicineName': { $regex: search, $options: 'i' } };
            if (isOfflinePatient === 'true') {
                rxFilter.isOfflinePatient = true;
                if (guestName) rxFilter.guestName = guestName;
                if (guestPhone) rxFilter.guestPhone = guestPhone;
                rxFilter.doctorId = req.user._id;
            } else {
                rxFilter.patientId = patientId;
                if (filter.doctorId) {
                    rxFilter.doctorId = filter.doctorId;
                }
            }

            const matchingPrescriptions = await prescrptionmodel.find(rxFilter).select('medicalHistoryId');
            const medicalHistoryIdsFromPrescriptions = matchingPrescriptions
                .map(p => p.medicalHistoryId)
                .filter(id => id);

            filter.$or = [
                { diagnosis: { $regex: search, $options: 'i' } },
                { notes: { $regex: search, $options: 'i' } },
                { prescriptionText: { $regex: search, $options: 'i' } }
            ];

            if (medicalHistoryIdsFromPrescriptions.length > 0) {
                filter.$or.push({ _id: { $in: medicalHistoryIdsFromPrescriptions } });
            }
        }

        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                filter.createdAt.$lte = end;
            }
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const sortDirection = sortOrder === 'asc' ? 1 : -1;

        const history = await db_service.find({
            model: medicalhistorymodel,
            filter,
            options: {
                sort: { createdAt: sortDirection },
                skip,
                limit: parseInt(limit),
                populate: [
                    { path: "prescriptions" },
                    { path: "doctorId", select: "fullName" }
                ]
            }
        });

        const total = await medicalhistorymodel.countDocuments(filter);

        return successresponse({
            res,
            message: "Medical history fetched successfully",
            data: {
                history,
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(total / parseInt(limit))
                }
            }
        });
    } catch (error) {
        return next(error);
    }
};

export const getMyPatients = async (req, res, next) => {
    try {
        const { startDate, endDate, page = 1, limit = 10, search = "", typeFilter = "All" } = req.query;
        const dateFilter = {};
        if (startDate || endDate) {
            dateFilter.createdAt = {};
            if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                dateFilter.createdAt.$lte = end;
            }
        }

        const baseFilter = { doctorId: req.user._id, ...dateFilter };
        if (req.assistant && req.assistant.clinicId) {
            baseFilter.clinicId = new mongoose.Types.ObjectId(req.assistant.clinicId);
        } else if (req.query.clinicId && req.query.clinicId !== "all") {
            baseFilter.clinicId = new mongoose.Types.ObjectId(req.query.clinicId);
        }
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const parsedLimit = parseInt(limit);

        // Build the pipeline up to the group stage to get unique patients
        const basePipeline = [
            { $match: baseFilter },
            {
                $group: {
                    _id: {
                        $cond: { if: "$isOfflinePatient", then: "$guestPhone", else: "$patientId" }
                    },
                    isOfflinePatient: { $first: "$isOfflinePatient" },
                    guestName: { $first: "$guestName" },
                    guestPhone: { $first: "$guestPhone" },
                    patientId: { $first: "$patientId" },
                    totalVisits: { $sum: 1 },
                    firstVisit: { $min: "$createdAt" },
                    lastVisit: { $max: "$createdAt" },
                    lastType: { $last: { $cond: { if: "$isOfflinePatient", then: "Walk-in", else: "Online" } } }
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "patientId",
                    foreignField: "_id",
                    as: "userData"
                }
            },
            {
                $unwind: { path: "$userData", preserveNullAndEmptyArrays: true }
            },
            {
                $project: {
                    id: "$_id",
                    isOfflinePatient: 1,
                    guestName: 1,
                    guestPhone: 1,
                    patientId: 1,
                    totalVisits: 1,
                    firstVisit: 1,
                    lastVisit: 1,
                    lastType: 1,
                    fullName: { $cond: { if: "$isOfflinePatient", then: "$guestName", else: "$userData.fullName" } },
                    email: "$userData.email",
                    phoneNumber: "$userData.phoneNumber",
                    status: { $ifNull: ["$userData.status", "active"] }
                }
            }
        ];

        // Apply typeFilter
        if (typeFilter === "Online") {
            basePipeline.push({ $match: { isOfflinePatient: false } });
        } else if (typeFilter === "Walk-in") {
            basePipeline.push({ $match: { isOfflinePatient: true } });
        }

        const isPhoneSearch = search && /^\d+$/.test(search.trim());

        if (isPhoneSearch) {
            // We must fetch all, decrypt, filter in memory, then paginate
            basePipeline.push({ $sort: { lastVisit: -1 } });
            const allPatients = await medicalhistorymodel.aggregate(basePipeline);
            
            let filtered = allPatients.map(p => {
                if (p.phoneNumber && !p.isOfflinePatient) {
                    try {
                        p.phoneNumber = decrypt(p.phoneNumber);
                    } catch (e) {
                        console.error("Failed to decrypt phone");
                    }
                }
                return p;
            });

            const s = search.trim();
            filtered = filtered.filter(p => 
                (p.phoneNumber && p.phoneNumber.includes(s)) || 
                (p.guestPhone && p.guestPhone.includes(s))
            );

            const total = filtered.length;
            const paginated = filtered.slice(skip, skip + parsedLimit);

            return successresponse({
                res,
                status: 200,
                message: "Patients fetched successfully",
                data: {
                    patients: paginated,
                    pagination: {
                        total,
                        page: parseInt(page),
                        limit: parsedLimit,
                        totalPages: Math.ceil(total / parsedLimit)
                    }
                }
            });
        } else {
            // Name search or no search - we can use $facet for DB pagination!
            if (search) {
                basePipeline.push({
                    $match: {
                        fullName: { $regex: search.trim(), $options: "i" }
                    }
                });
            }

            basePipeline.push({
                $facet: {
                    metadata: [{ $count: "total" }],
                    data: [
                        { $sort: { lastVisit: -1 } },
                        { $skip: skip },
                        { $limit: parsedLimit }
                    ]
                }
            });

            const result = await medicalhistorymodel.aggregate(basePipeline);
            const facetResult = result[0];
            const total = facetResult.metadata.length > 0 ? facetResult.metadata[0].total : 0;
            const patients = facetResult.data;

            const decryptedPatients = patients.map(p => {
                if (p.phoneNumber && !p.isOfflinePatient) {
                    try {
                        p.phoneNumber = decrypt(p.phoneNumber);
                    } catch (e) {
                        console.error("Failed to decrypt phone");
                    }
                }
                return p;
            });

            return successresponse({
                res,
                status: 200,
                message: "Patients fetched successfully",
                data: {
                    patients: decryptedPatients,
                    pagination: {
                        total,
                        page: parseInt(page),
                        limit: parsedLimit,
                        totalPages: Math.ceil(total / parsedLimit)
                    }
                }
            });
        }
    } catch (error) {
        next(error);
    }
};


export const getMyPrescriptions = async (req, res, next) => {
    try {
        const { startDate, endDate, page = 1, limit = 10, search = "" } = req.query;
        const dateFilter = {};
        if (startDate || endDate) {
            dateFilter.createdAt = {};
            if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                dateFilter.createdAt.$lte = end;
            }
        }

        const baseFilter = { doctorId: req.user._id, ...dateFilter };
        if (req.query.clinicId && req.query.clinicId !== "all") {
            baseFilter.clinicId = new mongoose.Types.ObjectId(req.query.clinicId);
        }
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const parsedLimit = parseInt(limit);
        const s = search.trim();

        if (s) {
            // Pipeline to join with users and filter
            const pipeline = [
                { $match: baseFilter },
                {
                    $lookup: {
                        from: "users",
                        localField: "patientId",
                        foreignField: "_id",
                        as: "patientIdData"
                    }
                },
                {
                    $unwind: { path: "$patientIdData", preserveNullAndEmptyArrays: true }
                }
            ];

            const isPhoneSearch = /^\d+$/.test(s);
            if (isPhoneSearch) {
                // Must fetch all to decrypt and filter in-memory
                pipeline.push({ $sort: { createdAt: -1 } });
                let allPrescriptions = await prescrptionmodel.aggregate(pipeline);

                allPrescriptions = allPrescriptions.map(p => {
                    if (p.patientIdData && p.patientIdData.phoneNumber) {
                        try {
                            p.patientIdData.phoneNumber = decrypt(p.patientIdData.phoneNumber);
                        } catch (e) { }
                    }
                    p.patientId = p.patientIdData; 
                    delete p.patientIdData;
                    return p;
                });

                let filtered = allPrescriptions.filter(p => 
                    (p.patientId && p.patientId.phoneNumber && p.patientId.phoneNumber.includes(s)) ||
                    (p.guestPhone && p.guestPhone.includes(s))
                );

                const total = filtered.length;
                const paginated = filtered.slice(skip, skip + parsedLimit);

                return successresponse({
                    res,
                    status: 200,
                    message: "Prescriptions fetched successfully",
                    data: {
                        prescriptions: paginated,
                        pagination: {
                            total,
                            page: parseInt(page),
                            limit: parsedLimit,
                            totalPages: Math.ceil(total / parsedLimit)
                        }
                    }
                });
            } else {
                // Name search
                pipeline.push({
                    $match: {
                        $or: [
                            { "patientIdData.fullName": { $regex: s, $options: "i" } },
                            { guestName: { $regex: s, $options: "i" } }
                        ]
                    }
                });

                pipeline.push({
                    $facet: {
                        metadata: [{ $count: "total" }],
                        data: [
                            { $sort: { createdAt: -1 } },
                            { $skip: skip },
                            { $limit: parsedLimit }
                        ]
                    }
                });

                const result = await prescrptionmodel.aggregate(pipeline);
                const facetResult = result[0];
                const total = facetResult.metadata.length > 0 ? facetResult.metadata[0].total : 0;
                let paginated = facetResult.data;

                paginated = paginated.map(p => {
                    if (p.patientIdData && p.patientIdData.phoneNumber) {
                        try {
                            p.patientIdData.phoneNumber = decrypt(p.patientIdData.phoneNumber);
                        } catch (e) { }
                    }
                    p.patientId = p.patientIdData;
                    delete p.patientIdData;
                    return p;
                });

                return successresponse({
                    res,
                    status: 200,
                    message: "Prescriptions fetched successfully",
                    data: {
                        prescriptions: paginated,
                        pagination: {
                            total,
                            page: parseInt(page),
                            limit: parsedLimit,
                            totalPages: Math.ceil(total / parsedLimit)
                        }
                    }
                });
            }
        } else {
            const prescriptionsData = await prescrptionmodel.find(baseFilter)
                .populate({ path: "patientId", select: "fullName email phoneNumber" })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parsedLimit)
                .lean();

            const prescriptions = prescriptionsData.map(p => {
                if (p.patientId && p.patientId.phoneNumber) {
                    try {
                        p.patientId.phoneNumber = decrypt(p.patientId.phoneNumber);
                    } catch (e) { }
                }
                return p;
            });

            const total = await prescrptionmodel.countDocuments(baseFilter);

            return successresponse({
                res,
                status: 200,
                message: "Prescriptions fetched successfully",
                data: {
                    prescriptions,
                    pagination: {
                        total,
                        page: parseInt(page),
                        limit: parsedLimit,
                        totalPages: Math.ceil(total / parsedLimit)
                    }
                }
            });
        }
    } catch (error) {
        next(error);
    }
};

export const getAllDoctors = async (req, res, next) => {
    try {
        // Basic pagination to prevent fetching the entire database
        const { page = 1, limit = 100 } = req.query;
        const skip = (page - 1) * limit;

        const doctors = await doctormodel.find()
            .skip(skip)
            .limit(parseInt(limit))
            .populate({
                path: "userId",
                select: "fullName email confirmed status profilepicture",
                match: { status: "approved" }
            })
            .lean(); // Massive performance boost by returning plain JS objects

        const activeDoctors = doctors.filter(d => d.userId);

        return successresponse({
            res,
            status: 200,
            message: "doctors fetched successfully",
            data: activeDoctors
        });
    } catch (error) {
        next(error);
    }
};

export const getReportsAnalytics = async (req, res, next) => {
    try {
        const doctorId = req.user._id;
        const { startDate, endDate } = req.query;

        let end = new Date();
        let start = new Date();
        start.setDate(start.getDate() - 30); // Default to last 30 days

        if (startDate) start = new Date(startDate);
        if (endDate) {
            end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
        }

        const periodLength = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));

        const prevEnd = new Date(start);
        const prevStart = new Date(start);
        prevStart.setDate(prevStart.getDate() - periodLength);

        const filter = { doctorId, status: "completed", createdAt: { $gte: start, $lte: end } };
        const prevFilter = { doctorId, status: "completed", createdAt: { $gte: prevStart, $lte: prevEnd } };

        if (req.query.clinicId && req.query.clinicId !== "all") {
            filter.clinicId = req.query.clinicId;
            prevFilter.clinicId = req.query.clinicId;
        }

        // Fetch current period sessions
        const currentSessions = await db_service.find({
            model: sessionmodel,
            filter,
            options: { lean: true }
        });

        // Fetch prev period sessions
        const prevSessions = await db_service.find({
            model: sessionmodel,
            filter: prevFilter,
            options: { lean: true }
        });

        // Current KPIs
        let onlineRevenue = 0;
        let offlineRevenue = 0;
        let currentRevenue = 0;
        let onlineCount = 0;
        let walkinCount = 0;
        const trendMap = {};
        const onlineUserIds = new Set();

        currentSessions.forEach(session => {
            if (session.isFeesFinalized) {
                onlineRevenue += (session.fees || 0);
            } else {
                offlineRevenue += (session.fees || 0);
            }

            if (session.isOfflinePatient) walkinCount++;
            else {
                onlineCount++;
                if (session.patientId) onlineUserIds.add(session.patientId.toString());
            }

            const createdAt = session.createdAt ? new Date(session.createdAt) : new Date();
            const dateStr = createdAt.toISOString().split('T')[0];
            trendMap[dateStr] = (trendMap[dateStr] || 0) + 1;
        });
        
        currentRevenue = onlineRevenue + offlineRevenue;

        // Fetch ages from patientmodel
        const patients = await patientmodel.find({ userId: { $in: Array.from(onlineUserIds) } }).lean();

        const ageGroups = { "0-18": 0, "19-30": 0, "31-50": 0, "51+": 0 };
        patients.forEach(p => {
            if (p.age !== undefined) {
                if (p.age <= 18) ageGroups["0-18"]++;
                else if (p.age <= 30) ageGroups["19-30"]++;
                else if (p.age <= 50) ageGroups["31-50"]++;
                else ageGroups["51+"]++;
            }
        });

        // Incorporate walk-in guest ages
        currentSessions.forEach(session => {
            if (session.isOfflinePatient && session.guestAge !== undefined) {
                if (session.guestAge <= 18) ageGroups["0-18"]++;
                else if (session.guestAge <= 30) ageGroups["19-30"]++;
                else if (session.guestAge <= 50) ageGroups["31-50"]++;
                else ageGroups["51+"]++;
            }
        });

        let prevRevenue = 0;
        prevSessions.forEach(session => {
            prevRevenue += (session.fees || 0);
        });

        const revenueGrowth = prevRevenue === 0 ? (currentRevenue > 0 ? 100 : 0) : Math.round(((currentRevenue - prevRevenue) / prevRevenue) * 100);
        const visitsGrowth = prevSessions.length === 0 ? (currentSessions.length > 0 ? 100 : 0) : Math.round(((currentSessions.length - prevSessions.length) / prevSessions.length) * 100);

        const visitTrends = [];
        for (let i = periodLength - 1; i >= 0; i--) {
            const d = new Date(end);
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            visitTrends.push({
                date: dateStr,
                visits: trendMap[dateStr] || 0
            });
        }

        const ageDemographics = Object.keys(ageGroups).map(name => ({
            name, count: ageGroups[name]
        }));

        // Medical History Analytics
        const histories = await db_service.find({
            model: medicalhistorymodel,
            filter: { doctorId, createdAt: { $gte: start, $lte: end } },
            options: { lean: true }
        });

        const diagnosisMap = {};
        histories.forEach(h => {
            if (h.diagnosis) {
                const diag = h.diagnosis?.trim()?.toLowerCase();
                if (diag) diagnosisMap[diag] = (diagnosisMap[diag] || 0) + 1;
            }
        });

        const topDiagnosis = Object.keys(diagnosisMap)
            .map(name => ({ name, count: diagnosisMap[name] }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        // Calculate Total Withdrawn (Payouts)
        const payoutTransactions = await db_service.find({
            model: transactionmodel,
            filter: { userId: doctorId, purpose: 'payout_withdrawal', createdAt: { $gte: start, $lte: end } },
            options: { lean: true }
        });
        const totalWithdrawn = payoutTransactions.reduce((acc, t) => acc + t.amount, 0);

        return successresponse({
            res,
            status: 200,
            message: "Analytics fetched successfully",
            data: {
                kpis: {
                    totalRevenue: currentRevenue,
                    onlineRevenue,
                    offlineRevenue,
                    revenueGrowth,
                    totalVisits: currentSessions.length,
                    visitsGrowth,
                    onlineVisits: onlineCount,
                    walkinVisits: walkinCount,
                    totalWithdrawn
                },
                visitTrends,
                topDiagnosis,
                ageDemographics
            }
        });

    } catch (error) {
        console.error("ANALYTICS 500 ERROR:", error);
        next(error);
    }
};

export const checkDoctorAccess = async (doctorId, patientUserId) => {
    // 1. Get the patient's privacy setting
    const patientProfile = await db_service.findOne({
        model: patientmodel,
        filter: { userId: patientUserId }
    });

    // CHANGE: Default to "otp" instead of "all" for better privacy by default
    const sharingSetting = patientProfile?.sharingSetting ?? "otp";

    // 2. Evaluate access based on setting
    if (sharingSetting === "all" || sharingSetting === "own_only") {
        return { hasAccess: true, sharingSetting };
    }

    // 3. For "otp", verify there is an active session
    const activeSession = await db_service.findOne({
        model: sessionmodel,
        filter: {
            doctorId,
            patientId: patientUserId,
            status: "in_progress",
            validUntil: { $gt: new Date() }
        }
    });

    if (activeSession) {
        return { hasAccess: true, sharingSetting };
    }

    return { hasAccess: false, sharingSetting };
};

// DELETE /doctor/license/pending — cancel pending license before admin reviews it
export const cancelPendingLicense = async (req, res, next) => {
    try {
        const doctor = await db_service.findOne({
            model: doctormodel,
            filter: { userId: req.user._id }
        });

        if (!doctor) {
            throw new Error("Doctor profile not found", { cause: 404 });
        }

        if (!doctor.pendingLicenseImage?.public_id) {
            throw new Error("No pending license to cancel", { cause: 400 });
        }

        const publicId = doctor.pendingLicenseImage.public_id;

        // Remove from DB
        doctor.pendingLicenseImage = null;
        await doctor.save();

        // the doctor still has their previously-approved licenseimage —
        // cancelling the pending update must not leave them stuck on
        // status "pending" (set by uploadLicense), since login requires
        // status === "approved"
        await db_service.findOneAndUpdate({
            model: usermodel,
            filter: { _id: req.user._id },
            update: { status: "approved" }
        });

        // Remove from Cloudinary
        await cloudinary.uploader.destroy(publicId);

        return successresponse({
            res,
            message: "Pending license cancelled successfully",
        });

    } catch (error) {
        next(error);
    }
};

export const addCertificate = async (req, res, next) => {
    try {
        if (!req.file) throw new Error("certificate file is required", { cause: 400 });

        const { title, issuer, issueDate } = req.body;
        const doctor = await db_service.findOne({
            model: doctormodel,
            filter: { userId: req.user._id }
        });

        const { secure_url, public_id } =
            await cloudinary.uploader.upload(req.file.path, {
                folder: "carehub/doctors/certificates"
            });

        doctor.certificates.push({
            title,
            issuer,
            issueDate,
            secure_url,
            public_id
        });

        await doctor.save();
        await notify.certificateAdded(req.user._id, title);

        return successresponse({
            res,
            message: "certificate added successfully",
            data: doctor.certificates
        })
    }
    catch (error) { next(error) }
};

export const updateCertificate = async (req, res, next) => {
    try {
        const { certificateId } = req.params;

        const doctor = await db_service.findOne({
            model: doctormodel,
            filter: { userId: req.user._id }
        });

        const certificate = doctor.certificates.id(certificateId);
        if (!certificate) throw new Error("certificate not found", { cause: 404 });

        if (req.body.title) certificate.title = req.body.title;
        if (req.body.issuer) certificate.title = req.body.issuer;
        if (req.body.issueDate) certificate.title = req.body.issueDate;

        if (req.file) {
            const oldPublicId = certificate.public_id;

            const { secure_url, public_id } =
                await cloudinary.uploader.upload(req.file.path, {
                    folder: "carehub/doctors/certificates"
                })

            certificate.secure_url = secure_url;
            certificate.public_id = public_id;
            await cloudinary.uploader.destroy(oldPublicId);
        }

        await doctor.save();
        await notify.certificateUpdated(req.user._id, certificate.title);

        return successresponse({
            res,
            message: "certificate updated successfully",
            data: doctor.certificates
        });

    }
    catch (error) { next(error) }
};

export const deleteCertificate = async (req, res, next) => {
    try {
        const { certificateId } = req.params;

        const doctor = await db_service.findOne({
            model: doctormodel,
            filter: { userId: req.user._id }
        });

        const certificate = doctor.certificates.id(certificateId);

        if (!certificate) {
            throw new Error("certificate not found", { cause: 404 });
        }

        await cloudinary.uploader.destroy(
            certificate.public_id
        );

        // pull --> work with mongoose array to delete element with id
        doctor.certificates.pull(certificateId);
        await doctor.save();
        await notify.certificateDeleted(req.user._id, certificate.title);

        return successresponse({
            res,
            message: "certificate deleted successfully"
        });

    } catch (error) {
        next(error);
    }
};

export const getCertificates = async (req, res, next) => {
    try {
        const doctor = await db_service.findOne({
            model: doctormodel,
            filter: { userId: req.user._id },
            select: "certificates"
        });

        if (!doctor) throw new Error("doctor not found", { cause: 404 });

        return successresponse({
            res,
            data: doctor.certificates
        });
    } catch (error) { next(error) }
};

export const getAllNotifications = async (req, res, next) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;

        const skip = (page - 1) * limit;

        const filter = {
            userId: req.user._id,
        };

        const [notifications, totalNotifications] = await Promise.all([
            notificationmodel
                .find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),

            notificationmodel.countDocuments(filter),
        ]);

        return res.status(200).json({
            success: true,
            page,
            limit,
            totalNotifications,
            totalPages: Math.ceil(totalNotifications / limit),
            notifications,
        });
    } catch (error) { next(error) }
};

export const reorderSessions = async (req, res, next) => {
    try {
        const { sessions } = req.body;
        // sessions is an array of { id, order }
        
        const bulkOps = sessions.map(s => ({
            updateOne: {
                filter: { _id: s.id, doctorId: req.user._id },
                update: { $set: { order: s.order } }
            }
        }));

        await sessionmodel.bulkWrite(bulkOps);

        return successresponse({
            res,
            message: "Queue reordered successfully"
        });
    } catch (error) { next(error) }
};

export const updateSessionVitals = async (req, res, next) => {
    try {
        const { sessionId } = req.params;
        const { bloodPressure, heartRate, sugarLevel, temperature, weight, height } = req.body;

        const session = await sessionmodel.findOne({ _id: sessionId, doctorId: req.user._id });
        if (!session) throw new Error("session not found", { cause: 404 });

        let history = await medicalhistorymodel.findOne({ sessionId });
        if (!history) {
            let ageAtEncounter = null;
            if (!session.isOfflinePatient && session.patientId) {
                const patientRec = await patientmodel.findOne({ userId: session.patientId });
                if (patientRec?.dateOfBirth) {
                    const ageDiffMs = Date.now() - new Date(patientRec.dateOfBirth).getTime();
                    ageAtEncounter = Math.abs(new Date(ageDiffMs).getUTCFullYear() - 1970);
                } else if (patientRec?.age != null) {
                    ageAtEncounter = patientRec.age;
                }
            }
            history = await medicalhistorymodel.create({
                doctorId: req.user._id,
                patientId: session.patientId, // Null if guest
                sessionId: session._id,
                bloodPressure,
                pulse: heartRate,
                sugarLevel,
                temperature,
                weight,
                height,
                ageAtEncounter,
                clinicId: session.clinicId
            });
        } else {
            history.bloodPressure = bloodPressure || history.bloodPressure;
            history.pulse = heartRate || history.pulse;
            history.sugarLevel = sugarLevel || history.sugarLevel;
            history.temperature = temperature || history.temperature;
            history.weight = weight || history.weight;
            history.height = height || history.height;
            await history.save();
        }

        return successresponse({
            res,
            message: "Vitals updated successfully",
            data: history
        });
    } catch (error) { next(error) }
};

export const updateSessionFees = async (req, res, next) => {
    try {
        const { sessionId } = req.params;
        const { fees, isFeesFinalized } = req.body;

        const existingSession = await db_service.findOne({
            model: sessionmodel,
            filter: { _id: sessionId, doctorId: req.user._id }
        });

        if (!existingSession) {
            throw new Error("Session not found", { cause: 404 });
        }

        if (existingSession.isFeesFinalized && fees < existingSession.fees) {
            throw new Error(`Fees cannot be reduced below the online paid amount (${existingSession.fees})`, { cause: 400 });
        }

        const updateObj = { fees };
        if (isFeesFinalized) {
            updateObj.isFeesFinalized = true;
        }

        const session = await db_service.findOneAndUpdate({
            model: sessionmodel,
            filter: { _id: sessionId, doctorId: req.user._id },
            update: updateObj,
            options: { new: true }
        });

        if (!session) {
            throw new Error("Session not found", { cause: 404 });
        }

        return successresponse({
            res,
            message: "Fees updated successfully",
            data: session
        });
    } catch (error) { next(error) }
};

// ═══════════════════════════════════════════════════════════════
// أضيفي الـ functions دي في doctor.service.js
// ═══════════════════════════════════════════════════════════════

// ─── PATCH /doctor/profile-image ─────────────────────────────────────────────
export const uploadDoctorProfileImage = async (req, res, next) => {
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
            { folder: "carehub/doctors/profiles" }
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

// ─── DELETE /doctor/profile-image ────────────────────────────────────────────
export const deleteDoctorProfileImage = async (req, res, next) => {
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