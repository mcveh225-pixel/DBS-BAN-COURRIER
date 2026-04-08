import React from 'react';
import { X, Users, Package, DollarSign, TrendingUp } from 'lucide-react';

interface BreakdownItem {
  name: string;
  city: string;
  value: string | number;
  subValue?: string | number;
}

interface AdminBreakdownModalProps {
  title: string;
  type: 'responsables' | 'parcels_today' | 'parcels_week' | 'revenue_today' | 'revenue_week' | 'revenue_month';
  data: BreakdownItem[];
  onClose: () => void;
}

export default function AdminBreakdownModal({ title, type, data, onClose }: AdminBreakdownModalProps) {
  const getIcon = () => {
    switch (type) {
      case 'responsables': return <Users className="w-5 h-5 text-blue-400" />;
      case 'parcels_today':
      case 'parcels_week': return <Package className="w-5 h-5 text-emerald-400" />;
      case 'revenue_today': return <TrendingUp className="w-5 h-5 text-orange-400" />;
      case 'revenue_week':
      case 'revenue_month': return <DollarSign className="w-5 h-5 text-purple-400" />;
      default: return <Package className="w-5 h-5 text-blue-400" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 border border-white/20 rounded-2xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-white flex items-center gap-3">
            <div className="p-2 bg-white/5 rounded-lg">
              {getIcon()}
            </div>
            {title}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
          {data.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 italic">Aucune donnée disponible</p>
            </div>
          ) : (
            data.map((item, index) => (
              <div key={index} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between hover:bg-white/10 transition-all group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400 font-bold border border-blue-600/30">
                    {item.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-white group-hover:text-blue-400 transition-colors">{item.name}</p>
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">{item.city}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-white">
                    {typeof item.value === 'number' && (type.includes('revenue')) 
                      ? `${item.value.toLocaleString()} FCFA` 
                      : item.value}
                  </p>
                  {item.subValue !== undefined && (
                    <p className="text-xs text-gray-500 font-medium">
                      {item.subValue} {type.includes('revenue') ? 'colis' : ''}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-white/10 flex justify-end">
          <button 
            onClick={onClose}
            className="px-8 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all text-sm font-bold shadow-lg"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
