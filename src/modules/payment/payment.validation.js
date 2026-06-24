import Joi from "joi";
import { generalrules } from "../../common/utilits/generalrules.js";



export const createCheckoutSchema = {

    params: Joi.object({

        appointmentId:
            generalrules.id.required()

    }).required()

};