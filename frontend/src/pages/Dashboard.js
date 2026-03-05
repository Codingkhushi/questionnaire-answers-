import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../components/api';

export default function Dashboard() {
  const [docs, setDocs] = useState([]);
  const [questionnaire, setQuestionnaire] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const pollRef = useRef(null);

  useEffect(() => {
    fetchDocs();
    return () => clearInterval(pollRef.current);
  }, []);

  const fetchDocs = async () => {
    try {
      const res = await api.get('/documents');
      // Show only latest upload per filename
      const seen = new Set();
      const unique = res.data.filter(d => {
        if (seen.has(d.filename)) return false;
        seen.add(d.filename);
        return true;
      });
      setDocs(unique);
    } catch {}
  };

  const uploadDoc = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await api.post('/documents/upload', form);
      setDocs(prev => [...prev, { id: res.data.docId, filename: res.data.filename, status: 'processing' }]);
      pollDocStatus(res.data.docId);
    } catch (err) {
      setError('Upload failed');
    }
    e.target.value = '';
  };

  const pollDocStatus = (docId) => {
    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/documents/${docId}/status`);
        setDocs(prev => prev.map(d => d.id === docId ? { ...d, status: res.data.status } : d));
        if (res.data.status === 'ready' || res.data.status === 'failed') {
          clearInterval(interval);
        }
      } catch { clearInterval(interval); }
    }, 2000);
  };

  const uploadQuestionnaire = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await api.post('/questionnaire/upload', form);
      setQuestionnaire(res.data);
    } catch (err) {
      setError('Questionnaire upload failed');
    }
    e.target.value = '';
  };

  const generate = async () => {
    if (!questionnaire) return;
    const allReady = docs.every(d => d.status === 'ready');
    if (!allReady) { setError('Wait for all documents to finish processing'); return; }
    setGenerating(true);
    setProgress('Starting...');
    setError('');
    try {
      const res = await api.post(`/generate/${questionnaire.questionnaireId}`);
      const jobId = res.data.jobId;
      pollRef.current = setInterval(async () => {
        try {
          const job = await api.get(`/generate/job/${jobId}`);
          setProgress(`Answering questions: ${job.data.progress}`);
          if (job.data.status === 'completed') {
            clearInterval(pollRef.current);
            setGenerating(false);
            navigate(`/review/${questionnaire.questionnaireId}`);
          } else if (job.data.status === 'failed') {
            clearInterval(pollRef.current);
            setGenerating(false);
            setError('Generation failed');
          }
        } catch { clearInterval(pollRef.current); setGenerating(false); }
      }, 2000);
    } catch (err) {
      setGenerating(false);
      setError(err.response?.data?.error || 'Generation failed');
    }
  };

  const logout = () => { localStorage.removeItem('token'); navigate('/login'); };
  const allReady = docs.length > 0 && docs.every(d => d.status === 'ready');

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.logo}>🔐 NovaSec</h1>
        <button onClick={logout} style={styles.logoutBtn}>Logout</button>
      </div>
      <div style={styles.content}>
        {error && <div style={styles.error}>{error}</div>}

        {/* Reference Docs */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>1. Upload Reference Documents</h2>
          <label style={styles.uploadBtn}>
            + Upload Document
            <input type="file" accept=".pdf,.txt" onChange={uploadDoc} style={{ display: 'none' }} />
          </label>
          <div style={styles.docList}>
            {docs.map(doc => (
              <div key={doc.id} style={styles.docItem}>
                <span style={styles.docName}>📄 {doc.filename}</span>
                <span style={{ ...styles.badge, background: doc.status === 'ready' ? '#006600' : doc.status === 'failed' ? '#660000' : '#664400' }}>
                  {doc.status === 'ready' ? '✓ Ready' : doc.status === 'failed' ? '✗ Failed' : '⏳ Processing'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Questionnaire Upload */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>2. Upload Questionnaire</h2>
          <label style={styles.uploadBtn}>
            + Upload Questionnaire
            <input type="file" accept=".pdf,.txt" onChange={uploadQuestionnaire} style={{ display: 'none' }} />
          </label>
          {questionnaire && (
            <div style={styles.docItem}>
              <span style={styles.docName}>📋 {questionnaire.filename}</span>
              <span style={{ ...styles.badge, background: '#006600' }}>✓ {questionnaire.totalQuestions} questions parsed</span>
            </div>
          )}
        </div>

        {/* Generate */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>3. Generate Answers</h2>
          <button
            onClick={generate}
            disabled={!questionnaire || !allReady || generating}
            style={{ ...styles.generateBtn, opacity: (!questionnaire || !allReady || generating) ? 0.5 : 1 }}>
            {generating ? `⏳ ${progress}` : 'Generate Answers'}
          </button>
          {!allReady && docs.length > 0 && <p style={styles.hint}>Waiting for documents to finish processing...</p>}
          {!questionnaire && <p style={styles.hint}>Upload a questionnaire to continue</p>}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', background: '#0f0f1a', color: '#fff' },
  header: { background: '#1a1a2e', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333' },
  logo: { color: '#4f8ef7', margin: 0 },
  logoutBtn: { background: 'transparent', color: '#888', border: '1px solid #333', padding: '8px 16px', borderRadius: 6, cursor: 'pointer' },
  content: { maxWidth: 800, margin: '40px auto', padding: '0 24px' },
  section: { background: '#1a1a2e', borderRadius: 12, padding: 24, marginBottom: 24, border: '1px solid #2a2a4e' },
  sectionTitle: { color: '#4f8ef7', marginTop: 0, marginBottom: 16 },
  uploadBtn: { display: 'inline-block', padding: '10px 20px', background: '#4f8ef7', color: '#fff', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 'bold' },
  docList: { marginTop: 16 },
  docItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #2a2a4e' },
  docName: { fontSize: 14, color: '#ccc' },
  badge: { padding: '4px 10px', borderRadius: 20, fontSize: 12, color: '#fff', fontWeight: 'bold' },
  generateBtn: { padding: '14px 32px', background: '#4f8ef7', color: '#fff', border: 'none', borderRadius: 8, fontSize: 16, cursor: 'pointer', fontWeight: 'bold' },
  hint: { color: '#888', fontSize: 13, marginTop: 8 },
  error: { background: '#ff000022', color: '#ff6666', padding: 12, borderRadius: 8, marginBottom: 16 }
};