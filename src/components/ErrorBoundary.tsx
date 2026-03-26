import React, { ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  public state: State;
  public props: Props;

  constructor(props: Props) {
    super(props);
    this.props = props;
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-8 max-w-md w-full text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-red-500/20 p-4 rounded-full">
                <AlertCircle className="w-12 h-12 text-red-500" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white mb-4">Une erreur est survenue</h2>
            <p className="text-gray-300 mb-6">
              L'application a rencontré un problème technique. Cela peut arriver sur certains navigateurs plus anciens.
            </p>
            <div className="bg-black/20 rounded-lg p-4 mb-6 text-left overflow-auto max-h-32">
              <code className="text-xs text-red-400 font-mono">
                {this.state.error?.message || 'Erreur inconnue'}
              </code>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition-all"
            >
              <RefreshCw className="w-5 h-5" />
              Actualiser la page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
