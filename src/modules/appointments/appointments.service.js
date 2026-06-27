import { successresponse } from "../../common/utilits/responce.success.js";
import { notify } from "../notifications/notification.service.js";

import * as db_service from "../../DB/db.service.js";
import slotmodel from "../../DB/models/slot_model.js";
import appointmentsmodel from "../../DB/models/appointments_model.js";
import doctormodel from "../../DB/models/doctormodel.js";
import availabilitymodel from "../../DB/models/avalibility_model.js";
import clinicmodel from "../../DB/models/clinic_model.js";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat.js";
import { decrypt } from "../../common/utilits/security/encrypt.js";
import mongoose from "mongoose";

// FIX: the plugin was imported but never registered, so the "YYYY-MM-DD HH:mm"
// format string passed to dayjs() further down was silently ignored.
dayjs.extend(customParseFormat);

// shared helper — converts "HH:mm" into minutes-from-midnight so time ranges
// can be compared as numbers instead of strings. (previously duplicated
// inside addAvailability AND defined again at module scope)
const toMinutes = (time) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

// case-insensitive "day" matcher — availability.day may have been stored as
// "Monday", "monday", etc. depending on who created it. Using a regex filter
// at the DB level keeps the overlap checks correct regardless of casing,
// instead of silently missing real conflicts.
const dayFilter = (day) => ({ $regex: `^${day}$`, $options: "i" });

// counts booked, future slots for a clinic that fall on a specific day of
// week — used to decide whether an availability change/deletion is safe.
// Scoped to the affected day only (previously this counted ANY booked slot
// for the whole clinic, so changing/deleting Wednesday's hours could be
// blocked by a booked appointment on a completely unrelated Monday).
async function countBookedSlotsOnDay({ doctorId, clinicId, day }) {
  const futureBookedSlots = await slotmodel.find({
    doctorId,
    clinicId,
    isBooked: true,
    startDateTime: { $gte: new Date() },
  });

  return futureBookedSlots.filter(
    (s) => dayjs(s.startDateTime).format("dddd").toLowerCase() === day?.toLowerCase(),
  ).length;
}

//done
export const addAvailability = async (req, res, next) => {
  try {
    const { day, startTime, endTime, appointmentDuration, clinicId } = req.body;

    ///عملت كومنت للجزء ده علشان اعطي فرصة للدوكتور يضيف اكتر من ميعاد نفس اليوم في نفس العيادة
    // const filter = { doctorId: req.user._id, day };
    // if (clinicId) filter.clinicId = clinicId;

    // const exists = await db_service.findOne({
    //   model: availabilitymodel,
    //   filter,
    // });

    // if (exists) {
    //   throw new Error("availability already exists for this day", { cause: 409 });
    // }

    if (!clinicId) {
      throw new Error("clinicId is required", { cause: 400 });
    }

    const availabilities = await db_service.find({
      model: availabilitymodel,
      filter: {
        doctorId: req.user._id,
        clinicId,
        day: dayFilter(day),
      },
    });

    const newStart = toMinutes(startTime);
    const newEnd = toMinutes(endTime);

    if (newStart >= newEnd) {
      throw new Error("end time must be greater than start time", {
        cause: 400,
      });
    }

    const overlap = availabilities.find((a) => {
      const existingStart = toMinutes(a.startTime);
      const existingEnd = toMinutes(a.endTime);

      return newStart < existingEnd && newEnd > existingStart;
    });

    if (overlap) {
      throw new Error("availability overlaps with existing schedule", {
        cause: 409,
      });
    }

    const allDayAvailabilities = await availabilitymodel.find({
      doctorId: req.user._id,
      day: dayFilter(day),
      clinicId: { $ne: clinicId },
    });

    const crossOverlap = allDayAvailabilities.find((a) => {
      return newStart < toMinutes(a.endTime) && newEnd > toMinutes(a.startTime);
    });

    if (crossOverlap) {
      throw new Error(
        `Time conflict with another clinic: ${crossOverlap.startTime} – ${crossOverlap.endTime}`,
        { cause: 409 },
      );
    }

    const availability = await db_service.create({
      model: availabilitymodel,
      data: {
        doctorId: req.user._id,
        day: day.toLowerCase(),
        startTime,
        endTime,
        appointmentDuration,
        clinicId,
      },
    });

    successresponse({
      res,
      status: 201,
      message: "availability added successfully",
      data: availability,
    });
  } catch (error) {
    next(error);
  }
};

