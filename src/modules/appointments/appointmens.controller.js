import { Router } from "express";
import * as AS from "./appointments.service.js";
import * as AV from "./appointmens.validation.js";
import { authentication } from "../../common/middleware/authenticataiaon.js";
import { authorization } from "../../common/middleware/authorization.js";
import { roleenum } from "../../common/enum/user.enum.js";
import { validation } from "../../common/middleware/validation.js";
const appointmensrouter = Router();

appointmensrouter.post(

    "/slot",

    authentication,

    authorization([roleenum.doctor]),

    validation(AV.createSlotSchema),

    AS.createslot

);
appointmensrouter.get(

    "/available-slots/:doctorId",

    authentication,

    authorization([
        roleenum.patient, roleenum.doctor
    ]),

    validation(AV.getAvailableSlotsSchema),

    AS.getAvailableSlots

);
appointmensrouter.post(

    "/book",

    authentication,

    authorization([
        roleenum.patient
    ]),

    validation(AV.bookAppointmentSchema),

    AS.bookAppointment

);
appointmensrouter.get(

    "/my-appointments",

    authentication,

    authorization([
        roleenum.patient
    ]),

    AS.getMyAppointments

);
appointmensrouter.get(

    "/doctor-appointments",

    authentication,

    authorization([
        roleenum.doctor
    ]),

    AS.getDoctorAppointments

);
appointmensrouter.patch(

    "/cancel/:appointmentId",

    authentication,

    authorization([
        roleenum.patient
    ]),

    validation(AV.cancelAppointmentSchema),

    AS.cancelAppointment

);
export default appointmensrouter;