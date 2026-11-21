import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'حدث خطأ غير متوقع في التطبيق.',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Application ErrorBoundary caught:', error, errorInfo);
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      let friendlyMessage = this.state.errorMessage;
      try {
        const parsed = JSON.parse(this.state.errorMessage) as { error?: string; operationType?: string };
        if (parsed.error) {
          friendlyMessage = `خطأ في قاعدة البيانات (${parsed.operationType || 'read/write'}): ${parsed.error}`;
        }
      } catch {
        // use raw message
      }

      return (
        <div
          dir="rtl"
          className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-900 dark:bg-black dark:text-zinc-100"
        >
          <div className="w-full max-w-lg rounded-xl border border-rose-300 bg-white p-6 shadow-sm dark:border-rose-900/60 dark:bg-[#09090b]">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-6 w-6 shrink-0" aria-hidden="true" />
              <h1 className="text-lg font-bold">تعذر إكمال العملية</h1>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-zinc-300">
              {friendlyMessage}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              <span>إعادة تحميل التطبيق</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
