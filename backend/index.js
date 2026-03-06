const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

const allowedOrigins = [
  'http://localhost:3000',
  'https://questionnaire-answers-2.onrender.com',
  'https://questionnaire-answers-mmur.vercel.app',
  'https://questionnaire-answers.vercel.app'
];

app.use(cors({
  origin: (origin, callback) => {
    console.log('Incoming origin:', origin);
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      console.error('CORS blocked for origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
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

app.get('/api/debug-db', async (req, res) => {
  try {
    const time = await pool.query('SELECT NOW()');
    const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    res.json({ status: 'connected', time: time.rows[0], tables: tables.rows.map(r => r.table_name) });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('SERVER ERROR:', err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});