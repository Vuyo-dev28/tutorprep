import React, { Component, ErrorInfo, ReactNode } from 'react';
import { motion } from 'motion/react';
import { Button } from '@/app/components/ui/button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundaryClass extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  render() {
    if (this.state.hasError) {
      try {
        if (this.props.fallback) {
          return this.props.fallback;
        }
        return <ErrorFallback error={this.state.error} errorInfo={this.state.errorInfo} />;
      } catch (fallbackError) {
        // If ErrorFallback itself has an error, show a minimal fallback
        console.error('ErrorBoundary fallback error:', fallbackError);
        return (
          <div style={{ padding: '20px', textAlign: 'center' }}>
            <h1>Something went wrong</h1>
            <p>Please refresh the page.</p>
            <button onClick={() => window.location.reload()}>Reload</button>
          </div>
        );
      }
    }

    return this.props.children;
  }
}

function ErrorFallback({ error, errorInfo }: { error: Error | null; errorInfo: ErrorInfo | null }) {
  const handleReload = () => {
    window.location.reload();
  };

  const handleGoHome = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl w-full bg-white rounded-3xl p-8 shadow-2xl"
      >
        <div className="text-center mb-6">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-10 h-10 text-red-600" />
          </div>
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">Something went wrong</h1>
          <p className="text-gray-600">
            We're sorry, but something unexpected happened. Please try refreshing the page.
          </p>
        </div>

        {error && (
          <div className="bg-gray-50 rounded-2xl p-4 mb-6">
            <p className="text-sm font-semibold text-gray-700 mb-2">Error Details:</p>
            <p className="text-sm text-red-600 font-mono">{error.message}</p>
            {errorInfo && process.env.NODE_ENV === 'development' && (
              <details className="mt-4">
                <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                  Stack Trace (Development Only)
                </summary>
                <pre className="mt-2 text-xs text-gray-600 overflow-auto max-h-60 bg-white p-3 rounded">
                  {errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        )}

        <div className="flex gap-3 justify-center">
          <Button
            onClick={handleReload}
            className="flex items-center gap-2 rounded-full bg-blue-600 hover:bg-blue-700"
          >
            <RefreshCw className="w-4 h-4" />
            Reload Page
          </Button>
          <Button
            onClick={handleGoHome}
            variant="outline"
            className="flex items-center gap-2 rounded-full"
          >
            <Home className="w-4 h-4" />
            Go Home
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

export function ErrorBoundary({ children, fallback }: Props) {
  return <ErrorBoundaryClass fallback={fallback}>{children}</ErrorBoundaryClass>;
}
