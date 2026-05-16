import { Router } from "express";
import * as AS from "./answer.service.js";
import * as AV from "./answer.validation.js";
import { authentication } from "../../common/middleware/authenticataiaon.js";
import { authorization } from "../../common/middleware/authorization.js";
import { validation } from "../../common/middleware/validation.js";
import { roleenum } from "../../common/enum/user.enum.js";

const answerrouter = Router();

answerrouter.post(
    "/",
    authentication,
    authorization([
        roleenum.patient,
        roleenum.doctor
    ]),
    validation(AV.answersSchema),
    AS.submitAnswers
);

answerrouter.get(
    "/:patientId",
    authentication,
    authorization([
        roleenum.patient,
        roleenum.doctor
    ]),
    validation(AV.getAnswersSchema),
    AS.getPatientAnswers
);

export default answerrouter;