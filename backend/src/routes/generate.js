const router = require('express').Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { generateAnswers } = require('../jobs/generateAnswers');

// Start generation job
router.post('/:questionnaireId', auth, async (req, res) => {
  try {
    const { questionnaireId } = req.params;

    // Verify questionnaire belongs to user
    const q = await pool.query(
      'SELECT * FROM questionnaires WHERE id=$1 AND user_id=$2',
      [questionnaireId, req.user.id]
    );
    if (!q.rows.length) return res.status(404).json({ error: 'Questionnaire not found' });

    // Check all docs are ready
    const docsResult = await pool.query(
      'SELECT status FROM documents WHERE user_id=$1',
      [req.user.id]
    );
    const notReady = docsResult.rows.filter(d => d.status !== 'ready');
    if (notReady.length > 0) {
      return res.status(400).json({ error: 'Some documents are still processing. Please wait.' });
    }

    // Create job
    const jobResult = await pool.query(
      'INSERT INTO jobs (user_id, questionnaire_id, status, progress) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.user.id, questionnaireId, 'pending', '0/0']
    );
    const job = jobResult.rows[0];

    // Return job ID immediately
    res.json({ jobId: job.id, status: 'pending', message: 'Generation started' });

    // Run in background
    generateAnswers(job.id, questionnaireId, req.user.id);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Poll job status
router.get('/job/:jobId', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM jobs WHERE id=$1 AND user_id=$2',
      [req.params.jobId, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Job not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all answers for a questionnaire
router.get('/answers/:questionnaireId', auth, async (req, res) => {
  try {
    const questions = await pool.query(
      'SELECT * FROM questions WHERE questionnaire_id=$1 ORDER BY order_index',
      [req.params.questionnaireId]
    );

    const result = await Promise.all(questions.rows.map(async (q) => {
      const answer = await pool.query(
        'SELECT * FROM answers WHERE question_id=$1',
        [q.id]
      );
      const citations = answer.rows.length ? await pool.query(
        'SELECT * FROM citations WHERE answer_id=$1',
        [answer.rows[0].id]
      ) : { rows: [] };

      return {
        question_id: q.id,
        order_index: q.order_index,
        question_text: q.question_text,
        answer: answer.rows[0] || null,
        citations: citations.rows
      };
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Edit an answer
router.put('/answers/:answerId', auth, async (req, res) => {
  try {
    const { answer_text } = req.body;
    const result = await pool.query(
      `UPDATE answers SET answer_text=$1, is_edited=true, edited_at=NOW()
       WHERE id=$2 RETURNING *`,
      [answer_text, req.params.answerId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Answer not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// TEMPORARY DEBUG ROUTE - remove after fixing
router.get('/debug/search', auth, async (req, res) => {
  try {
    const { embedText } = require('../services/embeddings');
    const pool = require('../config/db');
    
    const testQuestion = "What encryption standards do you use?";
    const embedding = await embedText(testQuestion);
    const vectorStr = JSON.stringify(embedding);

    const result = await pool.query(
      `SELECT id, source_filename, chunk_index,
              LEFT(chunk_text, 100) as preview,
              1 - (embedding <=> $1::vector) as similarity
       FROM chunks
       WHERE user_id = $2
       ORDER BY embedding <=> $1::vector
       LIMIT 5`,
      [vectorStr, req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
