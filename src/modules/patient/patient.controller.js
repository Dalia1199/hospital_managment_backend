import { Router } from "express";
import *as PS from "./patient.service.js"
import * as PV from "./patient.validation.js"
import { authorization } from "../../common/middleware/authorization.js";

import { validation } from "../../common/middleware/validation.js";
import { authentication } from "../../common/middleware/authenticataiaon.js";
import { multer_host } from "../../common/middleware/multer.js";
import { multerenum } from "../../common/enum/multerenum.js";
import { roleenum } from "../../common/enum/user.enum.js";
const patientrouter = Router()
patientrouter.get(
    "/prescriptions",
    authentication,
    authorization([roleenum.patient]),
    PS.getMyPrescriptions
)

patientrouter.get(
    "/prescriptions/:prescriptionId",
    authentication,
    authorization([roleenum.patient]),
    validation(PV.getSinglePrescriptionSchema),
    PS.getSinglePrescription
)
//done
patientrouter.patch(
    "/profile",
    authentication,
    authorization([roleenum.patient]),
    validation(PV.updatePatientProfileSchema),
    PS.updatePatientProfile
)
//done
patientrouter.patch(
    "/profile-image",
    authentication,
    authorization([roleenum.patient]),
    multer_host(multerenum.image).single("profilepicture"),
    PS.uploadProfileImage
)
patientrouter.delete(
    "/profile-image",
    authentication,
    authorization([roleenum.patient]),
    PS.deleteProfileImage
)
//done
patientrouter.get(
    "/profile",
    authentication,
    authorization([roleenum.patient]),
    PS.getMyProfile
)
//done
// patientrouter.patch(
//     "/profile-image",
//     authentication,
//     authorization([roleenum.patient]),
//     multer_host(multerenum.image).single("image"),
//     PS.updateProfileImage
// )

patientrouter.post(
    "/tracking",
    authentication,
    authorization([roleenum.patient]),
    PS.addTrackingRecord
)

patientrouter.get(
    "/tracking",
    authentication,
    authorization([roleenum.patient]),
    PS.getTrackingRecords
)

export default patientrouter
 