//done
// supports an optional ?clinicId= filter so the frontend can ask for just
// one clinic's schedule (used by the clinic card / edit page)
export const getAvailability = async (req, res, next) => {
  try {
    const { clinicId } = req.query;

    const filter = { doctorId: req.user._id };
    if (clinicId) filter.clinicId = clinicId;

    const availabilities = await db_service.find({
      model: availabilitymodel,
      filter,
      populate: [{ path: "clinicId", select: "name address" }],
    });

    successresponse({
      res,
      status: 200,
      message: "availabilities fetched successfully",
      data: availabilities,
    });
  } catch (error) {
    next(error);
  }
};

// Shared slot-rebuilding logic used by generateMonthlySlots (the public
// "Generate Slots" button) AND by updateAvailability/deleteAvailability
// (which need to silently keep open slots in sync after a schedule change).
// Always clears old unbooked slots in range first, then rebuilds from
// whatever availabilities currently exist — returns whether any
// availability existed at all, plus how many slots came out of it, and lets
// each caller decide what (if anything) counts as an error for it.
async function regenerateSlotsForRange({
  doctorId,
  clinicId,
  startDate,
  endDate,
  // optional — scope BOTH the deletion and the rebuild to a single day of
  // week. Used by update/deleteAvailability so changing/removing e.g.
  // Monday's hours doesn't touch Tuesday..Sunday's slots at all. Omit (or
  // pass null) to keep the old "whole range, every day" behavior — that's
  // still what generateMonthlySlots wants.
  day,
}) {
  const filter = { doctorId };
  if (clinicId) filter.clinicId = clinicId;
  if (day) filter.day = dayFilter(day);

  const availabilities = await db_service.find({
    model: availabilitymodel,
    filter,
  });

  const deleteFilter = {
    doctorId,
    isBooked: false,
    startDateTime: {
      $gte: startDate.toDate(),
      $lte: endDate.toDate(),
    },
  };
  if (clinicId) deleteFilter.clinicId = new mongoose.Types.ObjectId(clinicId);

  if (day) {
    // Mongo can't match "day of week" directly on a Date field without an
    // aggregation pipeline, so when we need to scope to one weekday we pull
    // the candidate ids and filter in JS before deleting — still far
    // cheaper than wiping/rebuilding every day in the range.
    const candidates = await slotmodel
      .find(deleteFilter)
      .select("_id startDateTime");
    const idsToDelete = candidates
      .filter(
        (s) =>
          dayjs(s.startDateTime).format("dddd").toLowerCase() ===
          day.toLowerCase(),
      )
      .map((s) => s._id);
    if (idsToDelete.length) {
      await slotmodel.deleteMany({ _id: { $in: idsToDelete } });
    }
  } else {
    await slotmodel.deleteMany(deleteFilter);
  }

  if (!availabilities.length) {
    return { totalSlots: 0, hasAvailability: false };
  }

  const slots = [];
  let currentDate = startDate;

  while (currentDate.isBefore(endDate) || currentDate.isSame(endDate, "day")) {
    const currentDay = currentDate.format("dddd").toLowerCase();

    // skip days entirely outside our scope instead of doing the (cheap but
    // pointless) availability filter + inner loop for them
    if (day && currentDay !== day.toLowerCase()) {
      currentDate = currentDate.add(1, "day");
      continue;
    }

    const dayAvailabilities = availabilities.filter(
      (a) => a.day?.toLowerCase() === currentDay,
    );

    for (const availability of dayAvailabilities) {
      let currentSlot = dayjs(
        `${currentDate.format("YYYY-MM-DD")} ${availability.startTime}`,
        "YYYY-MM-DD HH:mm",
      );

      const endSlot = dayjs(
        `${currentDate.format("YYYY-MM-DD")} ${availability.endTime}`,
        "YYYY-MM-DD HH:mm",
      );

      while (currentSlot.isBefore(endSlot)) {
        const nextSlot = currentSlot.add(
          availability.appointmentDuration,
          "minute",
        );

        if (nextSlot.isAfter(endSlot)) break;

        if (currentSlot.isAfter(dayjs())) {
          slots.push({
            doctorId,
            clinicId: availability.clinicId,
            startDateTime: currentSlot.toDate(),
            endDateTime: nextSlot.toDate(),
            isBooked: false,
          });
        }

        currentSlot = nextSlot;
      }
    }

    currentDate = currentDate.add(1, "day");
  }

  if (slots.length) {
    await slotmodel.insertMany(slots);
  }

  return { totalSlots: slots.length, hasAvailability: true };
}

