
import prescrptionmodel from "../../DB/models/prescriptionmodel.js";
import cloudinary from "../../common/utilits/cloudinary.js";
import * as db_service from "../../DB/db.service.js";
import { successresponse } from "../../common/utilits/responce.success.js"

export const deleteprescrption = async (req, res, next) => {
    const { user } = req; 

   
    const prescription = await prescrptionmodel.findById(req.params.id);

    if (!prescription) {
        return new Error('No prescription found with that ID');
    }

  
    if (user.role === "doctor" && prescription.doctorid.toString() !== user._id.toString()) {
        return new Error("you are not allowed to delete this prescription");
    }

   
    await prescrptionmodel.findByIdAndUpdate(req.params.id, { status: "cancelled" }, { new: true });

    successresponse({ res, message: "prescription deleted successfully" });
};

