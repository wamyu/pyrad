import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, ShieldAlert } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [adminPass, setAdminPass] = useState('');

  const handleAdmin = () => {
    if (adminPass === 'admin') navigate('/admin');
    else alert('Wrong Password');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6">
      <h1 className="text-4xl font-bold text-ctp-mauve mb-8">Study Tracker</h1>
      
      <div className="flex gap-4">
        <button onClick={() => navigate('/dashboard/user1')} className="flex flex-col items-center p-6 bg-ctp-surface0 rounded-xl hover:bg-ctp-surface1 transition">
          <User size={48} className="text-ctp-blue mb-2" />
          <span className="text-xl">User 1</span>
        </button>
        
        <button onClick={() => navigate('/dashboard/user2')} className="flex flex-col items-center p-6 bg-ctp-surface0 rounded-xl hover:bg-ctp-surface1 transition">
          <User size={48} className="text-ctp-green mb-2" />
          <span className="text-xl">User 2</span>
        </button>
      </div>

      <div className="mt-12 p-6 bg-ctp-mantle rounded-xl border border-ctp-surface2 flex flex-col items-center">
        <ShieldAlert className="text-ctp-red mb-2" />
        <p className="mb-2">Admin Access</p>
        <input 
          type="password" 
          placeholder="Password" 
          className="bg-ctp-base p-2 rounded outline-none border border-ctp-surface1 focus:border-ctp-mauve mb-2"
          onChange={(e) => setAdminPass(e.target.value)}
        />
        <button onClick={handleAdmin} className="bg-ctp-mauve text-ctp-crust px-4 py-1 rounded w-full font-bold">Login</button>
      </div>
    </div>
  );
}
