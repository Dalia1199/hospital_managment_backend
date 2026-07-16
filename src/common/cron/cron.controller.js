import { Router } from "express";
import appointmentsmodel from "../../DB/models/appointments_model.js";
import transactionmodel from "../../DB/models/transactionmodel.js";
import { releasePendingToAvailable } from "../../modules/wallet/wallet.service.js";

const router = Router();

router.get("/process-no-shows", async (req, res, next) => {
    try {
        // Secure the cron endpoint in production (Vercel sends a special header)
        if (process.env.NODE_ENV === 'production') {
            const authHeader = req.headers.authorization;
            if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
                return res.status(401).json({ message: "Unauthorized" });
            }
        }

        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const pastBookedAppointments = await appointmentsmodel.find({
            status: "booked",
            startDateTime: { $lt: startOfToday }
        });

        let processedCount = 0;

        for (const appointment of pastBookedAppointments) {
            appointment.status = "completed"; // Mark as completed (was missed before)
            await appointment.save();

            if (appointment.paymentStatus === "paid") {
                const docRevenueTx = await transactionmodel.findOne({
                    userId: appointment.doctorId,
                    purpose: 'online_booking_revenue',
                    $or: [{ referenceId: appointment._id }, { referenceId: appointment.slotId }]
                });

                if (docRevenueTx && docRevenueTx.metadata) {
                    const originalDoctorShare = docRevenueTx.metadata.doctorShare || docRevenueTx.amount;
                    if (originalDoctorShare > 0) {
                        await releasePendingToAvailable(appointment.doctorId, originalDoctorShare);
                    }
                }
            }
            processedCount++;
        }

        return res.status(200).json({ 
            message: "No-shows processed successfully",
            processed: processedCount
        });
    } catch (error) {
        console.error("[CRON] Error processing no-shows:", error);
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
});

export default router;
