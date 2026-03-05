const router = require('express').Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { callGroq } = require('../services/groq');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

router.post('/upload', auth, upload.single('file'), async (req, res) => {
  try {
    const { originalname, path: filePath } = req.file;
    const ext = path.extname(originalname).toLowerCase();

    // Extract raw text
    let rawText = '';
    if (ext === '.pdf') {
      const buffer = fs.readFileSync(filePath);
      const parsed = await pdfParse(buffer);
      rawText = parsed.text;
    } else {
      rawText = fs.readFileSync(filePath, 'utf-8');
    }

    if (!rawText || rawText.trim().length === 0) {
      return res.status(400).json({ error: 'Could not extract text from file' });
    }

    // Save questionnaire record
    const qResult = await pool.query(
      'INSERT INTO questionnaires (user_id, filename, file_path) VALUES ($1,$2,$3) RETURNING *',
      [req.user.id, originalname, filePath]
    );
    const questionnaire = qResult.rows[0];

    // Call Groq to extract questions
    const systemPrompt = `You are a document parser. Extract all questions from the provided questionnaire text.
Return ONLY a valid JSON array, no markdown, no backticks, no explanation.
Format: [{"index": 1, "question": "question text here"}, ...]`;

    const userPrompt = `Extract all questions from this questionnaire:\n\n${rawText}`;

    const groqResponse = await callGroq(userPrompt, systemPrompt);

    // Parse JSON safely
    let questions = [];
    try {
      const cleaned = groqResponse.replace(/```json|```/g, '').trim();
      questions = JSON.parse(cleaned);
    } catch (e) {
      return res.status(500).json({ error: 'Failed to parse questions from document', raw: groqResponse });
    }

    // Save questions to DB
    for (const q of questions) {
      await pool.query(
        'INSERT INTO questions (questionnaire_id, question_text, order_index) VALUES ($1,$2,$3)',
        [questionnaire.id, q.question, q.index]
      );
    }

    // Return questionnaire with parsed questions
    const savedQuestions = await pool.query(
      'SELECT * FROM questions WHERE questionnaire_id=$1 ORDER BY order_index',
      [questionnaire.id]
    );

    res.json({
      questionnaireId: questionnaire.id,
      filename: originalname,
      totalQuestions: savedQuestions.rows.length,
      questions: savedQuestions.rows
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const q = await pool.query(
      'SELECT * FROM questionnaires WHERE id=$1 AND user_id=$2',
      [req.params.id, req.user.id]
    );
    if (!q.rows.length) return res.status(404).json({ error: 'Not found' });

    const questions = await pool.query(
      'SELECT * FROM questions WHERE questionnaire_id=$1 ORDER BY order_index',
      [req.params.id]
    );

    res.json({ ...q.rows[0], questions: questions.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
