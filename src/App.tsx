import React, { useState, useEffect, useCallback } from 'react';
import { Package, LogOut, Settings, WifiOff, RefreshCw } from 'lucide-react';
import Logo from './components/Logo';
import AuthPage from './components/AuthPage';
import AdminDashboard from './components/AdminDashboard';
import CourierDashboard from './components/CourierDashboard';
import ChangePasswordModal from './components/ChangePasswordModal';
import { 
  User, 
  getCurrentUser, 
  logout, 
  cleanupOldDeliveredParcels, 
  getUnsyncedCount, 
  triggerBackgroundSync,
  verifyUserSession 
} from './lib/auth';
import { supabase } from './lib/supabase';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [sessionNotice, setSessionNotice] = useState<string | null>(() => {
    try {
      const stored = sessionStorage.getItem('dbs_ban_session_notice');
      if (stored) {
        sessionStorage.removeItem('dbs_ban_session_notice');
        return stored;
      }
    } catch {
      // Ignore
    }
    return null;
  });

  const forceLogoutWithNotice = useCallback((message: string) => {
    try {
      sessionStorage.setItem('dbs_ban_session_notice', message);
    } catch {
      // Ignore
    }
    setSessionNotice(message);
    logout();
    setUser(null);
  }, []);

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

  // Surveillance de la session active de l'utilisateur (déconnexion en temps réel si mot de passe changé ou compte modifié)
  useEffect(() => {
    if (!user) return;

    // 1. Canal Supabase Realtime pour déconnexion instantanée
    const channel = supabase
      .channel(`user-session-monitor-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${user.id}`
        },
        (payload) => {
          const updated = payload.new as any;
          if (!updated) return;
          if (updated.is_archived) {
            forceLogoutWithNotice("Votre compte a été archivé ou désactivé par l'administrateur.");
          } else if (updated.password && user.password && updated.password !== user.password) {
            forceLogoutWithNotice("Votre mot de passe a été modifié par l'administrateur principal. Vous avez été déconnecté automatiquement. Veuillez vous reconnecter avec le nouveau mot de passe.");
          } else if (updated.name !== user.name || updated.city !== user.city) {
            setUser(prev => prev ? ({ ...prev, name: updated.name, city: updated.city }) : null);
            const saved = getCurrentUser();
            if (saved) {
              localStorage.setItem('dbs_ban_current_user', JSON.stringify({ ...saved, name: updated.name, city: updated.city }));
            }
          }
        }
      )
      .subscribe();

    // 2. BroadcastChannel pour révoquer les sessions entre onglets/fenêtres instantanément
    let bc: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      bc = new BroadcastChannel('dbs_ban_auth_channel');
      bc.onmessage = (event) => {
        if (event.data?.type === 'FORCE_LOGOUT' && event.data.userId === user.id) {
          forceLogoutWithNotice("Votre mot de passe a été modifié par l'administrateur principal. Vous avez été déconnecté automatiquement. Veuillez vous reconnecter avec le nouveau mot de passe.");
        }
      };
    }

    // 3. Battement de coeur périodique (toutes les 3 secondes) pour garantir la déconnexion
    const heartbeatInterval = setInterval(async () => {
      const res = await verifyUserSession(user.id, user.password);
      if (!res.valid) {
        if (res.reason === 'PASSWORD_CHANGED') {
          forceLogoutWithNotice("Votre mot de passe a été modifié par l'administrateur principal. Vous avez été déconnecté automatiquement. Veuillez vous reconnecter avec le nouveau mot de passe.");
        } else if (res.reason === 'ARCHIVED') {
          forceLogoutWithNotice("Votre compte a été archivé ou désactivé par l'administrateur.");
        } else if (res.reason === 'NOT_FOUND') {
          forceLogoutWithNotice("Votre compte n'existe plus ou a été supprimé.");
        }
      } else if (res.freshUser) {
        if (res.freshUser.name !== user.name || res.freshUser.city !== user.city) {
          setUser(res.freshUser);
          localStorage.setItem('dbs_ban_current_user', JSON.stringify(res.freshUser));
        }
      }
    }, 3000);

    // 4. Vérification dès la reprise du focus de l'onglet
    const handleFocus = async () => {
      const res = await verifyUserSession(user.id, user.password);
      if (!res.valid && res.reason === 'PASSWORD_CHANGED') {
        forceLogoutWithNotice("Votre mot de passe a été modifié par l'administrateur principal. Vous avez été déconnecté.");
      }
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      supabase.removeChannel(channel);
      if (bc) bc.close();
      clearInterval(heartbeatInterval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user?.id, user?.password, user?.name, user?.city, forceLogoutWithNotice]);

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Chargement...</div>
  );

  if (!user) return (
    <>
      <AuthPage 
        onLogin={(loggedInUser) => {
          setSessionNotice(null);
          setUser(loggedInUser);
        }} 
        sessionNotice={sessionNotice}
        onClearNotice={() => setSessionNotice(null)}
      />
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

      {showPasswordModal && (
        <ChangePasswordModal 
          userId={user.id} 
          onClose={() => setShowPasswordModal(false)}
          onPasswordChanged={(newPassword) => {
            setUser(prev => prev ? ({ ...prev, password: newPassword }) : null);
          }}
        />
      )}
    </div>
  );
}

export default App;
