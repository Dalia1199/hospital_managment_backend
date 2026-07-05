import { Router } from "express";
import * as DS from "./doctor.service.js";
import * as SS from "./staff.service.js";
import * as DV from "./doctor.validation.js";
import { authentication } from "../../common/middleware/authenticataiaon.js";
import { authorization } from "../../common/middleware/authorization.js";
import { requirePermission, auditLogger, spoofAssistantToDoctor } from "../../common/middleware/assistant.middleware.js";
import { roleenum } from "../../common/enum/user.enum.js";
import { multer_host } from "../../common/middleware/multer.js";
import { multerenum } from "../../common/enum/multerenum.js";
import { validation } from "../../common/middleware/validation.js";

const doctorrouter = Router();

// Staff Management Routes
doctorrouter.post("/staff", authentication, authorization([roleenum.doctor]), SS.createStaff);
doctorrouter.get("/staff", authentication, authorization([roleenum.doctor]), SS.getStaff);
doctorrouter.put("/staff/:id", authentication, authorization([roleenum.doctor]), SS.updateStaff);
doctorrouter.delete("/staff/:id", authentication, authorization([roleenum.doctor]), SS.deleteStaff);
doctorrouter.get("/staff/logs", authentication, authorization([roleenum.doctor]), SS.getLogs);

// GET /doctor/all — accessible by patient + doctor + admin
doctorrouter.get(
    "/all",
    authentication,
    authorization([roleenum.patient, roleenum.doctor, roleenum.admin]),
    DS.getAllDoctors
);

// GET /doctor/global — accessible by anyone
doctorrouter.get(
    "/global",
    DS.getAllDoctors
);

// GET /doctor/dashboard
doctorrouter.get(
    "/dashboard",
    authentication,
    spoofAssistantToDoctor,
    authorization([roleenum.doctor]),
    DS.getDashboard
);

// GET /doctor/profile — fetch full profile data
// GET /doctor/reports/analytics
doctorrouter.get(
    "/reports/analytics",
    authentication,
    requirePermission("canManageReports"),
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
    requirePermission(["canManageAppointments", "canManagePatientsVitals", "canManagePatientsFull", "canManagePatients"]),
    authorization([roleenum.doctor]),
    validation(DV.searchPatientSchema),
    DS.searchPatient
);

// create session
doctorrouter.post(
    "/session/request",
    authentication,
    requirePermission("canManageAppointments"),
    authorization([roleenum.doctor]),
    validation(DV.createSessionSchema),
    auditLogger("CREATE_SESSION"),
    DS.createSession
);
// verify session 
doctorrouter.post(
    "/session/verify",
    authentication,
    requirePermission("canManageAppointments"),
    authorization([roleenum.doctor]),
    validation(DV.verifySessionSchema),
    auditLogger("VERIFY_SESSION"),
    DS.verifySession
);

// get active sessions
doctorrouter.get(
    "/session",
    authentication,
    requirePermission(["canManageAppointments", "canManageBilling", "canManagePatientsVitals", "canManagePatientsFull", "canManagePatients"]),
    authorization([roleenum.doctor]),
    DS.getActiveSessions
);

// reorder sessions
doctorrouter.patch(
    "/session/reorder",
    authentication,
    requirePermission(["canManageAppointments", "canManagePatientsVitals", "canManagePatientsFull", "canManagePatients"]),
    authorization([roleenum.doctor]),
    validation(DV.reorderSessionSchema),
    auditLogger("REORDER_SESSION_QUEUE"),
    DS.reorderSessions
);

// update session vitals
doctorrouter.patch(
    "/session/:sessionId/vitals",
    authentication,
    requirePermission(["canManagePatientsVitals", "canManagePatientsFull", "canManagePatients"]),
    authorization([roleenum.doctor]),
    validation(DV.updateSessionVitalsSchema),
    auditLogger("UPDATE_SESSION_VITALS"),
    DS.updateSessionVitals
);

// update session fees
doctorrouter.patch(
    "/session/:sessionId/fees",
    authentication,
    requirePermission(["canManageAppointments", "canManageBilling"]),
    authorization([roleenum.doctor]),
    validation(DV.updateSessionFeesSchema),
    auditLogger("UPDATE_SESSION_FEES"),
    DS.updateSessionFees
);

// get medication history
doctorrouter.get(
    "/medications/history",
    authentication,
    requirePermission(["canManagePatientsFull", "canManagePatients"]),
    authorization([roleenum.doctor]),
    DS.getMedicationHistory
);

// get full medical history
doctorrouter.get(
    "/patient/history",
    authentication,
    requirePermission(["canManagePatientsFull", "canManagePatients"]),
    authorization([roleenum.doctor]),
    DS.getPatientMedicalHistory
);

// update patient alerts
doctorrouter.patch(
    "/patient/:patientId/alerts",
    authentication,
    requirePermission(["canManagePatientsFull", "canManagePatients"]),
    authorization([roleenum.doctor]),
    validation(DV.updatePatientAlertsSchema),
    auditLogger("UPDATE_PATIENT_ALERTS"),
    DS.updatePatientAlerts
);

// get patient medication compliance report
doctorrouter.get(
    "/patient/:patientId/compliance",
    authentication,
    requirePermission(["canManagePatientsVitals", "canManagePatientsFull", "canManagePatients"]),
    authorization([roleenum.doctor]),
    DS.getPatientCompliance
);

// end session
doctorrouter.patch(
    "/session/:sessionId/end",
    authentication,
    requirePermission(["canManagePatientsFull", "canManagePatients"]),
    authorization([roleenum.doctor]),
    multer_host([...multerenum.image, ...multerenum.pdf]).fields([
        { name: "prescriptionImage", maxCount: 1 },
        { name: "attachments", maxCount: 10 }
    ]),
    validation(DV.endSessionSchema),
    auditLogger("END_SESSION_AND_ASSESS"),
    DS.endSession
);

// cancel session
doctorrouter.delete(
    "/session/:sessionId/cancel",
    authentication,
    requirePermission(["canManageAppointments", "canManagePatientsFull", "canManagePatients"]),
    authorization([roleenum.doctor]),
    validation(DV.cancelSessionSchema),
    auditLogger("CANCEL_SESSION"),
    DS.cancelSession
);

// get my patients
doctorrouter.get(
    "/my-patients",
    authentication,
    requirePermission(["canManagePatientsVitals", "canManagePatientsFull", "canManagePatients"]),
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
    spoofAssistantToDoctor,
    authorization([roleenum.doctor]),
    DS.getAllNotifications
);

// ─── Profile Image Routes ─────────────────────────────────────
doctorrouter.patch(
    "/profile-image",
    authentication,
    authorization([roleenum.doctor]),
    multer_host(multerenum.image).single("profilepicture"),
    DS.uploadDoctorProfileImage
);
 
doctorrouter.delete(
    "/profile-image",
    authentication,
    authorization([roleenum.doctor]),
    DS.deleteDoctorProfileImage
);

export default doctorrouter;