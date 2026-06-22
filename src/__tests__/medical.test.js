import request from "supertest";
import { jest } from '@jest/globals';

jest.mock('pdf-parse', () => jest.fn());

import { app, server } from "../index.js";
import { hash } from "../common/utilits/security/hash.js";
import User from "../DB/models/usermodel.js";
import Doctor from "../DB/models/doctormodel.js";
import Patient from "../DB/models/patientmodel.js";
import Session from "../DB/models/sessionmodel.js";
import MedicalHistory from "../DB/models/medicalhistorymodel.js";

afterAll(() => {
  if (server) server.close();
});

describe("Medical Records & Sessions Tests", () => {
  const testDoctor = {
    fullName: "Dr. Medical",
    email: "dr_medical@carehub.local",
    password: "Password123!",
    role: "doctor",
    phoneNumber: "01099996666",
    status: "approved",
    confirmed: true
  };

  const testPatient = {
    fullName: "Patient Medical",
    email: "pt_medical@carehub.local",
    password: "Password123!",
    role: "patient",
    phoneNumber: "01011116666",
    confirmed: true
  };

  let doctorJwt = "";
  let patientJwt = "";
  let doctorId = "";
  let patientId = "";

  beforeEach(async () => {
    const hashedPassword = hash({ plain_text: testDoctor.password, saltround: 8 });

    const docUser = await User.create({
      fullName: testDoctor.fullName,
      email: testDoctor.email,
      password: hashedPassword,
      role: testDoctor.role,
      phoneNumber: testDoctor.phoneNumber,
      status: testDoctor.status,
      confirmed: testDoctor.confirmed
    });
    doctorId = docUser._id;

    await Doctor.create({
      userId: docUser._id,
      specialization: "General",
      experience: 10,
      licenseimage: { secure_url: "url", public_id: "id" },
      nationalId: { secure_url: "url", public_id: "id" }
    });

    const ptUser = await User.create({
      fullName: testPatient.fullName,
      email: testPatient.email,
      password: hashedPassword,
      role: testPatient.role,
      phoneNumber: testPatient.phoneNumber,
      confirmed: testPatient.confirmed
    });
    patientId = ptUser._id;

    await Patient.create({
      userId: patientId,
      sharingSetting: "otp",
      age: 30,
      gender: "male",
      bloodType: "O+"
    });

    // Login Doctor
    const docLogin = await request(app)
      .post("/users/signin")
      .send({ email: testDoctor.email, password: testDoctor.password });
    doctorJwt = docLogin.headers["set-cookie"].find(c => c.startsWith("jwt=")).split(";")[0].split("=")[1];

    // Login Patient
    const ptLogin = await request(app)
      .post("/users/signin")
      .send({ email: testPatient.email, password: testPatient.password });
    patientJwt = ptLogin.headers["set-cookie"].find(c => c.startsWith("jwt=")).split(";")[0].split("=")[1];
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Doctor.deleteMany({});
    await Patient.deleteMany({});
    await Session.deleteMany({});
    await MedicalHistory.deleteMany({});
  });

  // Helper: create + verify a session, return sessionId
  async function createAndVerifySession() {
    const reqRes = await request(app)
      .post("/doctor/session/request")
      .set("Authorization", `Bearer ${doctorJwt}`)
      .send({ isOfflinePatient: false, patientId: patientId.toString() });

    const sId = reqRes.body.data.session._id;
    const otp = reqRes.body.data.temp_otp;

    await request(app)
      .post("/doctor/session/verify")
      .set("Authorization", `Bearer ${doctorJwt}`)
      .send({ sessionId: sId, otp });

    return sId;
  }

  // ─── Session Lifecycle ───

  it("should create a session request (OTP) for patient", async () => {
    const res = await request(app)
      .post("/doctor/session/request")
      .set("Authorization", `Bearer ${doctorJwt}`)
      .send({
        isOfflinePatient: false,
        patientId: patientId.toString()
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toMatch(/OTP generated/i);
    expect(res.body.data.session).toBeDefined();
    expect(res.body.data.temp_otp).toBeDefined();
  });

  it("should verify the session OTP to grant access", async () => {
    const reqRes = await request(app)
      .post("/doctor/session/request")
      .set("Authorization", `Bearer ${doctorJwt}`)
      .send({ isOfflinePatient: false, patientId: patientId.toString() });

    const sId = reqRes.body.data.session._id;
    const otp = reqRes.body.data.temp_otp;

    const res = await request(app)
      .post("/doctor/session/verify")
      .set("Authorization", `Bearer ${doctorJwt}`)
      .send({ sessionId: sId, otp });

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toMatch(/granted/i);
    expect(res.body.data.status).toBe("in_progress");
  });

  it("should end the session and create medical history", async () => {
    const sId = await createAndVerifySession();

    const res = await request(app)
      .patch(`/doctor/session/${sId}/end`)
      .set("Authorization", `Bearer ${doctorJwt}`)
      .send({
        fees: 200,
        diagnosis: "Common Cold",
        notes: "Rest and drink fluids",
        prescriptionText: "Paracetamol 500mg"
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toMatch(/saved successfully/i);
    expect(res.body.data.medicalHistory).toBeDefined();
    expect(res.body.data.medicalHistory.diagnosis).toBe("Common Cold");
  });

  // ─── Medical History ───

  it("should get patient medical history", async () => {
    // 1. Create a medical record by ending a session
    const sId1 = await createAndVerifySession();
    await request(app)
      .patch(`/doctor/session/${sId1}/end`)
      .set("Authorization", `Bearer ${doctorJwt}`)
      .send({ diagnosis: "Test Diagnosis", notes: "Test notes" });

    // 2. Open a new session for access
    const sId2 = await createAndVerifySession();

    // 3. Fetch history
    const res = await request(app)
      .get(`/medical-history/${patientId}`)
      .set("Authorization", `Bearer ${doctorJwt}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  // ─── Patient Alerts ───

  it("should update patient alerts", async () => {
    await createAndVerifySession();

    const res = await request(app)
      .patch(`/doctor/patient/${patientId}/alerts`)
      .set("Authorization", `Bearer ${doctorJwt}`)
      .send({ allergies: ["Peanuts"] });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.allergies).toContain("Peanuts");
  });
});
