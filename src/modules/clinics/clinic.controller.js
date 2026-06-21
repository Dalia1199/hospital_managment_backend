import { Router } from "express";
import * as CS from "./clinic.service.js";
import * as CV from "./clinic.validation.js";
import { authentication } from "../../common/middleware/authenticataiaon.js";
import { authorization } from "../../common/middleware/authorization.js";
import { roleenum } from "../../common/enum/user.enum.js";
import { validation } from "../../common/middleware/validation.js";

const clinicrouter = Router();

// POST /clinics
clinicrouter.post(
    "/",
    authentication,
    authorization([roleenum.doctor]),
    validation(CV.addClinicSchema),
    CS.addClinic
);

// GET /clinics
clinicrouter.get(
    "/",
    authentication,
    authorization([roleenum.doctor]),
    CS.getMyClinics
);

// PATCH /clinics/:clinicId
clinicrouter.patch(
    "/:clinicId",
    authentication,
    authorization([roleenum.doctor]),
    validation(CV.updateClinicSchema),
    CS.updateClinic
);

// DELETE /clinics/:clinicId
clinicrouter.delete(
    "/:clinicId",
    authentication,
    authorization([roleenum.doctor]),
    validation(CV.clinicIdSchema),
    CS.deleteClinic
);

// GET /clinics/doctor/:doctorId — patient views doctor clinics
clinicrouter.get(
    "/doctor/:doctorId",
    authentication,
    authorization([roleenum.patient, roleenum.doctor]),
    validation(CV.doctorIdSchema),
    CS.getDoctorClinics
);

export default clinicrouter;