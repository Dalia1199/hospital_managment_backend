import { Router } from "express";
import * as PV from "./prescription.validation.js";
import * as PS from "./prescription.service.js";
import { authentication } from "../../common/middleware/authenticataiaon.js";
import { authorization } from "../../common/middleware/authorization.js";
import { roleenum } from "../../common/enum/user.enum.js";
import { validation } from "../../common/middleware/validation.js";

const prescrptionrouter = Router();

prescrptionrouter.post(
    "/create",
    authentication,
    authorization([roleenum.doctor]),
    validation(PV.createPrescriptionSchema),
    PS.createPrescription
)




// GET /prescrption/patient/:patientId
// Accessible by: doctor, patient (own data only)
prescrptionrouter.get(
    "/patient/:patientId",
    authentication,
    authorization([roleenum.doctor, roleenum.patient]),
    validation(PV.getPatientPrescriptionsSchema),
    PS.getPatientPrescriptions
);

