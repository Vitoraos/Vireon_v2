/**
 * Displays the doctor's response and plays it via TTS.
 * Shows action + note clearly. Audio is optional fallback.
 */

import { useState, useRef } from 'react';
import { DoctorResponseCheck } from '@/types';
import { DOCTOR_ACTION_LABELS } from '@/lib/constants';

interface DoctorResponsePlayerProps {
  response: DoctorResponseCheck;
}

export function DoctorResponsePlayer({ response }: DoctorResponsePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const actionLabel = response.action
    ? DOCTOR_ACTION_LABELS[response.action] || response.action
    : 'Response received';

  const handlePlay = () => {
    // In a real implementation, this would play the TTS audio
    // For now, we simulate audio playback state
    setIsPlaying(true);
    setTimeout(() => setIsPlaying(false), 3000);
  };

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-accent"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
            />
          </svg>
        </div>

        <div className="space-y-1">
          <h2 className="font-display text-xl font-bold text-ink-primary">
            Doctor response
          </h2>
          <p className="text-sm text-ink-secondary">
            Your case has been reviewed
          </p>
        </div>
      </div>

      <div className="bg-surface rounded-soft border-hairline p-5 space-y-4">
        <div>
          <span className="text-[10px] uppercase tracking-widest text-ink-tertiary font-medium">
            Recommended action
          </span>
          <p className="text-base font-medium text-ink-primary mt-1">
            {actionLabel}
          </p>
        </div>

        {response.note && (
          <div>
            <span className="text-[10px] uppercase tracking-widest text-ink-tertiary font-medium">
              Doctor's note
            </span>
            <p className="text-sm text-ink-secondary mt-1 leading-relaxed">
              {response.note}
            </p>
          </div>
        )}
      </div>

      {/* Audio playback button — functional when TTS is wired */}
      <button
        onClick={handlePlay}
        disabled={isPlaying}
        className="w-full py-3 bg-accent text-white rounded-soft font-medium text-sm
                   hover:bg-accent-deep transition-colors duration-150
                   disabled:opacity-60 disabled:cursor-not-allowed
                   focus:outline-none focus:ring-2 focus:ring-accent/30
                   flex items-center justify-center gap-2"
      >
        {isPlaying ? (
          <>
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Playing...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            Listen to response
          </>
        )}
      </button>
    </div>
  );
}
