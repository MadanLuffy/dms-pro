import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(err) {
    return { hasError: true, message: err?.message || 'Something went wrong' };
  }

  componentDidCatch(err, info) {
    console.error('[ErrorBoundary]', err, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 48,
            textAlign: 'center',
            gap: 12,
            minHeight: this.props.minHeight || 200,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--danger, #b91c1c)' }}>Error</div>
          <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-main)' }}>This section failed to load</div>
          <div style={{ fontSize: 13, color: 'var(--text-light)', maxWidth: 420 }}>{this.state.message}</div>
          <button
            className="btn btn-primary"
            onClick={() => this.setState({ hasError: false, message: '' })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}