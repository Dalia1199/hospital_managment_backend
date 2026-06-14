import doctormodel from "../../DB/models/doctormodel.js";
import usermodel from "../../DB/models/usermodel.js";
import patientmodel from "../../DB/models/patientmodel.js";
import medicalhistorymodel from "../../DB/models/medicalhistorymodel.js";
import sessionmodel from "../../DB/models/sessionmodel.js";
import prescrptionmodel from "../../DB/models/prescriptionmodel.js";
import { sendemail, generateotp } from "../../common/utilits/email/send email.js";
import * as db_service from "../../DB/db.service.js";
import { successresponse } from "../../common/utilits/responce.success.js";
import { roleenum } from "../../common/enum/user.enum.js";
import cloudinary from "../../common/utilits/cloudinary.js";
import { decrypt } from "../../common/utilits/security/encrypt.js";

export const getDashboard = async (req, res, next) => {
    try {
        const doctor = await db_service.findOne({
            model: doctormodel,
            filter: { userId: req.user._id }
        });

        if (!doctor) {
            return res.status(404).json({ message: "doctor profile not found" });
        }

        const [totalPatients, totalPrescriptions, totalMedicalHistories] = await Promise.all([
            prescrptionmodel.distinct("patientId", { doctorId: req.user._id }).then(r => r.length),
            db_service.count({ model: prescrptionmodel, filter: { doctorId: req.user._id } }),
            db_service.count({ model: medicalhistorymodel, filter: { doctorId: req.user._id } })
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

// add update doctor profile logic
export const updatedoctorprofile = async (req, res, next) => {
    try {
        const { bio, specialization, experience } = req.body;

        const doctor = await db_service.findOne({
            model: doctormodel,
            filter: { userId: req.user._id }
        });

        if (!doctor) {
            throw new Error("Doctor profile not found", { cause: 404 });
        }

        if (bio !== undefined) doctor.bio = bio;
        if (specialization !== undefined) doctor.specialization = specialization;
        if (experience !== undefined) doctor.experience = experience;

        await doctor.save();

        return successresponse({
            res,
            message: "Profile updated successfully",
            data: doctor
        });
    } catch (error) {
          next(error);
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
        // 1. Upload new image
        const { secure_url, public_id } = await cloudinary.uploader.upload(req.file.path, {
            folder: "carehub/doctors/licenses"
        });

        const oldPublicId = doctor.licenseimage?.public_id;

        try {
            const updatedDoctor = await db_service.findOneAndUpdate({
                model: doctormodel,
                filter: { userId: req.user._id },
                update: { licenseimage: { secure_url, public_id } },
                options: { new: true }
            });

            await db_service.findOneAndUpdate({
                model: usermodel,
                filter: { _id: req.user._id },
                update: { status: "pending" }
            });

            if (oldPublicId) {
                await cloudinary.uploader.destroy(oldPublicId);
            }

            return successresponse({
                res,
                message: "license updated successfully, pending admin approval",
                data: updatedDoctor
            });

        } catch (dbError) {
            await cloudinary.uploader.destroy(public_id);
            throw dbError;
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
            message: "patients fetched successfully",
            data: decryptedPatients
        });
    } catch (error) {
        return next(error);
    }
};

export const createSession = async (req, res, next) => {
    try {
        const { isOfflinePatient, patientId, guestName, guestPhone } = req.body;
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

            const session = await db_service.create({
                model: sessionmodel,
                data: {
                    doctorId,
                    isOfflinePatient,
                    guestName,
                    guestPhone,
                    status: "in_progress",
                    validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000)
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

            // Check for existing session
            const existingSession = await db_service.findOne({
                model: sessionmodel,
                filter: { doctorId, patientId }
            });

            if (existingSession) {
                if (existingSession.status === "in_progress" && existingSession.validUntil > new Date()) {
                    throw new Error("Access already granted for this patient", { cause: 400 });
                }
                
                if (existingSession.status === "pending_otp") {
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
                
                // If existing session is completed or expired in_progress, we can delete it or proceed to create a new one.
                // We'll proceed to create a new one below if it's not pending or valid in_progress.
                // Actually, let's delete the old one to keep the DB clean
                await sessionmodel.findByIdAndDelete(existingSession._id);
            }
            
            const otp = generateotp().toString();
            
            const session = await db_service.create({
                model: sessionmodel,
                data: {
                    doctorId,
                    patientId,
                    otp,
                    status: "pending_otp",
                    validUntil: new Date(Date.now() + 10 * 60 * 1000)
                }
            });

            //commented to avoid sending real emails during testing
            /*
            await sendemail({
                to: patient.email,
                subject: "Carehub - Doctor Access OTP",
                html: `<h3>Hello ${patient.fullName},</h3>
                       <p>Your doctor is requesting access to your medical history.</p>
                       <p>Please provide the following OTP to grant access for 24 hours:</p>
                       <h2 style="color: blue; letter-spacing: 5px;">${otp}</h2>
                       <p>This OTP expires in 10 minutes.</p>`
            });
            */

            return successresponse({
                res,
                message: "OTP generated successfully",
                data: { session, temp_otp: otp } // Sending OTP to frontend for testing <Temporary>
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
    export const endSession = async (req, res, next) => {
    try {
        const { sessionId } = req.params;
        const { diagnosis, notes, prescriptionText, height, weight, bloodType, allergies, chronic, surgeries } = req.body;
        const doctorId = req.user._id;

        const session = await db_service.findOneAndUpdate({
            model: sessionmodel,
            filter: { _id: sessionId, doctorId },
            update: { status: "completed" },
            options: { new: true }
        });
        
        if (!session) {
            throw new Error("Session not found or already completed", { cause: 404 });
        }

        const documents = [];
        if (req.file) {
            const folderName = session.isOfflinePatient ? `guest_${session.guestName}` : `patient_${session.patientId}`;
            const { secure_url, public_id } = await cloudinary.uploader.upload(req.file.path, {
                folder: `carehub/medicalhistory/prescriptions/${folderName}`
            });
            documents.push({
                type: "prescription",
                title: "Handwritten Prescription",
                secure_url,
                public_id,
                uploadedBy: doctorId
            });
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
            allergies: parsedAllergies,
            chronic: parsedChronic,
            surgeries: parsedSurgeries,
            documents
        };

        if (session.isOfflinePatient) {
            medicalHistoryData.isOfflinePatient = true;
            medicalHistoryData.guestName = session.guestName;
            medicalHistoryData.guestPhone = session.guestPhone;
        } else {
            medicalHistoryData.patientId = session.patientId;
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

        const medicalHistory = await db_service.create({
            model: medicalhistorymodel,
            data: medicalHistoryData
        });

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
            throw new Error("Only pending sessions can be cancelled", { cause: 400 });
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
        const sessions = await db_service.find({
            model: sessionmodel,
            filter: { doctorId, status: { $in: ["pending_otp", "in_progress"] } },
            options: { 
                populate: { path: "patientId", select: "fullName phoneNumber profileImage bloodType height weight allergies chronic surgeries" },
                sort: { createdAt: -1 }
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
        const { patientId, isOfflinePatient, guestName, guestPhone } = req.query;
        
        let filter = {};
        if (isOfflinePatient === 'true') {
            filter.isOfflinePatient = true;
            filter.doctorId = req.user._id; // Scope to current doctor
            if (guestName) filter.guestName = guestName;
            if (guestPhone) filter.guestPhone = guestPhone;
        } else {
            filter.patientId = patientId;
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
        const { patientId, isOfflinePatient, guestName, guestPhone, page = 1, limit = 10, search, startDate, endDate } = req.query;
        
        let filter = {};
        if (isOfflinePatient === 'true') {
            filter.isOfflinePatient = true;
            filter.doctorId = req.user._id; // Scope to current doctor
            if (guestName) filter.guestName = guestName;
            if (guestPhone) filter.guestPhone = guestPhone;
        } else {
            filter.patientId = patientId;
        }

        if (search) {
            filter.$or = [
                { diagnosis: { $regex: search, $options: 'i' } },
                { notes: { $regex: search, $options: 'i' } }
            ];
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

        const history = await db_service.find({
            model: medicalhistorymodel,
            filter,
            options: { 
                sort: { createdAt: -1 },
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



export const getAllDoctors = async (req, res, next) => {
    try {
        const doctors = await doctormodel.find().populate({
            path: "userId",
            select: "fullName email confirmed",
            match: { confirmed: true }
        });
 
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