// to update availability we keep the same document (so its _id stays stable
// for the frontend) but re-validate it like a fresh addAvailability would,
// then rebuild this clinic's future open slots from the updated rules.
export const updateAvailability = async (req, res, next) => {
  try {
    const { availabilityId } = req.params;
    const { startTime, endTime, day, appointmentDuration } = req.body;

    const availability = await db_service.findOne({
      model: availabilitymodel,
      filter: {
        _id: availabilityId,
        doctorId: req.user._id,
      },
    });

    if (!availability) {
      throw new Error("availability not found", { cause: 404 });
    }

    // merge incoming changes onto the existing doc so we always validate the
    // *final* shape, even if the doctor only sent one or two fields
    const nextDay = (day || availability.day).toLowerCase();
    const nextStart = startTime || availability.startTime;
    const nextEnd = endTime || availability.endTime;
    const nextDuration =
      appointmentDuration || availability.appointmentDuration;

    const newStart = toMinutes(nextStart);
    const newEnd = toMinutes(nextEnd);

    if (newStart >= newEnd) {
      throw new Error("end time must be greater than start time", {
        cause: 400,
      });
    }

    // overlap check against this clinic's OTHER availabilities on that day
    const siblings = await db_service.find({
      model: availabilitymodel,
      filter: {
        doctorId: req.user._id,
        clinicId: availability.clinicId,
        day: dayFilter(nextDay),
        _id: { $ne: availabilityId },
      },
    });

    const overlap = siblings.find((a) => {
      const existingStart = toMinutes(a.startTime);
      const existingEnd = toMinutes(a.endTime);
      return newStart < existingEnd && newEnd > existingStart;
    });

    if (overlap) {
      throw new Error("availability overlaps with existing schedule", {
        cause: 409,
      });
    }

    const allDayOtherClinics = await availabilitymodel.find({
      doctorId: req.user._id,
      day: dayFilter(nextDay),
      clinicId: { $ne: availability.clinicId },
    });

    const crossOverlap = allDayOtherClinics.find((a) => {
      return newStart < toMinutes(a.endTime) && newEnd > toMinutes(a.startTime);
    });

    if (crossOverlap) {
      throw new Error(
        `Time conflict with another clinic: ${crossOverlap.startTime} – ${crossOverlap.endTime}`,
        { cause: 409 },
      );
    }

    // FIX: scoped to the day actually being changed (the ORIGINAL day,
    // since that's the schedule whose hours are being modified) instead of
    // counting every booked slot in the whole clinic.
    const bookedSlots = await countBookedSlotsOnDay({
      doctorId: req.user._id,
      clinicId: availability.clinicId,
      day: availability.day,
    });

    if (bookedSlots > 0) {
      return successresponse({
        res,
        status: 409,
        message: "cannot update availability with booked slots",
        data: {
          canUpdate: false,
          bookedSlots,
        },
      });
    }

    const updatedAvailability = await db_service.findOneAndUpdate({
      model: availabilitymodel,
      filter: { _id: availabilityId },
      update: {
        startTime: nextStart,
        endTime: nextEnd,
        day: nextDay,
        appointmentDuration: nextDuration,
      },
      options: { new: true },
    });

    // rebuild this clinic's future open slots so the new hours take effect
    // immediately. This is a side effect of the update — if it produces zero
    // slots (e.g. the new range happens to be empty) that's NOT a failure of
    // the availability change itself, so we never let it throw past here.
    let totalSlots = 0;
    try {
      const startDate = dayjs(
        req.body.startDate || dayjs().format("YYYY-MM-DD"),
      );
      const endDate = dayjs(
        req.body.endDate || dayjs().add(1, "year").format("YYYY-MM-DD"),
      );

      // FIX: scoped to the affected day(s) only — previously this wiped and
      // rebuilt a full year of slots for EVERY weekday in this clinic, not
      // just the day actually changed. If the doctor also changed the
      // `day` field itself (e.g. Monday → Tuesday), we need to regenerate
      // BOTH the old day (to clear it out) and the new one (to build it).
      const affectedDays = new Set([
        availability.day.toLowerCase(),
        nextDay,
      ]);

      for (const affectedDay of affectedDays) {
        const result = await regenerateSlotsForRange({
          doctorId: req.user._id,
          clinicId: availability.clinicId,
          startDate,
          endDate,
          day: affectedDay,
        });
        totalSlots += result.totalSlots;
      }
    } catch (genErr) {
      console.error(
        "slot regeneration after availability update failed:",
        genErr,
      );
    }

    return successresponse({
      res,
      status: 200,
      message: "availability updated successfully",
      data: { ...updatedAvailability.toObject(), totalSlots },
    });
  } catch (error) {
    next(error);
  }
};

