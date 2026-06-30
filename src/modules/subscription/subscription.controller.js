import { Router } from "express";
import * as SS from "./subscription.service.js";
import * as SV from "./subscription.validation.js";
import { authentication } from "../../common/middleware/authenticataiaon.js";
import { roleenum } from "../../common/enum/user.enum.js";
import { validation } from "../../common/middleware/validation.js";
import { authorization } from "../../common/middleware/authorization.js";



//tested
const subscriptionRouter =
    Router();

// =========================
// CREATE PLAN
// =========================

subscriptionRouter.post(

    "/create",

    authentication,

    authorization([

        roleenum.admin

    ]),

    validation(

        SV.createPlanSchema

    ),

    SS.createPlan

);

// =========================
// GET ALL PLANS
// =========================

subscriptionRouter.get(

    "/",
    authentication,

    authorization([roleenum.doctor,roleenum.admin ]),
    SS.getPlans

);

// =========================
// GET PLAN BY ID
// =========================

subscriptionRouter.get(

    "/:planId",
    authentication,
    authorization([roleenum.doctor, roleenum.admin]),

    validation(

        SV.getPlanSchema

    ),

    SS.getPlanById

);

// =========================
// UPDATE PLAN
// =========================

subscriptionRouter.patch(

    "/:planId",

    authentication,

    authorization([

        roleenum.admin

    ]),

    validation(

        SV.updatePlanSchema

    ),

    SS.updatePlan

);

// =========================
// DELETE PLAN
// =========================

subscriptionRouter.delete(

    "/:planId",

    authentication,

    authorization([

        roleenum.admin

    ]),

    validation(

        SV.deletePlanSchema

    ),

    SS.deletePlan

);

export default subscriptionRouter;