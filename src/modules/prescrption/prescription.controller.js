import { Router } from "express";
import * as PS from "../prescrption/prescription.service.js"
import * as PV from "../prescrption/prescription.validation.js"

import { validation } from "../../common/middleware/validation.js";
import { authentication } from "../../common/middleware/authenticataiaon.js";
import { multer_host } from "../../common/middleware/multer.js";
import { multerenum } from "../../common/enum/multerenum.js";
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

prescrptionrouter.delete('/:id',authentication,authorization([roleenum.doctor, roleenum.admin]),PS.deleteprescrption)

export default prescrptionrouter
