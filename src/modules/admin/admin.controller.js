import { Router } from "express";
import * as AS from "./admin.service.js";
import { authentication } from "../../common/middleware/authenticataiaon.js";
import { authorization } from "../../common/middleware/authorization.js";
import { roleenum } from "../../common/enum/user.enum.js";
import { validation } from "../../common/middleware/validation.js";

import * as AV from "./admin.validation.js";
const adminrouter = Router()

//routes


adminrouter.patch(
    "/doctors/:id/approve",
    authentication,
    authorization([roleenum.admin]),
    validation(AV.approveDoctorSchema),
    AS.approveDoctor
);

adminrouter.patch(
    "/doctors/:id/reject",
    authentication,
    authorization([roleenum.admin]),
    validation(AV.rejectDoctorSchema),
    AS.rejectDoctor
);

adminrouter.get(
    "/doctors",
    authentication,
    authorization([roleenum.admin]),
    AS.getAllDoctors
);


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

// ─── Admin Profile Routes ─────────────────────────────────────────────────────
adminrouter.get(
    "/profile",
    authentication,
    authorization([roleenum.admin]),
    AS.getAdminProfile
);

adminrouter.patch(
    "/profile",
    authentication,
    authorization([roleenum.admin]),
    validation(AV.updateAdminProfileSchema),
    AS.updateAdminProfile
);

adminrouter.patch(
    "/doctor/:id/approve-license",
    authentication,
    authorization([roleenum.admin]),
    validation(AV.approveLicenseSchema),
    AS.approveDoctorLicense
)

adminrouter.patch(
    "/doctor/:id/reject-license",
    authentication,
    authorization([roleenum.admin]),
    validation(AV.rejectLicenseSchema),
    AS.rejectDoctorLicense
)


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


adminrouter.get(
    "/doctors/pending",
    authentication,
    authorization([roleenum.admin]),
    AS.getPendingDoctors
);

adminrouter.patch(
    "/doctors/:id/pending",
    authentication,
    authorization([roleenum.admin]),
    AS.resetToPending
);

adminrouter.get(
    "/stats/monthly",
    authentication,
    authorization([roleenum.admin]),
    AS.getMonthlyStats
);

adminrouter.get(
    "/stats/daily",
    authentication,
    authorization([roleenum.admin]),
    AS.getDailyStats
);

adminrouter.get(
    "/stats/analytics",
    authentication,
    authorization([roleenum.admin]),
    AS.getAnalyticsStats
);

export default adminrouter;
