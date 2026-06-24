import { Router } from "express";
import * as PS from "./payment.service.js";
import * as PV from "./payment.validation.js";
import { validation } from "../../common/middleware/validation.js";
import { authentication } from "../../common/middleware/authenticataiaon.js";
import { authorization } from "../../common/middleware/authorization.js";

import { roleenum } from "../../common/enum/user.enum.js";

const paymentRouter = Router();

paymentRouter.post(
    "/checkout",
    authentication,
    authorization([roleenum.doctor,roleenum.patient]),
    PS.createCheckout
);

paymentRouter.get(
    "/callback",

    PS.paymentCallback
);

paymentRouter.post(
    "/webhook",

    PS.paymentWebhook
);

export default paymentRouter;