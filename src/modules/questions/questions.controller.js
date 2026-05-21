import { Router } from "express"
import { validation } from "../../common/middleware/validation.js"
import * as QS from "./questions.service.js"
import * as QV from "./questions.validation.js"
 const questionrouter=Router()
questionrouter.get(
    "/",
    validation(QV.getquestionsschema),
    QS.getquestions
)




export default questionrouter