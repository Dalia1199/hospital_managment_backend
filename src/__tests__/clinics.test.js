import request from "supertest";
import { jest } from '@jest/globals';

jest.mock('pdf-parse', () => jest.fn());

import { app, server } from "../index.js";
import { hash } from "../common/utilits/security/hash.js";
import mongoose from "mongoose";
import User from "../DB/models/usermodel.js";
import Doctor from "../DB/models/doctormodel.js";
import Clinic from "../DB/models/clinic_model.js";

afterAll(() => {
  if (server) server.close();
});

describe("Clinics Tests", () => {
  const testDoctor = {
    fullName: "Dr. Clinic Owner",
    email: "clinic_doc@carehub.local",
    password: "Password123!",
    role: "doctor",
    phoneNumber: "01099991234",
    status: "approved",
    confirmed: true
  };

  let doctorJwt = "";
  let doctorId = "";
  let clinicId = "";

  beforeEach(async () => {
    const hashedPassword = hash({ plain_text: testDoctor.password, saltround: 8 });
    const user = await User.create({
      fullName: testDoctor.fullName,
      email: testDoctor.email,
      password: hashedPassword,
      role: testDoctor.role,
      phoneNumber: testDoctor.phoneNumber,
      status: testDoctor.status,
      confirmed: testDoctor.confirmed
    });
    
    doctorId = user._id;

    await Doctor.create({
      userId: user._id,
      specialization: "Dermatology",
      experience: 5,
      licenseimage: {
        secure_url: "https://demo.url/license.png",
        public_id: "demo_license_123"
      },
      nationalId: {
        secure_url: "https://demo.url/national.png",
        public_id: "demo_national_123"
      }
    });

    const loginRes = await request(app)
      .post("/users/signin")
      .send({
        email: testDoctor.email,
        password: testDoctor.password
      });

    const cookies = loginRes.headers["set-cookie"];
    doctorJwt = cookies.find(c => c.startsWith("jwt=")).split(";")[0].split("=")[1];

    // Create a clinic to be used in fetch and update tests
    const clinicRes = await request(app)
      .post("/clinics")
      .set("Authorization", `Bearer ${doctorJwt}`)
      .send({
        name: "Derma Care Clinic",
        address: "123 Skin Ave",
        phone: "01011112222"
      });
    clinicId = clinicRes.body.data._id;
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Doctor.deleteMany({});
    await Clinic.deleteMany({});
  });

  it("should create a new clinic for the doctor", async () => {
    // The clinic is already created in beforeEach, we just create another one
    const res = await request(app)
      .post("/clinics")
      .set("Authorization", `Bearer ${doctorJwt}`)
      .send({
        name: "Second Clinic",
        address: "456 Skin Ave",
        phone: "01011112222"
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.message).toMatch(/added successfully/i);
  });

  it("should fetch my clinics", async () => {
    const res = await request(app)
      .get("/clinics")
      .set("Authorization", `Bearer ${doctorJwt}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].name).toBe("Derma Care Clinic");
  });

  it("should allow doctor to update clinic details", async () => {
    const res = await request(app)
      .patch(`/clinics/${clinicId}`)
      .set("Authorization", `Bearer ${doctorJwt}`)
      .send({
        phone: "01022223333"
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.phone).toBe("01022223333");
  });
});
