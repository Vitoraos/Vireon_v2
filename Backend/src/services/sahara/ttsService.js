const fetch = require('node-fetch');
const WebSocket = require('ws');
const { withTimeout } = require('../../lib/timeout');
const circuitBreaker = require('../../lib/circuitBreaker');

const SAHARA_API_KEY = process.env.SAHARA_API_KEY;
const SAHARA_TTS_BASE_URL = process.env.SAHARA_TTS_BASE_URL;
const SAHARA_TTS_MODE = process.env.SAHARA_TTS_MODE || 'batch';
const SERVICE_NAME = 'sahara_tts';

const STREAM_WS_URL = 'wss://infer.voice.intron.io/tts/v1/stream';
const STREAM_SESSION_TIMEOUT_MS = 20000;
const MIN_CHUNK_CHARS = 10;
const MAX_CHUNK_CHARS = 100;

// Poll config for /enqueue async jobs
const TTS_POLL_MAX_ATTEMPTS = 30;
const TTS_POLL_INTERVAL_MS = 2000;

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
  const voiceGender = voiceProfile.voice_gender || process.env.SAHARA_TTS_VOICE_GENDER;

  if (!voiceAccent || !voiceGender) {
    throw new Error('sahara_tts_missing_required_voice_params');
  }

  let jobId = null;

  // ── Step 1: enqueue the job ──
  try {
    const enqueueRes = await withTimeout(
      fetch(`${SAHARA_TTS_BASE_URL}/tts/v1/enqueue`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SAHARA_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text,
          voice_language: voiceLanguage,
          voice_accent: voiceAccent,
          voice_gender: voiceGender,
          output_audio_format: process.env.SAHARA_TTS_OUTPUT_FORMAT || 'wav'
        })
      }),
      10000,
      'sahara_tts_enqueue'
    );

    if (!enqueueRes.ok) {
      const body = await enqueueRes.text().catch(() => '');
      console.error(`sahara_tts_enqueue_http_${enqueueRes.status}`, body.slice(0, 300));
      throw new Error(`sahara_tts_enqueue_http_${enqueueRes.status}`);
    }

    const enqueueBody = await enqueueRes.text();
    console.log(`[Sahara TTS] enqueue raw response:`, enqueueBody);

    // Try common shapes: plain job_id string, JSON {job_id}, JSON {data:{job_id}}, etc.
    let parsed;
    try { parsed = JSON.parse(enqueueBody); } catch { parsed = enqueueBody; }

    jobId =
      parsed?.job_id ??
      parsed?.id ??
      parsed?.task_id ??
      parsed?.data?.job_id ??
      parsed?.data?.id ??
      (typeof parsed === 'string' ? parsed.trim() : null);

    if (!jobId) {
      console.error('sahara_tts_enqueue_unexpected_shape', parsed);
      throw new Error('sahara_tts_enqueue_unexpected_shape');
    }
  } catch (err) {
    circuitBreaker.recordFailure(sessionId, SERVICE_NAME);
    throw err;
  }

  // ── Step 2: poll for completion (pattern-matched from STT behavior) ──
  try {
    const audioBuffer = await pollTtsJob(jobId);
    circuitBreaker.recordSuccess(sessionId, SERVICE_NAME);
    return audioBuffer;
  } catch (err) {
    circuitBreaker.recordFailure(sessionId, SERVICE_NAME);
    throw err;
  }
}

async function pollTtsJob(jobId) {
  for (let i = 0; i < TTS_POLL_MAX_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, TTS_POLL_INTERVAL_MS));

    // Common Sahara pattern: /tts/v1/status/{job_id} or /tts/v1/jobs/{job_id}
    // Try the most likely ones; log the response so you can confirm the real path.
    const statusUrl = `${SAHARA_TTS_BASE_URL}/tts/v1/status/${encodeURIComponent(jobId)}`;
    const statusRes = await fetch(statusUrl, {
      headers: { Authorization: `Bearer ${SAHARA_API_KEY}` }
    });

    if (!statusRes.ok) {
      console.warn(`sahara_tts_poll_http_${statusRes.status} url=${statusUrl}`);
      continue;
    }

    const statusText = await statusRes.text();
    let statusJson;
    try { statusJson = JSON.parse(statusText); } catch { statusJson = statusText; }

    console.log(`[Sahara TTS] poll attempt=${i} raw:`, statusText.slice(0, 300));

    // Adjust these field names once you see the real response shape in logs
    const status = statusJson?.status ?? statusJson?.processing_status ?? statusJson?.state;
    const downloadUrl = statusJson?.download_url ?? statusJson?.audio_url ?? statusJson?.url;
    const audioB64 = statusJson?.audio_base64 ?? statusJson?.audio;

    // Done with audio inline
    if (audioB64) {
      return Buffer.from(audioB64, 'base64');
    }

    // Done with download URL
    if (status === 'completed' || status === 'done' || status === 'FILE_TRANSCRIBED') {
      if (downloadUrl) {
        const audioRes = await fetch(downloadUrl, {
          headers: { Authorization: `Bearer ${SAHARA_API_KEY}` }
        });
        if (!audioRes.ok) throw new Error(`sahara_tts_download_http_${audioRes.status}`);
        return Buffer.from(await audioRes.arrayBuffer());
      }
      // If no URL but status is done, maybe the response itself contains the data
      if (typeof statusJson === 'string') {
        // Could be direct base64
        return Buffer.from(statusJson, 'base64');
      }
    }

    if (status === 'failed' || status === 'error' || status === 'FAILED') {
      throw new Error('sahara_tts_job_failed');
    }
  }

  throw new Error('sahara_tts_poll_timed_out');
}

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

  if (chunks.length > 1 && chunks[chunks.length - 1].length < min) {
    const last = chunks.pop();
    const prev = chunks.pop();
    const merged = `${prev} ${last}`;
    chunks.push(merged.length <= max ? merged : prev);
    if (merged.length > max) chunks.push(last);
  }

  return chunks;
}

async function synthesizeStreaming(sessionId, text, voiceProfile = {}) {
  if (circuitBreaker.isOpen(sessionId, SERVICE_NAME)) {
    throw new Error('sahara_tts_circuit_open');
  }

  const voiceAccent = voiceProfile.voice_accent || process.env.SAHARA_TTS_VOICE_ACCENT;
  const voiceGender = process.env.SAHARA_TTS_VOICE_GENDER;
  const voiceLanguage = voiceProfile.voice_language || process.env.SAHARA_TTS_VOICE_LANGUAGE || 'en';
  const outputFormat = process.env.SAHARA_TTS_OUTPUT_FORMAT || 'wav';

  if (!voiceAccent || !voiceGender) {
    throw new Error('sahara_tts_missing_required_voice_params');
  }

  if (text.trim().length < MIN_CHUNK_CHARS) {
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

    ws.on('open', () => {});

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
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
