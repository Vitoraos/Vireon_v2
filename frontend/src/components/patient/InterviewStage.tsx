/**
 * Main patient interview container.
 * Orchestrates all sub-components based on interview state.
 * The "stage" model: one dominant action per viewport.
 */

'use client';

import { useInterviewMachine } from '@/hooks/useInterviewMachine';
import { RecordingButton } from './RecordingButton';
import { WaveformVisualizer } from './WaveformVisualizer';
import { StatusIndicator } from './StatusIndicator';
import { TranscriptDisplay } from './TranscriptDisplay';
import { ReportSubmittedCard } from './ReportSubmittedCard';
import { DoctorResponsePlayer } from './DoctorResponsePlayer';
import { ErrorFallback } from '@/components/shared/ErrorFallback';
import { DisclaimerBanner } from '@/components/shared/DisclaimerBanner';
import { UI_COPY } from '@/lib/constants';

export function InterviewStage() {
  const { state, startRecording, stopRecording, retry, reset } = useInterviewMachine();

  const isInteractionDisabled =
    state.status === 'uploading' ||
    state.status === 'processing' ||
    state.status === 'playing_tts' ||
    state.status === 'generating_report' ||
    state.status === 'polling';

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      {/* Main stage */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md flex flex-col items-center gap-8">
          {/* Header text — changes with state */}
          <div className="text-center space-y-2 min-h-[80px] flex flex-col items-center justify-center">
            {state.status === 'idle' && (
              <>
                <h1 className="font-display text-2xl font-bold text-ink-primary tracking-tight">
                  {UI_COPY.idle.title}
                </h1>
                <p className="text-sm text-ink-secondary max-w-xs">
                  {UI_COPY.idle.subtitle}
                </p>
              </>
            )}

            {state.status === 'recording' && (
              <>
                <h2 className="font-display text-xl font-bold text-ink-primary">
                  {UI_COPY.recording.title}
                </h2>
                <p className="text-sm text-ink-secondary">
                  {UI_COPY.recording.subtitle}
                </p>
              </>
            )}

            {(state.status === 'uploading' || state.status === 'processing') && (
              <StatusIndicator
                stage={state.status === 'uploading' ? 'uploading' : 'processing'}
              />
            )}

            {state.status === 'playing_tts' && state.ttsText && (
              <div className="space-y-2">
                <span className="text-[10px] uppercase tracking-widest text-ink-tertiary font-medium">
                  Clinician
                </span>
                <p className="text-base text-ink-primary italic">
                  {state.ttsText}
                </p>
              </div>
            )}

            {state.status === 'generating_report' && (
              <StatusIndicator stage="generating_report" />
            )}

            {state.status === 'submitted' && (
              <ReportSubmittedCard reportId={state.reportId || ''} />
            )}

            {state.status === 'polling' && (
              <StatusIndicator stage="polling" />
            )}

            {state.status === 'response_received' && state.doctorResponse && (
              <DoctorResponsePlayer response={state.doctorResponse} />
            )}

            {state.status === 'error' && (
              <ErrorFallback
                message={state.errorMessage || 'Something went wrong'}
                onRetry={state.recoverable ? retry : undefined}
                onReset={reset}
              />
            )}
          </div>

          {/* Waveform — shown during recording and TTS */}
          {(state.status === 'recording' || state.status === 'playing_tts') && (
            <WaveformVisualizer
              isRecording={state.status === 'recording'}
              stream={null} // Stream is managed inside useInterviewMachine
            />
          )}

          {/* Recording button — the primary action */}
          {state.status === 'idle' && (
            <div className="flex flex-col items-center gap-4">
              <RecordingButton
                isRecording={state.isRecording}
                disabled={isInteractionDisabled}
                onStart={startRecording}
                onStop={stopRecording}
              />
              <p className="text-xs text-ink-tertiary">
                {UI_COPY.idle.action}
              </p>
            </div>
          )}

          {state.status === 'recording' && (
            <RecordingButton
              isRecording={state.isRecording}
              disabled={false}
              onStart={startRecording}
              onStop={stopRecording}
            />
          )}

          {/* Transcript history — subtle, below the fold */}
          {state.history.length > 0 && state.status !== 'submitted' && state.status !== 'polling' && state.status !== 'response_received' && (
            <div className="w-full pt-4 border-t border-slate-200/60">
              <TranscriptDisplay history={state.history.slice(-4)} />
            </div>
          )}

          {/* Turn counter — subtle progress indicator */}
          {state.turnsUsed > 0 && state.status !== 'submitted' && state.status !== 'polling' && state.status !== 'response_received' && (
            <p className="text-[10px] text-ink-tertiary tracking-widest uppercase">
              Question {state.turnsUsed} of 8
            </p>
          )}
        </div>
      </main>

      {/* Disclaimer — persistent */}
      <DisclaimerBanner />
    </div>
  );
}
