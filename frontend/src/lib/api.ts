/**
 * API client layer.
 * Every call is wrapped in defensive error handling.
 * No raw fetch calls outside this file.
 */

import {
  TranscribeResponse,
  InterviewTurnRequest,
  InterviewTurnResponse,
  GenerateReportRequest,
  GenerateReportResponse,
  GetReportResponse,
  DoctorResponseRequest,
  DoctorResponseSuccess,
  DoctorResponseCheck,
  ApiError,
} from '@/types';
import { API_BASE_URL, API_TIMEOUT_MS } from './constants';

// ─── Helpers ───

class ApiClientError extends Error {
  constructor(
    message: string,
    public code: string,
    public status?: number
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

async function fetchWithTimeout(
  input: RequestInfo,
  init: RequestInit & { timeout?: number } = {}
): Promise<Response> {
  const { timeout = API_TIMEOUT_MS, ...rest } = init;

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(input, {
      ...rest,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(id);
  }
}

async function parseJsonSafely(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function assertField<T>(
  obj: unknown,
  field: string,
  validator: (v: unknown) => v is T
): T {
  if (obj === null || typeof obj !== 'object') {
    throw new ApiClientError(`Invalid response: expected object`, 'invalid_response');
  }
  const value = (obj as Record<string, unknown>)[field];
  if (!validator(value)) {
    throw new ApiClientError(
      `Invalid response: missing or invalid field "${field}"`,
      'invalid_response'
    );
  }
  return value;
}

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

function isNumber(v: unknown): v is number {
  return typeof v === 'number';
}

function isBoolean(v: unknown): v is boolean {
  return typeof v === 'boolean';
}

function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// ─── API Methods ───

/**
 * POST /api/transcribe
 * Uploads audio blob, returns transcript.
 */
export async function transcribeAudio(
  audioBlob: Blob,
  sessionId: string
): Promise<TranscribeResponse> {
  const formData = new FormData();
  formData.append('audio_file_blob', audioBlob, 'recording.webm');
  formData.append('session_id', sessionId);

  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/transcribe`,
    {
      method: 'POST',
      body: formData,
      timeout: 30000, // STT can take up to 15s polling on backend
    }
  );

  const data = await parseJsonSafely(response);

  if (!response.ok) {
    const errorObj: ApiError = isObject(data) && isString(data.error)
      ? { error: data.error }
      : { error: 'transcription_failed' };
    throw new ApiClientError(
      errorObj.error,
      errorObj.error,
      response.status
    );
  }

  // Defensive: validate response shape
  if (!isObject(data)) {
    throw new ApiClientError('Invalid response shape', 'invalid_response');
  }

  const transcript = assertField(data, 'transcript', isString);
  const returnedSessionId = assertField(data, 'session_id', isString);

  return { transcript, session_id: returnedSessionId };
}

/**
 * POST /api/interview-turn
 */
export async function sendInterviewTurn(
  payload: InterviewTurnRequest
): Promise<InterviewTurnResponse> {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/interview-turn`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );

  const data = await parseJsonSafely(response);

  if (!response.ok) {
    const errorObj: ApiError = isObject(data) && isString(data.error)
      ? { error: data.error }
      : { error: 'interview_turn_failed' };
    throw new ApiClientError(errorObj.error, errorObj.error, response.status);
  }

  if (!isObject(data)) {
    throw new ApiClientError('Invalid response shape', 'invalid_response');
  }

  // Defensive parse — every field validated
  const next_question = data.next_question === null ? null : assertField(data, 'next_question', isString);
  const slot_targeted = data.slot_targeted === null ? null : assertField(data, 'slot_targeted', isString);
  const red_flag_detected = assertField(data, 'red_flag_detected', isBoolean);
  const recommend_emergency = assertField(data, 'recommend_emergency', isBoolean);
  const turns_used = assertField(data, 'turns_used', isNumber);
  const done = assertField(data, 'done', isBoolean);

  const slotsData = assertField(data, 'slots_filled', isObject);
  const slots_filled = {
    duration: slotsData.duration === null ? null : isString(slotsData.duration) ? slotsData.duration : null,
    severity: slotsData.severity === null ? null : isNumber(slotsData.severity) ? slotsData.severity : null,
    associated_symptoms: slotsData.associated_symptoms === null ? null : isString(slotsData.associated_symptoms) ? slotsData.associated_symptoms : null,
    relevant_history: slotsData.relevant_history === null ? null : isString(slotsData.relevant_history) ? slotsData.relevant_history : null,
    anything_else: slotsData.anything_else === null ? null : isString(slotsData.anything_else) ? slotsData.anything_else : null,
  };

  return {
    next_question,
    slot_targeted,
    slots_filled,
    red_flag_detected,
    recommend_emergency,
    turns_used,
    done,
  };
}

/**
 * POST /api/generate-report
 */
export async function generateReport(
  payload: GenerateReportRequest
): Promise<GenerateReportResponse> {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/generate-report`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );

  const data = await parseJsonSafely(response);

  if (!response.ok) {
    const errorObj: ApiError = isObject(data) && isString(data.error)
      ? { error: data.error }
      : { error: 'generate_report_failed' };
    throw new ApiClientError(errorObj.error, errorObj.error, response.status);
  }

  if (!isObject(data)) {
    throw new ApiClientError('Invalid response shape', 'invalid_response');
  }

  // Validate required report fields
  const report_id = assertField(data, 'report_id', isString);
  const chief_complaint = assertField(data, 'chief_complaint', isString);
  const red_flag_detected = assertField(data, 'red_flag_detected', isBoolean);
  const recommend_emergency = assertField(data, 'recommend_emergency', isBoolean);
  const full_transcript = assertField(data, 'full_transcript', isString);
  const turns_used = assertField(data, 'turns_used', isNumber);
  const status = assertField(data, 'status', isString);

  return {
    report_id,
    chief_complaint,
    duration: data.duration === null ? null : isString(data.duration) ? data.duration : null,
    severity_score: data.severity_score === null ? null : isNumber(data.severity_score) ? data.severity_score : null,
    associated_symptoms: data.associated_symptoms === null ? null : isString(data.associated_symptoms) ? data.associated_symptoms : null,
    relevant_history: data.relevant_history === null ? null : isString(data.relevant_history) ? data.relevant_history : null,
    anything_else: data.anything_else === null ? null : isString(data.anything_else) ? data.anything_else : null,
    red_flag_detected,
    recommend_emergency,
    full_transcript,
    turns_used,
    status: status as 'pending' | 'responded',
  };
}

/**
 * GET /api/reports/:report_id
 */
export async function getReport(reportId: string): Promise<GetReportResponse> {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/reports/${encodeURIComponent(reportId)}`
  );

  const data = await parseJsonSafely(response);

  if (!response.ok) {
    const errorObj: ApiError = isObject(data) && isString(data.error)
      ? { error: data.error }
      : { error: 'fetch_report_failed' };
    throw new ApiClientError(errorObj.error, errorObj.error, response.status);
  }

  if (!isObject(data)) {
    throw new ApiClientError('Invalid response shape', 'invalid_response');
  }

  // Reuse validation logic from generateReport
  const report_id = assertField(data, 'report_id', isString);
  const chief_complaint = assertField(data, 'chief_complaint', isString);
  const red_flag_detected = assertField(data, 'red_flag_detected', isBoolean);
  const recommend_emergency = assertField(data, 'recommend_emergency', isBoolean);
  const full_transcript = assertField(data, 'full_transcript', isString);
  const turns_used = assertField(data, 'turns_used', isNumber);
  const status = assertField(data, 'status', isString);

  return {
    report_id,
    chief_complaint,
    duration: data.duration === null ? null : isString(data.duration) ? data.duration : null,
    severity_score: data.severity_score === null ? null : isNumber(data.severity_score) ? data.severity_score : null,
    associated_symptoms: data.associated_symptoms === null ? null : isString(data.associated_symptoms) ? data.associated_symptoms : null,
    relevant_history: data.relevant_history === null ? null : isString(data.relevant_history) ? data.relevant_history : null,
    anything_else: data.anything_else === null ? null : isString(data.anything_else) ? data.anything_else : null,
    red_flag_detected,
    recommend_emergency,
    full_transcript,
    turns_used,
    status: status as 'pending' | 'responded',
  };
}

/**
 * POST /api/doctor-response
 */
export async function submitDoctorResponse(
  payload: DoctorResponseRequest
): Promise<DoctorResponseSuccess> {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/doctor-response`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );

  const data = await parseJsonSafely(response);

  if (!response.ok) {
    const errorObj: ApiError = isObject(data) && isString(data.error)
      ? { error: data.error }
      : { error: 'doctor_response_failed' };
    throw new ApiClientError(errorObj.error, errorObj.error, response.status);
  }

  return { ok: true };
}

/**
 * GET /api/doctor-response/:report_id
 */
export async function checkDoctorResponse(
  reportId: string
): Promise<DoctorResponseCheck> {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/doctor-response/${encodeURIComponent(reportId)}`
  );

  const data = await parseJsonSafely(response);

  if (!response.ok) {
    const errorObj: ApiError = isObject(data) && isString(data.error)
      ? { error: data.error }
      : { error: 'check_response_failed' };
    throw new ApiClientError(errorObj.error, errorObj.error, response.status);
  }

  if (!isObject(data)) {
    throw new ApiClientError('Invalid response shape', 'invalid_response');
  }

  const responded = assertField(data, 'responded', isBoolean);
  const action = data.action === null ? null : isString(data.action) ? data.action : null;
  const note = data.note === null ? null : isString(data.note) ? data.note : null;

  return { responded, action, note };
}

/**
 * POST /api/tts
 * Backend engineer will add this endpoint. Graceful fallback if 404.
 */
export async function synthesizeSpeech(text: string): Promise<Blob | null> {
  try {
    const response = await fetchWithTimeout(
      `${API_BASE_URL}/api/tts`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        timeout: 15000,
      }
    );

    if (!response.ok) {
      console.warn('TTS endpoint returned error, falling back to text-only:', response.status);
      return null;
    }

    return await response.blob();
  } catch (err) {
    // 404, network error, timeout — all fall back to text-only
    console.warn('TTS unavailable, falling back to text-only:', err);
    return null;
  }
}

// ─── Export error class for hook usage ───
export { ApiClientError };
