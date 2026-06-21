import appointsmentmodel from "../../DB/models/appointments_model.js";
import { successresponse } from "../../common/utilits/responce.success.js";
import { notify } from "../notifications/notification.service.js";
import { roleenum } from "../../common/enum/user.enum.js";

import * as db_service from "../../DB/db.service.js";
import slotmodel from "../../DB/models/slot_model.js";
import appointmentsmodel from "../../DB/models/appointments_model.js";
import doctormodel from "../../DB/models/doctormodel.js";
import availabilitymodel from "../../DB/models/avalibility_model.js";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat.js";
import { decrypt } from "../../common/utilits/security/encrypt.js";
//done
export const addAvailability = async (req, res, next) => {
  const { day, startTime, endTime, appointmentDuration } = req.body;

  const exists = await db_service.findOne({
    model: availabilitymodel,

    filter: {
      doctorId: req.user._id,

      day,
    },
  });
  if (exists) {
    throw new Error("availability already exists for this day", { cause: 409 });
  }

  const availability = await db_service.create({
    model: availabilitymodel,
    data: {
      doctorId: req.user._id,

      day,

      startTime,

      endTime,

      appointmentDuration,
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

export const getAvailability = async (req, res, next) => {
  const availabilities = await db_service.find({
    model: availabilitymodel,
    filter: {
      doctorId: req.user._id,
    },
  });

  successresponse({
    res,
    status: 200,
    message: "availabilities fetched successfully",
    data: availabilities,
  });
};

//done

export const generateMonthlySlots = async (req, res, next) => {
  const doctorId = req.user._id;

  const availabilities = await db_service.find({
    model: availabilitymodel,
    filter: { doctorId },
  });

  if (!availabilities.length) {
    throw new Error("No availability found", { cause: 404 });
  }

  const slots = [];

  const startOfMonth = dayjs().startOf("month");
  const endOfMonth = dayjs().endOf("month");

  let currentDate = startOfMonth;

  while (
    currentDate.isBefore(endOfMonth) ||
    currentDate.isSame(endOfMonth, "day")
  ) {
    const currentDay = currentDate.format("dddd").toLowerCase();

    const availability = availabilities.find(
      (a) => a.day?.toLowerCase() === currentDay,
    );

    if (availability) {
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

        slots.push({
          doctorId,
          startDateTime: currentSlot.toDate(),
          endDateTime: nextSlot.toDate(),
          isBooked: false,
        });

        currentSlot = nextSlot;
      }
    }

    currentDate = currentDate.add(1, "day");
  }

  if (!slots.length) {
    throw new Error("no slots generated", { cause: 400 });
  }

  await slotmodel.insertMany(slots);

  return successresponse({
    res,
    status: 201,
    message: "monthly slots generated successfully",
    data: {
      totalSlots: slots.length,
    },
  });
};

//done

export const getAvailableSlots = async (req, res, next) => {
  try {
    const { doctorId } = req.params;

    const slots = await slotmodel
      .find({
        doctorId,
        isBooked: false,
        startDateTime: { $gte: new Date() },
      })
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

    const slot = await slotmodel.findOne({
      _id: slotId,
      isBooked: false,
    });

    if (!slot) {
      throw new Error("slot not available");
    }

    if (slot.isBooked) {
      throw new Error("slot already booked");
    }

    // 1. create appointment
    const appointment = await appointmentsmodel.create({
      patientId: req.user._id,
      doctorId: slot.doctorId,
      slotId,
      reason,
      status: "booked",

      appointmentDate: slot.startDateTime,

      startDateTime: slot.startDateTime,

      endDateTime: slot.endDateTime,
    });

    // 2. update slot
    slot.isBooked = true;
    await slot.save();

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
  const doctorId = req.user._id;

  const [
    totalAppointments,
    bookedAppointments,
    completedAppointments,
    cancelledAppointments,
  ] = await Promise.all([
    appointmentsmodel.countDocuments({
      doctorId,
    }),

    appointmentsmodel.countDocuments({
      doctorId,
      status: "booked",
    }),

    appointmentsmodel.countDocuments({
      doctorId,
      status: "completed",
    }),

    appointmentsmodel.countDocuments({
      doctorId,
      status: "cancelled",
    }),
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
  const { status } = req.query;

  const filter = {
    patientId: req.user._id,
  };

  if (status) {
    filter.status = status;
  }
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