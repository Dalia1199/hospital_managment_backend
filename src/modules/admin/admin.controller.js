import { Router } from "express";
import * as AS from "./admin.service.js";
import { authentication } from "../../common/middleware/authenticataiaon.js";
import { authorization } from "../../common/middleware/authorization.js";
import { roleenum } from "../../common/enum/user.enum.js";

const adminrouter = Router();

// GET /admin/dashboard
// Accessible by: admin only
adminrouter.get(
    "/dashboard",
    authentication,
    authorization([roleenum.admin]),
    AS.getDashboard
);

export default adminrouter;