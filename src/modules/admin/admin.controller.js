import { Router } from "express";
import *as AS from "../admin/admin.service.js"
import * as authenticationV from "../admin/admin.validation.js"

import { validation } from "../../common/middleware/validation.js";
import { authentication } from "../../common/middleware/authenticataiaon.js";
import { authorization } from "../../common/middleware/authorization.js";
import { roleenum } from "../../common/enum/user.enum.js";
const adminrouter = Router()

//routes
adminrouter.get(
    "/doctors/pending",
    authentication,
    authorization([roleenum.admin]),
    AS.getPendingDoctors
);

export default adminrouter