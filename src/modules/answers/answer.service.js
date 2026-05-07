import AnswerModel from "../../db/models/answer.model.js"
import * as db_service from "../../db/service/db.service.js"
import { successresponse } from "../../common/utilis/success.response.js"

export const createanswers = async (req, res, next) => {

    const { specialization, answers } = req.body

    const data = await db_service.create({
        model: AnswerModel,
        data: {
            userId: req.user._id,
            specialization,
            answers
        }
    })

    return successresponse({
        res,
        message: "answers saved",
        data
    })
}