import { Router } from "express";
import *as AS from "../admin/admin.service.js"
import * as AV from "../admin/admin.validation.js"

import { validation } from "../../common/middleware/validation.js";
import { authentication } from "../../common/middleware/authenticataiaon.js";
import { authorization } from "../../common/middleware/authorization.js";
import { roleenum } from "../../common/enum/user.enum.js";

const adminrouter = Router()

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

export default adminrouter