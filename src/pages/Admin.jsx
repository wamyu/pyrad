import { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { JEE_SYLLABUS } from '../data/jeeChapters';
import { Shield, PlusCircle, Award, CheckCircle2, Trash2, Database } from 'lucide-react';

export default function Admin() {
  const [activeTab, setActiveTab] = useState('progress');
  const [loading, setLoading] = useState(false);

  // States
  const [selectedUser, setSelectedUser] = useState('user1');
  const [subject, setSubject] = useState('Physics');
  const [selectedChapter, setSelectedChapter] = useState(JEE_SYLLABUS.Physics[0]);
  const [questionsSolved, setQuestionsSolved] = useState('');
  
  const [mockUser, setMockUser] = useState('user1');
  const [mockName, setMockName] = useState('');
  const [mockScore, setMockScore] = useState('');
  const [mockSyllabus, setMockSyllabus] = useState('');

  const [logs, setLogs] = useState({ progress: [], mocks: [], completed: [] });

  const handleSubjectChange = (newSub) => {
    setSubject(newSub);
    setSelectedChapter(JEE_SYLLABUS[newSub][0]);
  };

  const fetchDataLogs = async () => {
    const pSnap = await getDocs(query(collection(db, 'progress'), orderBy('timestamp', 'desc')));
    const mSnap = await getDocs(query(collection(db, 'mockMarks'), orderBy('createdAt', 'desc')));
    const cSnap = await getDocs(collection(db, 'completedChapters'));
    
    setLogs({
      progress: pSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      mocks: mSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      completed: cSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    });
  };

  useEffect(() => {
    if (activeTab === 'manage') fetchDataLogs();
  }, [activeTab]);

  const handleDelete = async (collectionName, id) => {
    if (confirm('Delete this record forever?')) {
      await deleteDoc(doc(db, collectionName, id));
      fetchDataLogs();
    }
  };

  const handleLogProgress = async (e) => {
    e.preventDefault();
    setLoading(true);
    await addDoc(collection(db, 'progress'), {
      userId: selectedUser, subject, chapter: selectedChapter,
      questionsSolved: Number(questionsSolved), timestamp: new Date()
    });
    setQuestionsSolved('');
    setLoading(false);
    alert('Logged!');
  };

  const handleAddMock = async (e) => {
    e.preventDefault();
    setLoading(true);
    await addDoc(collection(db, 'mockMarks'), {
      userId: mockUser, examName: mockName, score: Number(mockScore),
      syllabus: mockSyllabus, createdAt: new Date()
    });
    setMockName(''); setMockScore(''); setMockSyllabus('');
    setLoading(false);
    alert('Mock Saved!');
  };

  const handleCompleteChapter = async (e) => {
    e.preventDefault();
    setLoading(true);
    await addDoc(collection(db, 'completedChapters'), {
      userId: selectedUser, subject, chapter: selectedChapter, completedAt: new Date()
    });
    setLoading(false);
    alert('Chapter Marked Complete!');
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 border-b border-ctp-surface1 pb-4">
        <Shield className="text-ctp-mauve" size={32} />
        <h1 className="text-2xl font-bold text-ctp-text">Admin Panel</h1>
      </div>

      <div className="flex flex-wrap gap-2">
        {['progress', 'mock', 'complete', 'manage'].map((tab) => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition capitalize ${activeTab === tab ? 'bg-ctp-mauve text-ctp-crust' : 'bg-ctp-surface0 text-ctp-subtext0'}`}
          >
            {tab === 'complete' ? 'Complete Chapter' : tab === 'manage' ? 'Manage Data' : `${tab} Log`}
          </button>
        ))}
      </div>

      <div className="bg-ctp-surface0 p-6 rounded-2xl border border-ctp-surface1">
        {activeTab === 'manage' ? (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-ctp-red flex items-center gap-2"><Database size={18}/> Data Editor</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-ctp-base p-4 rounded-xl h-64 overflow-y-auto">
                <h3 className="font-semibold mb-2 text-ctp-blue">Mock Exams</h3>
                {logs.mocks.map(m => (
                  <div key={m.id} className="flex justify-between p-2 border-b border-ctp-surface1 text-xs">
                    <span>{m.userId} - {m.examName} ({m.score}/300)</span>
                    <button onClick={() => handleDelete('mockMarks', m.id)} className="text-ctp-red"><Trash2 size={14}/></button>
                  </div>
                ))}
              </div>
              <div className="bg-ctp-base p-4 rounded-xl h-64 overflow-y-auto">
                <h3 className="font-semibold mb-2 text-ctp-green">Completed Chapters</h3>
                {logs.completed.map(c => (
                  <div key={c.id} className="flex justify-between p-2 border-b border-ctp-surface1 text-xs">
                    <span>{c.userId} - {c.chapter}</span>
                    <button onClick={() => handleDelete('completedChapters', c.id)} className="text-ctp-red"><Trash2 size={14}/></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={activeTab === 'progress' ? handleLogProgress : activeTab === 'mock' ? handleAddMock : handleCompleteChapter} className="space-y-4">
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-ctp-subtext0 mb-1 block">Candidate</label>
                <select value={activeTab === 'mock' ? mockUser : selectedUser} onChange={(e) => activeTab === 'mock' ? setMockUser(e.target.value) : setSelectedUser(e.target.value)} className="w-full bg-ctp-base p-2.5 rounded-lg border border-ctp-surface1 outline-none text-sm">
                  <option value="user1">User 1</option><option value="user2">User 2</option>
                </select>
              </div>
              
              {activeTab !== 'mock' && (
                <div>
                  <label className="text-xs text-ctp-subtext0 mb-1 block">Subject</label>
                  <select value={subject} onChange={(e) => handleSubjectChange(e.target.value)} className="w-full bg-ctp-base p-2.5 rounded-lg border border-ctp-surface1 outline-none text-sm">
                    <option value="Physics">Physics</option><option value="Chemistry">Chemistry</option><option value="Mathematics">Mathematics</option>
                  </select>
                </div>
              )}
            </div>

            {activeTab !== 'mock' && (
              <div>
                <label className="text-xs text-ctp-subtext0 mb-1 block">Chapter</label>
                <select value={selectedChapter} onChange={(e) => setSelectedChapter(e.target.value)} className="w-full bg-ctp-base p-2.5 rounded-lg border border-ctp-surface1 outline-none text-sm">
                  {JEE_SYLLABUS[subject].map(chap => <option key={chap} value={chap}>{chap}</option>)}
                </select>
              </div>
            )}

            {activeTab === 'progress' && (
              <input type="number" placeholder="Questions Solved Today" value={questionsSolved} onChange={(e) => setQuestionsSolved(e.target.value)} className="w-full bg-ctp-base p-2.5 rounded-lg border border-ctp-surface1 outline-none text-sm" required />
            )}

            {activeTab === 'mock' && (
              <>
                <input type="text" placeholder="Mock Exam Name" value={mockName} onChange={(e) => setMockName(e.target.value)} className="w-full bg-ctp-base p-2.5 rounded-lg border border-ctp-surface1 outline-none text-sm" required />
                <input type="number" placeholder="Score (Out of 300)" value={mockScore} onChange={(e) => setMockScore(e.target.value)} className="w-full bg-ctp-base p-2.5 rounded-lg border border-ctp-surface1 outline-none text-sm" required />
                <textarea placeholder="Chapters Included (e.g. Kinematics, Atomic Structure)" value={mockSyllabus} onChange={(e) => setMockSyllabus(e.target.value)} className="w-full bg-ctp-base p-2.5 rounded-lg border border-ctp-surface1 outline-none text-sm h-20" required />
              </>
            )}

            <button type="submit" disabled={loading} className="w-full bg-ctp-mauve text-ctp-crust font-semibold py-2.5 rounded-lg hover:opacity-90">
              Save Entry
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
