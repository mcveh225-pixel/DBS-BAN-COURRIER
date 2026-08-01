import React, { useEffect } from 'react';
import { Info, X, CheckCircle, AlertCircle } from 'lucide-react';

interface NotificationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  type?: 'info' | 'success' | 'error';
  onClose: () => void;
  autoCloseDuration?: number;
}

export default function NotificationModal({
  isOpen,
  title,
  message,
  type = 'info',
  onClose,
  autoCloseDuration = 4500
}: NotificationModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      onClose();
    }, autoCloseDuration);
    return () => clearTimeout(timer);
  }, [isOpen, onClose, autoCloseDuration]);

  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'success': return <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />;
      case 'error': return <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />;
      default: return <Info className="w-5 h-5 text-blue-400 shrink-0" />;
    }
  };

  const getBgBorder = () => {
    switch (type) {
      case 'success': return 'bg-slate-900/95 border-emerald-500/40 shadow-emerald-950/30';
      case 'error': return 'bg-slate-900/95 border-red-500/40 shadow-red-950/30';
      default: return 'bg-slate-900/95 border-blue-500/40 shadow-blue-950/30';
    }
  };

  const getProgressBg = () => {
    switch (type) {
      case 'success': return 'bg-emerald-400';
      case 'error': return 'bg-red-400';
      default: return 'bg-blue-400';
    }
  };

  return (
    <>
      <style>{`
        @keyframes toastProgress {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
      <div className="fixed top-5 right-5 z-[250] max-w-sm w-[calc(100vw-2.5rem)] pointer-events-auto animate-in slide-in-from-top-5 slide-in-from-right-4 fade-in duration-300">
        <div className={`relative border backdrop-blur-xl rounded-2xl p-4 shadow-2xl flex items-start gap-3.5 overflow-hidden ${getBgBorder()}`}>
          <div className="p-2 rounded-xl bg-white/10 shrink-0 mt-0.5">
            {getIcon()}
          </div>

          <div className="flex-1 min-w-0 pr-1">
            <h4 className="text-sm font-extrabold text-white leading-tight">
              {title}
            </h4>
            <p className="text-xs text-gray-300 leading-snug mt-1 break-words">
              {message}
            </p>
          </div>

          <button 
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors shrink-0 -mr-1 -mt-1 cursor-pointer"
            title="Fermer"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Animated progress bar at bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
            <div 
              className={`h-full ${getProgressBg()}`}
              style={{
                animation: `toastProgress ${autoCloseDuration}ms linear forwards`
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
}

