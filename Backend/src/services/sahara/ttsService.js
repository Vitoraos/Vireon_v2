const fetch = require('node-fetch');
const WebSocket = require('ws');
const { withTimeout } = require('../../lib/timeout');
const circuitBreaker = require('../../lib/circuitBreaker');

const SAHARA_API_KEY = process.env.SAHARA_API_KEY;
const SAHARA_TTS_BASE_URL = process.env.SAHARA_TTS_BASE_URL;
const SAHARA_TTS_MODE = process.env.SAHARA_TTS_MODE || 'batch'; // 'batch' | 'streaming'
const SERVICE_NAME = 'sahara_tts';

const STREAM_WS_URL = 'wss://infer.voice.intron.io/tts/v1/stream';
const STREAM_SESSION_TIMEOUT_MS = 20000; // well under Sahara's 300s cap — this is OUR demo-latency budget, not their limit
const MIN_CHUNK_CHARS = 10;
const MAX_CHUNK_CHARS = 100;

/**
 * PLACEHOLDER 2: batch mode is the safe default — request text, get back
 * full audio. This is the worst-case latency budget: full LLM response +
 * full TTS generation before the patient hears anything. If a streaming/
 * chunked Sahara TTS endpoint is confirmed, implement synthesizeStreaming()
 * and flip SAHARA_TTS_MODE=streaming — routes call synthesize() and don't
 * need to change.
 *
 * @param {string} sessionId
 * @param {string} text
 * @param {{voice_language?: string, voice_accent?: string}} [voiceProfile]
 *   Optional per-session override so replies can match the language/accent
 *   the patient has been speaking in, rather than a single fixed env value
 *   for every patient. Falls back to SAHARA_TTS_VOICE_* env vars if omitted.
 */
async function synthesize(sessionId, text, voiceProfile) {
  if (SAHARA_TTS_MODE === 'streaming') {
    return synthesizeStreaming(sessionId, text, voiceProfile);
  }
  return synthesizeBatch(sessionId, text, voiceProfile);
}

async function synthesizeBatch(sessionId, text, voiceProfile = {}) {
  if (circuitBreaker.isOpen(sessionId, SERVICE_NAME)) {
    throw new Error('sahara_tts_circuit_open');
  }

  const voiceLanguage = voiceProfile.voice_language || process.env.SAHARA_TTS_VOICE_LANGUAGE || 'en';
  const voiceAccent = voiceProfile.voice_accent || process.env.SAHARA_TTS_VOICE_ACCENT;

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
        body: JSON.stringify({ text, voice_language: voiceLanguage, voice_accent: voiceAccent })
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

/**
 * Splits text into chunks respecting Sahara's documented 10-100 character
 * limit per INPUT_TEXT_CHUNK, breaking on word boundaries where possible.
 *
 * Edge case: if the final remainder is under MIN_CHUNK_CHARS, it's merged
 * into the previous chunk when that fits under the max; if it still
 * wouldn't fit, the short remainder is sent as its own chunk anyway —
 * this technically risks violating Sahara's stated minimum, but there's no
 * way to guarantee otherwise for arbitrary input length. Worth testing
 * against a real connection to see whether Sahara actually rejects a
 * sub-10-char final chunk or tolerates it.
 */
function chunkText(text, min = MIN_CHUNK_CHARS, max = MAX_CHUNK_CHARS) {
  const words = text.trim().split(/\s+/);
  const chunks = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > max) {
      if (current) chunks.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);

  // merge a too-short final chunk into the previous one if it fits
  if (chunks.length > 1 && chunks[chunks.length - 1].length < min) {
    const last = chunks.pop();
    const prev = chunks.pop();
    const merged = `${prev} ${last}`;
    chunks.push(merged.length <= max ? merged : prev);
    if (merged.length > max) chunks.push(last); // couldn't merge — keep both, flagged in comment above
  }

  return chunks;
}

/**
 * Streams text to Sahara TTS over WebSocket, chunk by chunk, per the
 * confirmed protocol: SESSION_CREATED -> (INPUT_TEXT_CHUNK -> READY ->
 * FETCH_AUDIO_CHUNK -> audio) per chunk -> COMMIT -> COMMITTED_AUDIO -> close.
 *
 * ASSUMPTION FLAGGED: Sahara's docs list SESSION_CREATED, READY, and
 * COMMITTED_AUDIO as server message types but do NOT document the exact
 * message_type name or field names for the actual audio-chunk delivery
 * response to FETCH_AUDIO_CHUNK. This implementation assumes a message with
 * a base64 audio payload arrives after each FETCH_AUDIO_CHUNK and tries a
 * couple of likely field names — CONFIRM the real shape by logging raw
 * messages against a live connection before relying on this for the demo.
 *
 * Returns a Buffer of concatenated decoded audio (WAV chunks concatenated
 * naively — if Sahara returns full WAV headers per chunk rather than raw
 * PCM, naive concatenation may produce an invalid file; verify playback
 * works, or strip headers from all but the first chunk if needed).
 */
