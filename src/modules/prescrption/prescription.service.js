
import prescrptionmodel from "../../DB/models/prescriptionmodel.js";
import cloudinary from "../../common/utilits/cloudinary.js";
import * as db_service from "../../DB/db.service.js";
import { successresponse } from "../../common/utilits/responce.success.js"

import { catchAsync } from "../../common/utilits/catchAsync.js";
import AppError from "../../common/utilits/appError.js";





export const deleteprescrption = catchAsync(async (req, res,next) => {
const prescription = await prescrptionmodel.findByIdAndUpdate(req.params.id,{status:"cancelled",},{new:true})
if (!prescription) {
    return next(new AppError('No prescription found with that ID', 404));
  }
successresponse({ res, message: "prescription deleted successfully" })


}
)
