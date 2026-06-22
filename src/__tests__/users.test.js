import request from "supertest";
import { jest } from '@jest/globals';
jest.mock('pdf-parse', () => jest.fn());

import { app, server } from "../index.js";
import { hash } from "../common/utilits/security/hash.js";
import mongoose from "mongoose";
import User from "../DB/models/usermodel.js";

afterAll(() => {
  if (server) server.close();
});

describe("Authentication & Security Tests", () => {
  const testUser = {
    fullName: "Test Patient",
    email: "test_auth@carehub.local",
    password: "Password123!",
    role: "patient",
    phoneNumber: "01012345678",
    age: 25,
    gender: "male",
    confirmed: true // Skip OTP for test
  };

  beforeEach(async () => {
    // Seed a user into the in-memory database
    const hashedPassword = hash({ plain_text: testUser.password, saltround: 8 });
    await User.create({
      fullName: testUser.fullName,
      email: testUser.email,
      password: hashedPassword,
      role: testUser.role,
      phoneNumber: testUser.phoneNumber,
      age: testUser.age,
      gender: testUser.gender,
      confirmed: testUser.confirmed
    });
  });

  afterAll(async () => {
    await User.deleteMany({});
  });

  it("should successfully login and receive HttpOnly cookies", async () => {
    const res = await request(app)
      .post("/users/signin")
      .send({
        email: testUser.email,
        password: testUser.password
      });

    // Check if the response is OK
    expect(res.statusCode).toBe(200);
    
    // Check if the server sets the HttpOnly cookie
    const cookies = res.headers["set-cookie"];
    expect(cookies).toBeDefined();
    
    // Verify jwt exists in cookies
    const hasAccessToken = cookies.some(cookie => cookie.includes("jwt="));
    expect(hasAccessToken).toBe(true);

    // Verify it's HttpOnly
    const isHttpOnly = cookies.some(cookie => cookie.includes("HttpOnly"));
    expect(isHttpOnly).toBe(true);
  });

  it("should reject login with wrong password", async () => {
    const res = await request(app)
      .post("/users/signin")
      .send({
        email: testUser.email,
        password: "WrongPassword123!"
      });

    // Should return 4xx error
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(res.body.message).toMatch(/invalid/i);
  });

  it("should enforce Rate Limiting (Security Check)", async () => {
    const res = await request(app).get("/");
    expect(res.headers["x-ratelimit-limit"]).toBeDefined();
  });

  it("should register a new patient successfully", async () => {
    const res = await request(app)
      .post("/users/signup")
      .send({
        fullName: "New Patient",
        email: "new_patient@carehub.local",
        password: "Password123!",
        confirmPassword: "Password123!",
        phoneNumber: "01099999999",
        role: "patient",
        age: 30,
        gender: "female",
        address: "123 Main St",
        bloodType: "O+"
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.message).toBe("signup success");
    expect(res.body.data.email).toBe("new_patient@carehub.local");
  });

  it("should successfully generate a new access token via refresh token", async () => {
    // 1. Signin to get the refresh token
    const loginRes = await request(app)
      .post("/users/signin")
      .send({
        email: testUser.email,
        password: testUser.password
      });

    expect(loginRes.statusCode).toBe(200);
    const cookies = loginRes.headers["set-cookie"];
    expect(cookies).toBeDefined();
    
    const refreshTokenCookie = cookies.find(c => c.startsWith("refreshToken="));
    
    // Extract just the value
    const tokenPart = refreshTokenCookie.split(";")[0];

    // 2. Request a new access token
    const refreshRes = await request(app)
      .get("/users/refresh-token")
      .set("Cookie", [tokenPart]);

    expect(refreshRes.statusCode).toBe(200);
    
    const newCookies = refreshRes.headers["set-cookie"];
    const hasNewJwt = newCookies.some(cookie => cookie.includes("jwt="));
    expect(hasNewJwt).toBe(true);
  });

  it("should successfully update password for an authenticated user", async () => {
    // 1. Signin to get the access token
    const loginRes = await request(app)
      .post("/users/signin")
      .send({
        email: testUser.email,
        password: testUser.password
      });

    const cookies = loginRes.headers["set-cookie"];
    const jwtCookie = cookies.find(c => c.startsWith("jwt=")).split(";")[0];
    const jwtValue = jwtCookie.split("=")[1];

    // 2. Update password
    const updateRes = await request(app)
      .patch("/users/update-password")
      .set("Authorization", `Bearer ${jwtValue}`)
      .send({
        oldpassword: testUser.password,
        newpassword: "NewPassword123!",
        cpassword: "NewPassword123!"
      });

    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.body.message).toBe("password updated");

    // 3. Verify old password no longer works
    const wrongLogin = await request(app)
      .post("/users/signin")
      .send({
        email: testUser.email,
        password: testUser.password
      });
    expect(wrongLogin.statusCode).toBe(400);

    // 4. Verify new password works
    const newLogin = await request(app)
      .post("/users/signin")
      .send({
        email: testUser.email,
        password: "NewPassword123!"
      });
    expect(newLogin.statusCode).toBe(200);
  });
});
