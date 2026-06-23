import notificationmodel from "../../DB/models/notificationmodel.js";
import * as db_service from "../../DB/db.service.js";
import { successresponse } from "../../common/utilits/responce.success.js";
import { sendNotificationToUser } from "../../common/socket/socket.service.js";
import { authentication } from "../../common/middleware/authenticataiaon.js";
import { sendWebPush } from "./push.service.js";
import pushPermissionModel from "../../DB/models/pushPermissionModel.js";

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

// ─── POST /notifications/push-permission ───────────────────────────────────────
export const savePushPermission = async (req, res, next) => {
    try {
        const { subscription } = req.body;
        if (!subscription || !subscription.endpoint || !subscription.keys) {
            return res.status(400).json({ message: "Subscription object is required with endpoint and keys." });
        }

        // Check if subscription already exists for this user/endpoint
        const existing = await pushPermissionModel.findOne({
            userId: req.user._id,
            "subscription.endpoint": subscription.endpoint
        });

        if (!existing) {
            await pushPermissionModel.create({
                userId: req.user._id,
                subscription
            });
        }

        return successresponse({
            res,
            status: 201,
            message: "Push permission registered successfully",
        });
    } catch (error) {
        next(error);
    }
};


