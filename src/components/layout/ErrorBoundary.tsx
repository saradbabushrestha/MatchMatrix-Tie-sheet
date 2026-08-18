import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertOctagon, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
  /** Shown instead of the generic message when provided. */
  label?: string
}

interface State {
  error: Error | null
}

/**
 * Catches render errors so one broken panel does not blank the whole app.
 *
 * Placed around each route and around the bracket canvas, which is the most
 * likely place for a data-shape surprise to surface.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep the details in the console — there is no error-reporting backend.
    console.error('Unhandled error in', this.props.label ?? 'component', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="flex size-11 items-center justify-center rounded-full bg-destructive/12 text-destructive">
          <AlertOctagon className="size-5" />
        </div>
        <div className="space-y-1">
          <p className="font-semibold">
            {this.props.label ? `${this.props.label} could not be displayed` : 'Something went wrong'}
          </p>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            {error.message || 'An unexpected error occurred.'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => this.setState({ error: null })}>
            <RefreshCw />
            Try again
          </Button>
          <Button size="sm" onClick={() => window.location.reload()}>
            Reload the page
          </Button>
        </div>
      </div>
    )
  }
}
