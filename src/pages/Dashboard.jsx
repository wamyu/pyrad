import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, onSnapshot, query, orderBy, setDoc, doc, addDoc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { JEE_SYLLABUS } from '../data/jeeChapters';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { ArrowLeft, Clock, Flame, Target, Swords, BrainCircuit, BellOff, CheckCircle2, BookOpen, Activity, Grid, PenTool, Edit3, TrendingUp, Crown, Timer } from 'lucide-react';

const JEE_TARGET = new Date('2027-01-20T00:00:00');
const TARGET_QS_PER_CHAPTER = 60; 
const ACCURACY_THRESHOLD = 75;
const names = { user1: 'Sharaan', user2: 'Anadi' };

export default function Dashboard() {
  const { userId } = useParams();
  
  const [progressData, setProgressData] = useState([]);
  const [mockScores, setMockScores] = useState([]);
  const [snoozedData, setSnoozedData] = useState({});
  const [completedChapters, setCompletedChapters] = useState([]);
  const [goals, setGoals] = useState({ user1: 350, user2: 350 });
  const [heatmapMax, setHeatmapMax] = useState(80);

  const [compSubject, setCompSubject] = useState('Physics');
  const [compChapter, setCompChapter] = useState(JEE_SYLLABUS.Physics[0]);
  const [newGoal, setNewGoal] = useState('');
  
  const [logSub, setLogSub] = useState('Physics');
  const [logChap, setLogChap] = useState(JEE_SYLLABUS.Physics[0]);
  const [logAtt, setLogAtt] = useState('');
  const [logCor, setLogCor] = useState('');
  const [logHours, setLogHours] = useState('');

  const [chartMode, setChartMode] = useState('weekly');
  const [chartSub, setChartSub] = useState('Physics');
  const [chartChap, setChartChap] = useState(JEE_SYLLABUS.Physics[0]);

  useEffect(() => {
    const unsubP = onSnapshot(collection(db, 'progress'), s => setProgressData(s.docs.map(d => d.data())));
    const unsubM = onSnapshot(query(collection(db, 'mockMarks'), orderBy('createdAt', 'asc')), s => setMockScores(s.docs.map(d => d.data())));
    const unsubC = onSnapshot(collection(db, 'completedChapters'), s => setCompletedChapters(s.docs.map(d => d.data())));
    const unsubS = onSnapshot(collection(db, 'chapterMeta'), s => {
      const snoozed = {}; s.docs.forEach(d => { snoozed[d.id] = d.data(); }); setSnoozedData(snoozed);
    });
    const unsubG = onSnapshot(collection(db, 'userGoals'), s => {
      const g = { user1: 350, user2: 350 };
      s.docs.forEach(d => { g[d.id] = d.data().weeklyTarget; });
      setGoals(g);
    });
    
    getDoc(doc(db, 'appSettings', 'general')).then(snap => {
      if(snap.exists() && snap.data().heatmapBlocks) setHeatmapMax(snap.data().heatmapBlocks);
    });

    return () => { unsubP(); unsubM(); unsubC(); unsubS(); unsubG(); };
  }, []);

  const daysLeft = Math.max(0, Math.ceil((JEE_TARGET - new Date()) / 86400000));
  const daysToWeekend = 6 - new Date().getDay(); 

  const completedSet = useMemo(() => new Set(completedChapters.filter(c => c.userId === userId).map(c => c.chapter)), [completedChapters, userId]);

  // Weekly Stats, Accuracy, and Dynamic Tug-of-War Points Algorithm
  const weeklyStats = useMemo(() => {
    let u1Att = 0, u1Cor = 0, u2Att = 0, u2Cor = 0, u1Hours = 0, u2Hours = 0;
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => ({ name: d, user1: 0, user2: 0 }));
    const sun = new Date(); sun.setDate(sun.getDate() - sun.getDay()); sun.setHours(0,0,0,0);
    
    progressData.forEach(p => {
      const d = p.timestamp?.toDate ? p.timestamp.toDate() : new Date(p.timestamp);
      if (d >= sun) {
        if (p.userId === 'user1') { 
          u1Att += p.questionsSolved; 
          u1Cor += p.correctAnswers || p.questionsSolved; 
          u1Hours += Number(p.studyHours || 0);
          days[d.getDay()].user1 += p.questionsSolved; 
        }
        if (p.userId === 'user2') { 
          u2Att += p.questionsSolved; 
          u2Cor += p.correctAnswers || p.questionsSolved; 
          u2Hours += Number(p.studyHours || 0);
          days[d.getDay()].user2 += p.questionsSolved; 
        }
      }
    });

    const u1Acc = u1Att ? (u1Cor / u1Att) * 100 : 0;
    const u2Acc = u2Att ? (u2Cor / u2Att) * 100 : 0;

    // Dynamic Algorithm: Points = Volume * (Accuracy / 50) ^ 1.5
    // Rewards high accuracy dynamically, penalizes guessing or low accuracy steeply.
    const u1Points = u1Att * Math.pow(Math.max(u1Acc, 10) / 50, 1.5);
    const u2Points = u2Att * Math.pow(Math.max(u2Acc, 10) / 50, 1.5);

    return {
      u1Vol: u1Att, u2Vol: u2Att,
      u1Acc: u1Acc.toFixed(1), u2Acc: u2Acc.toFixed(1),
      u1Hours, u2Hours,
      u1Points, u2Points,
      chartData: days
    };
  }, [progressData]);

  const chapterChartData = useMemo(() => {
    let u1 = 0, u2 = 0;
    progressData.forEach(p => {
      if (p.chapter === chartChap) {
        if (p.userId === 'user1') u1 += p.questionsSolved;
        if (p.userId === 'user2') u2 += p.questionsSolved;
      }
    });
    return [{ name: chartChap, user1: u1, user2: u2 }];
  }, [progressData, chartChap]);

  const activityFeed = useMemo(() => {
    const dayAgo = Date.now() - 86400000;
    let items = [];
    progressData.forEach(p => {
      const t = p.timestamp?.toDate ? p.timestamp.toDate().getTime() : 0;
      if (t > dayAgo) items.push({ id: Math.random(), type: 'practice', time: t, user: p.userId, text: `solved ${p.questionsSolved} Qs (${p.studyHours || 0}h) in ${p.chapter}` });
    });
    completedChapters.forEach(c => {
      const t = c.completedAt?.toDate ? c.completedAt.toDate().getTime() : 0;
      if (t > dayAgo) items.push({ id: Math.random(), type: 'complete', time: t, user: c.userId, text: `mastered ${c.chapter}` });
    });
    mockScores.forEach(m => {
      const t = m.createdAt?.toDate ? m.createdAt.toDate().getTime() : 0;
      if (t > dayAgo) items.push({ id: Math.random(), type: 'mock', time: t, user: m.userId, text: `scored ${m.score}/300 on ${m.examName}` });
    });
    return items.sort((a,b) => b.time - a.time);
  }, [progressData, completedChapters, mockScores]);

  const heatmapData = useMemo(() => {
    const res = [];
    ['Physics', 'Chemistry', 'Mathematics'].forEach(sub => {
      JEE_SYLLABUS[sub].forEach(chap => {
        res.push({ name: chap, subject: sub, done: completedSet.has(chap) });
      });
    });
    if (res.length > heatmapMax) return res.slice(0, heatmapMax);
    while (res.length < heatmapMax) {
      res.push({ name: 'Unassigned/Mock', subject: 'None', done: false, isPlaceholder: true });
    }
    return res;
  }, [completedSet, heatmapMax]);

  // Dominance Streak
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
      if (winner === userId) streak++; else if (winner !== 'tie') break; 
    }
    return streak;
  }, [progressData, userId]);

  // Daily Consistency Streak Bar
  const dailyStreak = useMemo(() => {
    const userDays = new Set();
    progressData.forEach(p => {
      if (p.userId === userId) {
        const d = p.timestamp?.toDate ? p.timestamp.toDate().toISOString().split('T')[0] : null;
        if (d) userDays.add(d);
      }
    });
    let streak = 0;
    let checkDate = new Date();
    for (let i = 0; i < 30; i++) {
      const dateStr = checkDate.toISOString().split('T')[0];
      if (userDays.has(dateStr)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else if (i === 0) {
        // Allow today to be missing if they haven't logged yet
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  }, [progressData, userId]);

  const actionableChapters = useMemo(() => {
    const stats = {};
    progressData.filter(p => p.userId === userId).forEach(p => {
      if (!stats[p.chapter]) stats[p.chapter] = { att: 0, cor: 0, last: 0 };
      stats[p.chapter].att += p.questionsSolved;
      stats[p.chapter].cor += (p.correctAnswers || p.questionsSolved);
      const t = p.timestamp?.toDate ? p.timestamp.toDate().getTime() : new Date(p.timestamp).getTime();
      if (t > stats[p.chapter].last) stats[p.chapter].last = t;
    });

    const actions = [];
    Array.from(completedSet).forEach(chap => {
      const metaId = `${userId}_${chap.replace(/\s+/g, '')}`;
      if (snoozedData[metaId] && snoozedData[metaId].delayUntil > Date.now()) return;

      const s = stats[chap] || { att: 0, cor: 0, last: 0 };
      const acc = s.att > 0 ? (s.cor / s.att) * 100 : 0;
      const daysSince = s.last === 0 ? Infinity : (Date.now() - s.last) / 86400000;
      
      let minQs = 0, tags = [], weight = 0;
      if (s.att === 0) { minQs = TARGET_QS_PER_CHAPTER; tags.push('Initial'); weight += 100; }
      else if (s.att < TARGET_QS_PER_CHAPTER) { minQs += (TARGET_QS_PER_CHAPTER - s.att); tags.push('Low Vol'); weight += 50; }
      if (s.att > 10 && acc < ACCURACY_THRESHOLD) { minQs = Math.max(minQs, 20); tags.push('Low Acc'); weight += (ACCURACY_THRESHOLD - acc) * 2; }
      if (daysSince > (daysLeft < 50 ? 7 : 14) && s.att > 0) { minQs = Math.max(minQs, 15); tags.push('Stale'); weight += daysSince * 1.5; }

      if (minQs > 0) actions.push({ chapter: chap, acc: acc.toFixed(0), minQs, tags, weight });
    });
    return actions.sort((a,b) => b.weight - a.weight).slice(0, 3);
  }, [progressData, userId, snoozedData, daysLeft, completedSet]);

  const handleSetGoal = async (e) => {
    e.preventDefault();
    if (!newGoal) return;
    await setDoc(doc(db, 'userGoals', userId), { weeklyTarget: Number(newGoal) }, { merge: true });
    setNewGoal('');
  };

  const handleQuickLog = async (e) => {
    e.preventDefault();
    if (Number(logCor) > Number(logAtt)) return alert("Correct can't exceed Attempted!");
    await addDoc(collection(db, 'progress'), {
      userId, subject: logSub, chapter: logChap,
      questionsSolved: Number(logAtt), correctAnswers: Number(logCor), 
      studyHours: Number(logHours || 0), timestamp: new Date()
    });
    setLogAtt(''); setLogCor(''); setLogHours(''); alert('Logged successfully!');
  };

  const handleMarkComplete = async (e) => {
    e.preventDefault();
    if (completedSet.has(compChapter)) return alert('Already completed!');
    await addDoc(collection(db, 'completedChapters'), { userId, subject: compSubject, chapter: compChapter, completedAt: new Date() });
  };

  const handleSnooze = async (chapter, days) => {
    const d = new Date(); d.setDate(d.getDate() + days);
    await setDoc(doc(db, 'chapterMeta', `${userId}_${chapter.replace(/\s+/g, '')}`), { userId, chapter, delayUntil: d.getTime() });
  };

  // Tug-of-war algorithmic points distribution
  const totalPoints = weeklyStats.u1Points + weeklyStats.u2Points;
  const u1Dominance = totalPoints > 0 ? (weeklyStats.u1Points / totalPoints) * 100 : 50;

  return (
    <div className="min-h-screen bg-ctp-crust text-ctp-text font-sans p-4 md:p-8">
      
      <header className="max-w-6xl mx-auto flex items-center justify-between bg-ctp-base/65 backdrop-blur-xl p-4 md:px-6 rounded-3xl border border-ctp-surface0 shadow-sm mb-6 sticky top-4 z-50 overflow-hidden">
        <div className="flex items-center gap-4 min-w-0">
          <Link to="/" className="p-2 bg-ctp-surface0 hover:bg-ctp-surface1 rounded-full shrink-0 text-ctp-subtext0"><ArrowLeft size={18} /></Link>
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-ctp-lavender truncate">{names[userId]}</h1>
            <p className="text-[10px] sm:text-[11px] text-ctp-subtext0 font-medium uppercase tracking-wider truncate">Mission Control</p>
          </div>
        </div>
        <div className="bg-gradient-to-r from-ctp-red to-ctp-peach text-ctp-crust font-black px-4 py-2 rounded-full text-[10px] sm:text-xs flex items-center gap-1 sm:gap-2 shadow-lg whitespace-nowrap shrink-0">
          <Clock size={14}/> {daysLeft} DAYS
        </div>
      </header>

      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* ROW 1: Gamification & Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Streak Column with Daily Consistency Bar below */}
          <div className="bg-ctp-base p-6 rounded-3xl border border-ctp-surface0 shadow-sm flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-ctp-peach/5 rounded-full blur-2xl transition duration-500"/>
            <div className="flex items-center justify-between relative z-10 mb-4">
              <div className="min-w-0">
                <p className="text-xs text-ctp-subtext0 font-bold uppercase mb-1">Dominance Streak</p>
                <p className="text-4xl font-black text-ctp-peach truncate">{competitiveStreak} <span className="text-base font-medium text-ctp-subtext0">Days</span></p>
              </div>
              <Flame size={48} className={`relative z-10 shrink-0 ${competitiveStreak > 0 ? 'text-ctp-peach' : 'text-ctp-surface2'}`} />
            </div>

            {/* Daily Consistency Streak Bar placed below */}
            <div className="pt-3 border-t border-ctp-surface0 relative z-10">
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-ctp-subtext0 uppercase tracking-wider text-[10px]">Daily Consistency</span>
                <span className="text-ctp-green">{dailyStreak} Day Streak</span>
              </div>
              <div className="w-full bg-ctp-surface0 h-2 rounded-full overflow-hidden">
                <div className="bg-ctp-green h-full rounded-full transition-all duration-500" style={{ width: `${Math.min((dailyStreak / 30) * 100, 100)}%` }} />
              </div>
            </div>
          </div>

          <div className="bg-ctp-base p-6 rounded-3xl border border-ctp-surface0 shadow-sm relative flex flex-col justify-between">
            <div className="flex justify-between items-start gap-2">
              <div className="flex items-center gap-1.5 text-ctp-green shrink-0"><Target size={16}/> <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Weekly Goal</span></div>
              <span className="text-[9px] sm:text-[10px] font-bold text-ctp-subtext0 bg-ctp-surface0 px-2 py-1 rounded-full shrink-0">Ends in {daysToWeekend} days</span>
            </div>
            <div className="flex items-end justify-between mt-2 gap-2">
              <p className="text-3xl font-black truncate">{userId === 'user1' ? weeklyStats.u1Vol : weeklyStats.u2Vol} <span className="text-lg font-medium text-ctp-subtext0">/ {goals[userId]}</span></p>
              <form onSubmit={handleSetGoal} className="flex gap-1 shrink-0">
                <input type="number" placeholder="New" value={newGoal} onChange={e=>setNewGoal(e.target.value)} className="w-14 bg-ctp-surface0 text-xs px-2 py-1 rounded-lg outline-none text-center" />
                <button type="submit" className="bg-ctp-mauve text-ctp-crust p-1 rounded-lg"><Edit3 size={14}/></button>
              </form>
            </div>
            <div className="w-full bg-ctp-surface0 h-2 mt-3 rounded-full overflow-hidden">
              <div className="bg-ctp-green h-full rounded-full transition-all duration-1000" style={{ width: `${Math.min(((userId === 'user1' ? weeklyStats.u1Vol : weeklyStats.u2Vol)/goals[userId])*100, 100)}%` }} />
            </div>
          </div>

          {/* Gamified Tug-of-War using Volume + Accuracy Algorithm */}
          <div className="bg-ctp-base p-5 rounded-3xl border border-ctp-surface0 shadow-sm flex flex-col justify-center">
             <div className="flex items-center justify-between mb-2">
               <div className="flex items-center gap-2 text-ctp-mauve"><Swords size={18}/> <span className="text-xs font-bold uppercase tracking-wider">Tug of War (Algo-Weighted)</span></div>
             </div>
             
             <div className="flex justify-between items-end text-center px-2">
               <div className="flex flex-col items-center">
                 {weeklyStats.u1Points > weeklyStats.u2Points && <Crown size={16} className="text-ctp-yellow mb-1"/>}
                 <p className="text-2xl font-black text-ctp-blue leading-none">{weeklyStats.u1Vol} <span className="text-[10px] font-normal text-ctp-subtext0">({weeklyStats.u1Hours}h)</span></p>
                 <p className="text-[10px] font-bold text-ctp-subtext0 mt-1">Sharaan</p>
                 <p className="text-[9px] text-ctp-green font-bold">{weeklyStats.u1Acc}% Acc</p>
               </div>
               <p className="text-[10px] font-black text-ctp-surface2 mb-4">VS</p>
               <div className="flex flex-col items-center">
                 {weeklyStats.u2Points > weeklyStats.u1Points && <Crown size={16} className="text-ctp-yellow mb-1"/>}
                 <p className="text-2xl font-black text-ctp-green leading-none">{weeklyStats.u2Vol} <span className="text-[10px] font-normal text-ctp-subtext0">({weeklyStats.u2Hours}h)</span></p>
                 <p className="text-[10px] font-bold text-ctp-subtext0 mt-1">Anadi</p>
                 <p className="text-[9px] text-ctp-green font-bold">{weeklyStats.u2Acc}% Acc</p>
               </div>
             </div>

             {/* Tug of War Bar driven by weighted algorithm */}
             <div className="w-full h-2.5 bg-ctp-surface0 rounded-full mt-3 flex overflow-hidden">
                <div className="bg-ctp-blue h-full transition-all duration-700 ease-out relative" style={{ width: `${u1Dominance}%` }}>
                  <div className="absolute right-0 top-0 bottom-0 w-1 bg-ctp-text opacity-50"></div>
                </div>
                <div className="bg-ctp-green h-full transition-all duration-700 ease-out" style={{ width: `${100 - u1Dominance}%` }}></div>
             </div>
          </div>
        </div>

        {/* ROW 2: Action Queue, Logging & Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="col-span-1 flex flex-col gap-6">
            <div className="bg-ctp-base p-6 rounded-3xl border border-ctp-surface0 shadow-sm">
              <div className="flex items-center gap-2 text-ctp-blue mb-4"><PenTool size={20}/> <h2 className="font-bold text-base tracking-tight">Quick Log Practice</h2></div>
              <form onSubmit={handleQuickLog} className="space-y-3">
                <select value={logSub} onChange={e => {setLogSub(e.target.value); setLogChap(JEE_SYLLABUS[e.target.value][0])}} className="w-full bg-ctp-surface0 p-2 rounded-xl text-xs outline-none border border-ctp-surface1"><option value="Physics">Physics</option><option value="Chemistry">Chemistry</option><option value="Mathematics">Mathematics</option></select>
                <select value={logChap} onChange={e => setLogChap(e.target.value)} className="w-full bg-ctp-surface0 p-2 rounded-xl text-xs outline-none border border-ctp-surface1">{JEE_SYLLABUS[logSub].map(c => <option key={c}>{c}</option>)}</select>
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" placeholder="Attempted" value={logAtt} onChange={e=>setLogAtt(e.target.value)} className="bg-ctp-surface0 p-2 rounded-xl text-xs outline-none border border-ctp-surface1" required/>
                  <input type="number" placeholder="Correct" value={logCor} onChange={e=>setLogCor(e.target.value)} className="bg-ctp-surface0 p-2 rounded-xl text-xs outline-none border border-ctp-surface1" required/>
                </div>
                <div className="relative">
                  <input type="number" step="0.5" placeholder="Study Hours (e.g. 2.5)" value={logHours} onChange={e=>setLogHours(e.target.value)} className="w-full bg-ctp-surface0 p-2 pl-8 rounded-xl text-xs outline-none border border-ctp-surface1" />
                  <Timer size={14} className="absolute left-2.5 top-2.5 text-ctp-subtext0" />
                </div>
                <button type="submit" className="w-full bg-ctp-blue text-ctp-crust font-bold py-2 rounded-xl hover:opacity-90 transition text-sm">Save Progress</button>
              </form>
            </div>

            <div className="bg-ctp-base p-6 rounded-3xl border border-ctp-surface0 shadow-sm flex-1 flex flex-col min-h-[250px]">
              <div className="flex items-center gap-2 text-ctp-red mb-4"><BrainCircuit size={20}/> <h2 className="font-bold text-base tracking-tight">Smart Queue</h2></div>
              <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                {actionableChapters.map((w, i) => (
                  <div key={i} className="bg-ctp-surface0/50 p-4 rounded-2xl border border-ctp-surface0/50">
                    <div className="flex justify-between items-start mb-2"><p className="text-sm font-bold line-clamp-1 pr-2">{w.chapter}</p><span className="text-[10px] font-bold px-2 py-1 bg-ctp-red/10 text-ctp-red rounded-lg">{w.acc}% Acc</span></div>
                    <div className="flex items-center justify-between border-t border-ctp-surface0 pt-3 mt-2">
                      <div className="flex items-center gap-1.5 text-ctp-green text-xs font-bold"><CheckCircle2 size={14} /> Solve {w.minQs} Qs</div>
                      <button onClick={() => handleSnooze(w.chapter, 1)} className="p-1 hover:bg-ctp-surface1 rounded"><BellOff size={14}/></button>
                    </div>
                  </div>
                ))}
                {actionableChapters.length === 0 && <p className="text-sm text-ctp-subtext0 text-center py-6 font-bold">Queue is clear! Great job.</p>}
              </div>
            </div>
          </div>

          <div className="col-span-1 lg:col-span-2 flex flex-col gap-6">
            <div className="bg-ctp-base p-6 rounded-3xl border border-ctp-surface0 shadow-sm flex-1 flex flex-col min-h-[350px]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                <div>
                  <h2 className="font-bold text-lg tracking-tight">Practice Comparison</h2>
                  <p className="text-xs text-ctp-subtext0">Sharaan vs Anadi Questions Solved</p>
                </div>
                <div className="flex gap-2 bg-ctp-surface0 p-1 rounded-xl self-start sm:self-auto">
                  <button onClick={() => setChartMode('weekly')} className={`px-3 py-1 text-xs font-bold rounded-lg ${chartMode==='weekly'?'bg-ctp-mauve text-ctp-crust':'text-ctp-subtext0'}`}>Weekly</button>
                  <button onClick={() => setChartMode('chapter')} className={`px-3 py-1 text-xs font-bold rounded-lg ${chartMode==='chapter'?'bg-ctp-mauve text-ctp-crust':'text-ctp-subtext0'}`}>By Chapter</button>
                </div>
              </div>

              {chartMode === 'chapter' && (
                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                  <select value={chartSub} onChange={e => {setChartSub(e.target.value); setChartChap(JEE_SYLLABUS[e.target.value][0])}} className="bg-ctp-surface0 p-2 rounded-xl text-xs outline-none border border-ctp-surface1 w-full sm:w-auto"><option value="Physics">Physics</option><option value="Chemistry">Chemistry</option><option value="Mathematics">Mathematics</option></select>
                  <select value={chartChap} onChange={e => setChartChap(e.target.value)} className="bg-ctp-surface0 p-2 rounded-xl text-xs outline-none border border-ctp-surface1 flex-1 w-full">{JEE_SYLLABUS[chartSub].map(c => <option key={c}>{c}</option>)}</select>
                </div>
              )}

              <div className="flex-1 w-full min-h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartMode === 'weekly' ? weeklyStats.chartData : chapterChartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#313244" vertical={false} opacity={0.5} />
                    <XAxis dataKey="name" stroke="#7f849c" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#7f849c" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: '#313244', opacity: 0.2 }} contentStyle={{ backgroundColor: '#1e1e2e', borderRadius: '12px', border: 'none' }} />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Bar dataKey="user1" fill="#89b4fa" name="Sharaan" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="user2" fill="#a6e3a1" name="Anadi" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-ctp-base p-6 rounded-3xl border border-ctp-surface0 shadow-sm flex flex-col md:flex-row items-center gap-4">
               <div className="flex items-center gap-2 text-ctp-green whitespace-nowrap"><BookOpen size={20}/> <h2 className="font-bold">Log Completion</h2></div>
               <form onSubmit={handleMarkComplete} className="flex flex-col sm:flex-row flex-1 gap-2 w-full">
                <select value={compSubject} onChange={e => {setCompSubject(e.target.value); setCompChapter(JEE_SYLLABUS[e.target.value][0])}} className="bg-ctp-surface0 p-2 rounded-xl text-xs outline-none border border-ctp-surface1 w-full sm:w-auto"><option value="Physics">Physics</option><option value="Chemistry">Chemistry</option><option value="Mathematics">Mathematics</option></select>
                <select value={compChapter} onChange={e => setCompChapter(e.target.value)} className="bg-ctp-surface0 p-2 rounded-xl text-xs outline-none border border-ctp-surface1 flex-1 w-full">{JEE_SYLLABUS[compSubject].map(c => <option key={c}>{c}</option>)}</select>
                <button type="submit" className="bg-ctp-green text-ctp-crust px-4 py-2 font-bold rounded-xl hover:opacity-90 transition text-sm w-full sm:w-auto">Add</button>
               </form>
            </div>
          </div>
        </div>

        {/* ROW 3: Heatmap & Activity Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="col-span-1 lg:col-span-2 bg-ctp-base p-6 rounded-3xl border border-ctp-surface0 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-ctp-peach"><Grid size={20}/> <h2 className="font-bold text-base tracking-tight">Syllabus Heatmap</h2></div>
              <span className="text-[10px] font-bold text-ctp-subtext0 bg-ctp-surface0 px-2 py-1 rounded-full">{heatmapMax} Blocks</span>
            </div>
            
            <div className="flex flex-wrap gap-1.5 justify-start">
              {heatmapData.map((chap, i) => {
                let colorClass = 'bg-ctp-surface0 border border-ctp-surface1'; 
                if (chap.isPlaceholder) colorClass = 'bg-ctp-crust border border-ctp-surface0/50 opacity-40';
                else if (chap.done) {
                  if (chap.subject === 'Physics') colorClass = 'bg-ctp-blue border border-ctp-blue';
                  else if (chap.subject === 'Chemistry') colorClass = 'bg-ctp-yellow border border-ctp-yellow';
                  else if (chap.subject === 'Mathematics') colorClass = 'bg-ctp-green border border-ctp-green';
                }
                return (
                  <div key={i} className={`w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 rounded-[4px] tooltip cursor-pointer transition ${colorClass}`} title={`${chap.name} (${chap.subject})`}></div>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-4 mt-6 text-[10px] font-bold text-ctp-subtext0 uppercase tracking-wider">
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-[3px] bg-ctp-blue"></div> Physics</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-[3px] bg-ctp-yellow"></div> Chemistry</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-[3px] bg-ctp-green"></div> Math</div>
            </div>
          </div>

          <div className="col-span-1 bg-ctp-base p-6 rounded-3xl border border-ctp-surface0 shadow-sm flex flex-col max-h-[300px]">
            <div className="flex items-center justify-between mb-4 text-ctp-lavender">
              <div className="flex items-center gap-2"><Activity size={20} className="animate-pulse"/> <h2 className="font-bold text-base tracking-tight">Live Activity (24H)</h2></div>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              {activityFeed.length > 0 ? activityFeed.map((act) => (
                <div key={act.id} className="flex gap-3 items-start p-3 bg-ctp-surface0/30 rounded-xl border border-ctp-surface0">
                  {act.type === 'practice' && <PenTool size={14} className="text-ctp-blue mt-0.5 shrink-0"/>}
                  {act.type === 'complete' && <CheckCircle2 size={14} className="text-ctp-green mt-0.5 shrink-0"/>}
                  {act.type === 'mock' && <TrendingUp size={14} className="text-ctp-peach mt-0.5 shrink-0"/>}
                  <div className="text-xs leading-relaxed break-words min-w-0">
                    <span className="font-bold capitalize text-ctp-text">{names[act.user]}</span> <span className="text-ctp-subtext0">{act.text}</span>
                  </div>
                </div>
              )) : (
                <p className="text-xs text-ctp-subtext0 text-center py-6">No activity in the last 24 hours.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
