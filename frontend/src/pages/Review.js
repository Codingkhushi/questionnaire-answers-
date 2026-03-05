import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../components/api';

export default function Review() {
  const { questionnaireId } = useParams();
  const [answers, setAnswers] = useState([]);
  const [editing, setEditing] = useState({});
  const [saved, setSaved] = useState({});
  const navigate = useNavigate();

  useEffect(() => { fetchAnswers(); }, []);

  const fetchAnswers = async () => {
    const res = await api.get(`/generate/answers/${questionnaireId}`);
    setAnswers(res.data);
  };

  const startEdit = (answerId, currentText) => {
    setEditing(prev => ({ ...prev, [answerId]: currentText }));
  };

  const saveEdit = async (answerId) => {
    try {
      await api.put(`/generate/answers/${answerId}`, { answer_text: editing[answerId] });
      setSaved(prev => ({ ...prev, [answerId]: true }));
      setEditing(prev => { const n = { ...prev }; delete n[answerId]; return n; });
      fetchAnswers();
    } catch { alert('Save failed'); }
  };

  const exportPDF = async () => {
    const res = await api.get(`/export/${questionnaireId}`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'novasec_answers.pdf';
    a.click();
  };

  const answered = answers.filter(a => a.answer && a.answer.answer_text !== 'Not found in references.').length;
  const notFound = answers.filter(a => !a.answer || a.answer.answer_text === 'Not found in references.').length;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button onClick={() => navigate('/dashboard')} style={styles.backBtn}>← Back</button>
        <h1 style={styles.logo}>🔐 NovaSec — Review Answers</h1>
        <button onClick={exportPDF} style={styles.exportBtn}>⬇ Export PDF</button>
      </div>

      <div style={styles.content}>
        {/* Summary */}
        <div style={styles.summary}>
          <div style={styles.summaryItem}><span style={styles.summaryNum}>{answers.length}</span><span>Total</span></div>
          <div style={styles.summaryItem}><span style={{ ...styles.summaryNum, color: '#4CAF50' }}>{answered}</span><span>Answered</span></div>
          <div style={styles.summaryItem}><span style={{ ...styles.summaryNum, color: '#f44336' }}>{notFound}</span><span>Not Found</span></div>
        </div>

        {/* Answers */}
        {answers.map((item) => {
          const answerId = item.answer?.id;
          const answerText = item.answer?.answer_text || 'Not found in references.';
          const isNotFound = answerText === 'Not found in references.';
          const isEditing = answerId && editing[answerId] !== undefined;
          const confidence = item.answer?.confidence_score;
          const confLabel = confidence >= 0.7 ? 'High' : confidence >= 0.4 ? 'Medium' : 'Low';
          const confColor = confidence >= 0.7 ? '#4CAF50' : confidence >= 0.4 ? '#ff9800' : '#f44336';

          return (
            <div key={item.question_id} style={styles.card}>
              <div style={styles.questionRow}>
                <span style={styles.qNum}>Q{item.order_index}</span>
                <span style={styles.questionText}>{item.question_text}</span>
              </div>

              {isEditing ? (
                <div style={styles.editArea}>
                  <textarea style={styles.textarea} value={editing[answerId]}
                    onChange={e => setEditing(prev => ({ ...prev, [answerId]: e.target.value }))}
                    rows={4} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button onClick={() => saveEdit(answerId)} style={styles.saveBtn}>Save</button>
                    <button onClick={() => setEditing(prev => { const n={...prev}; delete n[answerId]; return n; })} style={styles.cancelBtn}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div style={styles.answerRow}>
                  <p style={{ ...styles.answerText, color: isNotFound ? '#f44336' : '#e0e0e0' }}>{answerText}</p>
                  {answerId && !isNotFound && (
                    <button onClick={() => startEdit(answerId, answerText)} style={styles.editBtn}>✏ Edit</button>
                  )}
                </div>
              )}

              {item.answer?.is_edited && <span style={styles.editedTag}>✓ Manually reviewed</span>}

              {!isNotFound && confidence !== undefined && (
                <span style={{ ...styles.confBadge, color: confColor, borderColor: confColor }}>
                  {confLabel} confidence ({Math.round(confidence * 100)}%)
                </span>
              )}

              {item.citations.length > 0 && (
                <div style={styles.citations}>
                  <span style={styles.citLabel}>Sources: </span>
                  {item.citations.map((c, i) => (
                    <span key={i} style={styles.citChip}>📄 {c.source_filename}</span>
                  ))}
                  <div style={styles.snippet}>"{item.citations[0]?.snippet_text?.substring(0, 150)}..."</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', background: '#0f0f1a', color: '#fff' },
  header: { background: '#1a1a2e', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', position: 'sticky', top: 0, zIndex: 10 },
  logo: { color: '#4f8ef7', margin: 0, fontSize: 18 },
  backBtn: { background: 'transparent', color: '#888', border: '1px solid #333', padding: '8px 16px', borderRadius: 6, cursor: 'pointer' },
  exportBtn: { padding: '10px 20px', background: '#4CAF50', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' },
  content: { maxWidth: 900, margin: '0 auto', padding: '24px' },
  summary: { display: 'flex', gap: 16, marginBottom: 24 },
  summaryItem: { background: '#1a1a2e', padding: '16px 24px', borderRadius: 10, textAlign: 'center', flex: 1, border: '1px solid #2a2a4e', display: 'flex', flexDirection: 'column', gap: 4 },
  summaryNum: { fontSize: 28, fontWeight: 'bold', color: '#4f8ef7' },
  card: { background: '#1a1a2e', borderRadius: 10, padding: 20, marginBottom: 16, border: '1px solid #2a2a4e' },
  questionRow: { display: 'flex', gap: 12, marginBottom: 12, alignItems: 'flex-start' },
  qNum: { background: '#4f8ef7', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 'bold', flexShrink: 0 },
  questionText: { fontWeight: 'bold', color: '#e0e0e0', fontSize: 15 },
  answerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  answerText: { margin: 0, fontSize: 14, lineHeight: 1.6, flex: 1 },
  editBtn: { background: 'transparent', color: '#4f8ef7', border: '1px solid #4f8ef7', padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12, flexShrink: 0 },
  editArea: { marginTop: 8 },
  textarea: { width: '100%', background: '#0f0f1a', color: '#fff', border: '1px solid #4f8ef7', borderRadius: 8, padding: 10, fontSize: 14, boxSizing: 'border-box' },
  saveBtn: { background: '#4CAF50', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: 6, cursor: 'pointer' },
  cancelBtn: { background: 'transparent', color: '#888', border: '1px solid #333', padding: '6px 16px', borderRadius: 6, cursor: 'pointer' },
  editedTag: { fontSize: 11, color: '#4CAF50', marginTop: 4, display: 'block' },
  confBadge: { display: 'inline-block', border: '1px solid', padding: '2px 8px', borderRadius: 20, fontSize: 11, marginTop: 8 },
  citations: { marginTop: 12, paddingTop: 12, borderTop: '1px solid #2a2a4e' },
  citLabel: { fontSize: 12, color: '#888' },
  citChip: { background: '#0f0f1a', padding: '2px 8px', borderRadius: 4, fontSize: 12, margin: '0 4px' },
  snippet: { fontSize: 11, color: '#666', marginTop: 6, fontStyle: 'italic' }
};