/**
 * Application constants and configuration.
 * All magic numbers live here.
 */

// API
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Interview constraints (must match backend)
export const MAX_TURNS = 8;

// Polling configuration
export const POLL_INTERVAL_MS = 3000;
export const MAX_POLL_ATTEMPTS = 60; // 3 minutes total

// Timeouts
export const API_TIMEOUT_MS = 15000;
export const TTS_PLAYBACK_TIMEOUT_MS = 30000;

// Audio
export const MAX_RECORDING_DURATION_MS = 60000; // 60 seconds max per turn
export const AUDIO_MIME_TYPE_PREFERENCE = [
  'audio/webm',
  'audio/mp4',
  'audio/ogg',
  'audio/wav',
];

// UI text — clinical tone, no AI transparency
export const UI_COPY = {
  idle: {
    title: 'Start your consultation',
    subtitle: 'Hold the button and describe how you feel. Speak naturally in any language.',
    action: 'Hold to speak',
  },
  recording: {
    title: 'Listening',
    subtitle: 'Release when you are finished speaking',
  },
  uploading: {
    title: 'Understanding your voice',
    subtitle: 'This may take a few moments',
  },
  processing: {
    title: 'Analyzing your response',
    subtitle: 'Preparing the next question',
  },
  playing_tts: {
    title: '',
    subtitle: '',
  },
  generating_report: {
    title: 'Compiling your report',
    subtitle: 'Organizing your symptoms for the doctor',
  },
  submitted: {
    title: 'Report submitted',
    subtitle: 'A doctor will review your case shortly',
  },
  polling: {
    title: 'Waiting for doctor review',
    subtitle: 'You will be notified when a response is ready',
  },
  response_received: {
    title: 'Doctor response',
    subtitle: '',
  },
  error: {
    default: 'Something went wrong. Please try again.',
    transcription_failed: 'We could not understand your voice. Please try speaking more clearly.',
    network_error: 'Connection issue. Please check your internet and try again.',
    timeout: 'This is taking longer than expected. Please try again.',
  },
  disclaimer: 'Hackathon prototype — not a substitute for medical advice.',
} as const;

// Slot display names (for doctor dashboard)
export const SLOT_LABELS: Record<string, string> = {
  duration: 'Duration',
  severity: 'Severity',
  associated_symptoms: 'Associated Symptoms',
  relevant_history: 'Relevant History',
  anything_else: 'Additional Information',
};

// Doctor action labels
export const DOCTOR_ACTION_LABELS: Record<string, string> = {
  prescribe: 'Prescribe Medication',
  request_appointment: 'Request Appointment',
  recommend_emergency: 'Recommend Emergency Care',
};
