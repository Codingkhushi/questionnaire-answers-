const pool = require('../config/db');
const { embedText } = require('../services/embeddings');
const { retrieveTopChunks } = require('../services/rag');
const { callGroq } = require('../services/groq');

const SIMILARITY_THRESHOLD = -0.9;
const BATCH_SIZE = 3;

// Add this helper at the top of the file
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function generateAnswers(jobId, questionnaireId, userId) {
  try {
    // Fetch all questions
    const qResult = await pool.query(
      'SELECT * FROM questions WHERE questionnaire_id=$1 ORDER BY order_index',
      [questionnaireId]
    );
    const questions = qResult.rows;
    const total = questions.length;

    // Delete any previous answers for this questionnaire
    await pool.query(
      `DELETE FROM answers WHERE question_id IN (
        SELECT id FROM questions WHERE questionnaire_id=$1
      )`, [questionnaireId]
    );

    // Process in batches of 3
    for (let i = 0; i < questions.length; i += BATCH_SIZE) {
      const batch = questions.slice(i, i + BATCH_SIZE);

      // For each question in batch, retrieve top chunks
      const batchWithChunks = await Promise.all(batch.map(async (q) => {
        const chunks = await retrieveTopChunks(q.question_text, userId, 3);
        const relevantChunks = chunks.filter(c => c.similarity >= SIMILARITY_THRESHOLD);
        return { question: q, chunks: relevantChunks };
      }));

      // Build batch prompt
      const batchPrompt = buildBatchPrompt(batchWithChunks);

      const systemPrompt = `You are a strict compliance officer.You are provided with specific context snippets.
Answer questions using ONLY the provided source snippets.
If the answer is not explicitly in the snippets, return exactly: "Not found in references."
Always cite the source filename for every claim.
Respond ONLY with a valid JSON array. No markdown, no backticks, no explanation.`;

      let groqResponse;
      try {
        groqResponse = await callGroq(batchPrompt, systemPrompt);
        await sleep(2000);
      } catch (e) {
        console.error('Failed to parse Groq response for batch:', groqResponse);
        // Save "not found" for all questions in this batch
        for (const item of batch) {
          await pool.query(
            `INSERT INTO answers (question_id, answer_text, is_edited, confidence_score)
             VALUES ($1,$2,$3,$4)`,
            [item.id, 'Not found in references.', false, 0]
          );
        }
        continue;
      }

      // Parse Groq response
      let batchAnswers = [];
      try {
        const cleaned = groqResponse.replace(/```json|```/g, '').trim();
        batchAnswers = JSON.parse(cleaned);
      } catch (e) {
        console.error('Failed to parse Groq response for batch:', groqResponse);
        // Save "not found" for all questions in this batch
        for (const item of batch) {
          await pool.query(
            `INSERT INTO answers (question_id, answer_text, is_edited, confidence_score)
             VALUES ($1,$2,$3,$4)`,
            [item.id, 'Not found in references.', false, 0]
    );
  }
  continue;
}

      // Save answers + citations
      for (const item of batchAnswers) {
        const question = batch.find((q, idx) => idx === item.batch_index);
        if (!question) continue;

        const chunkData = batchWithChunks.find(b => b.question.id === question.id);
        const topChunk = chunkData?.chunks[0];

        // Compute confidence from similarity score
        const confidence = topChunk ? Math.min(topChunk.similarity * 1.5, 1.0) : 0;

        // Save answer
        const answerResult = await pool.query(
          `INSERT INTO answers (question_id, answer_text, is_edited, confidence_score)
           VALUES ($1,$2,$3,$4) RETURNING id`,
          [question.id, item.answer, false, parseFloat(confidence.toFixed(2))]
        );
        const answerId = answerResult.rows[0].id;

        // Validate and save citations
        const validChunkIds = new Set(chunkData?.chunks.map(c => c.id) || []);

        if (item.citations && item.citations.length > 0) {
          for (const cite of item.citations) {
            const chunk = chunkData?.chunks.find(c => c.source_filename === cite.source);
            if (!chunk) continue; // skip hallucinated citations

            await pool.query(
              `INSERT INTO citations (answer_id, chunk_id, source_filename, page_number, snippet_text)
               VALUES ($1,$2,$3,$4,$5)`,
              [answerId, chunk.id, chunk.source_filename, chunk.page_number,
               chunk.chunk_text.substring(0, 200)]
            );
          }
        }
      }

      // Update job progress
      const processed = Math.min(i + BATCH_SIZE, total);
      await pool.query(
        'UPDATE jobs SET progress=$1 WHERE id=$2',
        [`${processed}/${total}`, jobId]
      );

      console.log(`✓ Batch processed: questions ${i + 1}-${Math.min(i + BATCH_SIZE, total)} of ${total}`);
    }

    await pool.query('UPDATE jobs SET status=$1 WHERE id=$2', ['completed', jobId]);
    console.log('✓ Generation complete');

  } catch (err) {
    console.error('generateAnswers error:', err.message);
    await pool.query('UPDATE jobs SET status=$1 WHERE id=$2', ['failed', jobId]);
  }
}

function buildBatchPrompt(batchWithChunks) {
  let prompt = 'Answer the following questions using ONLY the provided sources.\n\n';

  batchWithChunks.forEach((item, idx) => {
    prompt += `QUESTION ${idx} (batch_index: ${idx}):\n${item.question.question_text}\n\n`;

    if (item.chunks.length === 0) {
      prompt += `SOURCES: No relevant sources found.\n\n`;
    } else {
      prompt += `SOURCES:\n`;
      item.chunks.forEach(chunk => {
        prompt += `[${chunk.source_filename}] ${chunk.chunk_text}\n`;
      });
      prompt += '\n';
    }
  });

  prompt += `Respond ONLY with a JSON array:
[
  {
    "batch_index": 0,
    "answer": "your answer here",
    "citations": [{"source": "filename.txt"}]
  }
]
If not found in sources, set answer to "Not found in references." and citations to [].`;

  return prompt;
}

module.exports = { generateAnswers };

