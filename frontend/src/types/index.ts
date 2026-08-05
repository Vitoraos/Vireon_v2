/**
 * Type definitions matching the backend API contract exactly.
 * Source of truth: API-Contract-3.md
 */

// ─── /api/transcribe ───

export interface TranscribeRequest {
  audio_file_blob: File;
  session_id: string;
}

export interface TranscribeResponse {
  transcript: string;
  session_id: string;
}

export interface TranscribeError {
  error: 'transcription_failed';
}

// ─── /api/interview-turn ───

export type SlotName =
  | 'duration'
  | 'severity'
  | 'associated_symptoms'
  | 'relevant_history'
  | 'anything_else';

export interface HistoryTurn {
  role: 'patient' | 'agent';
  text: string;
}

export interface InterviewTurnRequest {
  session_id: string;
  transcript: string;
  history: HistoryTurn[];
}

export interface SlotsFilled {
  duration: string | null;
  severity: number | null;
  associated_symptoms: string | null;
  relevant_history: string | null;
  anything_else: string | null;
}

export interface InterviewTurnResponse {
  next_question: string | null;
  slot_targeted: SlotName | null;
  slots_filled: SlotsFilled;
  red_flag_detected: boolean;
  recommend_emergency: boolean;
  turns_used: number;
  done: boolean;
}

// ─── /api/generate-report ───

export interface GenerateReportRequest {
  session_id: string;
  chief_complaint: string;
  full_transcript: string;
}

// NOTE: severity becomes severity_score in the report
export interface Report {
  report_id: string;
  chief_complaint: string;
  duration: string | null;
  severity_score: number | null;
  associated_symptoms: string | null;
  relevant_history: string | null;
  anything_else: string | null;
  red_flag_detected: boolean;
  recommend_emergency: boolean;
  full_transcript: string;
  turns_used: number;
  status: 'pending' | 'responded';
  created_at?: string;
}

export type GenerateReportResponse = Report;

// ─── /api/reports/:report_id ───

export type GetReportResponse = Report;

// ─── /api/doctor-response ───

export type DoctorAction = 'prescribe' | 'request_appointment' | 'recommend_emergency';

export interface DoctorResponseRequest {
  report_id: string;
  action: DoctorAction;
  note: string;
}

export interface DoctorResponseSuccess {
  ok: true;
}

// ─── /api/doctor-response/:report_id ───

export interface DoctorResponseCheck {
  responded: boolean;
  action: DoctorAction | null;
  note: string | null;
}

// ─── Generic error shape ───

export interface ApiError {
  error: string;
}

// ─── Frontend-only types ───

export type InterviewStatus =
  | 'idle'
  | 'recording'
  | 'uploading'
  | 'processing'
  | 'playing_tts'
  | 'generating_report'
  | 'submitted'
  | 'polling'
  | 'response_received'
  | 'error';

export interface InterviewState {
  status: InterviewStatus;
  sessionId: string;
  history: HistoryTurn[];
  chiefComplaint: string | null;
  currentTranscript: string | null;
  slotsFilled: SlotsFilled | null;
  turnsUsed: number;
  reportId: string | null;
  doctorResponse: DoctorResponseCheck | null;
  errorMessage: string | null;
  recoverable: boolean;
  // Non-persisted UI state
  isRecording: boolean;
  ttsText: string | null;
}
