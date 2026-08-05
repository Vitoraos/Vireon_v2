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

async function pollForTranscript(fileId, maxAttempts = 15, intervalMs = 1000) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const statusRes = await fetch(`${SAHARA_STT_BASE_URL}/file/v1/status/${fileId}`, {
      headers: { Authorization: `Bearer ${SAHARA_API_KEY}` }
    });
    if (!statusRes.ok) continue; // transient — keep polling within budget
    const statusJson = await statusRes.json();
    const status = statusJson.data?.status;
    if (status === 'completed') return statusJson.data.transcript;
    if (status === 'failed') throw new Error('sahara_transcription_failed_upstream');
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
