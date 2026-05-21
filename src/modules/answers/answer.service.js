import answermodel from "../../DB/models/answermodel.js";
import * as db_service from "../../DB/db.service.js";
import { successresponse } from "../../common/utilits/responce.success.js";
import { roleenum } from "../../common/enum/user.enum.js";

export const submitAnswers = async (req, res, next) => {

    const { answers, patientId } = req.body;

    let targetPatientId;

    if (req.user.role === roleenum.patient) {
        targetPatientId = req.user._id;
    } else {
        targetPatientId = patientId;
    }

    const docs = answers.map((item) => ({
        patientId: targetPatientId,
        questionId: item.questionId,
        answer: item.answer
    }));

    await answermodel.insertMany(docs);

    successresponse({
        res,
        message: "answers submitted"
    });
};


export const getPatientAnswers = async (req, res, next) => {

    const { patientId } = req.params;

    if (
        req.user.role === roleenum.patient &&
        req.user._id.toString() !== patientId
    ) {
        throw new Error("not authorized", { cause: 403 });
    }

    const answers = await db_service.find({
        model: answermodel,
        filter: { patientId },
        options: {
            populate: [
                {
                    path: "questionId"
                }
            ]
        }
    });

    successresponse({
        res,
        data: answers
    });
};