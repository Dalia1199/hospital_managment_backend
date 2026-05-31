import { Router } from "express";
import * as PS from "../prescrption/prescription.service.js"
import * as PV from "../prescrption/prescription.validation.js"

import { validation } from "../../common/middleware/validation.js";
import { authentication } from "../../common/middleware/authenticataiaon.js";
import { multer_host } from "../../common/middleware/multer.js";
import { multerenum } from "../../common/enum/multerenum.js";

const authcontroller = require("../../common/middleware/authenticataiaon.js")
const prescrptionrouter = express.Router()

//api

prescrptionrouter.route('/:id').delete(authcontroller.protect,authcontroller.restrictTo("doctor","admin"),PS.deleteprescrption)

export default prescrptionrouter