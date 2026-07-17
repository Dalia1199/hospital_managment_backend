import { Router } from "express";
import * as PS from "./payout.service.js";
import * as PV from "./payout.validation.js";
import { validation } from "../../common/middleware/validation.js";
import { authentication } from "../../common/middleware/authenticataiaon.js";
import { authorization } from "../../common/middleware/authorization.js";
import { roleenum } from "../../common/enum/user.enum.js";
import { multer_host } from "../../common/middleware/multer.js";
import { multerenum } from "../../common/enum/multerenum.js";

const payoutRouter = Router();

// ---------------- PROFILE SETUP & MANAGEMENT ----------------

// Get my payout profile
payoutRouter.get(
    "/profile",
    authentication,
    PS.getMyPayoutProfile
);

// Setup payout profile (First time)
payoutRouter.post(
    "/profile/setup",
    authentication,
    multer_host(multerenum.image).single('idPhoto'),
    validation(PV.setupPayoutProfileSchema),
    PS.setupPayoutProfile
);

// Request a change to an existing payout profile
payoutRouter.post(
    "/request-change",
    authentication,
    authorization([roleenum.doctor, roleenum.patient]),
    multer_host(multerenum.image).single('idPhoto'),
    validation(PV.requestPayoutChangeSchema),
    PS.requestPayoutChange
);

// Get approved payout methods
payoutRouter.get(
    "/my-methods",
    authentication,
    authorization([roleenum.doctor, roleenum.patient]),
    PS.getMyPayoutMethods
);


// ---------------- PAYOUT REQUESTS ----------------

// User/Doctor creates payout request
payoutRouter.post(
    "/request",
    authentication,
    validation(PV.requestPayoutSchema),
    PS.requestPayout
);

// User/Doctor fetches their own payout requests
payoutRouter.get(
    "/my-requests",
    authentication,
    PS.getMyPayouts
);


// ---------------- ADMIN ENDPOINTS ----------------

// Admin fetches all payout requests
payoutRouter.get(
    "/all",
    authentication,
    authorization([roleenum.admin]),
    PS.getAllPayoutRequests
);

// Admin gets count of pending payout requests
payoutRouter.get(
    "/admin/pending-count",
    authentication,
    authorization([roleenum.admin]),
    PS.getPendingPayoutsCount
);

// Admin updates payout request status
payoutRouter.patch(
    "/:requestId/status",
    authentication,
    authorization([roleenum.admin]),
    multer_host(multerenum.image).single('receiptPhoto'),
    validation(PV.updatePayoutStatusSchema),
    PS.updatePayoutStatus
);

// Admin fetches all profile change requests
payoutRouter.get(
    "/admin/change-requests",
    authentication,
    authorization([roleenum.admin]),
    PS.getAllChangeRequests
);

// Admin updates a profile change request status
payoutRouter.patch(
    "/admin/change-requests/:requestId/status",
    authentication,
    authorization([roleenum.admin]),
    validation(PV.updateChangeRequestStatusSchema),
    PS.updateChangeRequestStatus
);

// Admin suspends a user's payout profile
payoutRouter.patch(
    "/admin/suspend-wallet",
    authentication,
    authorization([roleenum.admin]),
    // validation(PV.suspendWalletSchema), // Skipping specific validation for simplicity
    PS.suspendPayoutProfile
);

export default payoutRouter;
