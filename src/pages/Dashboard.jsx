import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, onSnapshot, query, orderBy, setDoc, doc, addDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { JEE_SYLLABUS } from '../data/jeeChapters';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { ArrowLeft, Clock, Flame, Target, Swords, BrainCircuit, BellOff, CheckCircle2, BookOpen } from 'lucide-react';

const JEE_TARGET = new Date('2027-01-20T00:00:00'); // 110 days logic
const TARGET_QS_PER_CHAPTER = 60; 
const ACCURACY_THRESHOLD = 75;

const names = { user1: 'Sharaan', user2: 'Anadi' };

export default function Dashboard() {
  const { userId } = useParams();
  const [progressData, setProgressData] = useState([]);
  const [mockScores, setMockScores] = useState([]);
  const [snoozedData, setSnoozedData] = useState({});
  const [completedChapters, setCompletedChapters] = useState([]);

  // States for marking chapter complete
  const [compSubject, setCompSubject] = useState('Physics');
  const [compChapter, setCompChapter] = useState(JEE_SYLLABUS.Physics[0]);

  useEffect(() => {
    const unsubP = onSnapshot(collection(db, 'progress'), s => setProgressData(s.docs.map(d => d.data())));
    const unsubM = onSnapshot(query(collection(db, 'mockMarks'), orderBy('createdAt', 'asc')), s => setMockScores(s.docs.map(d => d.data())));
    const unsubC = onSnapshot(collection(db, 'completedChapters'), s => setCompletedChapters(s.docs.map(d => d.data())));
    const unsubS = onSnapshot(collection(db, 'chapterMeta'), s => {
      const snoozed = {};
      s.docs.forEach(d => { snoozed[d.id] = d.data(); });
      setSnoozedData(snoozed);
    });
    return () => { unsubP(); unsubM(); unsubC(); unsubS(); };
  }, []);

  const daysLeft = Math.max(0, Math.ceil((JEE_TARGET - new Date()) / 86400000));
  const dynamicStalenessThreshold = daysLeft < 50 ? 7 : 14;

  const completedSet = useMemo(() => {
    return new Set(completedChapters.filter(c => c.userId === userId).map(c => c.chapter));
  }, [completedChapters, userId]);

  const handleSnooze = async (chapter, days) => {
    const delayUntil = new Date();
    delayUntil.setDate(delayUntil.getDate() + days);
    await setDoc(doc(db, 'chapterMeta', `${userId}_${chapter.replace(/\s+/g, '')}`), {
      userId, chapter, delayUntil: delayUntil.getTime()
    });
  };

  const handleMarkComplete = async (e) => {
    e.preventDefault();
    if (completedSet.has(compChapter)) return alert('Chapter is already marked as completed!');
    
    await addDoc(collection(db, 'completedChapters'), {
      userId,
      subject: compSubject,
      chapter: compChapter,
      completedAt: new Date()
    });
    alert(`${compChapter} marked as completed and added to revision queue!`);
  };

  // 1. COMPETITIVE STREAK
  const competitiveStreak = useMemo(() => {
    const dailyTotals = {};
    progressData.forEach(p => {
      const d = p.timestamp?.toDate ? p.timestamp.toDate().toISOString().split('T')[0] : null;
      if (!d) return;
      if (!dailyTotals[d]) dailyTotals[d] = { user1: 0, user2: 0 };
      dailyTotals[d][p.userId] += p.questionsSolved;
    });

    const dates = Object.keys(dailyTotals).sort((a, b) => b.localeCompare(a));
    let streak = 0;
    for (let d of dates) {
      const t = dailyTotals[d];
      if (t.user1 === 0 && t.user2 === 0) continue;
      const winner = t.user1 > t.user2 ? 'user1' : (t.user2 > t.user1 ? 'user2' : 'tie');
      if (winner === userId) streak++;
      else if (winner !== 'tie') break; 
    }
    return streak;
  }, [progressData, userId]);

  const weeklyHeadToHead = useMemo(() => {
    let u1 = 0, u2 = 0;
    const sun = new Date(); sun.setDate(sun.getDate() - sun.getDay()); sun.setHours(0,0,0,0);
    progressData.forEach(p => {
      const d = p.timestamp?.toDate ? p.timestamp.toDate() : new Date(p.timestamp);
      if (d >= sun) {
        if (p.userId === 'user1') u1 += p.questionsSolved;
        if (p.userId === 'user2') u2 += p.questionsSolved;
      }
    });
    return { user1: u1, user2: u2, target: 350 };
  }, [progressData]);

  // 2. ADVANCED CS ALGORITHM (Only evaluates explicitly completed chapters)
  const actionableChapters = useMemo(() => {
    const stats = {};
    progressData.filter(p => p.userId === userId).forEach(p => {
      if (!stats[p.chapter]) stats[p.chapter] = { att: 0, cor: 0, last: 0 };
      stats[p.chapter].att += p.questionsSolved;
      stats[p.chapter].cor += (p.correctAnswers || p.questionsSolved);
      const t = p.timestamp?.toDate ? p.timestamp.toDate().getTime() : new Date(p.timestamp).getTime();
      if (t > stats[p.chapter].last) stats[p.chapter].last = t;
    });

    const now = Date.now();
    const actions = [];

    // ONLY evaluate chapters marked as completed
    Array.from(completedSet).forEach(chap => {
      const metaId = `${userId}_${chap.replace(/\s+/g, '')}`;
      const snoozeData = snoozedData[metaId];
      if (snoozeData && snoozeData.delayUntil > now) return;

      const s = stats[chap] || { att: 0, cor: 0, last: 0 };
      const acc = s.att > 0 ? (s.cor / s.att) * 100 : 0;
      const daysSince = s.last === 0 ? Infinity : (now - s.last) / 86400000;
      
      let minQs = 0;
      let tags = [];
      let weight = 0;

      // Rule 1: Freshly Completed (0 Questions Solved ever)
      if (s.att === 0) {
        minQs = TARGET_QS_PER_CHAPTER;
        tags.push('Initial Practice');
        weight += 100 + (110 - daysLeft); 
      }
      // Rule 2: Low Volume overall
      else if (s.att < TARGET_QS_PER_CHAPTER) {
        minQs += (TARGET_QS_PER_CHAPTER - s.att);
        tags.push('Low Volume');
        weight += 50;
      }

      // Rule 3: Accuracy Struggling
      if (s.att > 10 && acc < ACCURACY_THRESHOLD) {
        minQs = Math.max(minQs, 20); 
        tags.push('Low Accuracy');
        weight += (ACCURACY_THRESHOLD - acc) * 2;
      }

      // Rule 4: Spaced Repetition (Stale)
      if (daysSince > dynamicStalenessThreshold && s.att > 0) {
        minQs = Math.max(minQs, 15); 
        tags.push('Stale');
        weight += daysSince * 1.5;
      }

      if (minQs > 0) {
        actions.push({ chapter: chap, acc: acc.toFixed(0), minQs, tags, weight });
      }
    });

    return actions.sort((a,b) => b.weight - a.weight).slice(0, 4);
  }, [progressData, userId, snoozedData, daysLeft, dynamicStalenessThreshold, completedSet]);

  const mockChartData = mockScores.filter(m => m.userId === userId).map((m, i) => ({
    name: `Mock ${i+1}`,
    phy: m.phyScore || Math.floor(m.score/3),
    chem: m.chemScore || Math.floor(m.score/3),
    math: m.mathScore || Math.floor(m.score/3),
    total: m.score
  }));

  return (
    <div className="min-h-screen bg-ctp-crust text-ctp-text font-sans p-4 md:p-8 selection:bg-ctp-mauve selection:text-ctp-crust">
      
      <header className="max-w-6xl mx-auto flex items-center justify-between bg-ctp-base/60 backdrop-blur-xl p-4 md:px-6 rounded-3xl border border-ctp-surface0 shadow-sm mb-8 sticky top-4 z-50">
        <div className="flex items-center gap-4">
          <Link to="/" className="p-2 bg-ctp-surface0 hover:bg-ctp-surface1 rounded-full transition text-ctp-subtext0">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-ctp-lavender">{names[userId]}</h1>
            <p className="text-[11px] text-ctp-subtext0 font-medium uppercase tracking-wider">Mission Control</p>
          </div>
        </div>
        <div className="bg-gradient-to-r from-ctp-red to-ctp-peach text-ctp-crust font-black px-5 py-2 rounded-full text-xs flex items-center gap-2 shadow-lg shadow-ctp-red/20 tracking-wide">
          <Clock size={16}/> {daysLeft} DAYS LEFT
        </div>
      </header>

      <div className="max-w-6xl mx-auto space-y-6">
        {/* Gamification Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-ctp-base p-6 rounded-3xl border border-ctp-surface0 shadow-sm flex items-center justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-ctp-peach/5 rounded-full blur-2xl group-hover:bg-ctp-peach/10 transition duration-500"/>
            <div className="relative z-10">
              <p className="text-xs text-ctp-subtext0 font-bold uppercase tracking-wider mb-1">Dominance Streak</p>
              <p className="text-4xl font-black text-ctp-peach tracking-tighter">{competitiveStreak} <span className="text-base font-medium text-ctp-subtext0 tracking-normal">Days</span></p>
            </div>
            <Flame size={48} strokeWidth={1.5} className={`relative z-10 ${competitiveStreak > 0 ? 'text-ctp-peach' : 'text-ctp-surface2'}`} />
          </div>

          <div className="bg-ctp-base p-6 rounded-3xl border border-ctp-surface0 shadow-sm relative overflow-hidden">
            <div className="flex items-center gap-2 text-ctp-green mb-3"><Target size={18}/> <span className="text-xs font-bold uppercase tracking-wider">Weekly Output</span></div>
            <p className="text-3xl font-black tracking-tighter">{weeklyHeadToHead[userId]} <span className="text-lg font-medium text-ctp-subtext0">/ {weeklyHeadToHead.target}</span></p>
            <div className="w-full bg-ctp-surface0 h-2.5 mt-4 rounded-full overflow-hidden">
              <div className="bg-ctp-green h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${Math.min((weeklyHeadToHead[userId]/weeklyHeadToHead.target)*100, 100)}%` }} />
            </div>
          </div>

          <div className="bg-ctp-base p-6 rounded-3xl border border-ctp-surface0 shadow-sm">
             <div className="flex items-center gap-2 text-ctp-mauve mb-4"><Swords size={18}/> <span className="text-xs font-bold uppercase tracking-wider">Head to Head</span></div>
             <div className="flex justify-between items-center">
               <div className="text-center bg-ctp-surface0/50 px-4 py-2 rounded-2xl">
                 <p className="text-2xl font-black text-ctp-blue">{weeklyHeadToHead.user1}</p>
                 <p className="text-[10px] text-ctp-subtext0 uppercase font-bold tracking-wider">Sharaan</p>
               </div>
               <p className="text-xs font-black text-ctp-surface2 bg-ctp-surface0 px-2 py-1 rounded-full">VS</p>
               <div className="text-center bg-ctp-surface0/50 px-4 py-2 rounded-2xl">
                 <p className="text-2xl font-black text-ctp-green">{weeklyHeadToHead.user2}</p>
                 <p className="text-[10px] text-ctp-subtext0 uppercase font-bold tracking-wider">Anadi</p>
               </div>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: Smart Queue & Marking Complete */}
          <div className="col-span-1 flex flex-col gap-6">
            
            {/* Mark Complete Tool */}
            <div className="bg-ctp-base p-6 rounded-3xl border border-ctp-surface0 shadow-sm">
              <div className="flex items-center gap-2 text-ctp-green mb-2">
                <BookOpen size={20}/> 
                <h2 className="font-bold text-base tracking-tight">Log Completed Chapter</h2>
              </div>
              <p className="text-xs text-ctp-subtext0 mb-4 leading-relaxed">Mark a chapter as finished to add it to your algorithmic revision queue.</p>
              
              <form onSubmit={handleMarkComplete} className="space-y-3">
                <select value={compSubject} onChange={(e) => { setCompSubject(e.target.value); setCompChapter(JEE_SYLLABUS[e.target.value][0]); }} className="w-full bg-ctp-surface0 p-2.5 rounded-xl border border-ctp-surface1 text-xs outline-none">
                  <option value="Physics">Physics</option>
                  <option value="Chemistry">Chemistry</option>
                  <option value="Mathematics">Mathematics</option>
                </select>
                <select value={compChapter} onChange={(e) => setCompChapter(e.target.value)} className="w-full bg-ctp-surface0 p-2.5 rounded-xl border border-ctp-surface1 text-xs outline-none">
                  {JEE_SYLLABUS[compSubject].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <button type="submit" className="w-full bg-ctp-green text-ctp-crust font-bold py-2.5 rounded-xl hover:opacity-90 transition text-sm">
                  Mark as Completed
                </button>
              </form>
            </div>

            {/* Smart Queue Algorithm */}
            <div className="bg-ctp-base p-6 rounded-3xl border border-ctp-surface0 shadow-sm flex-1 flex flex-col">
              <div className="flex items-center gap-2 text-ctp-red mb-2">
                <BrainCircuit size={20}/> 
                <h2 className="font-bold text-base tracking-tight">Smart Queue</h2>
              </div>
              <p className="text-xs text-ctp-subtext0 mb-5 leading-relaxed">Algorithm analyzes your completed chapters for weakness & staleness.</p>
              
              <div className="space-y-3 flex-1">
                {actionableChapters.map((w, i) => (
                  <div key={i} className="bg-ctp-surface0/50 hover:bg-ctp-surface0 transition p-4 rounded-2xl border border-ctp-surface0/50 group">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-sm font-bold text-ctp-text line-clamp-1 pr-2">{w.chapter}</p>
                      <span className="shrink-0 text-[10px] font-bold px-2 py-1 bg-ctp-red/10 text-ctp-red rounded-lg">{w.acc}% Acc</span>
                    </div>
                    
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {w.tags.map(t => <span key={t} className="text-[9px] uppercase tracking-wider font-bold text-ctp-subtext0 bg-ctp-crust px-1.5 py-0.5 rounded-md">{t}</span>)}
                    </div>

                    <div className="flex items-center justify-between border-t border-ctp-surface0 pt-3 mt-1">
                      <div className="flex items-center gap-1.5 text-ctp-green text-xs font-bold">
                        <CheckCircle2 size={14} /> Solve {w.minQs} Qs to clear
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => handleSnooze(w.chapter, 1)} className="p-1.5 hover:bg-ctp-surface1 rounded-lg text-ctp-subtext0 transition tooltip" title="Snooze 1 Day"><BellOff size={14}/></button>
                        <button onClick={() => handleSnooze(w.chapter, 7)} className="p-1.5 hover:bg-ctp-surface1 rounded-lg text-ctp-subtext0 transition tooltip" title="Snooze 1 Week"><span className="text-[10px] font-bold">7D</span></button>
                      </div>
                    </div>
                  </div>
                ))}
                
                {actionableChapters.length === 0 && completedSet.size > 0 && (
                  <div className="h-full min-h-[150px] flex flex-col items-center justify-center text-ctp-subtext0 p-6 text-center border-2 border-dashed border-ctp-surface0 rounded-2xl">
                    <Target size={32} className="mb-2 text-ctp-green opacity-50"/>
                    <p className="text-sm font-bold text-ctp-green">Queue Clear!</p>
                    <p className="text-xs mt-1">You have mastered all your completed chapters.</p>
                  </div>
                )}
                
                {completedSet.size === 0 && (
                  <div className="h-full min-h-[150px] flex flex-col items-center justify-center text-ctp-subtext0 p-6 text-center border-2 border-dashed border-ctp-surface0 rounded-2xl">
                    <BookOpen size={32} className="mb-2 text-ctp-subtext0 opacity-50"/>
                    <p className="text-sm font-bold text-ctp-text">No Chapters Yet</p>
                    <p className="text-xs mt-1">Mark a chapter as completed above to start the algorithm.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Analytics */}
          <div className="col-span-1 lg:col-span-2 bg-ctp-base p-6 rounded-3xl border border-ctp-surface0 shadow-sm flex flex-col h-full min-h-[450px]">
            <div className="mb-6">
              <h2 className="font-bold text-lg tracking-tight mb-1">Performance Trajectory</h2>
              <p className="text-xs text-ctp-subtext0">Subject-wise mock score composition out of 300.</p>
            </div>
            
            <div className="flex-1 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mockChartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} barSize={32}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#313244" vertical={false} opacity={0.5} />
                  <XAxis dataKey="name" stroke="#7f849c" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="#7f849c" fontSize={11} tickLine={false} axisLine={false} domain={[0, 300]} />
                  <Tooltip 
                    cursor={{ fill: '#313244', opacity: 0.2 }} 
                    contentStyle={{ backgroundColor: '#1e1e2e', borderRadius: '16px', border: '1px solid #313244', color: '#cdd6f4', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.3)' }} 
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '20px', fontWeight: '500' }} iconType="circle" />
                  <Bar dataKey="phy" stackId="a" fill="#89b4fa" name="Physics" />
                  <Bar dataKey="chem" stackId="a" fill="#f9e2af" name="Chemistry" />
                  <Bar dataKey="math" stackId="a" fill="#a6e3a1" name="Maths" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
