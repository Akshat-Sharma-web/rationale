import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode; fallback?: ReactNode }
interface State { hasError: boolean }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div style={{ padding: '2rem', color: '#9ca3af' }}>
          <p>Something went wrong loading this page.</p>
          <button onClick={() => this.setState({ hasError: false })} style={{ marginTop: '1rem', color: '#4f46e5' }}>Try again</button>
        </div>
      )
    }
    return this.props.children
  }
}
