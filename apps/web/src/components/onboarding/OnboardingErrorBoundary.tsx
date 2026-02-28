import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { Component, ErrorInfo, ReactNode } from "react";

interface OnboardingErrorBoundaryProps {
  children: ReactNode;
  onReset?: () => void;
  fallbackMessage?: string;
}

interface OnboardingErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class OnboardingErrorBoundary extends Component<
  OnboardingErrorBoundaryProps,
  OnboardingErrorBoundaryState
> {
  constructor(props: OnboardingErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): OnboardingErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("Onboarding Error Boundary caught error:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 md:p-6 w-full max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[50vh] space-y-6">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h3 className="text-xl font-bold text-destructive">Something went wrong</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            {this.props.fallbackMessage || "We encountered an error during the onboarding process. Don't worry, your progress has been saved."}
          </p>
          <div className="flex gap-3">
            <Button
              onClick={this.handleRetry}
              variant="secondary"
              className="rounded-full gap-2"
            >
              {this.props.onReset ? "Retry" : "Reload Page"}
            </Button>
            <Button
              onClick={() => window.location.href = "/onboarding/profile"}
              variant="outline"
              className="rounded-full"
            >
              Start Over
            </Button>
          </div>
          {process.env.NODE_ENV === "development" && this.state.error && (
            <div className="mt-4 p-3 bg-muted rounded-xl text-sm max-w-md text-center break-words">
              <code>{this.state.error.message}</code>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}