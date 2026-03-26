import React, { useState } from 'react';
import { X, User, Mail, MapPin, Shield, Eye, EyeOff } from 'lucide-react';

interface CreateCourierModalProps {
  onClose: () => void;
  onCreate: (email: string, name: string, city: string, password?: string) => void;
}

const cities = [
  'Adjamé', 'Yopougon', 'Man', 'Sangouiné', 'Mahapleu', 'Danané', 'Teapleu', 'Zouhan-Hounien',
  'Bin-Houyé', 'Touba', 'Facobly', 'Biankouma', 'Bangolo', 'Duékoué'
];

export default function CreateCourierModal({ onClose, onCreate }: CreateCourierModalProps) {
  const [formData, setFormData] = useState({ email: '', name: '', city: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate(formData.email, formData.name, formData.city, formData.password || undefined);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 border border-white/20 rounded-xl p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-white">Créer un Responsable Courrier</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Nom complet</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white" placeholder="Nom et prénom" required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Adresse email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white" placeholder="email@dbs-ban.ci" required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Ville de responsabilité</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <select value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none" required>
                <option value="">Sélectionner une ville</option>
                {cities.map(city => <option key={city} value={city} className="bg-slate-800">{city}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Mot de passe</label>
            <div className="relative">
              <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input 
                type={showPassword ? "text" : "password"} 
                value={formData.password} 
                onChange={(e) => setFormData({ ...formData, password: e.target.value })} 
                className="w-full pl-10 pr-12 py-3 bg-white/10 border border-white/20 rounded-lg text-white" 
                placeholder="Mot de passe (optionnel)" 
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">Si vide, le mot de passe sera "courier123"</p>
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-lg">Annuler</button>
            <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg">Créer le compte</button>
          </div>
        </form>
      </div>
    </div>
  );
}
