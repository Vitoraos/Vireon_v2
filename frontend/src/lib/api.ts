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
  SlotName,
  DoctorAction,
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

// ─── Domain type guards (root cause fix) ───

const SLOT_NAMES: SlotName[] = [
  'duration',
  'severity',
  'associated_symptoms',
  'relevant_history',
  'anything_else',
];

function isSlotName(v: unknown): v is SlotName {
  return isString(v) && SLOT_NAMES.includes(v as SlotName);
}

const REPORT_STATUSES = ['pending', 'responded'] as const;

function isReportStatus(v: unknown): v is 'pending' | 'responded' {
  return isString(v) && (REPORT_STATUSES as readonly string[]).includes(v);
}

const DOCTOR_ACTIONS: DoctorAction[] = [
  'prescribe',
  'request_appointment',
  'recommend_emergency',
];

function isDoctorAction(v: unknown): v is DoctorAction {
  return isString(v) && DOCTOR_ACTIONS.includes(v as DoctorAction);
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
      timeout: 30000,
    }
  );

  const data = await parseJsonSafely(response);

  if (!response.ok) {
    const errorObj = isObject(data) && isString(data.error)
      ? (data as unknown as ApiError)
      : { error: 'transcription_failed' };
    throw new ApiClientError(
      errorObj.error,
      errorObj.error,
      response.status
    );
  }

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
    const errorObj = isObject(data) && isString(data.error)
      ? (data as unknown as ApiError)
      : { error: 'interview_turn_failed' };
    throw new ApiClientError(errorObj.error, errorObj.error, response.status);
  }

  if (!isObject(data)) {
    throw new ApiClientError('Invalid response shape', 'invalid_response');
  }

  const next_question = data.next_question === null ? null : assertField(data, 'next_question', isString);
  const slot_targeted = data.slot_targeted === null ? null : assertField(data, 'slot_targeted', isSlotName);
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
    const errorObj = isObject(data) && isString(data.error)
      ? (data as unknown as ApiError)
      : { error: 'generate_report_failed' };
    throw new ApiClientError(errorObj.error, errorObj.error, response.status);
  }

  if (!isObject(data)) {
    throw new ApiClientError('Invalid response shape', 'invalid_response');
  }

  const report_id = assertField(data, 'report_id', isString);
  const chief_complaint = assertField(data, 'chief_complaint', isString);
  const red_flag_detected = assertField(data, 'red_flag_detected', isBoolean);
  const recommend_emergency = assertField(data, 'recommend_emergency', isBoolean);
  const full_transcript = assertField(data, 'full_transcript', isString);
  const turns_used = assertField(data, 'turns_used', isNumber);
  const status = assertField(data, 'status', isReportStatus);

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
    status,
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
    const errorObj = isObject(data) && isString(data.error)
      ? (data as unknown as ApiError)
      : { error: 'fetch_report_failed' };
    throw new ApiClientError(errorObj.error, errorObj.error, response.status);
  }

  if (!isObject(data)) {
    throw new ApiClientError('Invalid response shape', 'invalid_response');
  }

  const report_id = assertField(data, 'report_id', isString);
  const chief_complaint = assertField(data, 'chief_complaint', isString);
  const red_flag_detected = assertField(data, 'red_flag_detected', isBoolean);
  const recommend_emergency = assertField(data, 'recommend_emergency', isBoolean);
  const full_transcript = assertField(data, 'full_transcript', isString);
  const turns_used = assertField(data, 'turns_used', isNumber);
  const status = assertField(data, 'status', isReportStatus);

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
    status,
  };
}

/**
 * GET /api/reports/latest
 */
export async function getLatestReport(): Promise<GetReportResponse> {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/reports/latest`
  );

  const data = await parseJsonSafely(response);

  if (!response.ok) {
    const errorObj = isObject(data) && isString(data.error)
      ? (data as unknown as ApiError)
      : { error: 'fetch_latest_report_failed' };
    throw new ApiClientError(errorObj.error, errorObj.error, response.status);
  }

  if (!isObject(data)) {
    throw new ApiClientError('Invalid response shape', 'invalid_response');
  }

  const report_id = assertField(data, 'report_id', isString);
  const chief_complaint = assertField(data, 'chief_complaint', isString);
  const red_flag_detected = assertField(data, 'red_flag_detected', isBoolean);
  const recommend_emergency = assertField(data, 'recommend_emergency', isBoolean);
  const full_transcript = assertField(data, 'full_transcript', isString);
  const turns_used = assertField(data, 'turns_used', isNumber);
  const status = assertField(data, 'status', isReportStatus);

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
    status,
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
    const errorObj = isObject(data) && isString(data.error)
      ? (data as unknown as ApiError)
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
    const errorObj = isObject(data) && isString(data.error)
      ? (data as unknown as ApiError)
      : { error: 'check_response_failed' };
    throw new ApiClientError(errorObj.error, errorObj.error, response.status);
  }

  if (!isObject(data)) {
    throw new ApiClientError('Invalid response shape', 'invalid_response');
  }

  const responded = assertField(data, 'responded', isBoolean);
  const action = data.action === null ? null : assertField(data, 'action', isDoctorAction);
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
    console.warn('TTS unavailable, falling back to text-only:', err);
    return null;
  }
}

// ─── Export error class for hook usage ───
export { ApiClientError };
