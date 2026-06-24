import { successresponse } from "../../common/utilits/responce.success.js";
import { notify } from "../notifications/notification.service.js";
import { roleenum } from "../../common/enum/user.enum.js";

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

//done
export const addAvailability = async (req, res, next) => {
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
    day,
  },
});

const toMinutes = (time) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

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

  const availability = await db_service.create({
    model: availabilitymodel,
    data: {
      doctorId: req.user._id,
      day,
      startTime,
      endTime,
      appointmentDuration,
      clinicId: clinicId || null,
    },
  });

  successresponse({
    res,
    status: 201,
    message: "availability added successfully",
    data: availability,
  });
};

//done
// supports an optional ?clinicId= filter so the frontend can ask for just
// one clinic's schedule (used by the clinic card / edit page)
export const getAvailability = async (req, res, next) => {
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
};

const toMinutes = (time) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

// Shared slot-rebuilding logic used by generateMonthlySlots (the public
// "Generate Slots" button) AND by updateAvailability/deleteAvailability
// (which need to silently keep open slots in sync after a schedule change).
// Always clears old unbooked slots in range first, then rebuilds from
// whatever availabilities currently exist — returns whether any
// availability existed at all, plus how many slots came out of it, and lets
// each caller decide what (if anything) counts as an error for it.
async function regenerateSlotsForRange({ doctorId, clinicId, startDate, endDate }) {
  const filter = { doctorId };
  if (clinicId) filter.clinicId = clinicId;

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
  if (clinicId) deleteFilter.clinicId = clinicId;

  await slotmodel.deleteMany(deleteFilter);

  if (!availabilities.length) {
    return { totalSlots: 0, hasAvailability: false };
  }

  const slots = [];
  let currentDate = startDate;

  while (currentDate.isBefore(endDate) || currentDate.isSame(endDate, "day")) {
    const currentDay = currentDate.format("dddd").toLowerCase();

    const dayAvailabilities = availabilities.filter(
      (a) => a.day?.toLowerCase() === currentDay
    );

    for (const availability of dayAvailabilities) {
      let currentSlot = dayjs(
        `${currentDate.format("YYYY-MM-DD")} ${availability.startTime}`,
        "YYYY-MM-DD HH:mm"
      );

      const endSlot = dayjs(
        `${currentDate.format("YYYY-MM-DD")} ${availability.endTime}`,
        "YYYY-MM-DD HH:mm"
      );

      while (currentSlot.isBefore(endSlot)) {
        const nextSlot = currentSlot.add(
          availability.appointmentDuration,
          "minute"
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
    const nextDay = day || availability.day;
    const nextStart = startTime || availability.startTime;
    const nextEnd = endTime || availability.endTime;
    const nextDuration = appointmentDuration || availability.appointmentDuration;

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
        day: nextDay,
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

    const bookedSlots = await slotmodel.countDocuments({
      doctorId: req.user._id,
      clinicId: availability.clinicId,
      isBooked: true,
      startDateTime: { $gte: new Date() },
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
      const startDate = dayjs(req.body.startDate || dayjs().format("YYYY-MM-DD"));
      const endDate = dayjs(
        req.body.endDate || dayjs().endOf("month").format("YYYY-MM-DD")
      );
      const result = await regenerateSlotsForRange({
        doctorId: req.user._id,
        clinicId: availability.clinicId,
        startDate,
        endDate,
      });
      totalSlots = result.totalSlots;
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

    const bookedSlots = await slotmodel.countDocuments({
      doctorId: req.user._id,
      clinicId: availability.clinicId,
      isBooked: true,
      startDateTime: { $gte: new Date() },
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
      const result = await regenerateSlotsForRange({
        doctorId: req.user._id,
        clinicId: availability.clinicId,
        startDate: dayjs(),
        endDate: dayjs().endOf("month"),
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

    const slots = await slotmodel
      .find(filter)
      .sort({ startDateTime: 1 });

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
      { new: true }
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

    // 2. update slot
    slot.isBooked = true;
    await slot.save();

    const patient = await usermodel.findById(appointment.patientId);

    await notify.appointmentBooked(appointment.patientId);
    await notify.patientAppointment(slot.doctorId , patient.fullName , slot.startDateTime);

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
            path: "clinicId",
            select: "name address governorate phone whatsapp landline",
          },
          {
            path: "slotId",
          },
        ],
        sort: {
          createdAt: -1,
        },
        lean: true
      }
    });


    const decryptedAppointments = appointments.map(appt => {
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
          select: `
                        fullName
                        email
                        phoneNumber
                        profilepicture
                    `,
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

    return successresponse({
      res,
      status: 200,
      message: "doctor appointments gets successfully",
      data: appointments,
    });
  } catch (error) {
    next(error);
  }
};

//done
export const cancelAppointment = async (req, res, next) => {
  try {
    const { appointmentId } = req.params;

    const appointment = await appointmentsmodel.findById(appointmentId);

    if (!appointment) {
      throw new Error("not found");
    }

    appointment.status = "cancelled";
    await appointment.save();

    await slotmodel.findByIdAndUpdate(appointment.slotId, {
      isBooked: false,
    });

    const patient = await usermodel.findById(appointment.patientId);

    await notify.appointmentCancelled(appointment.patientId);
    await notify.patientCancelledAppointment(appointment.doctorId, patient.fullName, appointment.startDateTime);

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

    const patient = await usermodel.findById(appointment.patientId);

    await notify.appointmentCompleted(updatedAppointment.patientId);
    await notify.patientCompletedAppointment(appointment.doctorId, patient.fullName);

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

    if (startDateTime && endDateTime) {
      if (new Date(startDateTime) >= new Date(endDateTime)) {
        throw new Error("invalid time range", { cause: 400 });
      }
    }

  const overlappingSlot = await slotmodel.findOne({
  doctorId: slot.doctorId,
  clinicId: slot.clinicId,
  _id: { $ne: slotId },
  isBooked: false,
  $or: [
    {
      startDateTime: { $lt: endDateTime },
      endDateTime: { $gt: startDateTime },
    },
  ],
});

    if (overlappingSlot) {
      throw new Error("slot overlaps with existing slot", { cause: 400 });
    }

    // 4. update slot
    const updatedSlot = await slotmodel.findByIdAndUpdate(
      slotId,
      {
        $set: {
          ...(startDateTime && { startDateTime }),
          ...(endDateTime && { endDateTime }),
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

    const appointment = await db_service.findOne({
      model: appointmentsmodel,
      filter: { _id: appointmentId },
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

    const oldSlot = await db_service.findOne({
      model: slotmodel,
      filter: { _id: appointment.slotId },
    });

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

    if (oldSlot) {
      await db_service.findOneAndUpdate({
        model: slotmodel,
        filter: { _id: oldSlot._id },
        update: { isBooked: false },
      });
    }

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

    // 6. update appointment
    const updatedAppointment = await db_service.findOneAndUpdate({
      model: appointmentsmodel,
      filter: { _id: appointmentId },
      update: {
        slotId: newSlotId,
        clinicId: newSlot.clinicId || null,
      },
      options: { new: true },
    });

    await notify.appointmentRescheduled(updatedAppointment.patientId);
    await notify.patientRescheduledAppointment(updatedAppointment.doctorId, updatedAppointment.patientId, appointment.startDateTime, updatedAppointment.startDateTime);

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
};

export const getUpcomingAppointments = async (req, res, next) => {
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
        select: "fullname email ",
      },
    ],
  });

  successresponse({
    res,
    message: "upcoming appointments retrieved successfully",
    data: appointments,
  });
};

export const getTodayAppointments = async (req, res, next) => {
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
        select: "fullname email phone",
      },
    ],
  });

  successresponse({
    res,
    message: "today appointments retrieved successfully",
    data: appointments,
  });
};

export const getCompletedAppointments = async (req, res, next) => {
  const appointments = await db_service.find({
    model: appointmentsmodel,
    filter: {
      doctorId: req.user._id,
      status: "completed",
    },
    populate: [
      {
        path: "patientId",
        select: "fullname email phone",
      },
    ],
  });

  successresponse({
    res,
    message: "completed appointments retrieved successfully",
    data: appointments,
  });
};

export const getPatientAppointments = async (req, res, next) => {
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
        select: "fullname email",
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
};