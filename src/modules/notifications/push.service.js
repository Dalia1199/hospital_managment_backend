import webpush from "web-push";
import pushPermissionModel from "../../DB/models/pushPermissionModel.js";

// Initialize web-push with VAPID details
const initWebPush = () => {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:carehub601@gmail.com";

  if (publicKey && privateKey) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
  } else {
    console.warn("VAPID keys not configured. Web Push notifications will not be sent.");
  }
};

// Call initialization
initWebPush();

/**
 * Send a web push notification to a user's registered devices
 * @param {string} userId 
 * @param {object} payload { title, body, link }
 */
export const sendWebPush = async (userId, { title, body, link }) => {
  try {
    const subscriptions = await pushPermissionModel.find({ userId });
    if (!subscriptions.length) return;

    const notificationPayload = JSON.stringify({
      notification: {
        title,
        body,
        icon: "/icons/icon-192x192.png",
        badge: "/icons/icon-192x192.png",
        data: {
          url: link || "/",
        },
      },
    });

    const promises = subscriptions.map(async (subDoc) => {
      try {
        await webpush.sendNotification(subDoc.subscription, notificationPayload);
      } catch (error) {
        // If subscription has expired or is no longer valid, delete it
        if (error.statusCode === 410 || error.statusCode === 404) {
          console.log(`Deleting expired push subscription: ${subDoc._id}`);
          await pushPermissionModel.deleteOne({ _id: subDoc._id });
        } else {
          console.error(`Error sending push notification to subscription ${subDoc._id}:`, error);
        }
      }
    });

    await Promise.all(promises);
  } catch (err) {
    console.error("Failed to send web push notifications:", err);
  }
};
