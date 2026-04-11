import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDanger?: boolean;
}

export default function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  onConfirm,
  onCancel,
  isDanger = false
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
      <div className="bg-[#1a1c2e] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-red-600/10 to-orange-600/10">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isDanger ? 'bg-red-500/20 text-red-500' : 'bg-amber-500/20 text-amber-500'}`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-white">{title}</h3>
          </div>
          <button 
            onClick={onCancel}
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

        <div className="p-4 bg-white/5 border-t border-white/5 flex justify-end gap-3">
          <button 
            onClick={onCancel}
            className="px-6 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors text-sm font-medium"
          >
            {cancelLabel}
          </button>
          <button 
            onClick={onConfirm}
            className={`px-6 py-2 rounded-lg transition-all text-sm font-medium shadow-lg ${
              isDanger 
                ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-900/20' 
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-900/20'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
