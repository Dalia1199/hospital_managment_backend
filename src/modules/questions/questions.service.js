import * as db_service from "../../DB/db.service.js"
import questionmodel from "../../DB/models/questionmodel.js"
import { successresponse } from "../../common/utilits/responce.success.js"

export const getquestions = async (req, res, next) => {

    const { specialization } = req.query

    let filter = {}

    if (specialization) {
        filter = {
            $or: [
                { type: "general" },
                { specialization }
            ]
        }
    } else {
        filter = { type: "general" }
    }

    const questions = await db_service.find({
        model: questionmodel,
        filter
    })

    return successresponse({
        res,
        data: { questions }
    })
}