import React, { useState } from 'react';
import { X, User, Mail, MapPin, Shield, Eye, EyeOff, KeyRound, AlertTriangle, RefreshCw, Check } from 'lucide-react';
import { User as UserType } from '../lib/auth';

interface EditCourierModalProps {
  user: UserType;
  onClose: () => void;
  onSuccess: (updatedUser: UserType) => void;
  onSave: (userId: string, data: { name: string; email: string; city?: string; password?: string }) => Promise<{ success: boolean; user?: UserType; error?: string }>;
}

const CITIES = [
  'Adjamé', 'Yopougon', 'Man', 'Sangouiné', 'Mahapleu', 'Danané', 'Teapleu', 'Zouhan-Hounien',
  'Bin-Houyé', 'Touba', 'Facobly', 'Biankouma', 'Bangolo', 'Duékoué'
];

export default function EditCourierModal({ user, onClose, onSuccess, onSave }: EditCourierModalProps) {
  const [formData, setFormData] = useState({
    name: user.name || '',
    email: user.email || '',
    city: user.city || '',
    newPassword: '',
    confirmPassword: ''
  });

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [copiedGenerated, setCopiedGenerated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const generateRandomPassword = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let pass = 'Dbs@';
    for (let i = 0; i < 4; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({
      ...prev,
      newPassword: pass,
      confirmPassword: pass
    }));
    setShowNewPassword(true);
    setShowConfirmPassword(true);
    setCopiedGenerated(true);
    setTimeout(() => setCopiedGenerated(false), 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError('Le nom du responsable est obligatoire.');
      return;
    }

    if (!formData.email.trim()) {
      setError('L\'adresse email est obligatoire.');
      return;
    }

    if (formData.newPassword) {
      if (formData.newPassword.length < 6) {
        setError('Le nouveau mot de passe doit comporter au moins 6 caractères.');
        return;
      }
      if (formData.newPassword !== formData.confirmPassword) {
        setError('Les deux mots de passe ne correspondent pas.');
        return;
      }
    }

    setLoading(true);
    try {
      const result = await onSave(user.id, {
        name: formData.name.trim(),
        email: formData.email.trim(),
        city: user.role === 'courier' ? formData.city : undefined,
        password: formData.newPassword ? formData.newPassword.trim() : undefined
      });

      if (result.success && result.user) {
        onSuccess(result.user);
      } else {
        setError(result.error || 'Erreur lors de la modification.');
      }
    } catch (err: any) {
      setError(err?.message || 'Erreur système lors de la modification.');
    } finally {
      setLoading(false);
    }
  };

  const isPasswordBeingChanged = Boolean(formData.newPassword.trim());

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-slate-800 border border-white/20 rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-5 pb-3 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                user.role === 'admin' ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
              }`}>
                {user.role === 'admin' ? 'Administrateur' : 'Responsable Courrier'}
              </span>
              {user.city && (
                <span className="text-xs text-gray-400 font-medium">Gare de {user.city}</span>
              )}
            </div>
            <h3 className="text-lg font-bold text-white mt-1">
              Modifier le compte de <span className="text-blue-400">{user.name}</span>
            </h3>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/15 border border-red-500/30 rounded-xl text-red-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nom du responsable */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
              Nom complet du responsable <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                value={formData.name} 
                onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/15 focus:border-blue-500 rounded-xl text-white text-sm outline-none transition-colors" 
                placeholder="Ex: Kouassi Koffi" 
                required 
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
              Adresse email / Identifiant <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="email" 
                value={formData.email} 
                onChange={(e) => setFormData({ ...formData, email: e.target.value })} 
                className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/15 focus:border-blue-500 rounded-xl text-white text-sm outline-none transition-colors" 
                placeholder="Ex: gare-adjame@dbs-ban.ci" 
                required 
              />
            </div>
          </div>

          {/* Ville pour les responsables courrier */}
          {user.role === 'courier' && (
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                Ville de responsabilité / Gare
              </label>
              <div className="relative">
                <MapPin className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <select 
                  value={formData.city} 
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })} 
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-white/15 focus:border-blue-500 rounded-xl text-white text-sm outline-none transition-colors"
                >
                  <option value="">Sélectionner une ville</option>
                  {CITIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                  {formData.city && !CITIES.includes(formData.city) && (
                    <option value={formData.city}>{formData.city}</option>
                  )}
                </select>
              </div>
            </div>
          )}

          {/* Mot de passe actuel enregistré (consultation admin) */}
          {user.password && (
            <div className="p-3 bg-black/20 border border-white/10 rounded-xl">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400 flex items-center gap-1.5 font-medium">
                  <KeyRound className="w-3.5 h-3.5 text-gray-400" /> Mot de passe actuel enregistré :
                </span>
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="text-blue-400 hover:text-blue-300 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                >
                  {showCurrentPassword ? (
                    <>
                      <EyeOff className="w-3 h-3" /> Masquer
                    </>
                  ) : (
                    <>
                      <Eye className="w-3 h-3" /> Afficher
                    </>
                  )}
                </button>
              </div>
              <div className="mt-1.5 font-mono text-sm font-bold text-gray-200">
                {showCurrentPassword ? user.password : '••••••••••••'}
              </div>
            </div>
          )}

          {/* Section Nouveau mot de passe */}
          <div className="pt-2 border-t border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider">
                Nouveau mot de passe
              </label>
              <button
                type="button"
                onClick={generateRandomPassword}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium transition-colors"
              >
                {copiedGenerated ? (
                  <span className="text-green-400 flex items-center gap-1 font-bold">
                    <Check className="w-3.5 h-3.5" /> Généré !
                  </span>
                ) : (
                  <>
                    <RefreshCw className="w-3 h-3" /> Générer un mot de passe
                  </>
                )}
              </button>
            </div>

            <div className="relative">
              <Shield className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type={showNewPassword ? "text" : "password"} 
                value={formData.newPassword} 
                onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })} 
                className="w-full pl-10 pr-12 py-2.5 bg-white/5 border border-white/15 focus:border-blue-500 rounded-xl text-white text-sm outline-none transition-colors" 
                placeholder="Laisser vide pour ne pas modifier" 
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {formData.newPassword && (
              <div className="relative animate-in fade-in duration-150">
                <Shield className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type={showConfirmPassword ? "text" : "password"} 
                  value={formData.confirmPassword} 
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })} 
                  className="w-full pl-10 pr-12 py-2.5 bg-white/5 border border-white/15 focus:border-blue-500 rounded-xl text-white text-sm outline-none transition-colors" 
                  placeholder="Confirmer le nouveau mot de passe" 
                  required={Boolean(formData.newPassword)}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            )}

            {/* Avertissement de sécurité si le mot de passe est modifié */}
            {isPasswordBeingChanged ? (
              <div className="p-3 bg-amber-500/15 border border-amber-500/30 rounded-xl text-amber-200 text-xs flex items-start gap-2.5 leading-relaxed">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-semibold text-amber-300">Déconnexion automatique de la session :</strong>
                  Dès l'enregistrement, toute personne actuellement connectée avec l'ancien mot de passe ({user.name}) sera <strong>déconnectée immédiatement</strong> et devra saisir ce nouveau mot de passe.
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-gray-400 italic">
                Si vous ne renseignez aucun nouveau mot de passe, le mot de passe actuel restera inchangé.
              </p>
            )}
          </div>

          {/* Boutons d'action */}
          <div className="flex gap-3 pt-3 border-t border-white/10">
            <button 
              type="button" 
              onClick={onClose} 
              disabled={loading}
              className="flex-1 bg-white/10 hover:bg-white/15 text-white py-2.5 rounded-xl font-medium text-sm transition-colors"
            >
              Annuler
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-900/30 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Enregistrement...
                </>
              ) : (
                'Enregistrer les modifications'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
