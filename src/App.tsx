import React, { useState, useEffect } from 'react';
import { Package, LogOut, Settings } from 'lucide-react';
import AuthPage from './components/AuthPage';
import AdminDashboard from './components/AdminDashboard';
import CourierDashboard from './components/CourierDashboard';
import ChangePasswordModal from './components/ChangePasswordModal';
import { User, getCurrentUser, logout, cleanupOldDeliveredParcels } from './lib/auth';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  useEffect(() => {
    const currentUser = getCurrentUser();
    setUser(currentUser);
    setLoading(false);
    
    // Nettoyage automatique des anciens colis livrés (plus de 30 jours)
    if (currentUser) {
      cleanupOldDeliveredParcels();
    }
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Chargement...</div>
  );

  if (!user) return (
    <>
      <AuthPage onLogin={setUser} />
    </>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800">
      <header className="bg-black/20 border-b border-white/10 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 flex items-center justify-center bg-white/10 rounded-lg overflow-hidden">
              <img 
                src="/logo.png" 
                alt="DBS-BAN Logo" 
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  // If image fails, show the Package icon as fallback instead of hiding
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const fallback = target.parentElement?.querySelector('.logo-fallback');
                  if (fallback) (fallback as HTMLElement).style.display = 'flex';
                }}
              />
              <div className="logo-fallback hidden absolute inset-0 items-center justify-center">
                <Package className="w-6 h-6 text-blue-400" />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">DBS-BAN Courrier</h1>
              <p className="text-xs text-gray-300">
                {user.role === 'admin' ? 'Administration' : `Responsable - ${user.city}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:block text-right">
              <p className="text-white text-sm font-medium">{user.name}</p>
              <p className="text-xs text-gray-400">{user.email}</p>
            </div>
            <button onClick={() => setShowPasswordModal(true)} className="p-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg"><Settings className="w-4 h-4" /></button>
            <button onClick={() => { logout(); setUser(null); }} className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm"><LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Quitter</span></button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {user.role === 'admin' ? <AdminDashboard /> : <CourierDashboard user={user} />}
      </main>

      <footer className="mt-12 py-6 text-center text-gray-400 text-sm border-t border-white/5">
        © 2025 DBS-BAN Transport – Service Courrier.
      </footer>

      {showPasswordModal && <ChangePasswordModal userId={user.id} onClose={() => setShowPasswordModal(false)} />}
    </div>
  );
}

export default App;
