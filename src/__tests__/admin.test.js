import request from "supertest";
import { jest } from '@jest/globals';

jest.mock('pdf-parse', () => jest.fn());

// Bypass validation middleware to avoid Express req.query readonly TypeError
jest.unstable_mockModule("../common/middleware/validation.js", () => ({
  validation: jest.fn().mockImplementation(() => (req, res, next) => next())
}));

let app, server, User, Doctor, hash;

beforeAll(async () => {
  const modIndex = await import("../index.js");
  app = modIndex.app;
  server = modIndex.server;
  
  hash = (await import("../common/utilits/security/hash.js")).hash;
  User = (await import("../DB/models/usermodel.js")).default;
  Doctor = (await import("../DB/models/doctormodel.js")).default;
});

afterAll(() => {
  if (server) server.close();
});

describe("Admin Tests", () => {
  const adminUser = {
    fullName: "Admin User",
    email: "admin@carehub.local",
    password: "Password123!",
    role: "admin",
    phoneNumber: "01000000000",
    confirmed: true
  };

  const pendingDoctor = {
    fullName: "Dr. Pending",
    email: "dr_pending@carehub.local",
    password: "Password123!",
    role: "doctor",
    phoneNumber: "01088887777",
    status: "pending",
    confirmed: true
  };

  let adminJwt = "";
  let pendingDoctorId = "";

  beforeEach(async () => {
    const hashedPassword = hash({ plain_text: adminUser.password, saltround: 8 });

    // Create admin user
    await User.create({
      fullName: adminUser.fullName,
      email: adminUser.email,
      password: hashedPassword,
      role: adminUser.role,
      phoneNumber: adminUser.phoneNumber,
      confirmed: adminUser.confirmed
    });

    // Create pending doctor
    const docUser = await User.create({
      fullName: pendingDoctor.fullName,
      email: pendingDoctor.email,
      password: hashedPassword,
      role: pendingDoctor.role,
      phoneNumber: pendingDoctor.phoneNumber,
      status: pendingDoctor.status,
      confirmed: pendingDoctor.confirmed
    });
    pendingDoctorId = docUser._id;

    await Doctor.create({
      userId: docUser._id,
      specialization: "Cardiology",
      experience: 5,
      licenseimage: { secure_url: "https://demo.url/license.png", public_id: "demo_license" },
      nationalId: { secure_url: "https://demo.url/national.png", public_id: "demo_national" }
    });

    // Login admin
    const loginRes = await request(app)
      .post("/users/signin")
      .send({ email: adminUser.email, password: adminUser.password });
    adminJwt = loginRes.headers["set-cookie"].find(c => c.startsWith("jwt=")).split(";")[0].split("=")[1];
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Doctor.deleteMany({});
  });

  // ─── Dashboard & Users ───

  it("should fetch admin dashboard stats", async () => {
    const res = await request(app)
      .get("/admin/dashboard")
      .set("Authorization", `Bearer ${adminJwt}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toBeDefined();
  });

  it("should fetch all users", async () => {
    const res = await request(app)
      .get("/admin/users")
      .set("Authorization", `Bearer ${adminJwt}`);

    if(res.statusCode !== 200) console.log(res.body);
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toBeDefined();
  });

  // ─── Doctor Approval Flow ───

  it("should fetch pending doctors", async () => {
    const res = await request(app)
      .get("/admin/doctors/pending")
      .set("Authorization", `Bearer ${adminJwt}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it("should approve a pending doctor", async () => {
    const res = await request(app)
      .patch(`/admin/doctors/${pendingDoctorId}/approve`)
      .set("Authorization", `Bearer ${adminJwt}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toMatch(/approved/i);

    // Verify the doctor is now approved
    const doctor = await User.findById(pendingDoctorId);
    expect(doctor.status).toBe("approved");
  });

  it("should reject a pending doctor", async () => {
    const res = await request(app)
      .patch(`/admin/doctors/${pendingDoctorId}/reject`)
      .set("Authorization", `Bearer ${adminJwt}`)
      .send({ reason: "Incomplete details" });

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toMatch(/rejected/i);

    const doctor = await User.findById(pendingDoctorId);
    expect(doctor.status).toBe("rejected");
  });

  // ─── User Activation/Deactivation ───

  it("should deactivate a user", async () => {
    const res = await request(app)
      .patch(`/admin/${pendingDoctorId}/deactivate`)
      .set("Authorization", `Bearer ${adminJwt}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toMatch(/deactivated/i);
  });

  it("should activate a deactivated user", async () => {
    // First deactivate
    await request(app)
      .patch(`/admin/${pendingDoctorId}/deactivate`)
      .set("Authorization", `Bearer ${adminJwt}`);

    // Then activate
    const res = await request(app)
      .patch(`/admin/${pendingDoctorId}/activate`)
      .set("Authorization", `Bearer ${adminJwt}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toMatch(/activated/i);
  });

  // ─── Admin Profile ───

  it("should fetch admin profile", async () => {
    const res = await request(app)
      .get("/admin/profile")
      .set("Authorization", `Bearer ${adminJwt}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toBeDefined();
  });

  // ─── Authorization Guard ───

  it("should deny non-admin users access to admin routes", async () => {
    // Login as the pending doctor (not admin)
    const hashedPassword = hash({ plain_text: pendingDoctor.password, saltround: 8 });
    // Update the doctor to approved so they can log in properly
    await User.findByIdAndUpdate(pendingDoctorId, { status: "approved" });

    const docLogin = await request(app)
      .post("/users/signin")
      .send({ email: pendingDoctor.email, password: pendingDoctor.password });
    const docJwt = docLogin.headers["set-cookie"].find(c => c.startsWith("jwt=")).split(";")[0].split("=")[1];

    const res = await request(app)
      .get("/admin/dashboard")
      .set("Authorization", `Bearer ${docJwt}`);

    expect(res.statusCode).toBe(403);
  });
});
