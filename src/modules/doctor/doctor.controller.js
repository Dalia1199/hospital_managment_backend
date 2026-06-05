import { Router } from "express";
import * as DS from "./doctor.service.js";
import * as DV from "./doctor.validation.js";
import { authentication } from "../../common/middleware/authenticataiaon.js";
import { authorization } from "../../common/middleware/authorization.js";
import { roleenum } from "../../common/enum/user.enum.js";
import { multer_host } from "../../common/middleware/multer.js";
import { multerenum } from "../../common/enum/multerenum.js";
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
// Routes
doctorrouter.patch(
    "/license",
    authentication,
    authorization([roleenum.doctor]),
    multer_host([...multerenum.image, ...multerenum.pdf]).single("license"),
    validation(DV.updateDoctorLicense),
    DS.uploadLicense
);

export default doctorrouter;
