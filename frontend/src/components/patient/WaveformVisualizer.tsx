/**
 * Canvas-based real-time waveform.
 * Uses the useWaveform hook for actual audio analysis.
 * Falls back to a gentle breathing animation when not recording.
 */

'use client';

import { useEffect } from 'react';
import { useWaveform } from '@/hooks/useWaveform';

interface WaveformVisualizerProps {
  isRecording: boolean;
  stream?: MediaStream | null;
}

export function WaveformVisualizer({ isRecording, stream }: WaveformVisualizerProps) {
  const { canvasRef, startVisualization, stopVisualization } = useWaveform();

  useEffect(() => {
    if (isRecording && stream) {
      startVisualization(stream, {
        width: 320,
        height: 80,
        barCount: 50,
        barWidth: 3,
        gap: 3,
        color: '#2563EB',
      });
    } else {
      stopVisualization();
    }

    return () => {
      stopVisualization();
    };
  }, [isRecording, stream, startVisualization, stopVisualization]);

  return (
    <div className="w-full flex items-center justify-center py-4">
      {isRecording ? (
        <canvas
          ref={canvasRef}
          className="w-full max-w-xs h-20"
          style={{ width: 320, height: 80 }}
        />
      ) : (
        <div className="flex items-center gap-1 h-20">
          {Array.from({ length: 40 }).map((_, i) => (
            <div
              key={i}
              className="w-1 rounded-full bg-accent/20 animate-breathe"
              style={{
                height: `${20 + Math.sin(i * 0.5) * 15 + 10}px`,
                animationDelay: `${i * 0.05}s`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
