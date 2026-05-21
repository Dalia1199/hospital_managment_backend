import { Router } from "express";
import * as MS from "./medicalhistory.service.js";
import * as MV from "./medicalhistory.validation.js";
import { authentication } from "../../common/middleware/authenticataiaon.js";
import { authorization } from "../../common/middleware/authorization.js";
import { validation } from "../../common/middleware/validation.js";
import { roleenum } from "../../common/enum/user.enum.js";
import { multer_host } from "../../common/middleware/multer.js";
import { multerenum } from "../../common/enum/multerenum.js";

const medicalrouter = Router();

medicalrouter.post(
    "/",
    authentication,
    authorization([roleenum.doctor]),//doctor orpatient
    validation(MV.createMedicalHistorySchema),
    MS.createMedicalHistory
);

medicalrouter.get(
    "/:patientId",
    authentication,
    authorization([roleenum.doctor, roleenum.patient]),
    validation(MV.getMedicalHistorySchema),
    MS.getMedicalHistory
);

medicalrouter.patch(
    "/upload/:historyId",
    authentication,
    authorization([roleenum.doctor, roleenum.patient]),
    multer_host(multerenum.image).array("files"),
    MS.uploadDocument
);
medicalrouter.delete(
    "/document/:historyId",
    authentication,
    authorization([roleenum.doctor, roleenum.patient]),
    validation(MV.deleteDocumentSchema),
    MS.deleteMedicalHistory
);

export default medicalrouter;