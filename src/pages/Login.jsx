import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { User, ShieldAlert, CheckCircle2, ChevronRight, Activity, PenTool, TrendingUp } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [progressData, setProgressData] = useState([]);
  const [mockScores, setMockScores] = useState([]);
  const [completedChapters, setCompletedChapters] = useState([]);

  // Fetch the latest 10 items from each collection to keep the login screen lightning fast
  useEffect(() => {
    const unsubP = onSnapshot(query(collection(db, 'progress'), orderBy('timestamp', 'desc'), limit(10)), 
      s => setProgressData(s.docs.map(d => d.data())));
    
    const unsubM = onSnapshot(query(collection(db, 'mockMarks'), orderBy('createdAt', 'desc'), limit(10)), 
      s => setMockScores(s.docs.map(d => d.data())));
    
    const unsubC = onSnapshot(query(collection(db, 'completedChapters'), orderBy('completedAt', 'desc'), limit(10)), 
      s => setCompletedChapters(s.docs.map(d => d.data())));

    return () => { unsubP(); unsubM(); unsubC(); };
  }, []);

  const names = { user1: 'Sharaan', user2: 'Anadi' };

  // Calculate the 24H Live Activity Feed
  const activityFeed = useMemo(() => {
    const dayAgo = Date.now() - 86400000;
    let items = [];
    
    progressData.forEach(p => {
      const t = p.timestamp?.toDate ? p.timestamp.toDate().getTime() : 0;
      if (t > dayAgo) items.push({ id: Math.random(), type: 'practice', time: t, user: p.userId, text: `solved ${p.questionsSolved} Qs in ${p.chapter}` });
    });
    
    completedChapters.forEach(c => {
      const t = c.completedAt?.toDate ? c.completedAt.toDate().getTime() : 0;
      if (t > dayAgo) items.push({ id: Math.random(), type: 'complete', time: t, user: c.userId, text: `mastered ${c.chapter}` });
    });
    
    mockScores.forEach(m => {
      const t = m.createdAt?.toDate ? m.createdAt.toDate().getTime() : 0;
      if (t > dayAgo) items.push({ id: Math.random(), type: 'mock', time: t, user: m.userId, text: `scored ${m.score}/300 on ${m.examName}` });
    });
    
    // Sort newest first and limit to the top 4 for the login UI
    return items.sort((a,b) => b.time - a.time).slice(0, 4);
  }, [progressData, completedChapters, mockScores]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-ctp-crust p-4 md:p-8 font-sans selection:bg-ctp-mauve selection:text-ctp-crust">
      
      <div className="text-center mb-12 animate-fade-in">
        <h1 className="text-5xl font-black text-ctp-lavender mb-3 tracking-tight">Study Tracker</h1>
        <p className="text-sm text-ctp-subtext0 font-medium uppercase tracking-widest">Select your profile to continue</p>
      </div>
      
      {/* Primary Login Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl w-full mb-8">
        <button 
          onClick={() => navigate('/dashboard/user1')} 
          className="group relative overflow-hidden flex flex-col items-center p-8 bg-ctp-base rounded-3xl border border-ctp-surface0 shadow-lg hover:border-ctp-blue hover:shadow-ctp-blue/10 transition-all duration-300 hover:-translate-y-1"
        >
          <div className="absolute top-0 left-0 w-full h-1.5 bg-ctp-blue transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
          <div className="p-4 bg-ctp-blue/10 rounded-full mb-4 group-hover:bg-ctp-blue/20 transition-colors duration-300">
            <User size={48} className="text-ctp-blue" />
          </div>
          <span className="text-2xl font-black text-ctp-text tracking-tight">Sharaan</span>
          <span className="flex items-center gap-1 text-xs text-ctp-blue mt-2 font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-y-2 group-hover:translate-y-0">
            Launch Workspace <ChevronRight size={14}/>
          </span>
        </button>
        
        <button 
          onClick={() => navigate('/dashboard/user2')} 
          className="group relative overflow-hidden flex flex-col items-center p-8 bg-ctp-base rounded-3xl border border-ctp-surface0 shadow-lg hover:border-ctp-green hover:shadow-ctp-green/10 transition-all duration-300 hover:-translate-y-1"
        >
          <div className="absolute top-0 left-0 w-full h-1.5 bg-ctp-green transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
          <div className="p-4 bg-ctp-green/10 rounded-full mb-4 group-hover:bg-ctp-green/20 transition-colors duration-300">
            <User size={48} className="text-ctp-green" />
          </div>
          <span className="text-2xl font-black text-ctp-text tracking-tight">Anadi</span>
          <span className="flex items-center gap-1 text-xs text-ctp-green mt-2 font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-y-2 group-hover:translate-y-0">
            Launch Workspace <ChevronRight size={14}/>
          </span>
        </button>
      </div>

      {/* Secondary Row: Admin & Activity Feed */}
      <div className="w-full max-w-2xl grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Unlocked Admin Card */}
        <div className="col-span-1">
          <button 
            onClick={() => navigate('/admin')} 
            className="w-full h-full flex flex-col items-center justify-center p-6 bg-ctp-base hover:bg-ctp-surface0 rounded-3xl border border-ctp-surface0 shadow-sm transition-all duration-300 hover:-translate-y-1 group min-h-[140px]"
          >
            <ShieldAlert className="text-ctp-mauve mb-3 group-hover:scale-110 transition-transform duration-300" size={32} />
            <span className="text-xs font-bold text-ctp-text uppercase tracking-widest">Admin Control</span>
          </button>
        </div>

        {/* Live Activity (24H) Feed */}
        <div className="col-span-1 md:col-span-2 bg-ctp-base rounded-3xl border border-ctp-surface0 p-5 shadow-sm overflow-hidden flex flex-col min-h-[140px]">
          <div className="flex items-center gap-2 text-ctp-lavender mb-4">
            <Activity size={18} className="animate-pulse"/> 
            <h2 className="text-xs font-bold uppercase tracking-widest">Live Activity (24H)</h2>
          </div>
          
          <div className="flex-1 flex flex-col gap-2 justify-center">
            {activityFeed.length > 0 ? activityFeed.map((act) => (
              <div key={act.id} className="flex items-start gap-3 text-sm bg-ctp-surface0/30 p-2.5 rounded-xl border border-ctp-surface0/50 hover:border-ctp-surface1 transition-colors">
                {act.type === 'practice' && <PenTool size={16} className="text-ctp-blue mt-0.5 shrink-0"/>}
                {act.type === 'complete' && <CheckCircle2 size={16} className="text-ctp-green mt-0.5 shrink-0"/>}
                {act.type === 'mock' && <TrendingUp size={16} className="text-ctp-peach mt-0.5 shrink-0"/>}
                
                <div className="truncate min-w-0 text-xs">
                  <span className="font-bold text-ctp-text capitalize">{names[act.user]}</span>
                  <span className="text-ctp-subtext0 truncate"> {act.text}</span>
                </div>
              </div>
            )) : (
              <div className="text-xs text-ctp-subtext0 text-center flex flex-col items-center gap-2 opacity-60">
                <Activity size={24}/>
                <p>No activity in the last 24 hours.</p>
              </div>
            )}
          </div>
        </div>
        
      </div>
    </div>
  );
}
