import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { JEE_SYLLABUS } from '../data/jeeChapters';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid 
} from 'recharts';
import { ArrowLeft, Clock, Layers, Calendar, BarChart2, ChevronDown, ChevronUp } from 'lucide-react';

const JEE_TARGET = new Date('2026-01-20T00:00:00');

export default function Dashboard() {
  const { userId } = useParams();
  const [progressData, setProgressData] = useState([]);
  const [mockScores, setMockScores] = useState([]);
  const [completedChapters, setCompletedChapters] = useState([]);
  
  const [graphMode, setGraphMode] = useState('weekly');
  const [selectedSubject, setSelectedSubject] = useState('Physics');
  const [selectedChapter, setSelectedChapter] = useState(JEE_SYLLABUS.Physics[0]);
  const [expandedMockId, setExpandedMockId] = useState(null);

  useEffect(() => {
    const unsubP = onSnapshot(collection(db, 'progress'), s => setProgressData(s.docs.map(d => d.data())));
    const unsubM = onSnapshot(query(collection(db, 'mockMarks'), orderBy('createdAt', 'asc')), s => {
      setMockScores(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubC = onSnapshot(collection(db, 'completedChapters'), s => setCompletedChapters(s.docs.map(d => d.data())));

    return () => { unsubP(); unsubM(); unsubC(); };
  }, []);

  // Countdown to 20 Jan 2026
  const daysLeft = useMemo(() => {
    const diff = JEE_TARGET - new Date();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, []);

  // Completion calculation (Only completed chapters reduce the percentage)
  const getSubjectStats = (subName) => {
    const total = subName === 'All' 
      ? Object.values(JEE_SYLLABUS).flat().length 
      : JEE_SYLLABUS[subName].length;

    const completed = new Set(
      completedChapters
        .filter(c => c.userId === userId && (subName === 'All' || c.subject === subName))
        .map(c => c.chapter)
    ).size;

    const remaining = Math.max(0, total - completed);
    const percentLeft = ((remaining / total) * 100).toFixed(1);

    return { total, remaining, percentLeft };
  };

  const overall = getSubjectStats('All');
  const phy = getSubjectStats('Physics');
  const chem = getSubjectStats('Chemistry');
  const math = getSubjectStats('Mathematics');

  // Weekly bar comparison
  const weeklyData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => ({ name: d, user1: 0, user2: 0 }));
    const sun = new Date();
    sun.setDate(sun.getDate() - sun.getDay());
    sun.setHours(0, 0, 0, 0);

    progressData.forEach(item => {
      const d = item.timestamp?.toDate ? item.timestamp.toDate() : new Date(item.timestamp);
      if (d >= sun) {
        if (item.userId === 'user1') days[d.getDay()].user1 += item.questionsSolved;
        if (item.userId === 'user2') days[d.getDay()].user2 += item.questionsSolved;
      }
    });
    return days;
  }, [progressData]);

  // Selected Chapter comparison
  const chapterData = useMemo(() => {
    let u1 = 0, u2 = 0;
    progressData.forEach(item => {
      if (item.chapter === selectedChapter) {
        if (item.userId === 'user1') u1 += item.questionsSolved;
        if (item.userId === 'user2') u2 += item.questionsSolved;
      }
    });
    return [{ name: selectedChapter, user1: u1, user2: u2 }];
  }, [progressData, selectedChapter]);

  // Mock list filtered for active user
  const userMocks = useMemo(() => {
    return mockScores
      .filter(m => m.userId === userId)
      .map((m, idx) => ({
        ...m,
        label: `Test ${idx + 1}`
      }));
  }, [mockScores, userId]);

  return (
    <div className="min-h-screen bg-ctp-base text-ctp-text p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="flex items-center justify-between border-b border-ctp-surface1 pb-4">
        <Link to="/" className="text-xs text-ctp-subtext0 hover:text-ctp-mauve flex items-center gap-1.5 transition">
          <ArrowLeft size={16} /> Switch User
        </Link>
        <div className="bg-ctp-red text-ctp-crust font-black px-4 py-1.5 rounded-full flex items-center gap-2 text-xs tracking-wide shadow-md">
          <Clock size={16} /> {daysLeft} DAYS UNTIL JEE MAIN (20 JAN 2026)
        </div>
      </div>

      {/* Completion Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-ctp-surface0 p-4 rounded-xl border border-ctp-surface1">
          <div className="flex items-center gap-2 text-ctp-mauve mb-2">
            <Layers size={18} />
            <span className="text-xs font-semibold">Total Remaining</span>
          </div>
          <p className="text-2xl font-black">{overall.percentLeft}%</p>
          <p className="text-[11px] text-ctp-subtext0">{overall.remaining} / {overall.total} chapters left</p>
        </div>

        <div className="bg-ctp-surface0 p-4 rounded-xl border border-ctp-surface1">
          <span className="text-xs font-semibold text-ctp-blue block mb-2">Physics</span>
          <p className="text-2xl font-black">{phy.percentLeft}%</p>
          <p className="text-[11px] text-ctp-subtext0">{phy.remaining} / {phy.total} chapters left</p>
        </div>

        <div className="bg-ctp-surface0 p-4 rounded-xl border border-ctp-surface1">
          <span className="text-xs font-semibold text-ctp-yellow block mb-2">Chemistry</span>
          <p className="text-2xl font-black">{chem.percentLeft}%</p>
          <p className="text-[11px] text-ctp-subtext0">{chem.remaining} / {chem.total} chapters left</p>
        </div>

        <div className="bg-ctp-surface0 p-4 rounded-xl border border-ctp-surface1">
          <span className="text-xs font-semibold text-ctp-green block mb-2">Mathematics</span>
          <p className="text-2xl font-black">{math.percentLeft}%</p>
          <p className="text-[11px] text-ctp-subtext0">{math.remaining} / {math.total} chapters left</p>
        </div>
      </div>

      {/* Practice Comparison Graph */}
      <div className="bg-ctp-surface0 p-6 rounded-2xl border border-ctp-surface1 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-ctp-text">Practice Comparison</h2>
            <p className="text-xs text-ctp-subtext0">User 1 vs User 2 Questions Solved</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setGraphMode('weekly')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium transition ${
                graphMode === 'weekly' ? 'bg-ctp-mauve text-ctp-crust' : 'bg-ctp-mantle text-ctp-subtext0'
              }`}
            >
              <Calendar size={14} /> Weekly
            </button>
            <button
              onClick={() => setGraphMode('chapter')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium transition ${
                graphMode === 'chapter' ? 'bg-ctp-mauve text-ctp-crust' : 'bg-ctp-mantle text-ctp-subtext0'
              }`}
            >
              <BarChart2 size={14} /> Filter by Chapter
            </button>
          </div>
        </div>

        {graphMode === 'chapter' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            <select
              value={selectedSubject}
              onChange={(e) => {
                setSelectedSubject(e.target.value);
                setSelectedChapter(JEE_SYLLABUS[e.target.value][0]);
              }}
              className="bg-ctp-base border border-ctp-surface1 text-xs text-ctp-text p-2.5 rounded-lg outline-none"
            >
              <option value="Physics">Physics</option>
              <option value="Chemistry">Chemistry</option>
              <option value="Mathematics">Mathematics</option>
            </select>

            <select
              value={selectedChapter}
              onChange={(e) => setSelectedChapter(e.target.value)}
              className="bg-ctp-base border border-ctp-surface1 text-xs text-ctp-text p-2.5 rounded-lg outline-none"
            >
              {JEE_SYLLABUS[selectedSubject].map(chap => (
                <option key={chap} value={chap}>{chap}</option>
              ))}
            </select>
          </div>
        )}

        <div className="h-64 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={graphMode === 'weekly' ? weeklyData : chapterData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#313244" vertical={false} />
              <XAxis dataKey="name" stroke="#a6adc8" fontSize={11} tickLine={false} />
              <YAxis stroke="#a6adc8" fontSize={11} tickLine={false} />
              <Tooltip 
                cursor={{ fill: '#313244', opacity: 0.4 }}
                contentStyle={{ backgroundColor: '#181825', borderRadius: '8px', border: '1px solid #45475a', color: '#cdd6f4' }} 
              />
              <Bar dataKey="user1" fill="#89b4fa" name="User 1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="user2" fill="#a6e3a1" name="User 2" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Mock Exam Separate Graph */}
      <div className="bg-ctp-surface0 p-6 rounded-2xl border border-ctp-surface1 space-y-4">
        <div>
          <h2 className="text-base font-bold text-ctp-text capitalize">{userId} Mock Exam Progression</h2>
          <p className="text-xs text-ctp-subtext0">Scores out of 300 over time</p>
        </div>

        {userMocks.length > 0 ? (
          <>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={userMocks} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#313244" vertical={false} />
                  <XAxis dataKey="label" stroke="#a6adc8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#a6adc8" fontSize={11} tickLine={false} domain={[0, 300]} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#181825', borderRadius: '8px', border: '1px solid #45475a', color: '#cdd6f4' }}
                    formatter={(val, name, item) => [`${val} / 300`, item.payload.examName]}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="score" 
                    stroke="#cba6f7" 
                    strokeWidth={3} 
                    dot={{ r: 5, fill: '#cba6f7' }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Mock Exam Details & Covered Chapters */}
            <div className="pt-4 border-t border-ctp-surface1 space-y-2">
              <p className="text-xs font-bold text-ctp-subtext0 uppercase">Test Details & Tested Chapters</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {userMocks.map((m) => (
                  <div key={m.id} className="bg-ctp-base p-3 rounded-lg border border-ctp-surface1 text-xs space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-ctp-mauve">{m.examName}</span>
                      <span className="font-extrabold text-ctp-text">{m.score} / 300</span>
                    </div>

                    <button 
                      type="button"
                      onClick={() => setExpandedMockId(expandedMockId === m.id ? null : m.id)}
                      className="text-[11px] text-ctp-blue flex items-center gap-1 hover:underline pt-1"
                    >
                      {expandedMockId === m.id ? <>Hide Syllabus <ChevronUp size={12} /></> : <>View Chapters Included <ChevronDown size={12} /></>}
                    </button>

                    {expandedMockId === m.id && (
                      <div className="pt-2 flex flex-wrap gap-1">
                        {m.chaptersCovered?.length > 0 ? (
                          m.chaptersCovered.map((c) => (
                            <span key={c} className="text-[10px] bg-ctp-surface0 px-2 py-0.5 rounded border border-ctp-surface1 text-ctp-subtext1">
                              {c}
                            </span>
                          ))
                        ) : (
                          <span className="text-[11px] text-ctp-subtext0">No specific chapters logged.</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <p className="text-xs text-ctp-subtext0 py-8 text-center">No mock tests recorded for this user yet.</p>
        )}
      </div>
    </div>
  );
}
