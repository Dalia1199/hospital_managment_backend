import { Router } from "express";
import * as PS from "../prescrption/prescription.service.js"
import * as PV from "../prescrption/prescription.validation.js"

import { validation } from "../../common/middleware/validation.js";
import { authentication } from "../../common/middleware/authenticataiaon.js";
import { multer_host } from "../../common/middleware/multer.js";
import { multerenum } from "../../common/enum/multerenum.js";

import { authorization } from "../../common/middleware/authorization.js";
import { roleenum } from "../../common/enum/user.enum.js";

const prescrptionrouter = Router()

// ==========================================
// API Routes for Prescriptions
// ==========================================

// Route 1: Update the text fields of a prescription (diagnosis, medications list, notes)
prescrptionrouter.patch(
    "/:id",
    authentication,                          // 1. Authenticate the doctor's JWT token
    authorization([roleenum.doctor]),        // 2. Restrict access: only allow users with "doctor" role
    validation(PV.updatePrescriptionSchema), // 3. Validate that the ID is valid and the body is formatted correctly
    PS.updatePrescription                    // 4. Run the update logic in the service layer
);

// Route 2: Upload a scanned file (image or PDF) for a prescription
prescrptionrouter.patch(
    "/:id/upload",
    authentication,                          // 1. Authenticate the doctor's JWT token
    authorization([roleenum.doctor]),        // 2. Restrict access: only allow doctors
    multer_host([...multerenum.image, ...multerenum.pdf]).single("prescriptionImage"), // 3. Upload middleware: accepts a single file named "prescriptionImage" (png, jpeg, pdf)
    validation(PV.uploadPrescriptionSchema), // 4. Validate the prescription ID in the URL parameter
    PS.uploadPrescriptionImage               // 5. Run the upload logic in the service layer
);

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
