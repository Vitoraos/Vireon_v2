/**
 * Displays the conversation history.
 * Patient turns and agent turns shown with clear visual distinction.
 * No chat bubbles — clean, clinical text blocks.
 */

import { HistoryTurn } from '@/types';

interface TranscriptDisplayProps {
  history: HistoryTurn[];
}

export function TranscriptDisplay({ history }: TranscriptDisplayProps) {
  if (history.length === 0) return null;

  return (
    <div className="w-full max-w-md space-y-4">
      {history.map((turn, index) => (
        <div
          key={index}
          className={`
            flex flex-col gap-1
            ${turn.role === 'patient' ? 'items-start' : 'items-end'}
          `}
        >
          <span className="text-[10px] uppercase tracking-widest text-ink-tertiary font-medium">
            {turn.role === 'patient' ? 'You' : 'Clinician'}
          </span>
          <p
            className={`
              text-sm leading-relaxed max-w-[90%]
              ${turn.role === 'patient'
                ? 'text-ink-primary'
                : 'text-ink-secondary italic'
              }
            `}
          >
            {turn.text}
          </p>
        </div>
      ))}
    </div>
  );
}
