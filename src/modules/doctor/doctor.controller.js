import { Router } from "express";
import * as DS from "./doctor.service.js";
import * as DV from "./doctor.validation.js";
import { authentication } from "../../common/middleware/authenticataiaon.js";
import { authorization } from "../../common/middleware/authorization.js";
import { roleenum } from "../../common/enum/user.enum.js";
import { validation } from "../../common/middleware/validation.js";

const doctorrouter = Router();

// add update doctor profile api
doctorrouter.patch(
    "/profile",
    authentication,              
    authorization([roleenum.doctor]),
    validation(DV.updatedoctorprofileschema),
    DS.updatedoctorprofile
);

export default doctorrouter;
