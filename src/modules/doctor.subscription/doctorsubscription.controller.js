import { Router } from "express";
import * as DSS from "./doctorsubscription.service.js";
import * as DSV from "./docorsubscription.validation.js";
import { authentication } from "../../common/middleware/authenticataiaon.js";
import { roleenum } from "../../common/enum/user.enum.js";
import { validation } from "../../common/middleware/validation.js";
import { authorization } from "../../common/middleware/authorization.js";

const doctorSubscriptionRouter =Router();
//done
doctorSubscriptionRouter.get(
    "/my-subscription",
    authentication,
    authorization([roleenum.doctor ]),
    DSS.getMySubscription 
);
//done
doctorSubscriptionRouter.get(

    "/",

    authentication,

    authorization([

        roleenum.admin

    ]),

    DSS.getAllDoctorSubscriptions

);
//done
doctorSubscriptionRouter.get(

    "/doctor/:doctorId",

    authentication,

    authorization([

        roleenum.admin

    ]),

    validation(

        DSV.getDoctorSubscriptionByDoctorSchema

    ),

    DSS.getDoctorSubscriptionByDoctor

);
//done
doctorSubscriptionRouter.patch(

    "/:subscriptionId/cancel",

    authentication,

    authorization([

        roleenum.admin

    ]),

    validation(

        DSV.cancelSubscriptionSchema

    ),

    DSS.cancelSubscription

);
doctorSubscriptionRouter.post(

    "/:subscriptionId/renew",

    authentication,

    authorization([

        roleenum.doctor

    ]),

    validation(

        DSV.renewSubscriptionSchema

    ),

    DSS.renewSubscription

);
//done
doctorSubscriptionRouter.get(

    "/:subscriptionId",

    authentication,

    authorization([

        roleenum.admin

    ]),

    validation(

        DSV.getDoctorSubscriptionSchema

    ),

    DSS.getDoctorSubscriptionById

);
export default doctorSubscriptionRouter