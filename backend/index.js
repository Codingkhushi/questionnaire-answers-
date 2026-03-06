const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://questionnaire-answers-2.onrender.com',
    'https://questionnaire-answers-mmur.vercel.app',
    'https://questionnaire-answers.vercel.app'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());

app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/documents', require('./src/routes/documents'));
app.use('/api/questionnaire', require('./src/routes/questionnaire'));
app.use('/api/generate', require('./src/routes/generate'));
app.use('/api/export', require('./src/routes/export'));

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});