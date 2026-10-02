import { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { collection, addDoc, getDocs, deleteDoc, updateDoc, doc, query, orderBy } from 'firebase/firestore';
import { JEE_SYLLABUS } from '../data/jeeChapters';
import { Shield, Trash2, Edit2, Save, X, Download } from 'lucide-react';

export default function Admin() {
  const [activeTab, setActiveTab] = useState('progress');
  const [loading, setLoading] = useState(false);

  // Form states
  const [user, setUser] = useState('user1');
  const [subject, setSubject] = useState('Physics');
  const [chapter, setChapter] = useState(JEE_SYLLABUS.Physics[0]);
  const [attempted, setAttempted] = useState('');
  const [correct, setCorrect] = useState('');
  
  // Mock form states
  const [mockName, setMockName] = useState('');
  const [mockPhy, setMockPhy] = useState('');
  const [mockChem, setMockChem] = useState('');
  const [mockMath, setMockMath] = useState('');

  // Data editor states
  const [records, setRecords] = useState({ progress: [], mocks: [] });
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({}); // Holds temp data while editing

  const fetchRecords = async () => {
    const pSnap = await getDocs(query(collection(db, 'progress'), orderBy('timestamp', 'desc')));
    const mSnap = await getDocs(query(collection(db, 'mockMarks'), orderBy('createdAt', 'desc')));

    setRecords({
      progress: pSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      mocks: mSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    });
  };

  useEffect(() => {
    if (activeTab === 'manage') fetchRecords();
  }, [activeTab]);

  const handleLogProgress = async (e) => {
    e.preventDefault();
    if (Number(correct) > Number(attempted)) return alert("Correct answers can't exceed attempted!");
    
    setLoading(true);
    await addDoc(collection(db, 'progress'), {
      userId: user, subject, chapter,
      questionsSolved: Number(attempted), 
      correctAnswers: Number(correct),
      timestamp: new Date()
    });
    setAttempted(''); setCorrect(''); setLoading(false);
    alert('Practice logged with accuracy!');
  };

  const handleSaveMock = async (e) => {
    e.preventDefault();
    const p = Number(mockPhy), c = Number(mockChem), m = Number(mockMath);
    if (p > 100 || c > 100 || m > 100) return alert('Max 100 per subject.');

    setLoading(true);
    await addDoc(collection(db, 'mockMarks'), {
      userId: user, examName: mockName,
      phyScore: p, chemScore: c, mathScore: m,
      score: p + c + m,
      createdAt: new Date()
    });
    setMockName(''); setMockPhy(''); setMockChem(''); setMockMath('');
    setLoading(false);
    alert('Mock test saved!');
  };

  // --- DATA MANAGEMENT FUNCTIONS ---

  const handleDelete = async (collectionName, id) => {
    if (confirm('Are you sure you want to permanently delete this record?')) {
      await deleteDoc(doc(db, collectionName, id));
      fetchRecords(); // Refresh the list
    }
  };

  const startEditing = (record, type) => {
    setEditingId(record.id);
    if (type === 'progress') {
      setEditData({ attempted: record.questionsSolved, correct: record.correctAnswers });
    } else {
      setEditData({ examName: record.examName, phy: record.phyScore, chem: record.chemScore, math: record.mathScore });
    }
  };

  const saveEdit = async (collectionName, id, type) => {
    try {
      if (type === 'progress') {
        if (Number(editData.correct) > Number(editData.attempted)) return alert("Correct can't exceed attempted!");
        await updateDoc(doc(db, collectionName, id), {
          questionsSolved: Number(editData.attempted),
          correctAnswers: Number(editData.correct)
        });
      } else {
        const p = Number(editData.phy), c = Number(editData.chem), m = Number(editData.math);
        await updateDoc(doc(db, collectionName, id), {
          examName: editData.examName,
          phyScore: p, chemScore: c, mathScore: m,
          score: p + c + m
        });
      }
      setEditingId(null);
      fetchRecords();
    } catch (err) {
      alert("Error updating record: " + err.message);
    }
  };

  const exportCSV = () => {
    let csv = "Type,User,Subject,Chapter/Exam,Score/Questions,Accuracy,Date\n";
    records.progress.forEach(r => {
      const date = r.timestamp?.toDate ? r.timestamp.toDate().toLocaleDateString() : 'N/A';
      const acc = r.correctAnswers ? ((r.correctAnswers/r.questionsSolved)*100).toFixed(1) : 100;
      csv += `Practice,${r.userId},${r.subject},${r.chapter},${r.questionsSolved},${acc}%,${date}\n`;
    });
    records.mocks.forEach(m => {
      const date = m.createdAt?.toDate ? m.createdAt.toDate().toLocaleDateString() : 'N/A';
      csv += `Mock,${m.userId},All,${m.examName},${m.score}/300,N/A,${date}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'study_data.csv'; a.click();
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 border-b border-ctp-surface1 pb-4">
        <Shield className="text-ctp-mauve" size={32} />
        <h1 className="text-2xl font-bold text-ctp-text">Admin Control</h1>
      </div>

      <div className="flex flex-wrap gap-2">
        {['progress', 'mock', 'manage'].map(tab => (
          <button key={tab} onClick={() => { setActiveTab(tab); setEditingId(null); }} className={`px-4 py-2 rounded-lg text-sm font-medium transition capitalize ${activeTab === tab ? 'bg-ctp-mauve text-ctp-crust' : 'bg-ctp-surface0 text-ctp-subtext0'}`}>
            {tab}
          </button>
        ))}
      </div>

      <div className="bg-ctp-surface0 p-6 rounded-2xl border border-ctp-surface1">
        {activeTab === 'manage' ? (
          <div className="space-y-8">
            <button onClick={exportCSV} className="bg-ctp-blue text-ctp-crust px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:opacity-90 transition">
              <Download size={16}/> Export as CSV
            </button>

            {/* PROGRESS LOGS EDITOR */}
            <div>
              <h2 className="text-lg font-bold text-ctp-lavender mb-3 border-b border-ctp-surface1 pb-2">Practice Logs</h2>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                {records.progress.map(p => (
                  <div key={p.id} className="flex items-center justify-between bg-ctp-base p-3 rounded-lg border border-ctp-surface1 text-sm">
                    {editingId === p.id ? (
                      <div className="flex-1 grid grid-cols-2 gap-2 mr-4">
                        <div>
                          <label className="text-[10px] text-ctp-subtext0">Attempted</label>
                          <input type="number" value={editData.attempted} onChange={e => setEditData({...editData, attempted: e.target.value})} className="w-full bg-ctp-surface0 p-1.5 rounded border border-ctp-surface1 text-xs" />
                        </div>
                        <div>
                          <label className="text-[10px] text-ctp-subtext0">Correct</label>
                          <input type="number" value={editData.correct} onChange={e => setEditData({...editData, correct: e.target.value})} className="w-full bg-ctp-surface0 p-1.5 rounded border border-ctp-surface1 text-xs" />
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1">
                        <p className="font-bold text-ctp-text">
                          <span className={p.userId === 'user1' ? 'text-ctp-blue' : 'text-ctp-green'}>
                            {p.userId === 'user1' ? 'Sharaan' : 'Anadi'}
                          </span>
                          <span className="mx-2 text-ctp-subtext0">|</span> 
                          {p.chapter}
                        </p>
                        <p className="text-xs text-ctp-subtext1">Att: {p.questionsSolved} | Cor: {p.correctAnswers}</p>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-3">
                      {editingId === p.id ? (
                        <>
                          <button onClick={() => saveEdit('progress', p.id, 'progress')} className="text-ctp-green hover:opacity-80"><Save size={18}/></button>
                          <button onClick={() => setEditingId(null)} className="text-ctp-subtext0 hover:opacity-80"><X size={18}/></button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEditing(p, 'progress')} className="text-ctp-yellow hover:opacity-80"><Edit2 size={16}/></button>
                          <button onClick={() => handleDelete('progress', p.id)} className="text-ctp-red hover:opacity-80"><Trash2 size={16}/></button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* MOCK LOGS EDITOR */}
            <div>
              <h2 className="text-lg font-bold text-ctp-lavender mb-3 border-b border-ctp-surface1 pb-2">Mock Exams</h2>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                {records.mocks.map(m => (
                  <div key={m.id} className="flex flex-col md:flex-row md:items-center justify-between bg-ctp-base p-3 rounded-lg border border-ctp-surface1 text-sm gap-4">
                    {editingId === m.id ? (
                      <div className="flex-1 space-y-2">
                        <input type="text" value={editData.examName} onChange={e => setEditData({...editData, examName: e.target.value})} className="w-full bg-ctp-surface0 p-1.5 rounded border border-ctp-surface1 text-xs" />
                        <div className="grid grid-cols-3 gap-2">
                          <input type="number" placeholder="P" value={editData.phy} onChange={e => setEditData({...editData, phy: e.target.value})} className="w-full bg-ctp-surface0 p-1.5 rounded border border-ctp-surface1 text-xs" />
                          <input type="number" placeholder="C" value={editData.chem} onChange={e => setEditData({...editData, chem: e.target.value})} className="w-full bg-ctp-surface0 p-1.5 rounded border border-ctp-surface1 text-xs" />
                          <input type="number" placeholder="M" value={editData.math} onChange={e => setEditData({...editData, math: e.target.value})} className="w-full bg-ctp-surface0 p-1.5 rounded border border-ctp-surface1 text-xs" />
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1">
                        <p className="font-bold text-ctp-text">
                          <span className={m.userId === 'user1' ? 'text-ctp-blue' : 'text-ctp-green'}>
                            {m.userId === 'user1' ? 'Sharaan' : 'Anadi'}
                          </span>
                          <span className="mx-2 text-ctp-subtext0">|</span> 
                          {m.examName}
                        </p>
                        <p className="text-xs text-ctp-subtext1">Total: {m.score}/300 (P:{m.phyScore} C:{m.chemScore} M:{m.mathScore})</p>
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      {editingId === m.id ? (
                        <>
                          <button onClick={() => saveEdit('mockMarks', m.id, 'mock')} className="text-ctp-green hover:opacity-80"><Save size={18}/></button>
                          <button onClick={() => setEditingId(null)} className="text-ctp-subtext0 hover:opacity-80"><X size={18}/></button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEditing(m, 'mock')} className="text-ctp-yellow hover:opacity-80"><Edit2 size={16}/></button>
                          <button onClick={() => handleDelete('mockMarks', m.id)} className="text-ctp-red hover:opacity-80"><Trash2 size={16}/></button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        ) : (
          <form onSubmit={activeTab === 'progress' ? handleLogProgress : handleSaveMock} className="space-y-4">
            <select value={user} onChange={(e) => setUser(e.target.value)} className="w-full bg-ctp-base p-2.5 rounded-lg border border-ctp-surface1 text-ctp-text outline-none text-sm">
              <option value="user1">Sharaan</option><option value="user2">Anadi</option>
            </select>

            {activeTab === 'progress' && (
              <>
                <select value={subject} onChange={(e) => { setSubject(e.target.value); setChapter(JEE_SYLLABUS[e.target.value][0])}} className="w-full bg-ctp-base p-2.5 rounded-lg border border-ctp-surface1 outline-none text-sm"><option value="Physics">Physics</option><option value="Chemistry">Chemistry</option><option value="Mathematics">Mathematics</option></select>
                <select value={chapter} onChange={(e) => setChapter(e.target.value)} className="w-full bg-ctp-base p-2.5 rounded-lg border border-ctp-surface1 outline-none text-sm">{JEE_SYLLABUS[subject].map(c => <option key={c}>{c}</option>)}</select>
                <div className="grid grid-cols-2 gap-4">
                  <input type="number" placeholder="Attempted (e.g. 50)" value={attempted} onChange={e => setAttempted(e.target.value)} className="w-full bg-ctp-base p-2.5 rounded border border-ctp-surface1 text-ctp-text" required />
                  <input type="number" placeholder="Correct (e.g. 42)" value={correct} onChange={e => setCorrect(e.target.value)} className="w-full bg-ctp-base p-2.5 rounded border border-ctp-surface1 text-ctp-text" required />
                </div>
              </>
            )}

            {activeTab === 'mock' && (
              <>
                <input type="text" placeholder="Mock Exam Name" value={mockName} onChange={e => setMockName(e.target.value)} className="w-full bg-ctp-base p-2.5 rounded border border-ctp-surface1 text-ctp-text" required />
                <div className="grid grid-cols-3 gap-2">
                  <input type="number" placeholder="Phy /100" value={mockPhy} onChange={e => setMockPhy(e.target.value)} className="bg-ctp-base p-2 rounded border border-ctp-surface1 text-ctp-text" required />
                  <input type="number" placeholder="Chem /100" value={mockChem} onChange={e => setMockChem(e.target.value)} className="bg-ctp-base p-2 rounded border border-ctp-surface1 text-ctp-text" required />
                  <input type="number" placeholder="Math /100" value={mockMath} onChange={e => setMockMath(e.target.value)} className="bg-ctp-base p-2 rounded border border-ctp-surface1 text-ctp-text" required />
                </div>
              </>
            )}
            <button type="submit" disabled={loading} className="w-full bg-ctp-mauve text-ctp-crust font-semibold py-2.5 rounded-lg hover:opacity-90">Submit</button>
          </form>
        )}
      </div>
    </div>
  );
}
