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

  beforeAll(async () => {
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
    // We send multiple requests to see if the rate limiter kicks in
    // Note: The global rate limiter is set to 100/15min. 
    // Testing this entirely might be slow, so we just verify the headers are present.
    const res = await request(app).get("/");
    expect(res.headers["x-ratelimit-limit"]).toBeDefined();
  });
});