// was completely missing before — there was no way to remove a single
// availability entry. Same "block if booked" rule as update, then rebuilds
// the clinic's future open slots from whatever availabilities remain (slots
// aren't tagged per-availability, so a full rebuild is the only safe way to
// make sure the deleted day's slots disappear without touching other days).
export const deleteAvailability = async (req, res, next) => {
  try {
    const { availabilityId } = req.params;

    const availability = await db_service.findOne({
      model: availabilitymodel,
      filter: {
        _id: availabilityId,
        doctorId: req.user._id,
      },
    });

    if (!availability) {
      throw new Error("availability not found", { cause: 404 });
    }

    // FIX: scoped to this availability's day only (see updateAvailability)
    const bookedSlots = await countBookedSlotsOnDay({
      doctorId: req.user._id,
      clinicId: availability.clinicId,
      day: availability.day,
    });

    if (bookedSlots > 0) {
      return successresponse({
        res,
        status: 409,
        message: "cannot delete availability with booked slots",
        data: {
          canDelete: false,
          bookedSlots,
        },
      });
    }

    await db_service.deleteOne({
      model: availabilitymodel,
      filter: { _id: availabilityId },
    });

    // rebuild future slots from whatever availabilities remain — if none are
    // left for this clinic, regenerateSlotsForRange still clears the old
    // open slots and simply returns hasAvailability: false, which is fine.
    let totalSlots = 0;
    try {
      // FIX: scoped to availability.day only — previously this wiped and
      // rebuilt a full year of slots for EVERY weekday in this clinic, not
      // just the day that was actually deleted.
      const result = await regenerateSlotsForRange({
        doctorId: req.user._id,
        clinicId: availability.clinicId,
        startDate: dayjs(),
        endDate: dayjs().add(1, "year"), // ← يشيل slots اليوم ده بس لمدة سنة
        day: availability.day,
      });
      totalSlots = result.totalSlots;
    } catch (genErr) {
      console.error(
        "slot regeneration after availability deletion failed:",
        genErr,
      );
    }

    return successresponse({
      res,
      status: 200,
      message: "availability deleted successfully",
      data: { totalSlots },
    });
  } catch (error) {
    next(error);
  }
};

