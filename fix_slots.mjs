import mongoose from "mongoose";
import checkConnectionDB from "./src/DB/connectiondb.js";
import slotmodel from "./src/DB/models/slot_model.js";
import appointmentsmodel from "./src/DB/models/appointments_model.js";
import dotenv from "dotenv";

dotenv.config();

async function fixSlots() {
  await checkConnectionDB();
  
  // Find all slots that are marked as booked
  const bookedSlots = await slotmodel.find({ isBooked: true });
  console.log(`Found ${bookedSlots.length} slots marked as isBooked=true`);
  
  let fixedCount = 0;
  for (const slot of bookedSlots) {
    // Check if there is a valid appointment for this slot
    const apt = await appointmentsmodel.findOne({ slotId: slot._id, status: { $in: ["booked", "completed"] } });
    if (!apt) {
      console.log(`Slot ${slot._id} is marked booked but has no active appointment. Fixing...`);
      slot.isBooked = false;
      slot.isReserved = false;
      slot.reservedAt = null;
      slot.reservedBy = null;
      await slot.save();
      fixedCount++;
    }
  }
  
  console.log(`Fixed ${fixedCount} orphaned slots.`);
  process.exit(0);
}

fixSlots().catch(console.error);
