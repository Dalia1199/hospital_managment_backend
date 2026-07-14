import { Router } from "express";

import * as DDS from "./doctordashboard.service.js";
import { authentication } from "../../common/middleware/authenticataiaon.js";
import { roleenum } from "../../common/enum/user.enum.js";
import { validation } from "../../common/middleware/validation.js";
import { authorization } from "../../common/middleware/authorization.js";

const doctorDashboardRouter = Router();
doctorDashboardRouter.get(

    "/",

    authentication,

    authorization([

        roleenum.doctor

    ]),

    DDS.getDashboard

);

export default doctorDashboardRouter;