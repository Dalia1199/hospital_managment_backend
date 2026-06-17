import notificationmodel from "../../DB/models/notificationmodel.js";
import * as db_service from "../../DB/db.service.js";
import { successresponse } from "../../common/utilits/responce.success.js";
import { sendNotificationToUser } from "../../common/socket/socket.service.js";

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
  sessionRequested: (userId) =>
    createNotification({
      userId,
      type: "session",
      message: "A doctor is requesting access to your medical history",
    }),
};

// ─── GET /notifications ────────────────────────────────────────────────────────
export const getNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [notifications, total] = await Promise.all([
      notificationmodel
        .find({ userId: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      notificationmodel.countDocuments({ userId: req.user._id }),
    ]);

    return successresponse({
      res,
      status: 200,
      message: "notifications fetched successfully",
      data: {
        notifications,
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
