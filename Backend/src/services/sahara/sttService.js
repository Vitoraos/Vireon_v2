const fetch = require('node-fetch');
const FormData = require('form-data');
const { withTimeout } = require('../../lib/timeout');
const circuitBreaker = require('../../lib/circuitBreaker');

const SAHARA_API_KEY = process.env.SAHARA_API_KEY;
const SAHARA_STT_BASE_URL = process.env.SAHARA_STT_BASE_URL;
const SAHARA_STT_MODE = process.env.SAHARA_STT_MODE || 'batch'; // 'batch' | 'streaming'
const SERVICE_NAME = 'sahara_stt';

/**
 * PLACEHOLDER 1: batch mode works today with the current API key tier.
 * Streaming mode (wss://infer.voice.intron.io/stt/v1/stream) needs a
 * confirmed Integrator Account — see .env.example. Once confirmed, implement
 * transcribeStreaming() below and flip SAHARA_STT_MODE=streaming; nothing
 * else in the codebase needs to change, since routes call transcribe()
 * and never care which mode is active.
 */
async function transcribe(sessionId, audioBuffer, audioFileName) {
  if (SAHARA_STT_MODE === 'streaming') {
    return transcribeStreaming(sessionId, audioBuffer, audioFileName);
  }
  return transcribeBatch(sessionId, audioBuffer, audioFileName);
}

async function transcribeBatch(sessionId, audioBuffer, audioFileName) {
  if (circuitBreaker.isOpen(sessionId, SERVICE_NAME)) {
    throw new Error('sahara_stt_circuit_open');
  }

  try {
    const form = new FormData();
    form.append('audio_file_blob', audioBuffer, audioFileName);
    form.append('audio_file_name', audioFileName);

    // Optional post-processing, per confirmed Sahara docs — opt-in only via
    // env, both unset by default. Deliberately NOT wiring get_treatment_plan,
    // get_differential_diagnosis, get_practice_guidelines, or get_icd_codes:
    // those generate diagnostic/treatment content directly from STT, which
    // is exactly what this project's PRD says the AI must never do ("does
    // not diagnose or prescribe"). Enabling them would bypass that safety
    // boundary one layer upstream of Qwen 3, not respect it.
    const useCategory = process.env.SAHARA_STT_USE_CATEGORY; // e.g. 'file_category_telehealth'
    const inputLanguage = process.env.SAHARA_STT_INPUT_LANGUAGE; // ASR input language code, see Sahara's supported-languages page
    if (useCategory) form.append('use_category', useCategory);
    if (inputLanguage) form.append('use_language_asr_input', inputLanguage);

    const uploadRes = await withTimeout(
      fetch(`${SAHARA_STT_BASE_URL}/file/v1/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${SAHARA_API_KEY}` },
        body: form
      }),
      10000,
      'sahara_stt_upload'
    );
    if (!uploadRes.ok) throw new Error(`sahara_upload_http_${uploadRes.status}`);
    const uploadJson = await uploadRes.json();
    const fileId = uploadJson.data?.file_id;
    if (!fileId) throw new Error('sahara_upload_missing_file_id');

    const transcript = await pollForTranscript(fileId);
    circuitBreaker.recordSuccess(sessionId, SERVICE_NAME);
    return transcript;
  } catch (err) {
    circuitBreaker.recordFailure(sessionId, SERVICE_NAME);
    throw err;
  }
}

async function pollForTranscript(fileId, maxAttempts = 20, intervalMs = 1500) {
  // NOTE: exact response field names for GET /file/v1/status/:id (status,
  // transcript) are inferred from the upload endpoint's pattern, not
  // independently confirmed against that specific endpoint's docs.
  // DIAGNOSTIC LOGGING added below: since a real timeout was hit against
  // live Render logs with no way to tell whether the cause is (a) genuinely
  // slow processing or (b) wrong field names causing 'completed' to never
  // match, the raw response is now logged so the next occurrence reveals
  // the real shape instead of guessing again.
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const statusRes = await fetch(`${SAHARA_STT_BASE_URL}/file/v1/status/${fileId}`, {
      headers: { Authorization: `Bearer ${SAHARA_API_KEY}` }
    });
    if (!statusRes.ok) {
      console.warn(`sahara_stt_poll_http_error attempt=${i} status=${statusRes.status}`);
      continue; // transient — keep polling within budget
    }
    const statusJson = await statusRes.json();

    // Log the FULL raw response on the first attempt, and again on the
    // last attempt before giving up — enough to see the real shape without
    // flooding logs on every one of the up-to-20 polls.
    if (i === 0 || i === maxAttempts - 1) {
      console.log(`sahara_stt_poll_raw attempt=${i} fileId=${fileId}`, JSON.stringify(statusJson));
    }

    const status = statusJson.data?.status ?? statusJson.status;
    const transcript = statusJson.data?.transcript ?? statusJson.transcript;

    if (status === 'completed' || status === 'success' || status === 'done') {
      if (!transcript) {
        console.error('sahara_stt_status_completed_but_no_transcript', JSON.stringify(statusJson));
        throw new Error('sahara_transcription_completed_but_missing_transcript');
      }
      return transcript;
    }
    if (status === 'failed' || status === 'error') {
      console.error('sahara_stt_status_failed', JSON.stringify(statusJson));
      throw new Error('sahara_transcription_failed_upstream');
    }
  }
  throw new Error('sahara_transcription_timed_out');
}

// eslint-disable-next-line no-unused-vars
async function transcribeStreaming(sessionId, audioBuffer, audioFileName) {
  // TODO once Integrator Account access is confirmed:
  // open wss://infer.voice.intron.io/stt/v1/stream, stream audio chunks
  // (1KB-32KB per Sahara's documented limits), send commit message, resolve
  // on final transcript. Session lifetime cap is 300s per Sahara docs.
  throw new Error('sahara_stt_streaming_not_yet_implemented');
}

module.exports = { transcribe };
