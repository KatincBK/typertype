import { Component, type ErrorInfo, type ReactNode } from "react";
import { logger } from "@/lib/logger";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error("ErrorBoundary caught", error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <div role="alert" className="error-boundary">
          <h1>Beklenmeyen hata oluştu</h1>
          <pre>{this.state.error.message}</pre>
          <button type="button" onClick={this.reset}>
            Yeniden dene
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
