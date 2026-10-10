import React from 'react';

/**
 * Standard React error boundary to protect UI sections and global app from fatal render exceptions.
 * Prevents an uncaught error in a child component from crashing the entire page.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
    if (typeof window !== 'undefined' && import.meta.env?.VITE_SENTRY_DSN) {
      import('@sentry/react')
        .then((Sentry) => {
          Sentry.captureException(error, { extra: errorInfo });
        })
        .catch(() => {});
    }
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback(this.state.error);
      }
      if (this.props.fallback !== undefined) {
        return this.props.fallback;
      }
      if (this.props.global) {
        return (
          <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center p-6 text-center">
            <div className="max-w-md w-full p-8 rounded-[8px] border border-[#E5E7EB] bg-white space-y-4">
              <h1 className="text-xl font-semibold text-[#111827]">Something went wrong</h1>
              <p className="text-sm text-[#6B7280]">
                An unexpected error occurred. Please refresh the page to continue.
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center justify-center h-9 px-4 rounded-[6px] bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1D4ED8] transition-colors"
              >
                Reload page
              </button>
            </div>
          </div>
        );
      }
      return (
        <div
          className="aspect-[4/5] rounded-[6px] bg-[#E5E7EB] flex items-center justify-center text-xs text-[#9CA3AF] p-3 text-center"
          aria-label="Preview unavailable"
        >
          Preview unavailable
        </div>
      );
    }
    return this.props.children;
  }
}
