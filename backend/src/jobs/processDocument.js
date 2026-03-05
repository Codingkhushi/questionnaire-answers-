const pool = require('../config/db');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');
const { chunkWithOverlap } = require('../services/chunker');
const { embedText } = require('../services/embeddings');

async function processDocument(docId, userId, filePath, filename) {
  try {
    let text = '';
    const ext = path.extname(filename).toLowerCase();

    if (ext === '.pdf') {
      const fileBuffer = fs.readFileSync(filePath);
      const parsed = await pdfParse(fileBuffer);
      text = parsed.text;
    } else {
      // .txt and any other plain text files
      text = fs.readFileSync(filePath, 'utf-8');
    }

    if (!text || text.trim().length === 0) {
      await pool.query('UPDATE documents SET status=$1 WHERE id=$2', ['failed', docId]);
      return;
    }

    const chunks = chunkWithOverlap(text, 300, 50);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = await embedText(chunk);
      const vectorStr = JSON.stringify(embedding);

      await pool.query(
        `INSERT INTO chunks (user_id, doc_id, chunk_text, source_filename, page_number, chunk_index, embedding)
         VALUES ($1, $2, $3, $4, $5, $6, $7::vector)`,
        [userId, docId, chunk, filename, 1, i, vectorStr]
      );
    }

    await pool.query('UPDATE documents SET status=$1 WHERE id=$2', ['ready', docId]);
    console.log(`✓ ${filename} processed: ${chunks.length} chunks`);
  } catch (err) {
    console.error('processDocument error:', err.message);
    await pool.query('UPDATE documents SET status=$1 WHERE id=$2', ['failed', docId]);
  }
}

module.exports = { processDocument };