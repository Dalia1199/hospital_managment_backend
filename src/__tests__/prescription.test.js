import request from "supertest";
import { jest } from '@jest/globals';

jest.mock('pdf-parse', () => jest.fn());

import { app, server } from "../index.js";
import { hash } from "../common/utilits/security/hash.js";
import User from "../DB/models/usermodel.js";
import Doctor from "../DB/models/doctormodel.js";
import Patient from "../DB/models/patientmodel.js";
import Session from "../DB/models/sessionmodel.js";
import Prescription from "../DB/models/prescriptionmodel.js";
import MedicalHistory from "../DB/models/medicalhistorymodel.js";

afterAll(() => {
  if (server) server.close();
});

describe("Prescription Tests", () => {
  const testDoctor = {
    fullName: "Dr. Prescription",
    email: "dr_rx@carehub.local",
    password: "Password123!",
    role: "doctor",
    phoneNumber: "01099998888",
    status: "approved",
    confirmed: true
  };

  const testPatient = {
    fullName: "Patient Rx",
    email: "pt_rx@carehub.local",
    password: "Password123!",
    role: "patient",
    phoneNumber: "01011118888",
    confirmed: true
  };

  let doctorJwt = "";
  let patientJwt = "";
  let doctorId = "";
  let patientId = "";

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
      specialization: "Internal Medicine",
      experience: 8,
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
      age: 40,
      gender: "female",
      bloodType: "A+"
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
    await Prescription.deleteMany({});
    await MedicalHistory.deleteMany({});
  });

  // ─── Create Prescription ───

  it("should create a prescription for a patient", async () => {
    const res = await request(app)
      .post("/prescrption/create")
      .set("Authorization", `Bearer ${doctorJwt}`)
      .send({
        patientId: patientId.toString(),
        diagnosis: "Hypertension",
        medications: [
          {
            medicineName: "Amlodipine",
            dosage: "5mg",
            frequency: "Once daily",
            duration: "30 days",
            instructions: "Take in the morning"
          }
        ],
        notes: "Monitor blood pressure weekly"
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toMatch(/created successfully/i);
    expect(res.body.data.diagnosis).toBe("Hypertension");
    expect(res.body.data.medications).toHaveLength(1);
    expect(res.body.data.medications[0].medicineName).toBe("Amlodipine");
  });

  it("should create a prescription with multiple medications", async () => {
    const res = await request(app)
      .post("/prescrption/create")
      .set("Authorization", `Bearer ${doctorJwt}`)
      .send({
        patientId: patientId.toString(),
        diagnosis: "Diabetes Type 2",
        medications: [
          {
            medicineName: "Metformin",
            dosage: "500mg",
            frequency: "Twice daily",
            duration: "90 days",
            instructions: "Take with meals"
          },
          {
            medicineName: "Glimepiride",
            dosage: "2mg",
            frequency: "Once daily",
            duration: "90 days",
            instructions: "Take before breakfast"
          }
        ]
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.medications).toHaveLength(2);
  });

  it("should reject prescription without required fields", async () => {
    const res = await request(app)
      .post("/prescrption/create")
      .set("Authorization", `Bearer ${doctorJwt}`)
      .send({
        patientId: patientId.toString()
        // Missing diagnosis and medications
      });

    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  it("should reject prescription with empty medications array", async () => {
    const res = await request(app)
      .post("/prescrption/create")
      .set("Authorization", `Bearer ${doctorJwt}`)
      .send({
        patientId: patientId.toString(),
        diagnosis: "Test",
        medications: []
      });

    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  // ─── Get Patient Prescriptions ───

  it("should get patient prescriptions as doctor with active session", async () => {
    // 1. Create a prescription
    await request(app)
      .post("/prescrption/create")
      .set("Authorization", `Bearer ${doctorJwt}`)
      .send({
        patientId: patientId.toString(),
        diagnosis: "Flu",
        medications: [
          { medicineName: "Paracetamol", dosage: "500mg", frequency: "3 times daily", duration: "5 days" }
        ]
      });

    // 2. Create active session for access
    await createAndVerifySession();

    // 3. Fetch
    const res = await request(app)
      .get(`/prescrption/patient/${patientId}`)
      .set("Authorization", `Bearer ${doctorJwt}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it("should allow patient to view their own prescriptions", async () => {
    // 1. Doctor creates a prescription
    await request(app)
      .post("/prescrption/create")
      .set("Authorization", `Bearer ${doctorJwt}`)
      .send({
        patientId: patientId.toString(),
        diagnosis: "Cold",
        medications: [
          { medicineName: "Vitamin C", dosage: "1000mg", frequency: "Once daily", duration: "7 days" }
        ]
      });

    // 2. Patient fetches own prescriptions
    const res = await request(app)
      .get(`/prescrption/patient/${patientId}`)
      .set("Authorization", `Bearer ${patientJwt}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it("should deny doctor access to prescriptions without active session", async () => {
    // No session created — OTP sharing setting blocks access
    const res = await request(app)
      .get(`/prescrption/patient/${patientId}`)
      .set("Authorization", `Bearer ${doctorJwt}`);

    expect(res.statusCode).toBe(403);
  });

  // ─── Update Prescription ───

  it("should update prescription fields", async () => {
    // 1. Create prescription
    const createRes = await request(app)
      .post("/prescrption/create")
      .set("Authorization", `Bearer ${doctorJwt}`)
      .send({
        patientId: patientId.toString(),
        diagnosis: "Migraine",
        medications: [
          { medicineName: "Sumatriptan", dosage: "50mg", frequency: "As needed", duration: "30 days" }
        ],
        notes: "Initial notes"
      });

    const rxId = createRes.body.data._id;

    // 2. Update
    const res = await request(app)
      .patch(`/prescrption/${rxId}`)
      .set("Authorization", `Bearer ${doctorJwt}`)
      .send({
        diagnosis: "Chronic Migraine",
        notes: "Updated notes - increase dosage if needed"
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toMatch(/updated successfully/i);
    expect(res.body.data.diagnosis).toBe("Chronic Migraine");
    expect(res.body.data.notes).toBe("Updated notes - increase dosage if needed");
  });

  it("should not allow a different doctor to update the prescription", async () => {
    // 1. Create prescription with first doctor
    const createRes = await request(app)
      .post("/prescrption/create")
      .set("Authorization", `Bearer ${doctorJwt}`)
      .send({
        patientId: patientId.toString(),
        diagnosis: "Test",
        medications: [
          { medicineName: "TestMed", dosage: "10mg", frequency: "Daily", duration: "7 days" }
        ]
      });

    const rxId = createRes.body.data._id;

    // 2. Create a second doctor
    const hashedPassword = hash({ plain_text: "Password123!", saltround: 8 });
    const doc2User = await User.create({
      fullName: "Dr. Other",
      email: "dr_other@carehub.local",
      password: hashedPassword,
      role: "doctor",
      phoneNumber: "01077776666",
      status: "approved",
      confirmed: true
    });

    await Doctor.create({
      userId: doc2User._id,
      specialization: "Surgery",
      experience: 3,
      licenseimage: { secure_url: "url", public_id: "id" },
      nationalId: { secure_url: "url", public_id: "id" }
    });

    const doc2Login = await request(app)
      .post("/users/signin")
      .send({ email: "dr_other@carehub.local", password: "Password123!" });
    const doc2Jwt = doc2Login.headers["set-cookie"].find(c => c.startsWith("jwt=")).split(";")[0].split("=")[1];

    // 3. Second doctor tries to update
    const res = await request(app)
      .patch(`/prescrption/${rxId}`)
      .set("Authorization", `Bearer ${doc2Jwt}`)
      .send({ diagnosis: "Hacked Diagnosis" });

    expect(res.statusCode).toBe(403);
  });

  // ─── Delete (Soft Cancel) Prescription ───

  it("should soft-delete (cancel) a prescription", async () => {
    // 1. Create prescription
    const createRes = await request(app)
      .post("/prescrption/create")
      .set("Authorization", `Bearer ${doctorJwt}`)
      .send({
        patientId: patientId.toString(),
        diagnosis: "Allergy",
        medications: [
          { medicineName: "Cetirizine", dosage: "10mg", frequency: "Once daily", duration: "14 days" }
        ]
      });

    const rxId = createRes.body.data._id;

    // 2. Delete
    const res = await request(app)
      .delete(`/prescrption/${rxId}`)
      .set("Authorization", `Bearer ${doctorJwt}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toMatch(/deleted successfully/i);

    // 3. Verify it's cancelled (not physically deleted)
    const rx = await Prescription.findById(rxId);
    expect(rx).not.toBeNull();
    expect(rx.status).toBe("cancelled");
  });

  // ─── Prescription with Medical History Link ───

  it("should create a prescription linked to medical history", async () => {
    // 1. Create a session and end it to create medical history
    const sId = await createAndVerifySession();
    const endRes = await request(app)
      .patch(`/doctor/session/${sId}/end`)
      .set("Authorization", `Bearer ${doctorJwt}`)
      .send({ diagnosis: "Linked Diagnosis", notes: "Test" });

    const medHistoryId = endRes.body.data.medicalHistory._id;

    // 2. Create prescription linked to that medical history
    const res = await request(app)
      .post("/prescrption/create")
      .set("Authorization", `Bearer ${doctorJwt}`)
      .send({
        patientId: patientId.toString(),
        medicalHistoryId: medHistoryId,
        diagnosis: "Linked Diagnosis",
        medications: [
          { medicineName: "LinkedMed", dosage: "25mg", frequency: "Twice daily", duration: "14 days" }
        ]
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.medicalHistoryId).toBe(medHistoryId);

    // 3. Verify the prescription ID was pushed to medical history
    const history = await MedicalHistory.findById(medHistoryId);
    const rxIds = history.prescriptions.map(id => id.toString());
    expect(rxIds).toContain(res.body.data._id);
  });
});
