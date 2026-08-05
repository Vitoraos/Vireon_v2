/**
 * The primary interaction element.
 * A large, accessible button that initiates and stops recording.
 * Visual states: idle, recording (with gradient ring), disabled.
 */

'use client';

import { useRef, useState } from 'react';

interface RecordingButtonProps {
  isRecording: boolean;
  disabled?: boolean;
  onStart: () => void;
  onStop: () => void;
}

export function RecordingButton({
  isRecording,
  disabled,
  onStart,
  onStop,
}: RecordingButtonProps) {
  const [isPressed, setIsPressed] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handlePointerDown = () => {
    if (disabled || isRecording) return;
    setIsPressed(true);
    onStart();
  };

  const handlePointerUp = () => {
    setIsPressed(false);
    if (isRecording) {
      onStop();
    }
  };

  const handlePointerLeave = () => {
    if (isPressed && isRecording) {
      setIsPressed(false);
      onStop();
    }
  };

  // Keyboard support
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      if (!isRecording && !disabled) {
        onStart();
      }
    }
  };

  const handleKeyUp = (e: React.KeyboardEvent) => {
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      if (isRecording) {
        onStop();
      }
    }
  };

  return (
    <button
      ref={buttonRef}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      disabled={disabled}
      aria-label={isRecording ? 'Stop recording' : 'Hold to speak'}
      className={`
        relative w-20 h-20 rounded-full flex items-center justify-center
        transition-all duration-200 ease-out
        focus:outline-none
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${isRecording ? 'scale-110' : isPressed ? 'scale-105' : 'scale-100 hover:scale-105'}
      `}
      style={{
        background: isRecording
          ? 'linear-gradient(135deg, #2563EB 0%, #1E40AF 50%, #0A1628 100%)'
          : '#2563EB',
        boxShadow: isRecording
          ? '0 0 0 6px rgba(37, 99, 235, 0.2), 0 8px 24px rgba(37, 99, 235, 0.3)'
          : isPressed
          ? '0 0 0 4px rgba(37, 99, 235, 0.2), 0 4px 16px rgba(37, 99, 235, 0.2)'
          : '0 4px 16px rgba(37, 99, 235, 0.15)',
      }}
    >
      {/* Microphone icon */}
      <svg
        className="w-8 h-8 text-white"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        {isRecording ? (
          // Stop square icon when recording
          <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
        ) : (
          // Microphone icon when idle
          <>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
            />
          </>
        )}
      </svg>

      {/* Recording pulse ring */}
      {isRecording && (
        <span className="absolute inset-0 rounded-full animate-ping bg-accent/20" />
      )}
    </button>
  );
}
