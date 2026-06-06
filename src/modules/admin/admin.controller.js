import { Router } from "express";
import * as AS from "./admin.service.js";
import { authentication } from "../../common/middleware/authenticataiaon.js";
import { authorization } from "../../common/middleware/authorization.js";
import { roleenum } from "../../common/enum/user.enum.js";
import { validation } from "../../common/middleware/validation.js";

import * as AV from "./admin.validation.js";
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
    validation(AV.reject or approveDoctorSchema),
    AS.approveDoctor
);

adminrouter.patch(
    "/doctors/:id/reject",
    authentication,
    authorization([roleenum.admin]),
    validation(AV.reject or approveDoctorSchema),
    AS.rejectDoctor
);
export default adminrouter



// GET /admin/dashboard
// Accessible by: admin only
adminrouter.get(
    "/dashboard",
    authentication,
    authorization([roleenum.admin]),
    AS.getDashboard
);



// Routes
adminrouter.get(
    "/users",
    authentication,
    authorization([roleenum.admin]),
    validation(AV.getusersschema),
    AS.getallusers
);


adminrouter.patch(
    "/:id/activate",
    authentication,
    authorization([roleenum.admin]),
    validation(AV.activateAndDeactivateSchema),
    AS.activateUser
);
adminrouter.patch(
    "/:id/deactivate",
    authentication,
    authorization([roleenum.admin]),
    validation(AV.activateAndDeactivateSchema),
    AS.deactivateUser
);

export default adminrouter;
