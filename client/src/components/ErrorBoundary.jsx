import React from 'react';

/**
 * Standard React error boundary to protect UI sections from fatal render exceptions.
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
      return (
        <div className="aspect-[4/5] rounded-[6px] bg-[#E5E7EB] flex items-center justify-center text-xs text-[#9CA3AF] p-3 text-center" aria-label="Preview unavailable">
          Preview unavailable
        </div>
      );
    }
    return this.props.children;
  }
}
