import React, { useState } from 'react';
import { X, Lock, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { changePassword } from '../lib/auth';

interface ChangePasswordModalProps {
  userId: string;
  onClose: () => void;
}

export default function ChangePasswordModal({ userId, onClose }: ChangePasswordModalProps) {
  const [formData, setFormData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (formData.newPassword.length < 6) return setError('Minimum 6 caractères');
    if (formData.newPassword !== formData.confirmPassword) return setError('Mots de passe différents');

    setLoading(true);
    try {
      const ok = await changePassword(userId, formData.currentPassword, formData.newPassword);
      if (ok) {
        setSuccess(true);
        setTimeout(onClose, 2000);
      } else setError('Mot de passe actuel incorrect');
    } catch { setError('Erreur système'); }
    finally { setLoading(false); }
  };

  if (success) return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 border border-white/20 rounded-xl p-6 w-full max-w-md text-center">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-white">Mot de passe modifié</h3>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 border border-white/20 rounded-xl p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-white">Changer le mot de passe</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input 
              type={showCurrent ? "text" : "password"} 
              value={formData.currentPassword} 
              onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })} 
              className="w-full pl-4 pr-12 py-3 bg-white/10 border border-white/20 rounded-lg text-white" 
              placeholder="Mot de passe actuel" 
              required 
            />
            <button
              type="button"
              onClick={() => setShowCurrent(!showCurrent)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
            >
              {showCurrent ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          <div className="relative">
            <input 
              type={showNew ? "text" : "password"} 
              value={formData.newPassword} 
              onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })} 
              className="w-full pl-4 pr-12 py-3 bg-white/10 border border-white/20 rounded-lg text-white" 
              placeholder="Nouveau mot de passe" 
              required 
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
            >
              {showNew ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          <div className="relative">
            <input 
              type={showConfirm ? "text" : "password"} 
              value={formData.confirmPassword} 
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })} 
              className="w-full pl-4 pr-12 py-3 bg-white/10 border border-white/20 rounded-lg text-white" 
              placeholder="Confirmer" 
              required 
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
            >
              {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {error && <div className="text-red-400 text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</div>}
          <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg">{loading ? 'Modification...' : 'Modifier'}</button>
        </form>
      </div>
    </div>
  );
}
