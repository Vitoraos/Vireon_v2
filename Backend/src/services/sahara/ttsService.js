const fetch = require('node-fetch');
const { withTimeout } = require('../../lib/timeout');
const circuitBreaker = require('../../lib/circuitBreaker');

const SAHARA_API_KEY = process.env.SAHARA_API_KEY;
const SAHARA_TTS_BASE_URL = process.env.SAHARA_TTS_BASE_URL;
const SAHARA_TTS_MODE = process.env.SAHARA_TTS_MODE || 'batch'; // 'batch' | 'streaming'
const SERVICE_NAME = 'sahara_tts';

/**
 * PLACEHOLDER 2: batch mode is the safe default — request text, get back
 * full audio. This is the worst-case latency budget: full LLM response +
 * full TTS generation before the patient hears anything. If a streaming/
 * chunked Sahara TTS endpoint is confirmed, implement synthesizeStreaming()
 * and flip SAHARA_TTS_MODE=streaming — routes call synthesize() and don't
 * need to change.
 */
async function synthesize(sessionId, text) {
  if (SAHARA_TTS_MODE === 'streaming') {
    return synthesizeStreaming(sessionId, text);
  }
  return synthesizeBatch(sessionId, text);
}

async function synthesizeBatch(sessionId, text) {
  if (circuitBreaker.isOpen(sessionId, SERVICE_NAME)) {
    throw new Error('sahara_tts_circuit_open');
  }

  try {
    // NOTE: exact request/response shape for Sahara TTS batch endpoint should
    // be confirmed against current docs before wiring — placeholder shape below.
    const res = await withTimeout(
      fetch(`${SAHARA_TTS_BASE_URL}/tts/v1/synthesize`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SAHARA_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text })
      }),
      10000,
      'sahara_tts'
    );
    if (!res.ok) throw new Error(`sahara_tts_http_${res.status}`);
    const audioBuffer = await res.buffer();
    circuitBreaker.recordSuccess(sessionId, SERVICE_NAME);
    return audioBuffer;
  } catch (err) {
    circuitBreaker.recordFailure(sessionId, SERVICE_NAME);
    throw err;
  }
}

// eslint-disable-next-line no-unused-vars
async function synthesizeStreaming(sessionId, text) {
  // TODO once a Sahara TTS streaming/chunked endpoint is confirmed to exist:
  // open the streaming connection, forward chunks to the caller as they
  // arrive instead of buffering the full audio.
  throw new Error('sahara_tts_streaming_not_yet_implemented');
}

module.exports = { synthesize };
