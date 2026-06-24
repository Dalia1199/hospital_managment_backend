import notificationmodel from "../../DB/models/notificationmodel.js";
import * as db_service from "../../DB/db.service.js";
import { successresponse } from "../../common/utilits/responce.success.js";
import { sendNotificationToUser } from "../../common/socket/socket.service.js";
import { authentication } from "../../common/middleware/authenticataiaon.js";
import doctormodel from "../../DB/models/doctormodel.js";

// ─── Reusable function ─────────────────────────────────────────────────────────
export const createNotification = async ({ userId, message, type, link }) => {
    const notification = await db_service.create({
        model: notificationmodel,
        data: { userId, message, type, link },
    });

    // send real-time if user is online
    sendNotificationToUser(userId, notification);

    return notification;
};

// ─── Predefined notifications ──────────────────────────────────────────────────
export const notify = {
    appointmentBooked: (userId) =>
        createNotification({
            userId,
            type: "appointment",
            message: "Your appointment has been booked successfully",
            link: "/patient/appointments",
        }),
    appointmentCancelled: (userId) =>
        createNotification({
            userId,
            type: "appointment",
            message: "Your appointment has been cancelled",
            link: "/patient/appointments",
        }),
    appointmentRescheduled: (userId) =>
        createNotification({
            userId,
            type: "appointment",
            message: "Your appointment has been rescheduled",
            link: "/patient/appointments",
        }),
    appointmentCompleted: (userId) =>
        createNotification({
            userId,
            type: "appointment",
            message: "Your appointment has been marked as completed",
            link: "/patient/appointments",
        }),
    prescriptionIssued: (userId) =>
        createNotification({
            userId,
            type: "prescription",
            message: "A new prescription has been issued for you",
            link: "/patient/history",
        }),
    medicalHistoryAdded: (userId) =>
        createNotification({
            userId,
            type: "medical_history",
            message: "A new medical record has been added to your history",
            link: "/patient/history",
        }),
    accessRequested: (userId, doctorName) =>
        createNotification({
            userId,
            type: "session",
            message: `Doctor ${doctorName} has requested access to your medical profile.`,
        }),
    profileViewed: (userId, doctorName) =>
        createNotification({
            userId,
            type: "session",
            message: `Doctor ${doctorName} has viewed your medical profile.`,
        }),
    medicationReminder: (userId, medName, msg) =>
        createNotification({
            userId,
            type: "medication",
            message: msg || `It is time to take your medication: ${medName}.`,
        }),
    newDoctorRegistration: (adminId, doctorName) =>
        createNotification({
            userId: adminId,
            type: "doctor_registration",
            message: `A new doctor ${doctorName} has registered and is waiting for approval`,
            link: "/admin/approvals"
        }),
    licenseUpdated: (adminId, doctorName) =>
        createNotification({
            userId: adminId,
            type: "license_update",
            message: `A new doctor ${doctorName} has updated his license and is waiting for approval`,
            link: "/admin/doctors/licenses"
    }),
    newDoctorUnderReview: (doctorId) =>
        createNotification({
            userId: doctorId,
            type: "doctor_under_review",
            message:"Your registration was submitted successfully. Please wait for admin approval",
        }),
    doctorApproved: (doctorId) =>
        createNotification({
            userId: doctorId,
            type: "doctor_approved",
            message:"Your account has been approved by an administrator",
            link: "/doctor"
        }),
    doctorRejected: (doctorId, reason) =>
        createNotification({
            userId: doctorId,
            type: "doctor_rejected",
            message: `Your account approval request has been rejected, the reason: ${reason}`,
        }),
    newLicenseUnderReview: (doctorId) =>
        createNotification({
            userId: doctorId,
            type: "license_under_review",
            message:"Your License was uploaded successfully. Please wait for admin approval",
        }),
    licenseApproved: (doctorId) =>
        createNotification({
            userId: doctorId,
            type: "license_approved",
            message: "Your license update has been approved",
            link: "/doctor/profile"
        }),
    licenseRejected: (doctorId) =>
        createNotification({
            userId: doctorId,
            type: "license_rejected",
            message: "Your license update has been rejected",
        }),
    patientAppointment: (doctorId, patientName, date) =>
        createNotification({
            userId: doctorId,
            type: "patient_booked_appointment",
            message: `${patientName} booked an appointment at ${date}`,
            link: "/doctor/appointments"
        }),
    patientCancelledAppointment: (doctorId, patientName, date) =>
        createNotification({
            userId: doctorId,
            type: "patient_cancelled_appointment",
            message: `${patientName} has cancelled an appointment at ${date}.`,
            link: "/doctor/appointments"
        }),
    patientCompletedAppointment: (doctorId, patientName) =>
        createNotification({
            userId: doctorId,
            type: "patient_completed_appointment",
            message: `${patientName} has completed their appointment.`,
            link: "/doctor/appointments"
        }),
    patientRescheduledAppointment: (doctorId, patientName, date) =>
        createNotification({
            userId: doctorId,
            type: "patient_rescheduled_appointment",
            message: `${patientName} has rescheduled their appointment from ${date} to ${date}.`,
            link: "/doctor/appointments"
        }),
    certificateAdded: (doctorId, certificateName) =>
        createNotification({
            userId: doctorId,
            type: "certificate_added",
            message: `Certificate "${certificateName}" has been added successfully.`,
            link: "/doctor/profile/certificates"
        }),

    certificateUpdated: (doctorId, certificateName) =>
        createNotification({
            userId: doctorId,
            type: "certificate_updated",
            message: `Certificate "${certificateName}" has been updated successfully.`,
            link: "/doctor/profile/certificates"
        }),

    certificateDeleted: (doctorId, certificateName) =>
        createNotification({
            userId: doctorId,
            type: "certificate_deleted",
            message: `Certificate "${certificateName}" has been deleted successfully.`,
            link: "/doctor/profile/certificates"
        }),
};

// ─── GET /notifications ────────────────────────────────────────────────────────
export const getNotifications = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, tab = "all", search = "" } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const filterQuery = { userId: req.user._id };
        
        if (tab === "read") filterQuery.isRead = true;
        if (tab === "unread") filterQuery.isRead = false;
        
        if (search) {
            filterQuery.message = { $regex: search, $options: "i" };
        }

        const [notifications, total, unreadCount] = await Promise.all([
            notificationmodel
                .find(filterQuery)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            notificationmodel.countDocuments(filterQuery),
            notificationmodel.countDocuments({ userId: req.user._id, isRead: false })
        ]);

        return successresponse({
            res,
            status: 200,
            message: "notifications fetched successfully",
            data: {
                notifications,
                unreadCount,
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(total / parseInt(limit)),
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

// ─── PATCH /notifications/:id/read ────────────────────────────────────────────
export const markAsRead = async (req, res, next) => {
    try {
        await db_service.findOneAndUpdate({
            model: notificationmodel,
            filter: { _id: req.params.id, userId: req.user._id },
            update: { isRead: true },
        });
        return successresponse({
            res,
            status: 200,
            message: "notification marked as read",
        });
    } catch (error) {
        next(error);
    }
};

// ─── PATCH /notifications/read-all ────────────────────────────────────────────
export const markAllAsRead = async (req, res, next) => {
    try {
        await notificationmodel.updateMany(
            { userId: req.user._id, isRead: false },
            { isRead: true },
        );
        return successresponse({
            res,
            status: 200,
            message: "all notifications marked as read",
        });
    } catch (error) {
        next(error);
    }
};
