import slotmodel from "../../DB/models/slot_model.js";

/**
 * Creates a temporary reservation for a slot.
 * Marks slot as reserved and sets reservedAt timestamp.
 * After 5 minutes the reservation is automatically released if not booked.
 */
export const createReservation = async (slotId) => {
  const now = new Date();
  const slot = await slotmodel.findByIdAndUpdate(
    slotId,
    { isReserved: true, reservedAt: now, isBooked: false },
    { new: true }
  );
  if (!slot) {
    throw new Error("Slot not found");
  }

  // Auto‑release after 5 minutes (simple timer). In production use a job queue.
  setTimeout(async () => {
    const freshSlot = await slotmodel.findById(slotId);
    if (freshSlot && freshSlot.isReserved && !freshSlot.isBooked) {
      await slotmodel.findByIdAndUpdate(slotId, { isReserved: false, reservedAt: null });
    }
  }, 5 * 60 * 1000);
  return slot;
};

export const releaseReservation = async (slotId) => {
  await slotmodel.findByIdAndUpdate(slotId, { isReserved: false, reservedAt: null });
};
