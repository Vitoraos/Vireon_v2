/**
 * Progress dots for multi-step pipeline stages.
 * Shows 4 states: recording complete → transcribing → analyzing → ready.
 * No spinners, no "AI is thinking" text.
 */

interface StatusIndicatorProps {
  stage: 'uploading' | 'processing' | 'generating_report' | 'polling';
}

const STAGE_CONFIG = {
  uploading: {
    label: 'Understanding your voice',
    activeIndex: 0,
  },
  processing: {
    label: 'Analyzing your response',
    activeIndex: 1,
  },
  generating_report: {
    label: 'Compiling your report',
    activeIndex: 2,
  },
  polling: {
    label: 'Waiting for doctor review',
    activeIndex: 3,
  },
};

export function StatusIndicator({ stage }: StatusIndicatorProps) {
  const config = STAGE_CONFIG[stage];
  const totalDots = 4;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-3">
        {Array.from({ length: totalDots }).map((_, i) => (
          <div
            key={i}
            className={`
              w-2 h-2 rounded-full transition-all duration-300
              ${i < config.activeIndex
                ? 'bg-accent'
                : i === config.activeIndex
                ? 'bg-accent animate-pulse'
                : 'bg-ink-tertiary/30'
              }
            `}
          />
        ))}
      </div>
      <p className="text-sm text-ink-secondary font-medium">
        {config.label}
      </p>
    </div>
  );
}
