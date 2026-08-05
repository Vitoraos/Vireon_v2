/**
 * Error fallback UI.
 * Shows a human-readable message and a recovery action.
 * No technical jargon, no stack traces.
 */

interface ErrorFallbackProps {
  message: string;
  onRetry?: () => void;
  onReset?: () => void;
}

export function ErrorFallback({ message, onRetry, onReset }: ErrorFallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="w-16 h-16 rounded-full bg-signal-critical/10 flex items-center justify-center">
        <svg
          className="w-8 h-8 text-signal-critical"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>

      <div className="space-y-2">
        <h3 className="font-display text-lg font-bold text-ink-primary">
          Something went wrong
        </h3>
        <p className="text-sm text-ink-secondary max-w-xs">
          {message}
        </p>
      </div>

      <div className="flex gap-3">
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-5 py-2.5 bg-accent text-white rounded-soft font-medium text-sm
                       hover:bg-accent-deep transition-colors duration-150
                       focus:outline-none focus:ring-2 focus:ring-accent/30"
          >
            Try again
          </button>
        )}
        {onReset && (
          <button
            onClick={onReset}
            className="px-5 py-2.5 bg-surface border-hairline text-ink-primary rounded-soft
                       font-medium text-sm hover:bg-canvas transition-colors duration-150
                       focus:outline-none focus:ring-2 focus:ring-accent/30"
          >
            Start over
          </button>
        )}
      </div>
    </div>
  );
}
