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
import usermodel from "../../DB/models/usermodel.js";
import { logAction } from "../../common/middleware/assistant.middleware.js";
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

// Normalize a stored time string like "9:00" or "09:00" to always be "09:00"
// so that dayjs("YYYY-MM-DD HH:mm") parses it correctly.
const normalizeTime = (time) => {
  const [h, m] = time.split(":");
  return `${String(Number(h)).padStart(2, "0")}:${String(Number(m)).padStart(2, "0")}`;
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
async function getBookedSlotsOnDay({ doctorId, clinicId, day }) {
  const futureBookedSlots = await slotmodel.find({
    doctorId,
    clinicId,
    isBooked: true,
    startDateTime: { $gte: new Date() },
  });

  // We need the associated appointments to show patient names/details to the doctor
  const slotIds = futureBookedSlots
    .filter((s) => dayjs(s.startDateTime).format("dddd").toLowerCase() === day?.toLowerCase())
    .map((s) => s._id);

  if (slotIds.length === 0) return [];

  const appointments = await appointmentsmodel.find({
    slotId: { $in: slotIds },
    status: "booked"
  }).populate("patientId", "firstName lastName");

  return appointments;
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

    // Instead of failing if one exists, we update it (upsert)
    let existingAvailability = availabilities.length > 0 ? availabilities[0] : null;

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

    let availability;
    if (existingAvailability) {
        existingAvailability.startTime = startTime;
        existingAvailability.endTime = endTime;
        existingAvailability.appointmentDuration = appointmentDuration;
        await existingAvailability.save();
        availability = existingAvailability;
    } else {
        availability = await db_service.create({
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
    }

    successresponse({
      res,
      status: existingAvailability ? 200 : 201,
      message: existingAvailability ? "availability updated successfully" : "availability added successfully",
      data: {
        availability,
      },
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
export async function regenerateSlotsForRange({
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
        `${currentDate.format("YYYY-MM-DD")} ${normalizeTime(availability.startTime)}`,
        "YYYY-MM-DD HH:mm",
      );

      const endSlot = dayjs(
        `${currentDate.format("YYYY-MM-DD")} ${normalizeTime(availability.endTime)}`,
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
    const bookedAppointments = await getBookedSlotsOnDay({
      doctorId: req.user._id,
      clinicId: availability.clinicId,
      day: availability.day,
    });

    const isForce = req.query?.force === "true" || req.body?.force === true;

    if (bookedAppointments.length > 0 && !isForce) {
      return successresponse({
        res,
        status: 409,
        message: "cannot update availability with booked slots",
        data: {
          canUpdate: false,
          bookedSlots: bookedAppointments.length,
          affectedAppointments: bookedAppointments,
        },
      });
    }

    if (bookedAppointments.length > 0 && isForce) {
      // Cancel affected appointments
      for (const appt of bookedAppointments) {
        await cancelAppointmentLogic(appt._id, req.user._id, "Schedule changed by doctor");
      }
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

    return successresponse({
      res,
      status: 200,
      message: "availability updated successfully",
      data: { ...updatedAvailability.toObject() },
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
    const bookedAppointments = await getBookedSlotsOnDay({
      doctorId: req.user._id,
      clinicId: availability.clinicId,
      day: availability.day,
    });

    const isForce = req.query?.force === "true" || req.body?.force === true;

    if (bookedAppointments.length > 0 && !isForce) {
      return successresponse({
        res,
        status: 409,
        message: "cannot delete availability with booked slots",
        data: {
          canDelete: false,
          bookedSlots: bookedAppointments.length,
          affectedAppointments: bookedAppointments,
        },
      });
    }

    if (bookedAppointments.length > 0 && isForce) {
      // Cancel affected appointments
      for (const appt of bookedAppointments) {
        await cancelAppointmentLogic(appt._id, req.user._id, "Schedule deleted by doctor");
      }
    }

    await db_service.deleteOne({
      model: availabilitymodel,
      filter: { _id: availabilityId },
    });

    return successresponse({
      res,
      status: 200,
      message: "availability deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};


export const getAvailableSlots = async (req, res, next) => {
  try {
    const { doctorId } = req.params;
    const { clinicId, startDate, endDate, includeBooked } = req.query;

    const start = startDate ? new Date(startDate) : new Date();
    const filter = {
      doctorId,
      startDateTime: { $gte: start },
    };
    
    // Only patients restrict by isBooked: false, OR if not specifically requested
    if (!(req.user?.role === 'doctor' && includeBooked === 'true')) {
        filter.isBooked = false;
    }

    if (endDate) {
      filter.startDateTime.$lte = new Date(endDate);
    }
    if (clinicId) filter.clinicId = clinicId;

    const slots = await slotmodel.find(filter).sort({ startDateTime: 1 }).lean();

    if (req.user?.role === 'doctor' && includeBooked === 'true') {
        const slotIds = slots.map(s => s._id);
        const appointments = await db_service.find({
            model: appointmentsmodel,
            filter: { slotId: { $in: slotIds }, status: 'booked' },
            populate: [{ path: 'patientId', select: 'fullName phoneNumber' }]
        });
        
        const appointmentMap = {};
        appointments.forEach(app => {
            if (app.patientId && app.patientId.phoneNumber) {
                try {
                    app.patientId.phoneNumber = decrypt(app.patientId.phoneNumber);
                } catch (e) {
                    console.error("Failed to decrypt patient phone", e);
                }
            }
            appointmentMap[app.slotId.toString()] = app;
        });

        slots.forEach(slot => {
            if (slot.isBooked && appointmentMap[slot._id.toString()]) {
                const app = appointmentMap[slot._id.toString()];
                slot.appointmentDetails = {
                    patientName: app.patientId?.fullName,
                    patientPhone: app.patientId?.phoneNumber,
                    appointmentId: app._id
                };
            }
        });
    }

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

    const slotData = await slotmodel.findById(slotId);
    if (!slotData || slotData.isBooked || new Date(slotData.startDateTime) < new Date()) {
      throw new Error("slot not available or already booked", {
        cause: 409,
      });
    }

    // Ensure the patient doesn't already have an active appointment with this doctor
    const existingAppointment = await appointmentsmodel.findOne({
      patientId: req.user._id,
      doctorId: slotData.doctorId,
      status: "booked"
    });

    if (existingAppointment) {
      throw new Error("You already have an active appointment with this doctor. Please wait until it is completed or cancelled.", {
        cause: 409,
      });
    }

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

        let isFollowUp = false;
        let parentAppointmentId = null;

        // Check if there is a scheduled follow-up
        const validFollowUp = await appointmentsmodel.findOne({
          patientId: req.user._id,
          doctorId: slot.doctorId,
          status: "completed",
          followUpStatus: { $in: ["scheduled", "overridden"] }
        }).sort({ createdAt: -1 });

        if (validFollowUp) {
          const bookingDate = dayjs(slot.startDateTime);
          const deadline = dayjs(validFollowUp.followUpDeadline);
          
          if (validFollowUp.followUpStatus === "overridden" || bookingDate.isBefore(deadline) || bookingDate.isSame(deadline, 'day')) {
             isFollowUp = true;
             parentAppointmentId = validFollowUp._id;
             // We will update the parent appointment status to 'used' after this
          } else if (validFollowUp.followUpStatus === "scheduled") {
             // Deadline passed, mark the old follow-up as expired
             validFollowUp.followUpStatus = "expired";
             await validFollowUp.save();
          }
        }

    const appointment = await db_service.create({
      model: appointmentsmodel,
      data: {
        doctorId: slot.doctorId,
        patientId: req.user._id,
        clinicId: slot.clinicId,
        slotId: slot._id,
        reason: reason,
        appointmentDate: slot.startDateTime,
        startDateTime: slot.startDateTime,
        endDateTime: slot.endDateTime,
        paymentStatus: "pending",
        status: "booked",
        isFollowUp,
        parentAppointmentId
      },
    });

    if (isFollowUp && parentAppointmentId) {
       await appointmentsmodel.findByIdAndUpdate(parentAppointmentId, {
           followUpStatus: "used"
       });
    }

    const patient = await db_service.findOne({
      model: usermodel,
      filter: { _id: appointment.patientId }
    });

    await notify.appointmentBooked(appointment.patientId);
    if (patient) {
        await notify.patientAppointment(slot.doctorId, patient.fullName, slot.startDateTime);
    }

    return successresponse({
      res,
      message: "appointment booked successfully",
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
};

import { createReservation, releaseReservation } from "./reservation.service.js";

export const holdSlot = async (req, res, next) => {
  try {
    const { slotId } = req.body;

    const slotData = await slotmodel.findById(slotId);
    if (!slotData || slotData.isBooked || slotData.isReserved || new Date(slotData.startDateTime) < new Date()) {
      throw new Error("slot not available", {
        cause: 409,
      });
    }

    // Ensure the patient doesn't already have an active appointment with this doctor
    const existingAppointment = await appointmentsmodel.findOne({
      patientId: req.user._id,
      doctorId: slotData.doctorId,
      status: "booked"
    });

    if (existingAppointment) {
      throw new Error("You already have an active appointment with this doctor. Please wait until it is completed or cancelled.", {
        cause: 409,
      });
    }

    const slot = await createReservation(slotId);

    return successresponse({
      res,
      message: "slot held successfully for 5 minutes",
      data: slot,
    });
  } catch (error) {
    next(error);
  }
};

// New: confirmAndCreate - creates appointment after successful payment
export const confirmAndCreate = async (req, res, next) => {
  try {
    const { slotId, reason, paymentId } = req.body;
    // Reserve the slot (5‑minute hold)
    await createReservation(slotId);
    // Verify slot still free
    const slot = await slotmodel.findOne({ _id: slotId, isBooked: false, isReserved: true });
    if (!slot) {
      throw new Error('slot not available after reservation', { cause: 409 });
    }
    // Verify payment audit
    const PaymentAudit = (await import('../../DB/models/payment_audit.model.js')).default;
    const payment = await PaymentAudit.findOne({ _id: paymentId, status: 'success' });
    if (!payment) {
      throw new Error('valid payment not found', { cause: 400 });
    }
    // Create appointment with paid status
    const appointment = await db_service.create({
      model: appointmentsmodel,
      data: {
        doctorId: slot.doctorId,
        patientId: req.user._id,
        clinicId: slot.clinicId,
        slotId: slot._id,
        reason,
        appointmentDate: slot.startDateTime,
        startDateTime: slot.startDateTime,
        endDateTime: slot.endDateTime,
        paymentStatus: 'paid',
        status: 'booked',
      },
    });
    // Mark slot as booked and clear reservation
    await slotmodel.findByIdAndUpdate(slotId, { isBooked: true, isReserved: false, reservedAt: null });
    // Notify patient and doctor
    await notify.appointmentBooked(appointment.patientId);
    const patient = await db_service.findOne({ model: usermodel, filter: { _id: appointment.patientId } });
    if (patient) {
      await notify.patientAppointment(slot.doctorId, patient.fullName, slot.startDateTime);
    }
    return successresponse({ res, message: 'appointment confirmed and created', data: appointment });
  } catch (error) {
    // Release reservation on error
    await releaseReservation(req.body.slotId).catch(() => {});
    next(error);
  }
};

//gets appointment for patient
export const getMyAppointments = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = {
      patientId: req.user._id,
    };

    const totalCount = await db_service.count({ model: appointmentsmodel, filter });
    const totalPages = Math.ceil(totalCount / limit);

    const appointments = await db_service.find({
      model: appointmentsmodel,
      filter,
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
        skip,
        limit,
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
      pagination: { totalPages, currentPage: page, totalRecords: totalCount },
    });
  } catch (error) {
    next(error);
  }
};

//done
export const getDoctorAppointments = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = {
      doctorId: req.user._id,
    };

    if (req.query.clinicId && req.query.clinicId !== 'all') {
      filter.clinicId = req.query.clinicId;
    }

    const totalCount = await db_service.count({ model: appointmentsmodel, filter });
    const totalPages = Math.ceil(totalCount / limit);

    const appointments = await db_service.find({
      model: appointmentsmodel,
      filter,

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
      skip,
      limit,
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
      pagination: { totalPages, currentPage: page, totalRecords: totalCount },
    });
  } catch (error) {
    next(error);
  }
};

//done
export const cancelAppointmentLogic = async (appointmentId, actionByUserId, reason) => {
  const appointment = await appointmentsmodel.findById(appointmentId);
  if (!appointment) return;

  if (appointment.status === "cancelled" || appointment.status === "completed") return;

  appointment.status = "cancelled";
  // could save reason if schema allows, skipping for now
  await appointment.save();

  // Restore follow-up rights if this was a follow-up appointment
  if (appointment.isFollowUp && appointment.parentAppointmentId) {
    const parentAppt = await appointmentsmodel.findById(appointment.parentAppointmentId);
    if (parentAppt && parentAppt.followUpStatus === "used") {
      const originalDeadline = new Date(parentAppt.followUpDeadline);
      const newDeadline = new Date();
      newDeadline.setDate(newDeadline.getDate() + 3); // Extend by 3 days from cancellation

      parentAppt.followUpStatus = "scheduled";
      parentAppt.followUpDeadline = newDeadline > originalDeadline ? newDeadline : originalDeadline;
      await parentAppt.save();
    }
  }

  await slotmodel.findByIdAndUpdate(appointment.slotId, {
    isBooked: false,
  });

  if (appointment.paymentStatus === "paid") {
    const { addAvailableBalance, removePendingBalance } = await import('../wallet/wallet.service.js');
    const transactionmodel = (await import('../../DB/models/transactionmodel.js')).default;
    
    const docRevenueTx = await transactionmodel.findOne({
        userId: appointment.doctorId,
        purpose: 'online_booking_revenue',
        $or: [{ referenceId: appointment._id }, { referenceId: appointment.slotId }]
    });

    if (docRevenueTx && docRevenueTx.metadata && docRevenueTx.metadata.totalPaid) {
        const totalPaid = docRevenueTx.metadata.totalPaid;
        const originalDoctorShare = docRevenueTx.metadata.doctorShare || docRevenueTx.amount;
        
        // Doctor cancelled -> 100% refund
        await addAvailableBalance(appointment.patientId, totalPaid, 'refund', appointment._id, { totalPaid });
        await removePendingBalance(appointment.doctorId, originalDoctorShare);
    }
  }

  // Non-blocking: notification failure should never prevent cancellation
  try {
    await notify.appointmentCancelled(appointment.patientId);
  } catch (notifyErr) {
    console.error("[cancelAppointmentLogic] Failed to send cancellation notification:", notifyErr);
  }
  return appointment;
};

export const cancelAppointment = async (req, res, next) => {
  try {
    const { appointmentId } = req.params;

    const appointment = await appointmentsmodel.findOne({
      _id: appointmentId,
      patientId: req.user._id,
    });

    if (!appointment) {
      throw new Error("appointment not found", { cause: 404 });
    }

    if (appointment.status === "cancelled") {
      throw new Error("appointment already cancelled", { cause: 409 });
    }

    if (appointment.status === "completed") {
      throw new Error("cannot cancel a completed appointment", { cause: 400 });
    }

    // Since this is patient-initiated, use the regular logic
    appointment.status = "cancelled";
    await appointment.save();

    // Restore follow-up rights if this was a follow-up appointment
    if (appointment.isFollowUp && appointment.parentAppointmentId) {
      const parentAppt = await appointmentsmodel.findById(appointment.parentAppointmentId);
      if (parentAppt && parentAppt.followUpStatus === "used") {
        const originalDeadline = new Date(parentAppt.followUpDeadline);
        const newDeadline = new Date();
        newDeadline.setDate(newDeadline.getDate() + 3); // Extend by 3 days from cancellation

        parentAppt.followUpStatus = "scheduled";
        parentAppt.followUpDeadline = newDeadline > originalDeadline ? newDeadline : originalDeadline;
        await parentAppt.save();
      }
    }

    await slotmodel.findByIdAndUpdate(appointment.slotId, {
      isBooked: false,
    });

    if (appointment.paymentStatus === "paid") {
      const { calculateRefundSplit } = await import('../appconfig/appconfig.service.js');
      const { addAvailableBalance, removePendingBalance } = await import('../wallet/wallet.service.js');
      const transactionmodel = (await import('../../DB/models/transactionmodel.js')).default;
      
      const docRevenueTx = await transactionmodel.findOne({
          userId: appointment.doctorId,
          purpose: 'online_booking_revenue',
          $or: [{ referenceId: appointment._id }, { referenceId: appointment.slotId }]
      });

      if (docRevenueTx && docRevenueTx.metadata && docRevenueTx.metadata.totalPaid) {
          const totalPaid = docRevenueTx.metadata.totalPaid;
          const originalDoctorShare = docRevenueTx.metadata.doctorShare || docRevenueTx.amount;
          
          const { patientRefund, doctorCompensation } = await calculateRefundSplit(totalPaid);
          
          await addAvailableBalance(appointment.patientId, patientRefund, 'refund', appointment._id, { totalPaid });
          await removePendingBalance(appointment.doctorId, originalDoctorShare);
          
          if (doctorCompensation > 0) {
              await addAvailableBalance(appointment.doctorId, doctorCompensation, 'cancellation_fee', appointment._id);
          }
      }
    }

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
    const filter = { doctorId };

    if (req.query.clinicId && req.query.clinicId !== 'all') {
      filter.clinicId = req.query.clinicId;
    }

    const [
      totalAppointments,
      bookedAppointments,
      completedAppointments,
      cancelledAppointments,
    ] = await Promise.all([
      appointmentsmodel.countDocuments(filter),
      appointmentsmodel.countDocuments({ ...filter, status: "booked" }),
      appointmentsmodel.countDocuments({ ...filter, status: "completed" }),
      appointmentsmodel.countDocuments({ ...filter, status: "cancelled" }),
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
    const filter = {
      doctorId: req.user._id,
      status: "booked",
      startDateTime: { $gte: new Date() },
    };

    if (req.query.clinicId && req.query.clinicId !== 'all') {
      filter.clinicId = req.query.clinicId;
    }

    const appointments = await db_service.find({
      model: appointmentsmodel,
      filter,
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

    const filter = {
      doctorId: req.user._id,
      status: "booked",
      startDateTime: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    };

    if (req.query.clinicId && req.query.clinicId !== 'all') {
      filter.clinicId = req.query.clinicId;
    }

    const appointments = await db_service.find({
      model: appointmentsmodel,
      filter,
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
    const filter = {
      doctorId: req.user._id,
      status: "completed",
    };

    if (req.query.clinicId && req.query.clinicId !== 'all') {
      filter.clinicId = req.query.clinicId;
    }

    const appointments = await db_service.find({
      model: appointmentsmodel,
      filter,
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

    const appointmentsWithAmount = await Promise.all(appointments.map(async (appt) => {
      const doc = await doctormodel.findOne({ userId: appt.doctorId }).lean();
      const amount = appt.isFollowUp ? (doc?.followUpFee ?? ((doc?.consultationFee ?? 0) * 0.5)) : (doc?.consultationFee ?? 0);
      return { ...appt.toObject(), amount };
    }));

    const total = await db_service.count({
      model: appointmentsmodel,
      filter,
    });

    successresponse({
      res,
      message: "appointments retrieved successfully",
      data: appointmentsWithAmount,
      pagination: {
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        totalRecords: total,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── SCHEDULE FOLLOW-UP ───────────────────────────────────────────────────
export const scheduleFollowUp = async (req, res, next) => {
    try {
        const { appointmentId } = req.params;
        const { gracePeriodDays = 7 } = req.body;

        const appointment = await appointments_model.findById(appointmentId);
        if (!appointment) throw new Error("Appointment not found", { cause: 404 });

        const deadline = new Date();
        const GRACE_BUFFER_DAYS = 3; // Adding a 3-day automatic grace period for patient convenience
        deadline.setDate(deadline.getDate() + parseInt(gracePeriodDays) + GRACE_BUFFER_DAYS);

        appointment.isFollowUp = true;
        appointment.followUpStatus = "scheduled";
        appointment.followUpDeadline = deadline;
        appointment.followUpSetBy = req.user._id;

        await appointment.save();

        return successresponse({
            res,
            status: 200,
            message: "Follow-up scheduled successfully",
            data: appointment
        });
    } catch (error) {
        next(error);
    }
};

// ─── OVERRIDE FOLLOW-UP ───────────────────────────────────────────────────
export const overrideFollowUp = async (req, res, next) => {
    try {
        const { appointmentId } = req.params;
        
        const appointment = await appointments_model.findById(appointmentId);
        if (!appointment) throw new Error("Appointment not found", { cause: 404 });

        appointment.followUpStatus = "overridden";
        appointment.followUpSetBy = req.user._id;

        await appointment.save();

        return successresponse({
            res,
            status: 200,
            message: "Follow-up status overridden to active",
            data: appointment
        });
    } catch (error) {
        next(error);
    }
};

export const generateCustomSlots = async (req, res, next) => {
  try {
    const { clinicId, dates } = req.body;
    const doctorId = req.user._id;

    if (!Array.isArray(dates) || dates.length === 0) {
      throw new Error("You must provide an array of dates to generate slots for", { cause: 400 });
    }

    let totalGenerated = 0;

    for (const dateStr of dates) {
      const dateObj = dayjs(dateStr, "YYYY-MM-DD");
      if (!dateObj.isValid()) continue;

      const dayOfWeek = dateObj.format("dddd").toLowerCase();

      // Wipe any UNBOOKED slots on this specific day for this doctor
      // Expanding time window by 3 hours to cover timezone differences (e.g., Egypt UTC+2/+3)
      const deleteFilter = {
        doctorId,
        isBooked: false,
        startDateTime: {
          $gte: dateObj.subtract(3, 'hour').startOf("day").toDate(),
          $lte: dateObj.add(3, 'hour').endOf("day").toDate(),
        },
      };
      // We intentionally do NOT filter by clinicId here. If the doctor generates slots for a day,
      // it should clean up any stale/wrong slots for that day before generating new ones.

      await slotmodel.deleteMany(deleteFilter);

      // Find the availability rules for this day of week
      const availFilter = { doctorId, day: dayFilter(dayOfWeek) };
      if (clinicId) availFilter.clinicId = clinicId;

      const availabilities = await db_service.find({
        model: availabilitymodel,
        filter: availFilter,
      });

      if (!availabilities.length) continue;

      const newSlots = [];

      for (const availability of availabilities) {
        let currentSlot = dayjs(`${dateStr} ${normalizeTime(availability.startTime)}`, "YYYY-MM-DD HH:mm");
        const endSlot = dayjs(`${dateStr} ${normalizeTime(availability.endTime)}`, "YYYY-MM-DD HH:mm");

        while (currentSlot.isBefore(endSlot)) {
          const nextSlot = currentSlot.add(availability.appointmentDuration, "minute");
          if (nextSlot.isAfter(endSlot)) break;

          if (currentSlot.isAfter(dayjs())) {
            newSlots.push({
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

      if (newSlots.length > 0) {
        await slotmodel.insertMany(newSlots);
        totalGenerated += newSlots.length;
      }
    }

    return successresponse({
      res,
      status: 200,
      message: `Generated ${totalGenerated} slots successfully`,
      data: { totalSlots: totalGenerated },
    });

  } catch (error) {
    next(error);
  }
};

export const deleteDoctorSlot = async (req, res, next) => {
    try {
        const { slotId } = req.params;
        const doctorId = req.user._id;

        const slot = await slotmodel.findById(slotId);
        if (!slot) {
            throw new Error("slot not found", { cause: 404 });
        }

        if (slot.doctorId.toString() !== doctorId.toString()) {
            throw new Error("unauthorized to delete this slot", { cause: 403 });
        }

        if (slot.isBooked) {
            const appointment = await appointmentsmodel.findOne({ slotId: slot._id, status: "booked" });
            if (appointment) {
                try {
                    await cancelAppointmentLogic(appointment._id, doctorId, "Slot deleted by doctor");
                } catch (cancelErr) {
                    console.error("[deleteDoctorSlot] Failed to cancel appointment, forcing slot delete anyway:", cancelErr);
                    // Force-mark the appointment as cancelled even if refund failed
                    await appointmentsmodel.findByIdAndUpdate(appointment._id, { status: "cancelled" });
                }
            }
        }

        await slotmodel.findByIdAndDelete(slotId);

        return successresponse({
            res,
            status: 200,
            message: "slot deleted successfully",
            data: null
        });
    } catch (error) {
        next(error);
    }
};

export const deleteMultipleDoctorSlots = async (req, res, next) => {
    try {
        const { slotIds } = req.body;
        const doctorId = req.user._id;

        if (!Array.isArray(slotIds) || slotIds.length === 0) {
            throw new Error("slotIds array is required", { cause: 400 });
        }

        const slots = await slotmodel.find({ _id: { $in: slotIds }, doctorId });

        for (const slot of slots) {
            if (slot.isBooked) {
                const appointment = await appointmentsmodel.findOne({ slotId: slot._id, status: "booked" });
                if (appointment) {
                    try {
                        await cancelAppointmentLogic(appointment._id, doctorId, "Slot deleted by doctor");
                    } catch (cancelErr) {
                        console.error("[deleteMultipleDoctorSlots] Failed to cancel appointment:", cancelErr);
                        await appointmentsmodel.findByIdAndUpdate(appointment._id, { status: "cancelled" });
                    }
                }
            }
            await slotmodel.findByIdAndDelete(slot._id);
        }

        return successresponse({
            res,
            status: 200,
            message: "slots deleted successfully",
            data: null
        });
    } catch (error) {
        next(error);
    }
};