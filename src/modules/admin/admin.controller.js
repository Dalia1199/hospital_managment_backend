import { Router } from "express";
import * as AS from "./admin.service.js";
import * as AV from "./admin.validation.js";
import { authentication } from "../../common/middleware/authenticataiaon.js";
import { authorization } from "../../common/middleware/authorization.js";
import { roleenum } from "../../common/enum/user.enum.js";
import { validation } from "../../common/middleware/validation.js";

const adminrouter = Router();

// Routes
adminrouter.get(
    "/users",
    authentication,
    authorization([roleenum.admin]),
    validation(AV.getusersschema),
    AS.getallusers
);

export default adminrouter;
