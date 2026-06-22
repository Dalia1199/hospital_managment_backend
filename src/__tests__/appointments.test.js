import request from "supertest";
import { jest } from '@jest/globals';

jest.mock('pdf-parse', () => jest.fn());

import { app, server } from "../index.js";
import { hash } from "../common/utilits/security/hash.js";
import User from "../DB/models/usermodel.js";
import Doctor from "../DB/models/doctormodel.js";
import Slot from "../DB/models/slot_model.js";
import Availability from "../DB/models/avalibility_model.js";
import Appointment from "../DB/models/appointments_model.js";

afterAll(() => {
  if (server) server.close();
});

describe("Appointments Tests", () => {
  const testDoctor = {
    fullName: "Dr. Appt Tester",
    email: "dr_appt@carehub.local",
    password: "Password123!",
    role: "doctor",
    phoneNumber: "01099995555",
    status: "approved",
    confirmed: true
  };

  const testPatient = {
    fullName: "Patient Appt Tester",
    email: "pt_appt@carehub.local",
    password: "Password123!",
    role: "patient",
    phoneNumber: "01011115555",
    confirmed: true
  };

  let doctorJwt = "";
  let patientJwt = "";
  let doctorId = "";
  let slotId = "";
  let appointmentId = "";

  beforeEach(async () => {
    const hashedPassword = hash({ plain_text: testDoctor.password, saltround: 8 });
    
    // Create Doctor User
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

    // Create Patient User
    const ptUser = await User.create({
      fullName: testPatient.fullName,
      email: testPatient.email,
      password: hashedPassword,
      role: testPatient.role,
      phoneNumber: testPatient.phoneNumber,
      confirmed: testPatient.confirmed
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

    // Setup Availability and Slots for Doctor
    await request(app)
      .patch("/appointmens/availability")
      .set("Authorization", `Bearer ${doctorJwt}`)
      .send({
        day: "monday",
        startTime: "10:00",
        endTime: "12:00",
        appointmentDuration: 30
      });

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Adjust tomorrow to next Monday to ensure slots are generated
    while(tomorrow.getDay() !== 1) {
        tomorrow.setDate(tomorrow.getDate() + 1);
    }
    const startDate = tomorrow.toISOString().split("T")[0];
    
    const nextWeek = new Date(tomorrow);
    nextWeek.setDate(nextWeek.getDate() + 6);
    const endDate = nextWeek.toISOString().split("T")[0];

    const generateRes = await request(app)
      .post("/appointmens/generate-slots")
      .set("Authorization", `Bearer ${doctorJwt}`)
      .send({ startDate, endDate });

    // Fetch available slots
    const slotsRes = await request(app)
      .get(`/appointmens/available-slots/${doctorId}`)
      .set("Authorization", `Bearer ${patientJwt}`);
      
    if(slotsRes.body.data && slotsRes.body.data.length > 0) {
        slotId = slotsRes.body.data[0]._id;
    }
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Doctor.deleteMany({});
    await Slot.deleteMany({});
    await Availability.deleteMany({});
    await Appointment.deleteMany({});
  });

  it("should allow a patient to book an appointment", async () => {
    expect(slotId).toBeTruthy();

    const res = await request(app)
      .post("/appointmens/book")
      .set("Authorization", `Bearer ${patientJwt}`)
      .send({ slotId });

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toMatch(/booked successfully/i);
    appointmentId = res.body.data._id;
  });

  it("should not allow double booking a slot", async () => {
    // Book it first
    await request(app)
      .post("/appointmens/book")
      .set("Authorization", `Bearer ${patientJwt}`)
      .send({ slotId });

    // Try booking again
    const res = await request(app)
      .post("/appointmens/book")
      .set("Authorization", `Bearer ${patientJwt}`)
      .send({ slotId });

    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(res.body.message).toMatch(/not available/i);
  });

  it("should allow patient to cancel an appointment", async () => {
    const bookRes = await request(app)
      .post("/appointmens/book")
      .set("Authorization", `Bearer ${patientJwt}`)
      .send({ slotId });
    const appId = bookRes.body.data._id;

    const res = await request(app)
      .patch(`/appointmens/cancel/${appId}`)
      .set("Authorization", `Bearer ${patientJwt}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toMatch(/cancelled successfully/i);
  });
});
