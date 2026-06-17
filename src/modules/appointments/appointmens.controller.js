import { Router } from "express";
import * as AS from "./appointments.service.js";
import * as AV from "./appointmens.validation.js";
import { authentication } from "../../common/middleware/authenticataiaon.js";
import { authorization } from "../../common/middleware/authorization.js";
import { roleenum } from "../../common/enum/user.enum.js";
import { validation } from "../../common/middleware/validation.js";
const appointmensrouter = Router();
//done

appointmensrouter.patch(

    "/availability",

    authentication,

    authorization([roleenum.doctor]),

    validation(AV.addAvailabilitySchema),

    AS.addAvailability

);
//done

appointmensrouter.post(

    "/generate-slots",

    authentication,

    authorization([roleenum.doctor]),

    validation(
        AV.generateSlotsSchema
    ),

    AS.generateMonthlySlots

);
//done

appointmensrouter.get(

    "/available-slots/:doctorId",

    authentication,

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

    authorization([
        roleenum.doctor
    ]),

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

    authorization([roleenum.doctor]),

    validation(AV.completeAppointmentSchema),

    AS.completeAppointment

);
//done
appointmensrouter.delete(

    "/slot/:slotId",

    authentication,

    authorization([roleenum.doctor]),

    validation(AV.deleteSlotSchema),

    AS.deleteSlot

);
//done
appointmensrouter.patch(

    "/slot/:slotId",

    authentication,

    authorization([roleenum.doctor]),

    validation(AV.updateSlotSchema),

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
    authorization([roleenum.doctor]),
    AS.doctorDashboard
);
appointmensrouter.get(
    "/doctor/upcoming",
    authentication,
    authorization([roleenum.doctor]),
    AS.getUpcomingAppointments
);

appointmensrouter.get(
    "/doctor/today",
    authentication,
    authorization([roleenum.doctor]),
    AS.getTodayAppointments
);

appointmensrouter.get(
    "/doctor/completed",
    authentication,
    authorization([roleenum.doctor]),
    AS.getCompletedAppointments
);
appointmensrouter.get(
    "/patient",
    authentication,
    authorization([roleenum.patient]),
    AS.getPatientAppointments
);
export default appointmensrouter;