import { Router } from "express";
import * as CS from "./clinic.service.js";
import * as CV from "./clinic.validation.js";
import { authentication } from "../../common/middleware/authenticataiaon.js";
import { authorization } from "../../common/middleware/authorization.js";
import { roleenum } from "../../common/enum/user.enum.js";
import { spoofAssistantToDoctor, requirePermission, auditLogger } from "../../common/middleware/assistant.middleware.js";
import { validation } from "../../common/middleware/validation.js";
import { requireClinicSlot } from "../../common/middleware/subscriptionGuard.js";

const clinicrouter = Router();

// POST /clinics
clinicrouter.post(
    "/",
    authentication,
    requirePermission("canManageClinics"),
    authorization([roleenum.doctor]),
    requireClinicSlot(),
    validation(CV.addClinicSchema),
    auditLogger("ADD_CLINIC"),
    CS.addClinic
);

// GET /clinics
clinicrouter.get(
    "/",
    authentication,
    spoofAssistantToDoctor,
    authorization([roleenum.doctor]),
    CS.getMyClinics
);

// PATCH /clinics/:clinicId
clinicrouter.patch(
    "/:clinicId",
    authentication,
    requirePermission("canManageClinics"),
    authorization([roleenum.doctor]),
    validation(CV.updateClinicSchema),
    auditLogger("UPDATE_CLINIC"),
    CS.updateClinic
);

// DELETE /clinics/:clinicId
clinicrouter.delete(
    "/:clinicId",
    authentication,
    requirePermission("canManageClinics"),
    authorization([roleenum.doctor]),
    validation(CV.clinicIdSchema),
    auditLogger("DELETE_CLINIC"),
    CS.deleteClinic
);

// ⚠️ لازم يجي قبل /:clinicId عشان مايتطابقش غلط
clinicrouter.get(
    "/doctor/:doctorId",
    authentication,
    authorization([roleenum.patient, roleenum.doctor]),
    validation(CV.doctorIdSchema),
    CS.getDoctorClinics
);

// // GET /clinics/doctor/:doctorId — patient views doctor clinics
// clinicrouter.get(
//     "/doctor/:doctorId",
//     authentication,
//     authorization([roleenum.patient, roleenum.doctor]),
//     validation(CV.doctorIdSchema),
//     CS.getDoctorClinics
// );

// ─── Service Routes ───────────────────────────────────────────────────────────

clinicrouter.post(
    "/:clinicId/services",
    authentication,
    requirePermission("canManageClinics"),
    authorization([roleenum.doctor]),
    validation(CV.addServiceSchema),
    auditLogger("ADD_CLINIC_SERVICE"),
    CS.addService
);

clinicrouter.patch(
    "/:clinicId/services/:serviceId",
    authentication,
    requirePermission("canManageClinics"),
    authorization([roleenum.doctor]),
    validation(CV.updateServiceSchema),
    auditLogger("UPDATE_CLINIC_SERVICE"),
    CS.updateService
);

clinicrouter.delete(
    "/:clinicId/services/:serviceId",
    authentication,
    requirePermission("canManageClinics"),
    authorization([roleenum.doctor]),
    validation(CV.serviceIdSchema),
    auditLogger("DELETE_CLINIC_SERVICE"),
    CS.deleteService
);


export default clinicrouter;