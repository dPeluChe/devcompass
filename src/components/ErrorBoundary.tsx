import { Component, type ReactNode } from 'react'

type Props = {
  /** Names the region in the fallback copy, e.g. "this view". */
  label?: string
  children: ReactNode
}

type State = { error: Error | null }

/**
 * Catches render/lifecycle crashes so one broken region doesn't blank the whole
 * app. Mount with a `key` tied to the current route/scope so navigating away
 * auto-resets; "Try again" re-renders in place for transient failures.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error(`[ErrorBoundary${this.props.label ? `:${this.props.label}` : ''}]`, error)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="eb-fallback" role="alert">
        <strong>Something broke in {this.props.label ?? 'this view'}.</strong>
        <pre className="eb-message">{this.state.error.message}</pre>
        <div className="eb-actions">
          <button className="hs-modal-btn primary" onClick={() => this.setState({ error: null })}>Try again</button>
          <button className="hs-modal-btn" onClick={() => window.location.reload()}>Reload app</button>
        </div>
      </div>
    )
  }
}
