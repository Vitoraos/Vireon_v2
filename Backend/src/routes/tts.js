const express = require('express');
const ttsService = require('../services/sahara/ttsService');

const router = express.Router();

/**
 * Confirmed to match frontend/src/lib/api.ts's synthesizeSpeech() exactly:
 * POST /api/tts, body { text }, expects a raw Blob back (not JSON), and
 * already treats any non-2xx or network failure as a silent fallback to
 * text-only (returns null, playTTS() shows text briefly then continues).
 * That means failures here should be REAL non-2xx statuses, not 200-with-
 * error-body — the frontend's fallback logic depends on response.ok.
 *
 * One fixed voice (SAHARA_TTS_VOICE_ACCENT/GENDER/LANGUAGE from env) for
 * every reply — no per-session voice-profile detection. Qwen 3's system
 * prompt already asks it to mirror the patient's code-switch pattern in
 * the TEXT it generates; this endpoint just reads that text aloud.
 *
 * Request:  { text: string }
 * Response: raw audio bytes, Content-Type matching SAHARA_TTS_OUTPUT_FORMAT
 * On failure: non-2xx status, { error: "synthesis_failed" } JSON body
 *
 * NOT YET in API-Contract-3.md — worth adding it there too so it's not
 * only documented in frontend's own comment, but functionally this now
 * matches what the frontend already calls.
 */
router.post('/api/tts', async (req, res) => {
  const { text } = req.body;

  if (typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'invalid_request_shape' });
  }

  try {
    const audioBuffer = await ttsService.synthesize('anonymous_tts', text);
    const format = process.env.SAHARA_TTS_OUTPUT_FORMAT || 'wav';
    res.set('Content-Type', format === 'opus' ? 'audio/opus' : 'audio/wav');
    return res.send(audioBuffer);
  } catch (err) {
    console.error('tts_failed', err.message);
    return res.status(502).json({ error: 'synthesis_failed' });
  }
});

module.exports = router;
