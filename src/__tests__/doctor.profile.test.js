import request from "supertest";
import { jest } from '@jest/globals';

// Mock cloudinary for testing uploads
jest.unstable_mockModule('cloudinary', () => ({
  default: {
    v2: {
      uploader: {
        upload: jest.fn().mockResolvedValue({
          secure_url: 'https://res.cloudinary.com/demo/image/upload/v123/license.png',
          public_id: 'license_123'
        }),
        destroy: jest.fn().mockResolvedValue({ result: 'ok' })
      }
    }
  }
}));

// Mock pdf-parse
jest.mock('pdf-parse', () => jest.fn());

import { app, server } from "../index.js";
import { hash } from "../common/utilits/security/hash.js";
import mongoose from "mongoose";
import User from "../DB/models/usermodel.js";
import Doctor from "../DB/models/doctormodel.js";

afterAll(() => {
  if (server) server.close();
});

describe("Doctor Profile Tests", () => {
  const testDoctor = {
    fullName: "Dr. Test",
    email: "dr_test@carehub.local",
    password: "Password123!",
    role: "doctor",
    phoneNumber: "01099998888",
    status: "approved",
    confirmed: true
  };

  let doctorJwt = "";

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

    await Doctor.create({
      userId: user._id,
      specialization: "Cardiology",
      experience: 10,
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
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Doctor.deleteMany({});
  });

  it("should successfully fetch doctor dashboard/profile", async () => {
    const res = await request(app)
      .get("/doctor/dashboard")
      .set("Authorization", `Bearer ${doctorJwt}`);

    // If dashboard requires patients, it might be 200 or return empty data
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBeDefined();
  });

  it("should allow doctor to update profile information", async () => {
    const res = await request(app)
      .patch("/doctor/profile")
      .set("Authorization", `Bearer ${doctorJwt}`)
      .send({
        experience: 15,
        address: "New Clinic Address"
      });

    expect(res.statusCode).toBe(200);
  });
});
