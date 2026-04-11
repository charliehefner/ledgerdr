import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/** Fire-and-forget error logger – never throws */
async function logErrorToDb(
  errorMessage: string,
  stackTrace?: string,
  componentName?: string
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await (supabase as any).from("app_error_log").insert({
      user_id: user?.id ?? null,
      error_message: errorMessage.slice(0, 2000),
      stack_trace: stackTrace?.slice(0, 8000) ?? null,
      page_url: window.location.href,
      user_agent: navigator.userAgent,
      component_name: componentName ?? null,
    });
  } catch {
    // swallow – logging must never break the app
  }
}

// Global handlers for errors outside React tree
if (typeof window !== "undefined") {
  window.addEventListener("error", (event) => {
    logErrorToDb(
      event.message || "Unhandled error",
      event.error?.stack,
      "window.onerror"
    );
  });

  window.addEventListener("unhandledrejection", (event) => {
    const msg =
      event.reason instanceof Error
        ? event.reason.message
        : String(event.reason);
    const stack =
      event.reason instanceof Error ? event.reason.stack : undefined;
    logErrorToDb(msg, stack, "unhandledrejection");
  });
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    const msg = error.message?.toLowerCase() || "";
    if (
      msg.includes("insertbefore") ||
      msg.includes("removechild") ||
      msg.includes("failed to execute")
    ) {
      console.warn("[ErrorBoundary] Suppressed browser extension DOM error:", error.message);
      return { hasError: false, error: null };
    }
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught error:", error, errorInfo);
    logErrorToDb(
      error.message,
      error.stack,
      errorInfo.componentStack?.slice(0, 500) ?? "ErrorBoundary"
    );
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-md w-full bg-card rounded-xl border border-border p-8 shadow-sm text-center space-y-4">
            <div className="flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-7 w-7 text-destructive" />
              </div>
            </div>
            <h2 className="text-xl font-semibold text-foreground">
              Algo salió mal
            </h2>
            <p className="text-sm text-muted-foreground">
              Ocurrió un error inesperado. Intente recargar la página.
            </p>
            {this.state.error && (
              <pre className="text-xs text-left bg-muted rounded-lg p-3 overflow-auto max-h-32 text-muted-foreground">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex gap-3 justify-center pt-2">
              <Button variant="outline" onClick={this.handleReset}>
                Reintentar
              </Button>
              <Button onClick={this.handleReload}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Recargar página
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
