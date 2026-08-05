/**
 * Confirmation card shown after report is submitted.
 * Clear, reassuring, no unnecessary decoration.
 */

interface ReportSubmittedCardProps {
  reportId: string;
}

export function ReportSubmittedCard({ reportId }: ReportSubmittedCardProps) {
  return (
    <div className="flex flex-col items-center gap-6 p-8 text-center">
      <div className="w-16 h-16 rounded-full bg-signal-success/10 flex items-center justify-center">
        <svg
          className="w-8 h-8 text-signal-success"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
          />
        </svg>
      </div>

      <div className="space-y-2">
        <h2 className="font-display text-xl font-bold text-ink-primary">
          Report submitted
        </h2>
        <p className="text-sm text-ink-secondary max-w-xs">
          A doctor will review your case shortly. You will hear their response here when it is ready.
        </p>
      </div>

      <div className="px-4 py-2 bg-canvas rounded-soft border-hairline">
        <span className="text-xs text-ink-tertiary font-mono-data">
          Ref: {reportId.slice(0, 8)}...
        </span>
      </div>
    </div>
  );
}
