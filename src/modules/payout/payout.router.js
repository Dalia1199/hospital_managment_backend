import { Router } from "express";
import * as PS from "./payout.service.js";
import * as PV from "./payout.validation.js";
import { validation } from "../../common/middleware/validation.js";
import { authentication } from "../../common/middleware/authenticataiaon.js";
import { authorization } from "../../common/middleware/authorization.js";
import { roleenum } from "../../common/enum/user.enum.js";

const payoutRouter = Router();

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

// Admin fetches all payout requests
payoutRouter.get(
    "/all",
    authentication,
    authorization([roleenum.admin]),
    PS.getAllPayoutRequests
);

// Admin updates payout request status
payoutRouter.patch(
    "/:requestId/status",
    authentication,
    authorization([roleenum.admin]),
    validation(PV.updatePayoutStatusSchema),
    PS.updatePayoutStatus
);

export default payoutRouter;
