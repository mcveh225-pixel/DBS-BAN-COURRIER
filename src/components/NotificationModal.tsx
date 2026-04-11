import React from 'react';
import { Info, X, CheckCircle, AlertCircle } from 'lucide-react';

interface NotificationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  type?: 'info' | 'success' | 'error';
  onClose: () => void;
}

export default function NotificationModal({
  isOpen,
  title,
  message,
  type = 'info',
  onClose
}: NotificationModalProps) {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'success': return <CheckCircle className="w-5 h-5 text-emerald-500" />;
      case 'error': return <AlertCircle className="w-5 h-5 text-red-500" />;
      default: return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getBg = () => {
    switch (type) {
      case 'success': return 'bg-emerald-500/20';
      case 'error': return 'bg-red-500/20';
      default: return 'bg-blue-500/20';
    }
  };

  const getBorder = () => {
    switch (type) {
      case 'success': return 'border-emerald-500/30';
      case 'error': return 'border-red-500/30';
      default: return 'border-blue-500/30';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[110]">
      <div className="bg-[#1a1c2e] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className={`p-6 border-b border-white/5 flex justify-between items-center ${getBg()}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-white/10`}>
              {getIcon()}
            </div>
            <h3 className="text-xl font-bold text-white">{title}</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6">
          <p className="text-gray-300 leading-relaxed">
            {message}
          </p>
        </div>

        <div className="p-4 bg-white/5 border-t border-white/5 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium shadow-lg shadow-blue-900/20"
          >
            D'accord
          </button>
        </div>
      </div>
    </div>
  );
}
