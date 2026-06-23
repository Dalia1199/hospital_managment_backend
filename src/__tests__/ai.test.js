import request from "supertest";
import { jest } from '@jest/globals';

await jest.unstable_mockModule("@google/generative-ai", () => ({
  GoogleGenerativeAI: class {
    constructor() {}
    getGenerativeModel() {
      return {
        startChat: () => ({
          sendMessage: async () => ({
            response: Promise.resolve({
              text: () => '[{"condition":"Mock", "rationale":"Mock"}]'
            })
          })
        }),
        embedContent: async () => ({
          embedding: { values: [0.1, 0.2, 0.3] }
        })
      };
    }
  }
}));

await jest.unstable_mockModule("pdf-parse", () => ({
  default: jest.fn().mockResolvedValue({ text: "Mock PDF Content" })
}));

process.env.GEMINI_API_KEY = "test_key";

let app, server, User, Patient, Doctor, hash;

beforeAll(async () => {
  const modIndex = await import("../index.js");
  app = modIndex.app;
  server = modIndex.server;
  
  hash = (await import("../common/utilits/security/hash.js")).hash;
  User = (await import("../DB/models/usermodel.js")).default;
  Patient = (await import("../DB/models/patientmodel.js")).default;
  Doctor = (await import("../DB/models/doctormodel.js")).default;
});

afterAll(() => {
  if (server) server.close();
});

describe("AI Service Tests", () => {
  const testPatient = {
    fullName: "AI Patient",
    email: "ai_patient@carehub.local",
    password: "Password123!",
    role: "patient",
    phoneNumber: "01055554444",
    confirmed: true
  };

  const testDoctor = {
    fullName: "AI Doctor",
    email: "ai_doctor@carehub.local",
    password: "Password123!",
    role: "doctor",
    phoneNumber: "01033332222",
    status: "approved",
    confirmed: true
  };

  let patientJwt = "";
  let doctorJwt = "";
  let patientId = "";

  beforeEach(async () => {
    const hashedPassword = hash({ plain_text: "Password123!", saltround: 8 });

    const ptUser = await User.create({
      ...testPatient,
      password: hashedPassword
    });
    patientId = ptUser._id;
    await Patient.create({ userId: patientId, age: 30, gender: "male", bloodType: "O+" });

    const docUser = await User.create({
      ...testDoctor,
      password: hashedPassword
    });
    await Doctor.create({
      userId: docUser._id,
      specialization: "General Practice",
      licenseimage: { secure_url: "url", public_id: "id" },
      nationalId: { secure_url: "url", public_id: "id" }
    });

    const ptLogin = await request(app).post("/users/signin").send({ email: testPatient.email, password: "Password123!" });
    patientJwt = ptLogin.headers["set-cookie"].find(c => c.startsWith("jwt=")).split(";")[0].split("=")[1];

    const docLogin = await request(app).post("/users/signin").send({ email: testDoctor.email, password: "Password123!" });
    doctorJwt = docLogin.headers["set-cookie"].find(c => c.startsWith("jwt=")).split(";")[0].split("=")[1];
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Patient.deleteMany({});
    await Doctor.deleteMany({});
  });

  it("should allow patient to interact with AI chatbot", async () => {
    const res = await request(app)
      .post("/ai/chatbot")
      .set("Authorization", `Bearer ${patientJwt}`)
      .send({
        message: "I have a headache."
      });

    if (res.statusCode !== 200) console.log(res.body);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.reply).toBeDefined();
    expect(res.body.data.reply).toBe('[{"condition":"Mock", "rationale":"Mock"}]');
  });

  it("should allow doctor to ask clinical assistant (RAG)", async () => {
    const res = await request(app)
      .post("/ai/ask")
      .set("Authorization", `Bearer ${doctorJwt}`)
      .send({
        symptoms: "What is the recommended treatment for hypertension?"
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.response).toBe('[{"condition":"Mock", "rationale":"Mock"}]');
  });

  it("should generate differential diagnosis for doctor", async () => {
    const res = await request(app)
      .post("/ai/differential-diagnosis")
      .set("Authorization", `Bearer ${doctorJwt}`)
      .send({
        symptoms: ["headache", "fever", "stiff neck"],
        history: "No previous medical history",
        vitals: "Temp 39C, BP 120/80"
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toBeDefined();
  });

  it("should deny patient access to clinical assistant", async () => {
    const res = await request(app)
      .post("/ai/ask")
      .set("Authorization", `Bearer ${patientJwt}`)
      .send({ question: "Is this cancer?" });

    expect(res.statusCode).toBe(403);
  });
});
