const fetch = require('node-fetch');
const { withTimeout } = require('../../lib/timeout');
const circuitBreaker = require('../../lib/circuitBreaker');

const TRANSLATE_BASE_URL = process.env.TRANSLATE_BASE_URL;
const TRANSLATE_MODEL = process.env.TRANSLATE_MODEL || 'nllb-200-distilled-600M';
const TRANSLATE_TIMEOUT_MS = Number(process.env.TRANSLATE_TIMEOUT_MS || 4000);
const SERVICE_NAME = 'translate';

/**
 * Translates native (possibly code-switched) text to English.
 *
 * Used ONLY for internal processing (red-flag matching, slot extraction) —
 * never for patient-facing output. The patient always hears/reads responses
 * generated from the ORIGINAL transcript, to preserve their own language mix.
 *
 * Degrades to pass-through (returns the original text unchanged) if the
 * translation model is unavailable or the circuit breaker has tripped for
 * this session — red-flag keyword matching then simply relies more heavily
 * on Qwen 3's own red_flag_detected opinion for that turn. This is a
 * deliberate degrade, not a silent failure: it's logged so it's visible
 * in testing and in demo debugging.
 */
async function translateToEnglish(sessionId, nativeText) {
  if (!TRANSLATE_BASE_URL) {
    console.warn('translate_service_not_configured — passing text through untranslated');
    return { text: nativeText, translated: false };
  }

  if (circuitBreaker.isOpen(sessionId, SERVICE_NAME)) {
    console.warn(`translate_circuit_open session=${sessionId} — passing text through untranslated`);
    return { text: nativeText, translated: false };
  }

  try {
    const response = await withTimeout(
      fetch(`${TRANSLATE_BASE_URL}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: TRANSLATE_MODEL,
          text: nativeText,
          target_lang: 'eng_Latn'
        })
      }),
      TRANSLATE_TIMEOUT_MS,
      'translate'
    );

    if (!response.ok) throw new Error(`translate_http_${response.status}`);

    const data = await response.json();
    circuitBreaker.recordSuccess(sessionId, SERVICE_NAME);
    return { text: data.translated_text, translated: true };
  } catch (err) {
    circuitBreaker.recordFailure(sessionId, SERVICE_NAME);
    console.error(`translate_failed session=${sessionId}`, err.message);
    // Degrade, don't throw — the turn must continue.
    return { text: nativeText, translated: false };
  }
}

module.exports = { translateToEnglish };
