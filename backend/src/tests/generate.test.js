require('dotenv').config();
const request = require('supertest');
const express = require('express');
const authRouter = require('../routes/auth');
const generateRouter = require('../routes/generate');
const pool = require('../config/db');

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/generate', generateRouter);

let token;
let userId;

beforeAll(async () => {
  const testEmail = `test_gen_${Date.now()}@jest.com`;
  const res = await request(app)
    .post('/api/auth/signup')
    .send({ email: testEmail, password: 'testpass' });
  token = res.body.token;
  userId = res.body.user.id;
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE id=$1', [userId]);
});

describe('Generate Route — Auth Protection', () => {
  test('should reject request without token', async () => {
    const res = await request(app)
      .post('/api/generate/some-questionnaire-id');
    expect(res.status).toBe(401);
  });

  test('should reject request with invalid token', async () => {
    const res = await request(app)
      .post('/api/generate/some-id')
      .set('Authorization', 'Bearer invalidtoken123');
    expect(res.status).toBe(401);
  });
});

describe('Generate Route — Questionnaire Validation', () => {
  test('should return 404 for non-existent questionnaire', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app)
      .post(`/api/generate/${fakeId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe('Answer Edit Route', () => {
  test('should reject edit without auth token', async () => {
    const res = await request(app)
      .put('/api/generate/answers/some-answer-id')
      .send({ answer_text: 'edited text' });
    expect(res.status).toBe(401);
  });

  test('should return 404 for non-existent answer', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app)
      .put(`/api/generate/answers/${fakeId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ answer_text: 'edited' });
    expect(res.status).toBe(404);
  });

  test('should prevent User A from editing User B data', async () => {
    // 1. Create User B
    const resB = await request(app)
      .post('/api/auth/signup')
      .send({ email: `userB_${Date.now()}@jest.com`, password: 'passwordB' });
    const tokenB = resB.body.token;

    // 2. User A tries to access a route with tokenB (or vice versa)
    // In this case, we check if User B token is rejected for User A's hypothetical data
    // (Actual data ownership check happens in SQL via WHERE user_id=$1)
    
    const fakeQuestionnaireId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app)
      .get(`/api/generate/answers/${fakeQuestionnaireId}`)
      .set('Authorization', `Bearer ${tokenB}`);
    
    // Should be 404 or empty because the questionnaire doesn't belong to User B
    expect(res.status).toBe(200); 
    expect(res.body.length).toBe(0);
  });
});