const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { processDocument } = require('../jobs/processDocument');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

// Upload a reference document
router.post('/upload', auth, upload.single('file'), async (req, res) => {
  try {
    const { originalname, path: filePath } = req.file;

    const result = await pool.query(
      'INSERT INTO documents (user_id, filename, file_path, status) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.user.id, originalname, filePath, 'processing']
    );
    const doc = result.rows[0];

    // Return immediately, process in background
    res.json({ docId: doc.id, status: 'processing', filename: originalname });

    // Background processing - don't await
    processDocument(doc.id, req.user.id, filePath, originalname);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Poll status of a document
router.get('/:id/status', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, filename, status FROM documents WHERE id=$1 AND user_id=$2',
      [req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List all documents for current user
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, filename, status, created_at FROM documents WHERE user_id=$1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