//done
export const generateMonthlySlots = async (req, res, next) => {
  try {
    const doctorId = req.user._id;
    const { clinicId } = req.body;

    const startDate = dayjs(req.body.startDate || dayjs().startOf("day"));
    const endDate = dayjs(req.body.endDate || dayjs().endOf("month"));

    const { totalSlots, hasAvailability } = await regenerateSlotsForRange({
      doctorId,
      clinicId,
      startDate,
      endDate,
    });

    if (!hasAvailability) {
      throw new Error("No availability found", { cause: 404 });
    }

    if (!totalSlots) {
      throw new Error("no slots generated", { cause: 400 });
    }

    return successresponse({
      res,
      status: 201,
      message: "monthly slots generated successfully",
      data: {
        totalSlots,
      },
    });
  } catch (error) {
    next(error);
  }
};

//done
export const getAvailableSlots = async (req, res, next) => {
  try {
    const { doctorId } = req.params;
    const { clinicId } = req.query;

    const filter = {
      doctorId,
      isBooked: false,
      startDateTime: { $gte: new Date() },
    };
    if (clinicId) filter.clinicId = clinicId;

    const slots = await slotmodel.find(filter).sort({ startDateTime: 1 });

    return successresponse({
      res,
      status: 200,
      message: "available slots fetched successfully",
      data: slots,
    });
  } catch (error) {
    next(error);
  }
};