async function synthesizeStreaming(sessionId, text, voiceProfile = {}) {
  if (circuitBreaker.isOpen(sessionId, SERVICE_NAME)) {
    throw new Error('sahara_tts_circuit_open');
  }

  const voiceAccent = voiceProfile.voice_accent || process.env.SAHARA_TTS_VOICE_ACCENT;
  const voiceGender = process.env.SAHARA_TTS_VOICE_GENDER; // gender is a fixed assistant-voice choice, not patient-matched
  const voiceLanguage = voiceProfile.voice_language || process.env.SAHARA_TTS_VOICE_LANGUAGE || 'en';
  const outputFormat = process.env.SAHARA_TTS_OUTPUT_FORMAT || 'wav';

  if (!voiceAccent || !voiceGender) {
    throw new Error('sahara_tts_missing_required_voice_params');
  }

  if (text.trim().length < MIN_CHUNK_CHARS) {
    // Sahara's streaming endpoint has a hard 10-char minimum per chunk with
    // no way to pad meaningfully — this should never happen for real
    // next_question/safety-line text in this project, but fail loudly
    // rather than silently sending an invalid chunk if it ever does.
    throw new Error('sahara_tts_text_too_short_for_streaming');
  }

  const chunks = chunkText(text);
  const audioBuffers = [];

  const task = new Promise((resolve, reject) => {
    const url =
      `${STREAM_WS_URL}?voice_accent=${encodeURIComponent(voiceAccent)}` +
      `&voice_gender=${encodeURIComponent(voiceGender)}` +
      `&voice_language=${encodeURIComponent(voiceLanguage)}` +
      `&output_audio_format=${encodeURIComponent(outputFormat)}`;

    const ws = new WebSocket(url, {
      headers: { Authorization: `Bearer ${SAHARA_API_KEY}` }
    });

    let chunkIndex = 0;
    let sessionCreated = false;

    function sendNextChunk() {
      if (chunkIndex >= chunks.length) {
        ws.send(JSON.stringify({ message_type: 'COMMIT' }));
        return;
      }
      ws.send(
        JSON.stringify({
          message_type: 'INPUT_TEXT_CHUNK',
          text: chunks[chunkIndex],
          ack_id: chunkIndex
        })
      );
    }

    ws.on('open', () => {
      // wait for SESSION_CREATED before sending anything, per documented workflow
    });

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return; // ignore unparseable frames rather than crash the session
      }

      switch (msg.message_type || msg.type) {
        case 'SESSION_CREATED':
          sessionCreated = true;
          sendNextChunk();
          break;

        case 'READY': {
          const readyChunkId = msg.chunk_id ?? msg.ack_id ?? chunkIndex;
          ws.send(JSON.stringify({ message_type: 'FETCH_AUDIO_CHUNK', chunk_id: readyChunkId }));
          break;
        }

        // ASSUMPTION: real field/message_type name for audio delivery is unconfirmed —
        // trying the most likely shapes here; verify and correct against a live session.
        case 'AUDIO_CHUNK':
        case 'FETCHED_AUDIO_CHUNK': {
          const b64 = msg.audio || msg.audio_base64 || msg.data;
          if (b64) audioBuffers.push(Buffer.from(b64, 'base64'));
          chunkIndex += 1;
          sendNextChunk();
          break;
        }

        case 'COMMITTED_AUDIO':
          ws.close();
          resolve(Buffer.concat(audioBuffers));
          break;

        case 'ERROR':
          reject(new Error(`sahara_tts_stream_error: ${msg.message || 'unknown'}`));
          ws.close();
          break;

        default:
          // unrecognized message type — log for debugging the protocol assumption above
          console.warn('sahara_tts_stream_unhandled_message', msg);
      }
    });

    ws.on('error', (err) => reject(err));
    ws.on('close', () => {
      if (!sessionCreated) reject(new Error('sahara_tts_stream_closed_before_session_created'));
    });
  });

  try {
    const result = await withTimeout(task, STREAM_SESSION_TIMEOUT_MS, 'sahara_tts_stream');
    circuitBreaker.recordSuccess(sessionId, SERVICE_NAME);
    return result;
  } catch (err) {
    circuitBreaker.recordFailure(sessionId, SERVICE_NAME);
    throw err;
  }
}

module.exports = { synthesize, chunkText };
