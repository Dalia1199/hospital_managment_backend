import { Router } from "express";
import * as PS from "../prescrption/prescription.service.js"
import * as PV from "../prescrption/prescription.validation.js"

import { validation } from "../../common/middleware/validation.js";
import { authentication } from "../../common/middleware/authenticataiaon.js";
import { authorization } from "../../common/middleware/authorization.js";
import { roleenum } from "../../common/enum/user.enum.js";

const prescrptionrouter = Router()

// GET /prescrption/patient/:patientId
// Accessible by: doctor, patient (own data only)
prescrptionrouter.get(
    "/patient/:patientId",
    authentication,
    authorization([roleenum.doctor, roleenum.patient]),
    validation(PV.getPatientPrescriptionsSchema),
    PS.getPatientPrescriptions
);

export default prescrptionrouter