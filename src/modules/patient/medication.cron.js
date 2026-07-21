import cron from "node-cron";
import medicationschedulemodel from "../../DB/models/medicationschedulemodel.js";
import { notify } from "../notifications/notification.service.js";
import { _syncMissedDosesForAll } from "./patient.service.js";

// Run every minute
const medicationCronJob = cron.schedule("* * * * *", async () => {
  try {
    const now = new Date();
    // Format to HH:mm (e.g. 02:00, 14:30) in 24-hour time
    const currentHour = now.getHours().toString().padStart(2, "0");
    const currentMinute = now.getMinutes().toString().padStart(2, "0");
    const currentTimeStr = `${currentHour}:${currentMinute}`;

    // Find all active schedules
    const schedules = await medicationschedulemodel.find({ isActive: true });

    for (const schedule of schedules) {
      let shouldNotify = false;

      if (schedule.scheduleType === "specific_times") {
        if (schedule.times && schedule.times.includes(currentTimeStr)) {
          shouldNotify = true;
        }
      } else if (schedule.scheduleType === "interval" && schedule.intervalData?.startTime && schedule.intervalData?.hours > 0) {
        // e.g. startTime: "08:00", hours: 4
        // Check if current time is a multiple of interval hours away from startTime
        const [startH, startM] = schedule.intervalData.startTime.split(":").map(Number);
        const [currH, currM] = [Number(currentHour), Number(currentMinute)];
        
        // Exact minute must match
        if (startM === currM) {
           let diffHours = currH - startH;
           if (diffHours < 0) {
             diffHours += 24; // Handle next day crossing
           }
           if (diffHours % schedule.intervalData.hours === 0) {
             shouldNotify = true;
           }
        }
      }

      if (shouldNotify) {
        // Trigger push notification
        await notify.medicationReminder(
          schedule.patientId, 
          schedule.medicineName, 
          `Time to take your medication: ${schedule.medicineName}`
        );
      }
    }
  } catch (error) {
    console.error("Medication Cron Job Error:", error);
  }
});

// Run once daily at 00:05 AM to sync missed doses for all patients
const missedDosesSyncJob = cron.schedule("5 0 * * *", async () => {
    try {
        console.log("[Cron] Starting daily missed doses sync...");
        await _syncMissedDosesForAll();
        console.log("[Cron] Missed doses sync complete.");
    } catch (error) {
        console.error("[Cron] Missed doses sync error:", error);
    }
});

export { medicationCronJob, missedDosesSyncJob };
