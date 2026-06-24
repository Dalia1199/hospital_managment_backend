import cron from "node-cron";
import prescrptionmodel from "../../DB/models/prescriptionmodel.js";
import { notify } from "../../modules/notifications/notification.service.js";
import { parseDuration, parseFrequency } from "../utilits/medicationHelper.js";
import medicationtrackingmodel from "../../DB/models/medicationtrackingmodel.js";

// Returns the number of expected doses up to the current hour. Returns 0 if no dose is scheduled at this exact hour.
function getExpectedDosesSoFar(frequency) {
  const currentHour = new Date().getHours();

  // Define standard hours for each frequency
  const schedules = {
    1: [8],
    2: [8, 20],
    3: [8, 14, 20],
    4: [8, 12, 16, 20],
    6: [0, 4, 8, 12, 16, 20],
  };

  const times = schedules[frequency] || schedules[1];
  
  if (!times.includes(currentHour)) return 0;
  
  let count = 0;
  for (const t of times) {
     if (t <= currentHour) count++;
  }
  return count;
}

export const startMedicationCron = () => {
  // Run at the beginning of every hour (e.g., 08:00, 09:00, 10:00)
  cron.schedule("0 * * * *", async () => {
    try {
      // console.log("Running medication reminder cron job...");
      const now = new Date();

      // Fetch all active prescriptions
      const activePrescriptions = await prescrptionmodel.find({
        status: "active",
        isOfflinePatient: false,
      });

      for (const rx of activePrescriptions) {
        const rxDate = new Date(rx.createdAt);

        for (const med of rx.medications) {
          const durationInfo = parseDuration(med.duration);
          const frequency = parseFrequency(med.frequency);

          let isActive = false;

          // Check if treatment period is still ongoing
          if (durationInfo.isLifelong) {
            isActive = true;
          } else {
            const endDate = new Date(rxDate);
            endDate.setDate(endDate.getDate() + durationInfo.days);
            if (now <= endDate) {
              isActive = true;
            } else {
                // If the end date has passed, we could optionally mark rx as completed if all meds are done,
                // but we will just skip it for now.
            }
          }

          if (isActive) {
            const expectedSoFar = getExpectedDosesSoFar(frequency);
            if (expectedSoFar > 0) {
              const todayStart = new Date(now);
              todayStart.setHours(0, 0, 0, 0);
              const todayEnd = new Date(now);
              todayEnd.setHours(23, 59, 59, 999);

              const trackedCount = await medicationtrackingmodel.countDocuments({
                  patientId: rx.patientId,
                  medicationId: med._id,
                  scheduledDoseDateTime: { $gte: todayStart, $lte: todayEnd }
              });

              if (trackedCount < expectedSoFar) {
                // Send notification
                await notify.medicationReminder(
                  rx.patientId,
                  med.medicineName,
                  `Reminder: It is time to take your dose of ${med.medicineName}.`
                );
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Error running medication cron job:", error);
    }
  });
};
