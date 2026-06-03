import usermodel from "../../DB/models/usermodel.js";
import { successresponse } from "../../common/utilits/responce.success.js";
import { roleenum } from "../../common/enum/user.enum.js";
import * as db_service from "../../DB/db.service.js";
import { options } from "joi";




export const getPendingDoctors = async (req, res, next) => {


    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;


    const pendingDoctors = await db_service.find({
        model: usermodel,
        filter: { 
            role: roleenum.doctor,
            status: "pending"
        }, 
        options: {
            skip,
            limit,
            select: "-password",
            sort: { createdAt: 1 }
        }
    });
    return successresponse({ res, data: pendingDoctors });
};