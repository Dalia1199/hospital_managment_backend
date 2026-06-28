import cron from "node-cron";
import appointmentModel from "../../DB/models/appointments_model.js";
import { notify } from "../notifications/notification.service.js";

// Run every hour
cron.schedule("0 * * * *", async () => {
    try {
        console.log("Running hourly appointment reminder cron job...");
        const now = new Date();
        const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
        const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        // Define windows for "about 1 hour" and "about 24 hours"
        const oneHourStart = new Date(oneHourFromNow.getTime() - 5 * 60 * 1000);
        const oneHourEnd = new Date(oneHourFromNow.getTime() + 55 * 60 * 1000);

        const twentyFourHourStart = new Date(twentyFourHoursFromNow.getTime() - 5 * 60 * 1000);
        const twentyFourHourEnd = new Date(twentyFourHoursFromNow.getTime() + 55 * 60 * 1000);

        // Find appointments starting in ~24 hours
        const appointments24h = await appointmentModel.find({
            startDateTime: { $gte: twentyFourHourStart, $lte: twentyFourHourEnd },
            status: "scheduled"
        }).populate("patientId", "fullName").populate("doctorId");

        for (const appt of appointments24h) {
            const timeStr = appt.startDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            // Notify Patient
            await notify.appointmentReminder(
                appt.patientId._id,
                `Reminder: You have an appointment tomorrow at ${timeStr}.`,
                "/patient/appointments"
            );
            // Notify Doctor
            await notify.appointmentReminder(
                appt.doctorId.userId || appt.doctorId._id, // fallback depending on schema
                `Reminder: You have an appointment with ${appt.patientId.fullName} tomorrow at ${timeStr}.`,
                "/doctor/appointments"
            );
        }

        // Find appointments starting in ~1 hour
        const appointments1h = await appointmentModel.find({
            startDateTime: { $gte: oneHourStart, $lte: oneHourEnd },
            status: "scheduled"
        }).populate("patientId", "fullName").populate("doctorId");

        for (const appt of appointments1h) {
            const timeStr = appt.startDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            // Notify Patient
            await notify.appointmentReminder(
                appt.patientId._id,
                `Reminder: Your appointment is starting in 1 hour at ${timeStr}.`,
                "/patient/appointments"
            );
            // Notify Doctor
            await notify.appointmentReminder(
                appt.doctorId.userId || appt.doctorId._id,
                `Reminder: You have an upcoming appointment with ${appt.patientId.fullName} in 1 hour at ${timeStr}.`,
                "/doctor/appointments"
            );
        }
    } catch (error) {
        console.error("Error in appointment reminder cron job:", error);
    }
});
