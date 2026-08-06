const fetch = require('node-fetch');
const FormData = require('form-data');
const { withTimeout } = require('../../lib/timeout');
const circuitBreaker = require('../../lib/circuitBreaker');

const SAHARA_API_KEY = process.env.SAHARA_API_KEY;
const SAHARA_STT_BASE_URL = process.env.SAHARA_STT_BASE_URL;
const SAHARA_STT_MODE = process.env.SAHARA_STT_MODE || 'batch'; // 'batch' | 'streaming'
const SERVICE_NAME = 'sahara_stt';

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

    const useCategory = process.env.SAHARA_STT_USE_CATEGORY;
    const inputLanguage = process.env.SAHARA_STT_INPUT_LANGUAGE;
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

async function pollForTranscript(fileId, maxAttempts = 26, intervalMs = 1500) {
  // CONFIRMED against real Render logs (2026-08-06): the actual shape is
  // data.processing_status (values seen: "FILE_PROCESSING", "FILE_TRANSCRIBED")
  // and data.audio_transcript — NOT data.status / data.transcript as
  // originally guessed. Fixed below.
  //
  // TIMING NOTE: a real transcript took ~28.5s to complete in testing —
  // right at the edge of the old 30s budget. Bumped to 26×1.5s=39s here for
  // margin, BUT this only helps if the frontend's own client-side timeout
  // is also widened — frontend/src/lib/api.ts's transcribeAudio() currently
  // aborts at 30000ms, which would still fire and show an error even after
  // this fix, on any request that takes as long as the one just observed.
  // Flag this to Bright: bump that timeout to at least 45000.
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const statusRes = await fetch(`${SAHARA_STT_BASE_URL}/file/v1/status/${fileId}`, {
      headers: { Authorization: `Bearer ${SAHARA_API_KEY}` }
    });
    if (!statusRes.ok) {
      console.warn(`sahara_stt_poll_http_error attempt=${i} status=${statusRes.status}`);
      continue;
    }
    const statusJson = await statusRes.json();
    const status = statusJson.data?.processing_status;
    const transcript = statusJson.data?.audio_transcript;

    if (status === 'FILE_TRANSCRIBED') {
      if (!transcript) {
        console.error('sahara_stt_transcribed_but_empty', JSON.stringify(statusJson));
        throw new Error('sahara_transcription_completed_but_missing_transcript');
      }
      return transcript;
    }
    if (status === 'FILE_FAILED' || status === 'FAILED') {
      console.error('sahara_stt_status_failed', JSON.stringify(statusJson));
      throw new Error('sahara_transcription_failed_upstream');
    }
  }
  throw new Error('sahara_transcription_timed_out');
}

async function transcribeStreaming(sessionId, audioBuffer, audioFileName) {
  throw new Error('sahara_stt_streaming_not_yet_implemented');
}

module.exports = { transcribe };
