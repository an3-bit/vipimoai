import React from "react";

type Props = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

type State = {
  hasError: boolean;
};

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    // This prints the component stack so we can pinpoint which component is using Context.Consumer incorrectly.
    console.error("[ErrorBoundary] Caught error:", error);
    console.error("[ErrorBoundary] Component stack:", info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="min-h-screen bg-background flex items-center justify-center p-6">
            <div className="max-w-lg w-full rounded-lg border border-border bg-card p-6">
              <h1 className="text-xl font-semibold">Something went wrong</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                The app hit a runtime error while rendering this page. Please refresh, or go back and try again.
              </p>
              <button
                className="mt-4 inline-flex h-9 items-center justify-center rounded-md border border-border bg-background px-4 text-sm"
                onClick={() => window.location.reload()}
              >
                Reload page
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
