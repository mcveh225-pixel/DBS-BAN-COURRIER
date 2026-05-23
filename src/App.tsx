import React, { useState, useEffect } from 'react';
import { Package, LogOut, Settings, WifiOff, RefreshCw } from 'lucide-react';
import Logo from './components/Logo';
import AuthPage from './components/AuthPage';
import AdminDashboard from './components/AdminDashboard';
import CourierDashboard from './components/CourierDashboard';
import ChangePasswordModal from './components/ChangePasswordModal';
import { User, getCurrentUser, logout, cleanupOldDeliveredParcels, getUnsyncedCount, triggerBackgroundSync } from './lib/auth';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [unsyncedCount, setUnsyncedCount] = useState(0);

  useEffect(() => {
    const currentUser = getCurrentUser();
    setUser(currentUser);
    setLoading(false);
    
    // Nettoyage automatique des anciens colis livrés (plus de 30 jours)
    if (currentUser) {
      cleanupOldDeliveredParcels();
    }

    // Initial check
    setUnsyncedCount(getUnsyncedCount());

    const handleSyncChange = () => {
      setUnsyncedCount(getUnsyncedCount());
    };

    window.addEventListener('offline_data_synced', handleSyncChange);
    window.addEventListener('offline_action_queued', handleSyncChange);

    const interval = setInterval(() => {
      setUnsyncedCount(getUnsyncedCount());
    }, 4000);

    return () => {
      window.removeEventListener('offline_data_synced', handleSyncChange);
      window.removeEventListener('offline_action_queued', handleSyncChange);
      clearInterval(interval);
    };
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
            <Logo size="md" />
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

      {unsyncedCount > 0 && (
        <div className="bg-amber-600/20 border-b border-amber-600/30 text-amber-200 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 py-2.5 text-xs flex items-center justify-between font-medium">
            <div className="flex items-center gap-2.5">
              <WifiOff className="w-4 h-4 text-amber-500 animate-pulse" />
              <span>
                Connexion instable détectée – <strong>{unsyncedCount} modification{unsyncedCount > 1 ? 's' : ''}</strong> en attente de synchronisation. Vos colis sont enregistrés localement.
              </span>
            </div>
            <button 
              onClick={() => triggerBackgroundSync()}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-slate-900 rounded font-bold transition-all text-[11px] flex items-center gap-1.5 cursor-pointer shadow-md shadow-amber-900/40 text-white"
            >
              <RefreshCw className="w-3 h-3 animate-spin" /> Synchroniser
            </button>
          </div>
        </div>
      )}

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
