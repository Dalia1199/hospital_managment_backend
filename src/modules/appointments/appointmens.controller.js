import { Router } from "express";
import * as AS from "./appointments.service.js";
import * as AV from "./appointmens.validation.js";
import { authentication } from "../../common/middleware/authenticataiaon.js";
import { authorization } from "../../common/middleware/authorization.js";
import { requirePermission, auditLogger, spoofAssistantToDoctor } from "../../common/middleware/assistant.middleware.js";
import { roleenum } from "../../common/enum/user.enum.js";
import { validation } from "../../common/middleware/validation.js";
import { successresponse } from "../../common/utilits/responce.success.js";
import { releaseReservation } from "./reservation.service.js";

const appointmensrouter = Router();
//done

appointmensrouter.get(
    "/availability",
    authentication,
    requirePermission("canManageAppointments"),
    authorization([roleenum.doctor]),
    AS.getAvailability
);

appointmensrouter.post(

    "/availability",

    authentication,

    requirePermission("canManageAppointments"),
    authorization([roleenum.doctor]),

    validation(AV.addAvailabilitySchema),
    auditLogger("ADD_AVAILABILITY"),
    AS.addAvailability

);
//done

appointmensrouter.patch(
    "/availability/:availabilityId",
    authentication,
    requirePermission("canManageAppointments"),
    authorization([roleenum.doctor]),
    validation(AV.updateAvailabilitySchema),
    auditLogger("UPDATE_AVAILABILITY"),
    AS.updateAvailability
);

appointmensrouter.delete(
    "/availability/:availabilityId",
    authentication,
    requirePermission("canManageAppointments"),
    authorization([roleenum.doctor]),
    validation(AV.deleteAvailabilitySchema),
    auditLogger("DELETE_AVAILABILITY"),
    AS.deleteAvailability
);

//done

appointmensrouter.post(
    "/generate-slots",
    authentication,
    requirePermission("canManageAppointments"),
    authorization([roleenum.doctor]),
    validation(AV.generateSlotsSchema),
    auditLogger("GENERATE_SLOTS"),
    AS.generateCustomSlots
);

appointmensrouter.get(

    "/available-slots/:doctorId",

    authentication,
    spoofAssistantToDoctor,
    authorization([
        roleenum.patient, roleenum.doctor
    ]),

    validation(AV.getAvailableSlotsSchema),

    AS.getAvailableSlots

);
//done

appointmensrouter.post(

    "/book",

    authentication,

    authorization([
        roleenum.patient
    ]),

    validation(AV.bookAppointmentSchema),

    AS.bookAppointment

);

// New: Hold slot for 5 minutes before payment
appointmensrouter.post(
  "/hold",
  authentication,
  authorization([
    roleenum.patient
  ]),
  validation(AV.holdSlotSchema),
  AS.holdSlot
);

// New: Confirm appointment after payment
appointmensrouter.post(
  "/confirm",
  authentication,
  authorization([
    roleenum.patient
  ]),
  validation(AV.confirmAppointmentSchema),
  AS.confirmAndCreate
);

// New: Release reservation when user aborts
appointmensrouter.post(
  "/release-reservation",
  authentication,
  authorization([
    roleenum.patient
  ]),
  validation(AV.releaseReservationSchema),
  async (req, res, next) => {
    try {
      const { slotId } = req.body;
      await releaseReservation(slotId);
      return successresponse({
        res,
        status: 200,
        message: "Reservation released",
        data: null,
      });
    } catch (error) {
      next(error);
    }
  }
);

appointmensrouter.delete(
  "/slots/:slotId",
  authentication,
  authorization([roleenum.doctor]),
  AS.deleteDoctorSlot
);

//done
appointmensrouter.get(

    "/my-appointments",

    authentication,

    authorization([
        roleenum.patient
    ]),

    AS.getMyAppointments

);
//done
appointmensrouter.get(

    "/doctor-appointments",

    authentication,

    requirePermission("canManageAppointments"),
    authorization([roleenum.doctor]),

    AS.getDoctorAppointments

);
//done
appointmensrouter.patch(

    "/cancel/:appointmentId",

    authentication,

    authorization([
        roleenum.patient
    ]),

    validation(AV.cancelAppointmentSchema),

    AS.cancelAppointment

);
//done
appointmensrouter.patch(

    "/complete/:appointmentId",

    authentication,

    requirePermission("canManageAppointments"),
    authorization([roleenum.doctor]),

    validation(AV.completeAppointmentSchema),
    auditLogger("COMPLETE_APPOINTMENT"),
    AS.completeAppointment

);
//done
appointmensrouter.delete(

    "/slot/:slotId",

    authentication,

    requirePermission("canManageAppointments"),
    authorization([roleenum.doctor]),

    validation(AV.deleteSlotSchema),
    auditLogger("DELETE_SLOT"),
    AS.deleteSlot

);
//done
appointmensrouter.patch(

    "/slot/:slotId",

    authentication,

    requirePermission("canManageAppointments"),
    authorization([roleenum.doctor]),

    validation(AV.updateSlotSchema),
    auditLogger("UPDATE_SLOT"),
    AS.updateSlot

);
appointmensrouter.patch(

    "/reschedule/:appointmentId",

    authentication,

    authorization([roleenum.patient]),

    validation(AV.rescheduleAppointmentSchema),

    AS.rescheduleAppointment
);
appointmensrouter.get(
    "/dashboard",
    authentication,
    requirePermission("canManageAppointments"),
    authorization([roleenum.doctor]),
    AS.doctorDashboard
);
appointmensrouter.get(
    "/doctor/upcoming",
    authentication,
    requirePermission("canManageAppointments"),
    authorization([roleenum.doctor]),
    AS.getUpcomingAppointments
);

appointmensrouter.get(
    "/doctor/today",
    authentication,
    requirePermission("canManageAppointments"),
    authorization([roleenum.doctor]),
    AS.getTodayAppointments
);

appointmensrouter.get(
    "/doctor/completed",
    authentication,
    requirePermission("canManageAppointments"),
    authorization([roleenum.doctor]),
    AS.getCompletedAppointments
);
appointmensrouter.get(
    "/patient",
    authentication,
    authorization([roleenum.patient]),
    AS.getPatientAppointments
);

// ==============================
// Follow Up Routes
// ==============================

appointmensrouter.post(
    "/:appointmentId/schedule-followup",
    authentication,
    requirePermission("canManageAppointments"),
    authorization([roleenum.doctor]),
    auditLogger("SCHEDULE_FOLLOWUP"),
    AS.scheduleFollowUp
);

appointmensrouter.patch(
    "/:appointmentId/override-followup",
    authentication,
    requirePermission("canManageAppointments"),
    authorization([roleenum.doctor]),
    auditLogger("OVERRIDE_FOLLOWUP"),
    AS.overrideFollowUp
);

export default appointmensrouter;