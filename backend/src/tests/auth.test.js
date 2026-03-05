require('dotenv').config();
const request = require('supertest');
const express = require('express');
const authRouter = require('../routes/auth');
const pool = require('../config/db');

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

// Clean up test users after all tests
afterAll(async () => {
  await pool.query("DELETE FROM users WHERE email LIKE 'test_%@jest.com'");
});

describe('Auth — Signup', () => {
  const testEmail = `test_${Date.now()}@jest.com`;

  test('should create a new user and return JWT token', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: testEmail, password: 'testpass123' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.email).toBe(testEmail);
  });

  test('should reject duplicate email', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: testEmail, password: 'testpass123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Email already exists');
  });

  test('should reject missing password', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: `test_nopass_${Date.now()}@jest.com` });
    
    expect(res.status).toBe(500); // Because bcrypt fails
  });
});

describe('Auth — Login', () => {
  const testEmail = `test_login_${Date.now()}@jest.com`;

  beforeAll(async () => {
    await request(app)
      .post('/api/auth/signup')
      .send({ email: testEmail, password: 'correctpass' });
  });

  test('should login with correct credentials and return token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testEmail, password: 'correctpass' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  test('should reject wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testEmail, password: 'wrongpass' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid credentials');
  });

  test('should reject non-existent email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@jest.com', password: 'pass' });

    expect(res.status).toBe(400);
  });
});

describe('Auth — JWT Middleware', () => {
  test('JWT token should be a valid format', async () => {
    const testEmail = `test_jwt_${Date.now()}@jest.com`;
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: testEmail, password: 'pass123' });

    const token = res.body.token;
    // JWT has 3 parts separated by dots
    const parts = token.split('.');
    expect(parts.length).toBe(3);
  });
});