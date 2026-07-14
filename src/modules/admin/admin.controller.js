import { Router } from "express";
import * as AS from "./admin.service.js";
import { authentication } from "../../common/middleware/authenticataiaon.js";
import { authorization } from "../../common/middleware/authorization.js";
import { roleenum } from "../../common/enum/user.enum.js";
import { validation } from "../../common/middleware/validation.js";
import { multer_host } from "../../common/middleware/multer.js";
import { multerenum } from "../../common/enum/multerenum.js";

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

// GET /admin/doctors/pending-licenses — list doctors with a license update
// awaiting review. Must come before "/doctors/:id/..." routes below would
// otherwise still match fine since Express matches static segments first,
// but kept together here for readability.
adminrouter.get(
    "/doctors/pending-licenses",
    authentication,
    authorization([roleenum.admin]),
    AS.getPendingLicenseDoctors
);

adminrouter.patch(
    "/doctors/:id/approve-license",
    authentication,
    authorization([roleenum.admin]),
    validation(AV.approveLicenseSchema),
    AS.approveDoctorLicense
)

adminrouter.patch(
    "/doctors/:id/reject-license",
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
    "/stats/payments",
    authentication,
    authorization([roleenum.admin]),
    AS.getPaymentAnalytics
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

// ─── Profile Image Routes ─────────────────────────────────────
adminrouter.patch(
    "/profile-image",
    authentication,
    authorization([roleenum.admin]),
    multer_host(multerenum.image).single("profilepicture"),
    AS.uploadAdminProfileImage
);
 
adminrouter.delete(
    "/profile-image",
    authentication,
    authorization([roleenum.admin]),
    AS.deleteAdminProfileImage
);

// get top doctors in case of appointments
adminrouter.get(
    "/doctors/appointments-ranking",
    authentication,
    authorization([roleenum.admin]),
    AS.getDoctorsAppointmentsRanking
);

export default adminrouter;
