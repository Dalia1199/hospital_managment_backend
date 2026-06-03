import { Router } from "express";
import * as PS from "../prescrption/prescription.service.js"
import * as PV from "../prescrption/prescription.validation.js"

import { validation } from "../../common/middleware/validation.js";
import { authentication } from "../../common/middleware/authenticataiaon.js";
import { multer_host } from "../../common/middleware/multer.js";
import { multerenum } from "../../common/enum/multerenum.js";



//api

prescrptionrouter.delete('/:id',authentication,authorization([roleenum.doctor, roleenum.doctor]),PS.deleteprescrption)

export default prescrptionrouter