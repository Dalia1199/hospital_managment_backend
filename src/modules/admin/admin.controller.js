import { Router } from "express";
import *as AS from "../admin/admin.service.js"
import * as authenticationV from "../admin/admin.validation.js"

import { validation } from "../../common/middleware/validation.js";
import { authentication } from "../../common/middleware/authenticataiaon.js";
import { authorization } from "../../common/middleware/authorization.js";
const adminrouter = Router()

//routes

export default adminrouter