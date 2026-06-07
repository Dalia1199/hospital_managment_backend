import { Router } from "express";
import *as AS from "../admin/admin.service.js"
import * as authenticationV from "../admin/admin.validation.js"

import { validation } from "../../common/middleware/validation.js";
import { authentication } from "../../common/middleware/authenticataiaon.js";
import { authorization } from "../../common/middleware/authorization.js";
import { roleenum } from "../../common/enum/user.enum.js";
const adminrouter = Router()

//routes
adminrouter.get(
    "/doctors/pending",
    authentication,
    authorization([roleenum.admin]),
    AS.getPendingDoctors
);


adminrouter.patch(
    "/doctors/:id/approve",
    authentication,
    authorization([roleenum.admin]),
    validation(authenticationV.approveDoctorSchema),
    AS.approveDoctor
);

adminrouter.patch(
    "/doctors/:id/reject",
    authentication,
    authorization([roleenum.admin]),
    validation(authenticationV.rejectDoctorSchema),
    AS.rejectDoctor
);

adminrouter.get(
    "/doctors",
    authentication,
    authorization([roleenum.admin]),
    AS.getAllDoctors
);


export default adminrouter