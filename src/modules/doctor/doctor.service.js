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
import { decrypt , encrypt } from "../../common/utilits/security/encrypt.js";

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
                
            }
        });
    } catch (error) {
        next(error);
    }
};

// add update doctor profile logic
export const updatedoctorprofile = async (req, res, next) => {
    try {
        const {fullName, address, phoneNumber, bio, specialization, experience } = req.body;

        const doctor = await db_service.findOne({
            model: doctormodel,
            filter: { userId: req.user._id }
        });

        if (!doctor) {
            throw new Error("Doctor profile not found", { cause: 404 });
        }

         // Update user model fields (fullName, address)
        if (fullName !== undefined) req.user.fullName = fullName;
        if (address !== undefined) req.user.address = address;
        if (phoneNumber !== undefined) req.user.phoneNumber = encrypt(phoneNumber);
        await req.user.save();


        // Update doctor model fields
        if (bio !== undefined) doctor.bio = bio;
        if (specialization !== undefined) doctor.specialization = specialization;
        if (experience !== undefined) doctor.experience = experience;
        await doctor.save();

        return successresponse({
            res,
            message: "Profile updated successfully",
            data:  {              
                fullName: req.user.fullName,
                address: req.user.address,
                phoneNumber: phoneNumber ? phoneNumber : decrypt(req.user.phoneNumber),
                bio: doctor.bio,
                specialization: doctor.specialization,
                experience: doctor.experience 
            }
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
        const { isOfflinePatient, patientId, guestName, guestPhone, guestAge } = req.body;
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
                    guestAge,
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

export const updatePatientAlerts = async (req, res, next) => {
    try {
        const { patientId } = req.params;
        const { allergies, chronic, surgeries } = req.body;

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
        const { fees, diagnosis, notes, prescriptionText, height, weight, bloodPressure, sugarLevel, pulse, temperature, bloodType, allergies, chronic, surgeries } = req.body;
        const doctorId = req.user._id;

        const session = await db_service.findOneAndUpdate({
            model: sessionmodel,
            filter: { _id: sessionId, doctorId },
            update: { status: "completed", fees: fees || 0 },
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
                const meta = parsedMetadata[i] || { title: `Document ${i+1}`, type: "other" };
                
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

export const getMyPatients = async (req, res, next) => {
    try {
        const { startDate, endDate, page = 1, limit = 10 } = req.query;
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
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const pipeline = [
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
            { $sort: { lastVisit: -1 } },
            { $skip: skip },
            { $limit: parseInt(limit) },
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
                    fullName: "$userData.fullName",
                    email: "$userData.email",
                    phoneNumber: "$userData.phoneNumber",
                    status: { $ifNull: ["$userData.status", "active"] }
                }
            }
        ];

        const patients = await medicalhistorymodel.aggregate(pipeline);

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

        const countPipeline = [
            { $match: baseFilter },
            { 
                $group: {
                    _id: {
                        $cond: { if: "$isOfflinePatient", then: "$guestPhone", else: "$patientId" }
                    }
                }
            },
            { $count: "total" }
        ];
        const countResult = await medicalhistorymodel.aggregate(countPipeline);
        const total = countResult.length > 0 ? countResult[0].total : 0;

        return successresponse({
            res,
            status: 200,
            message: "Patients fetched successfully",
            data: {
                patients: decryptedPatients,
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(total / parseInt(limit))
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

export const getMyPrescriptions = async (req, res, next) => {
    try {
        const { startDate, endDate, page = 1, limit = 10 } = req.query;
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
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const prescriptions = await prescrptionmodel.find(baseFilter)
            .populate({ path: "patientId", select: "fullName email phoneNumber" })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

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
                    limit: parseInt(limit),
                    totalPages: Math.ceil(total / parseInt(limit))
                }
            }
        });
    } catch (error) {
        next(error);
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

        // Fetch current period sessions
        const currentSessions = await db_service.find({
            model: sessionmodel,
            filter: { doctorId, status: "completed", createdAt: { $gte: start, $lte: end } }
        });

        // Fetch prev period sessions
        const prevSessions = await db_service.find({
            model: sessionmodel,
            filter: { doctorId, status: "completed", createdAt: { $gte: prevStart, $lt: prevEnd } }
        });

        // Current KPIs
        let currentRevenue = 0;
        let onlineCount = 0;
        let walkinCount = 0;
        const trendMap = {};
        const onlineUserIds = new Set();

        currentSessions.forEach(session => {
            currentRevenue += (session.fees || 0);
            if (session.isOfflinePatient) walkinCount++;
            else {
                onlineCount++;
                if (session.patientId) onlineUserIds.add(session.patientId.toString());
            }

            const createdAt = session.createdAt ? new Date(session.createdAt) : new Date();
            const dateStr = createdAt.toISOString().split('T')[0];
            trendMap[dateStr] = (trendMap[dateStr] || 0) + 1;
        });

        // Fetch ages from patientmodel
        const patients = await patientmodel.find({ userId: { $in: Array.from(onlineUserIds) } });

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
            filter: { doctorId, createdAt: { $gte: start, $lte: end } }
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

        return successresponse({
            res,
            status: 200,
            message: "Analytics fetched successfully",
            data: {
                kpis: {
                    totalRevenue: currentRevenue,
                    revenueGrowth,
                    totalVisits: currentSessions.length,
                    visitsGrowth,
                    onlineVisits: onlineCount,
                    walkinVisits: walkinCount
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
