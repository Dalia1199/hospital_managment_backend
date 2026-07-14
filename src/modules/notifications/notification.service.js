import notificationmodel from "../../DB/models/notificationmodel.js";
import * as db_service from "../../DB/db.service.js";
import { successresponse } from "../../common/utilits/responce.success.js";
import { sendNotificationToUser } from "../../common/socket/socket.service.js";
import { authentication } from "../../common/middleware/authenticataiaon.js";
import doctormodel from "../../DB/models/doctormodel.js";
import { sendWebPush } from "./push.service.js";
import pushPermissionModel from "../../DB/models/pushPermissionModel.js";
import usermodel from "../../DB/models/usermodel.js";

// ─── Reusable function ─────────────────────────────────────────────────────────
export const createNotification = async ({ userId, message, type, link }) => {
    const notification = await db_service.create({
        model: notificationmodel,
        data: { userId, message, type, link },
    });

    // send real-time if user is online
    sendNotificationToUser(userId, notification);

    // send push notification (non-blocking)
    sendWebPush(userId, {
        title: "CareHub Notification",
        body: message,
        link: link
    }).catch(err => console.error("Web Push trigger error:", err));

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
    accessRequested: (userId, doctorName, otp) =>
        createNotification({
            userId,
            type: "session",
            message: `Doctor ${doctorName} has requested access to your medical profile. Your OTP is: ${otp}`,
        }),
    profileViewed: (userId, doctorName) =>
        createNotification({
            userId,
            type: "session",
            message: `Doctor ${doctorName} has viewed your medical profile.`,
        }),
    appointmentReminder: (userId, message, link) =>
        createNotification({
            userId,
            type: "appointment_reminder",
            message: message,
            link: link
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
            type: "license_update",
            type: "doctor_registration",
            message: `A new doctor ${doctorName} has registered and is waiting for approval`,
            link: "/admin/approvals"
        }),
    licenseApproved: (doctorUserId) =>
        createNotification({
            userId: doctorUserId,
            type: "license_update",
            message: "Your updated license has been approved.",
            link: "/doctor/profile"
        }),
    licenseRejected: (doctorUserId, reason) =>
        createNotification({
            userId: doctorUserId,
            type: "license_update",
            message: reason
                ? `Your license update was rejected: ${reason}`
                : "Your license has been rejected by the admin. Please upload a valid license.",
            link: "/doctor/profile"
        }),
    licenseUpdated: (adminId, doctorName) =>
        createNotification({
            userId: adminId,
            type: "license_update",
            message: `Dr. ${doctorName} has uploaded a new license and is waiting for approval`,
            link: "/admin/doctors/licenses"
        }),
    licenseReviewed: (adminId, doctorName, decision) =>
        createNotification({
            userId: adminId,
            type: "license_update",
            message: decision === "approved"
                ? `You approved Dr. ${doctorName}'s license update`
                : `You rejected Dr. ${doctorName}'s license update`,
            link: "/admin/doctors/licenses"
        }),
    newLicenseUnderReview: (doctorId) =>
        createNotification({
            userId: doctorId,
            type: "license_under_review",
            message: "Your updated license has been submitted and is waiting for admin approval",
            link: "/doctor/profile"
        }),
    newDoctorUnderReview: (doctorId) =>
        createNotification({
            userId: doctorId,
            type: "doctor_under_review",
            message: "Your registration was submitted successfully. Please wait for admin approval",
        }),
    doctorApproved: (doctorId) =>
        createNotification({
            userId: doctorId,
            type: "doctor_approved",
            message: "Your account has been approved by an administrator",
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
            message: "Your License was uploaded successfully. Please wait for admin approval",
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
    subscriptionPlanRenewed: (adminId, doctorName) =>
        createNotification({
            userId: adminId,
            type: "doctor_renew_plan",
            message: `${doctorName} has been renewed their subscription plan.`,
            link: "/admin/notifications"
        }),
    doctorPlanRenewed: (doctorId, amount) =>
        createNotification({
            userId: doctorId,
            type: "doctor_renew_plan",
            message: `You have been renewed your subscription plan by ${amount}.`,
            link: "/doctor/notifications"
        }),
    subscriptionPlanPaid: (adminId, doctorName) =>
        createNotification({
            userId: adminId,
            type: "doctor_pay_plan",
            message: `${doctorName} has been paid for a subscription plan.`,
            link: "/admin/notifications"
        }),
    doctorPlanPaid: (doctorId, amount) =>
        createNotification({
            userId: doctorId,
            type: "doctor_pay_plan",
            message: `You have been paid ${amount} for a subscription plan.`,
            link: "/doctor/notifications"
        }),
    doctorPlanRenewed: (doctorId) =>
        createNotification({
            userId: doctorId,
            type: "doctor_renew_plan",
            message: `You have been renewed your subscription plan.`,
            link: "/doctor/notifications"
        }),
};

// ─── GET /notifications ────────────────────────────────────────────────────────
export const getNotifications = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, tab = "all", search = "" } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const filterQuery = { userId: req.user._id };

        if (req.query.clinicId && req.query.clinicId !== "all") {
            // Notifications without a clinicId are considered "global" and shown everywhere
            filterQuery.$or = [
                { clinicId: req.query.clinicId },
                { clinicId: { $exists: false } },
                { clinicId: null }
            ];
        }

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
            notificationmodel.countDocuments({ ...filterQuery, isRead: false })
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

// 📌 POST /notifications/push-permission 
// ---------------------------------------------------------------------------------------------------------------------------------------------------------
export const savePushPermission = async (req, res, next) => {
    try {
        const { subscription } = req.body;
        if (!subscription || !subscription.endpoint || !subscription.keys) {
            return res.status(400).json({ message: "Subscription object is required with endpoint and keys." });
        }

        // Find user 
        const user = await db_service.findOne({
            model: usermodel,
            filter: { _id: req.user._id }
        });

        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        // Add or update the push subscription
        user.pushSubscription = subscription;
        await user.save();

        // Return a response using successresponse structure if applicable
        
        // Remove this specific browser endpoint from any user to avoid getting notifications for a previous user who logged out
        await pushPermissionModel.deleteMany({ "subscription.endpoint": subscription.endpoint });

        // Save the push subscription for the current logged-in user
        const newSub = await pushPermissionModel.create({
            userId: req.user._id,
            subscription
        });
        
        return successresponse({
            res,
            status: 200,
            message: "Push permission saved successfully.",
            data: { subscription: newSub.subscription }
        });
    } catch (error) {
        next(error);
    }
};

// 📌 DELETE /notifications/push-permission
// ---------------------------------------------------------------------------------------------------------------------------------------------------------
export const removePushPermission = async (req, res, next) => {
    try {
        const { endpoint } = req.body;
        if (!endpoint) {
            return res.status(400).json({ message: "Subscription endpoint is required." });
        }

        await pushPermissionModel.deleteMany({ "subscription.endpoint": endpoint, userId: req.user._id });

        return successresponse({
            res,
            status: 200,
            message: "Push subscription removed successfully.",
        });
    } catch (error) {
        next(error);
    }
};
