const router = require('express').Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const PDFDocument = require('pdfkit');

router.get('/:questionnaireId', auth, async (req, res) => {
  try {
    const { questionnaireId } = req.params;

    // Verify ownership
    const q = await pool.query(
      'SELECT * FROM questionnaires WHERE id=$1 AND user_id=$2',
      [questionnaireId, req.user.id]
    );
    if (!q.rows.length) return res.status(404).json({ error: 'Not found' });

    // Fetch questions in order
    const questions = await pool.query(
      'SELECT * FROM questions WHERE questionnaire_id=$1 ORDER BY order_index',
      [questionnaireId]
    );

    // Fetch answers + citations for each question
    const data = await Promise.all(questions.rows.map(async (question) => {
      const answer = await pool.query(
        'SELECT * FROM answers WHERE question_id=$1',
        [question.id]
      );
      const citations = answer.rows.length ? await pool.query(
        'SELECT * FROM citations WHERE answer_id=$1',
        [answer.rows[0].id]
      ) : { rows: [] };

      return {
        question,
        answer: answer.rows[0] || null,
        citations: citations.rows
      };
    }));

    // Generate PDF
    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="novasec_answers.pdf"`);
    doc.pipe(res);

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text('NovaSec Inc.', { align: 'center' });
    doc.fontSize(14).font('Helvetica').text('Vendor Security Questionnaire — Answered', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).fillColor('gray').text(`Generated: ${new Date().toLocaleDateString()}`, { align: 'center' });
    doc.moveDown(2);

    // Coverage summary
    const answered = data.filter(d => d.answer && d.answer.answer_text !== 'Not found in references.').length;
    const notFound = data.filter(d => !d.answer || d.answer.answer_text === 'Not found in references.').length;

    doc.fillColor('black').fontSize(11).font('Helvetica-Bold').text('Coverage Summary');
    doc.fontSize(10).font('Helvetica')
      .text(`Total Questions: ${data.length}`)
      .text(`Answered with Citations: ${answered}`)
      .text(`Not Found in References: ${notFound}`);
    doc.moveDown(2);

    // Divider
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown();

    // Each question + answer
    data.forEach((item, idx) => {
      // Question
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#1a1a2e')
        .text(`Q${item.question.order_index}. ${item.question.question_text}`);
      doc.moveDown(0.5);

      // Answer
      const answerText = item.answer?.answer_text || 'Not found in references.';
      const isNotFound = answerText === 'Not found in references.';
      const isEdited = item.answer?.is_edited;

      doc.fontSize(10).font('Helvetica').fillColor(isNotFound ? '#cc0000' : '#1a1a1a')
        .text(`Answer: ${answerText}`);

      if (isEdited) {
        doc.fontSize(8).fillColor('gray').text('[Manually reviewed and edited]');
      }

      // Confidence score
      if (item.answer && !isNotFound) {
        const score = item.answer.confidence_score;
        const label = score >= 0.7 ? 'High' : score >= 0.4 ? 'Medium' : 'Low';
        const color = score >= 0.7 ? '#006600' : score >= 0.4 ? '#cc6600' : '#cc0000';
        doc.fontSize(8).fillColor(color).text(`Confidence: ${label} (${Math.round(score * 100)}%)`);
      }

      // Citations
      if (item.citations.length > 0) {
        doc.moveDown(0.3);
        doc.fontSize(8).fillColor('#444444').font('Helvetica-Oblique')
          .text('Sources:');
        item.citations.forEach(cite => {
          doc.fontSize(8).fillColor('#444444')
            .text(`  • ${cite.source_filename}, p.${cite.page_number}`);
          if (cite.snippet_text) {
            doc.fontSize(7).fillColor('#888888')
              .text(`    "${cite.snippet_text.substring(0, 120)}..."`, { indent: 10 });
          }
        });
      }

      doc.moveDown();

      // Divider between questions (not after last)
      if (idx < data.length - 1) {
        doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#dddddd').stroke();
        doc.moveDown();
      }
    });

    doc.end();

  } catch (err) {
    console.error('Export error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
