import { Router } from "express";
import * as DS from "./doctor.service.js";
import * as DV from "./doctor.validation.js";
import { authentication } from "../../common/middleware/authenticataiaon.js";
import { authorization } from "../../common/middleware/authorization.js";
import { roleenum } from "../../common/enum/user.enum.js";
import { multer_host } from "../../common/middleware/multer.js";
import { multerenum } from "../../common/enum/multerenum.js";
import { validation } from "../../common/middleware/validation.js";

const doctorrouter = Router();

// GET /doctor/all — accessible by patient + doctor + admin
doctorrouter.get(
    "/all",
    authentication,
    authorization([roleenum.patient, roleenum.doctor, roleenum.admin]),
    DS.getAllDoctors
);
// GET /doctor/dashboard
doctorrouter.get(
    "/dashboard",
    authentication,
    authorization([roleenum.doctor]),
    DS.getDashboard
);

// GET /doctor/profile — fetch full profile data
// GET /doctor/reports/analytics
doctorrouter.get(
    "/reports/analytics",
    authentication,
    authorization([roleenum.doctor]),
    DS.getReportsAnalytics
);


// DELETE /doctor/license/pending — cancel pending license
doctorrouter.delete(
    "/license/pending",
    authentication,
    authorization([roleenum.doctor]),
    DS.cancelPendingLicense
);
// GET /doctor/profile - fetch full profile data
doctorrouter.get(
    "/profile",
    authentication,
    authorization([roleenum.doctor]),
    DS.getDoctorProfile
);

// add update doctor profile api
doctorrouter.patch(
    "/profile",
    authentication,
    authorization([roleenum.doctor]),
    validation(DV.updatedoctorprofileschema),
    DS.updatedoctorprofile
);
// Routes
doctorrouter.patch(
    "/license",
    authentication,
    authorization([roleenum.doctor]),
    multer_host([...multerenum.image, ...multerenum.pdf]).single("license"),
    validation(DV.updateDoctorLicense),
    DS.uploadLicense
);

// search
doctorrouter.get(
    "/search-patient",
    authentication,
    authorization([roleenum.doctor]),
    validation(DV.searchPatientSchema),
    DS.searchPatient
);

// create session
doctorrouter.post(
    "/session/request",
    authentication,
    authorization([roleenum.doctor]),
    validation(DV.createSessionSchema),
    DS.createSession
);
// verify session 
doctorrouter.post(
    "/session/verify",
    authentication,
    authorization([roleenum.doctor]),
    validation(DV.verifySessionSchema),
    DS.verifySession
);

// get active sessions
doctorrouter.get(
    "/session",
    authentication,
    authorization([roleenum.doctor]),
    DS.getActiveSessions
);

// get medication history
doctorrouter.get(
    "/medications/history",
    authentication,
    authorization([roleenum.doctor]),
    DS.getMedicationHistory
);

// get full medical history
doctorrouter.get(
    "/patient/history",
    authentication,
    authorization([roleenum.doctor]),
    DS.getPatientMedicalHistory
);

// update patient alerts
doctorrouter.patch(
    "/patient/:patientId/alerts",
    authentication,
    authorization([roleenum.doctor]),
    validation(DV.updatePatientAlertsSchema),
    DS.updatePatientAlerts
);

// get patient medication compliance report
doctorrouter.get(
    "/patient/:patientId/compliance",
    authentication,
    authorization([roleenum.doctor]),
    DS.getPatientCompliance
);

// end session
doctorrouter.patch(
    "/session/:sessionId/end",
    authentication,
    authorization([roleenum.doctor]),
    multer_host([...multerenum.image, ...multerenum.pdf]).fields([
        { name: "prescriptionImage", maxCount: 1 },
        { name: "attachments", maxCount: 10 }
    ]),
    validation(DV.endSessionSchema),
    DS.endSession
);

// cancel session
doctorrouter.delete(
    "/session/:sessionId/cancel",
    authentication,
    authorization([roleenum.doctor]),
    validation(DV.cancelSessionSchema),
    DS.cancelSession
);

// get my patients
doctorrouter.get(
    "/my-patients",
    authentication,
    authorization([roleenum.doctor]),
    validation(DV.getMyPatientsSchema),
    DS.getMyPatients
);

// get my prescriptions
doctorrouter.get(
    "/my-prescriptions",
    authentication,
    authorization([roleenum.doctor]),
    validation(DV.getMyPrescriptionsSchema),
    DS.getMyPrescriptions
);

// add a certificate
doctorrouter.post(
    "/profile/certificates",
    authentication,
    authorization([roleenum.doctor]),
    multer_host([...multerenum.image, ...multerenum.pdf]).single("certificate"),
    validation(DV.addCertificateSchema),
    DS.addCertificate
);
doctorrouter.patch(
    "/profile/certificates/:certificateId",
    authentication,
    authorization([roleenum.doctor]),
    multer_host([...multerenum.image, ...multerenum.pdf]).single("certificate"),
    validation(DV.updateCertificateSchema),
    DS.updateCertificate
);

doctorrouter.delete(
    "/profile/certificates/:certificateId",
    authentication,
    authorization([roleenum.doctor]),
    validation(DV.deleteCertificateSchema),
    DS.deleteCertificate
);

doctorrouter.get(
    "/profile/certificates",
    authentication,
    authorization([roleenum.doctor]),
    DS.getCertificates
);

doctorrouter.get(
    "/notifications",
    authentication,
    authorization([roleenum.doctor]),
    DS.getAllNotifications
);

export default doctorrouter;