const pool = require('../config/db');
const { embedText } = require('./embeddings');

async function retrieveTopChunks(questionText, userId, topK = 3) {
  const queryVector = await embedText(questionText);
  const vectorStr = JSON.stringify(queryVector);

  const result = await pool.query(
    `SELECT id, chunk_text, source_filename, page_number,
            1 - (embedding <=> $1::vector) as similarity
     FROM chunks
     WHERE user_id = $2
     ORDER BY embedding <-> $1::vector
     LIMIT $3`,
    [vectorStr, userId, topK]
  );
  return result.rows;
}

module.exports = { retrieveTopChunks };