//done
export const bookAppointment = async (req, res, next) => {
  try {
    const { slotId, reason } = req.body;

    const slot = await slotmodel.findOneAndUpdate(
      {
        _id: slotId,
        isBooked: false,
        startDateTime: { $gte: new Date() },
      },
      {
        $set: { isBooked: true },
      },
      { new: true },
    );

    if (!slot) {
      throw new Error("slot not available or already booked", {
        cause: 409,
      });
    }

    const appointment = await appointmentsmodel.create({
      patientId: req.user._id,
      doctorId: slot.doctorId,
      slotId,
      clinicId: slot.clinicId || null,
      reason,
      status: "booked",
      appointmentDate: slot.startDateTime,
      startDateTime: slot.startDateTime,
      endDateTime: slot.endDateTime,
    });

    await notify.appointmentBooked(appointment.patientId);

    return successresponse({
      res,
      message: "appointment booked successfully",
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
};

//done
//gets appointment for patient
export const getMyAppointments = async (req, res, next) => {
  try {
    const appointments = await db_service.find({
      model: appointmentsmodel,
      filter: {
        patientId: req.user._id,
      },
      options: {
        populate: [
          {
            path: "doctorId",
            select: "fullName email profilepicture phoneNumber address",
          },
          {
            path: "slotId",
          },
        ],
        sort: {
          createdAt: -1,
        },
        lean: true,
      },
    });

    const decryptedAppointments = appointments.map((appt) => {
      if (appt.doctorId && appt.doctorId.phoneNumber) {
        try {
          appt.doctorId.phoneNumber = decrypt(appt.doctorId.phoneNumber);
        } catch (e) {
          console.error("Failed to decrypt doctor phone", e);
        }
      }
      return appt;
    });

    return successresponse({
      res,
      status: 200,
      message: "appointments gets successfully",
      data: decryptedAppointments,
    });
  } catch (error) {
    next(error);
  }
};

//done
export const getDoctorAppointments = async (req, res, next) => {
  try {
    const appointments = await db_service.find({
      model: appointmentsmodel,

      filter: {
        doctorId: req.user._id,
      },

      populate: [
        {
          path: "patientId",
          select: "fullName email phoneNumber profilepicture",
        },
        {
          path: "slotId",
        },
        {
          path: "clinicId",
          select: "name address phone",
        },
      ],

      sort: {
        createdAt: -1,
      },
    });

    // FIX: phoneNumber is stored encrypted (see getMyAppointments doing the
    // same for the doctor's number) — this endpoint returned the raw
    // ciphertext to the doctor instead of a usable phone number.
    const decryptedAppointments = appointments.map((appt) => {
      if (appt.patientId && appt.patientId.phoneNumber) {
        try {
          appt.patientId.phoneNumber = decrypt(appt.patientId.phoneNumber);
        } catch (e) {
          console.error("Failed to decrypt patient phone", e);
        }
      }
      return appt;
    });

    return successresponse({
      res,
      status: 200,
      message: "doctor appointments gets successfully",
      data: decryptedAppointments,
    });
  } catch (error) {
    next(error);
  }
};

//done
export const cancelAppointment = async (req, res, next) => {
  try {
    const { appointmentId } = req.params;

    // FIX: was findById with no ownership check at all — any authenticated
    // patient could cancel ANY patient's appointment by guessing/reusing an
    // appointmentId. Now scoped to the requesting patient.
    const appointment = await appointmentsmodel.findOne({
      _id: appointmentId,
      patientId: req.user._id,
    });

    if (!appointment) {
      // FIX: missing { cause: 404 } meant this fell through to a generic
      // 500 instead of a proper 404.
      throw new Error("appointment not found", { cause: 404 });
    }

    if (appointment.status === "cancelled") {
      throw new Error("appointment already cancelled", { cause: 409 });
    }

    appointment.status = "cancelled";
    await appointment.save();

    await slotmodel.findByIdAndUpdate(appointment.slotId, {
      isBooked: false,
    });

    await notify.appointmentCancelled(appointment.patientId);

    return successresponse({
      res,
      message: "cancelled successfully",
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
};

//done
export const completeAppointment = async (req, res, next) => {
  try {
    const { appointmentId } = req.params;

    const appointment = await db_service.findOne({
      model: appointmentsmodel,

      filter: {
        _id: appointmentId,
        doctorId: req.user._id,
      },
    });

    if (!appointment) {
      throw new Error("appointment not found", { cause: 404 });
    }

    if (appointment.status === "completed") {
      throw new Error("appointment already completed", { cause: 409 });
    }

    if (appointment.status === "cancelled") {
      throw new Error("appointment is cancelled", { cause: 400 });
    }

    const updatedAppointment = await db_service.findOneAndUpdate({
      model: appointmentsmodel,

      filter: {
        _id: appointmentId,
      },

      update: {
        status: "completed",
      },

      options: {
        new: true,
      },
    });

    await notify.appointmentCompleted(updatedAppointment.patientId);

    return successresponse({
      res,
      status: 200,
      message: "appointment completed successfully",
      data: updatedAppointment,
    });
  } catch (error) {
    next(error);
  }
};

//done
export const deleteSlot = async (req, res, next) => {
  try {
    const { slotId } = req.params;

    const slot = await db_service.findOne({
      model: slotmodel,

      filter: {
        _id: slotId,
        doctorId: req.user._id,
      },
    });

    if (!slot) {
      throw new Error("slot not found", { cause: 404 });
    }

    if (slot.isBooked) {
      throw new Error("cannot delete booked slot", { cause: 400 });
    }

    await db_service.deleteOne({
      model: slotmodel,

      filter: {
        _id: slotId,
      },
    });

    successresponse({
      res,
      message: "slot deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

//done
export const updateSlot = async (req, res, next) => {
  try {
    const { slotId } = req.params;
    const { startDateTime, endDateTime } = req.body;

    const slot = await slotmodel.findOne({
      _id: slotId,
      isBooked: false,
      doctorId: req.user._id,
    });

    if (!slot) {
      throw new Error("slot not found or already booked", { cause: 404 });
    }

    // FIX: previously only validated the range when BOTH fields were sent,
    // and the overlap query below used the raw (possibly undefined) body
    // values. Falling back to the slot's existing values means a partial
    // update (only startDateTime, or only endDateTime) is still validated
    // and checked for overlaps against its real final range.
    const nextStart = startDateTime ? new Date(startDateTime) : slot.startDateTime;
    const nextEnd = endDateTime ? new Date(endDateTime) : slot.endDateTime;

    if (nextStart >= nextEnd) {
      throw new Error("invalid time range", { cause: 400 });
    }

    const overlappingSlot = await slotmodel.findOne({
      doctorId: slot.doctorId,
      clinicId: slot.clinicId,
      _id: { $ne: slotId },
      isBooked: false,
      startDateTime: { $lt: nextEnd },
      endDateTime: { $gt: nextStart },
    });

    if (overlappingSlot) {
      throw new Error("slot overlaps with existing slot", { cause: 400 });
    }

    const updatedSlot = await slotmodel.findByIdAndUpdate(
      slotId,
      {
        $set: {
          startDateTime: nextStart,
          endDateTime: nextEnd,
        },
      },
      { new: true },
    );

    return successresponse({
      res,
      message: "slot updated successfully",
      data: updatedSlot,
    });
  } catch (error) {
    next(error);
  }
};

//done
export const rescheduleAppointment = async (req, res, next) => {
  try {
    const { appointmentId } = req.params;
    const { newSlotId } = req.body;

    // FIX: was missing patientId in the filter — any authenticated patient
    // could reschedule ANY patient's appointment by guessing the id.
    const appointment = await db_service.findOne({
      model: appointmentsmodel,
      filter: { _id: appointmentId, patientId: req.user._id },
    });

    if (!appointment) {
      throw new Error("appointment not found", { cause: 404 });
    }
    if (new Date(appointment.startDateTime) < new Date()) {
      throw new Error("cannot reschedule past appointment", { cause: 400 });
    }

    if (appointment.status !== "booked") {
      throw new Error("cannot reschedule cancelled/completed appointment", {
        cause: 400,
      });
    }

    const newSlot = await db_service.findOne({
      model: slotmodel,
      filter: {
        _id: newSlotId,
        isBooked: false,
      },
    });

    if (!newSlot) {
      throw new Error("new slot not available", { cause: 400 });
    }

    // FIX: nothing stopped a patient from "rescheduling" into a slot that
    // belongs to a completely different doctor.
    if (String(newSlot.doctorId) !== String(appointment.doctorId)) {
      throw new Error("new slot must belong to the same doctor", {
        cause: 400,
      });
    }

    // FIX (race condition): the old code released the old slot FIRST and
    // only then tried to atomically book the new one. If booking the new
    // slot failed (someone else grabbed it a moment earlier), the old slot
    // had already been freed and the appointment was left pointing at a
    // slot that was no longer reserved — i.e. the patient silently lost
    // their original appointment with nothing to show for it.
    // Now we secure the new slot first, and only release the old one once
    // we know the new one is actually ours.
    const bookedSlot = await db_service.findOneAndUpdate({
      model: slotmodel,
      filter: {
        _id: newSlotId,
        isBooked: false,
      },
      update: {
        isBooked: true,
      },
      options: { new: true },
    });

    if (!bookedSlot) {
      throw new Error("slot was just booked by another user", { cause: 409 });
    }

    const oldSlot = await db_service.findOne({
      model: slotmodel,
      filter: { _id: appointment.slotId },
    });

    if (oldSlot) {
      await db_service.findOneAndUpdate({
        model: slotmodel,
        filter: { _id: oldSlot._id },
        update: { isBooked: false },
      });
    }

    // FIX: the appointment's own startDateTime/endDateTime/appointmentDate
    // were never updated to match the new slot, so "today"/"upcoming"
    // queries (which filter on appointment.startDateTime) would keep
    // showing the OLD time even though slotId pointed at the new one.
    const updatedAppointment = await db_service.findOneAndUpdate({
      model: appointmentsmodel,
      filter: { _id: appointmentId },
      update: {
        slotId: newSlotId,
        clinicId: newSlot.clinicId || null,
        appointmentDate: newSlot.startDateTime,
        startDateTime: newSlot.startDateTime,
        endDateTime: newSlot.endDateTime,
      },
      options: { new: true },
    });

    await notify.appointmentRescheduled(updatedAppointment.patientId);

    return successresponse({
      res,
      status: 200,
      message: "appointment rescheduled successfully",
      data: updatedAppointment,
    });
  } catch (error) {
    next(error);
  }
};

export const doctorDashboard = async (req, res, next) => {
  try {
    const doctorId = req.user._id;

    const [
      totalAppointments,
      bookedAppointments,
      completedAppointments,
      cancelledAppointments,
    ] = await Promise.all([
      appointmentsmodel.countDocuments({ doctorId }),
      appointmentsmodel.countDocuments({ doctorId, status: "booked" }),
      appointmentsmodel.countDocuments({ doctorId, status: "completed" }),
      appointmentsmodel.countDocuments({ doctorId, status: "cancelled" }),
    ]);

    successresponse({
      res,
      message: "doctor dashboard retrieved successfully",
      data: {
        totalAppointments,
        bookedAppointments,
        completedAppointments,
        cancelledAppointments,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getUpcomingAppointments = async (req, res, next) => {
  try {
    const appointments = await db_service.find({
      model: appointmentsmodel,
      filter: {
        doctorId: req.user._id,
        status: "booked",
        startDateTime: { $gte: new Date() },
      },
      populate: [
        {
          path: "patientId",
          // FIX: was "fullname" (lowercase) — didn't match the schema field
          // (fullName, used everywhere else), so this never returned data.
          select: "fullName email",
        },
      ],
    });

    successresponse({
      res,
      message: "upcoming appointments retrieved successfully",
      data: appointments,
    });
  } catch (error) {
    next(error);
  }
};

export const getTodayAppointments = async (req, res, next) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const appointments = await db_service.find({
      model: appointmentsmodel,
      filter: {
        doctorId: req.user._id,
        status: "booked",
        startDateTime: {
          $gte: startOfDay,
          $lte: endOfDay,
        },
      },
      populate: [
        {
          path: "patientId",
          // FIX: "fullname"/"phone" didn't match the real field names
          // (fullName/phoneNumber).
          select: "fullName email phoneNumber",
        },
      ],
    });

    // FIX: phoneNumber is stored encrypted — same issue as
    // getDoctorAppointments.
    const decryptedAppointments = appointments.map((appt) => {
      if (appt.patientId && appt.patientId.phoneNumber) {
        try {
          appt.patientId.phoneNumber = decrypt(appt.patientId.phoneNumber);
        } catch (e) {
          console.error("Failed to decrypt patient phone", e);
        }
      }
      return appt;
    });

    successresponse({
      res,
      message: "today appointments retrieved successfully",
      data: decryptedAppointments,
    });
  } catch (error) {
    next(error);
  }
};

export const getCompletedAppointments = async (req, res, next) => {
  try {
    const appointments = await db_service.find({
      model: appointmentsmodel,
      filter: {
        doctorId: req.user._id,
        status: "completed",
      },
      populate: [
        {
          path: "patientId",
          select: "fullName email phoneNumber",
        },
      ],
    });

    const decryptedAppointments = appointments.map((appt) => {
      if (appt.patientId && appt.patientId.phoneNumber) {
        try {
          appt.patientId.phoneNumber = decrypt(appt.patientId.phoneNumber);
        } catch (e) {
          console.error("Failed to decrypt patient phone", e);
        }
      }
      return appt;
    });

    successresponse({
      res,
      message: "completed appointments retrieved successfully",
      data: decryptedAppointments,
    });
  } catch (error) {
    next(error);
  }
};

export const getPatientAppointments = async (req, res, next) => {
  try {
    const { status, clinicId } = req.query;

    const filter = {
      patientId: req.user._id,
    };

    if (status) filter.status = status;
    if (clinicId) filter.clinicId = clinicId;

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const appointments = await db_service.find({
      model: appointmentsmodel,
      filter,
      populate: [
        {
          path: "doctorId",
          // FIX: "fullname" → "fullName" to match the schema.
          select: "fullName email",
        },
        {
          path: "clinicId",
          select: "name address phone",
        },
      ],
      skip: (page - 1) * limit,
      limit,
    });

    successresponse({
      res,
      message: "appointments retrieved successfully",
      data: appointments,
    });
  } catch (error) {
    next(error);
  }
};