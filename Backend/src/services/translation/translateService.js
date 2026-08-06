const fetch = require('node-fetch');
const { withTimeout } = require('../../lib/timeout');
const circuitBreaker = require('../../lib/circuitBreaker');

// Reuses the same Groq (or whichever OpenAI-compatible provider) credentials
// as qwenService.js — no separate translation infrastructure needed.
// CORRECTION from earlier: there is no confirmed free-hosted dedicated MT
// model (e.g. NLLB) available — that would require self-hosting your own
// GPU endpoint, which isn't "free" in the time-to-deploy sense you need
// today. This uses a small, fast Groq model with a plain translate prompt
// instead. Trade-off: general LLM translation quality for Yoruba/Hausa/
// Nigerian Pidgin is NOT independently verified here — test it against real
// code-switched fake transcripts before trusting it for the red-flag path.
const TRANSLATE_BASE_URL = process.env.TRANSLATE_BASE_URL || process.env.QWEN_BASE_URL;
const TRANSLATE_API_KEY = process.env.TRANSLATE_API_KEY || process.env.QWEN_API_KEY;
const TRANSLATE_MODEL = process.env.TRANSLATE_MODEL || 'llama-3.1-8b-instant'; // fast + free on Groq
const TRANSLATE_TIMEOUT_MS = Number(process.env.TRANSLATE_TIMEOUT_MS || 4000);
const SERVICE_NAME = 'translate';

/**
 * Translates native (possibly code-switched) text to English via a plain
 * prompt against a small, fast model — not a dedicated MT model.
 *
 * Used ONLY for internal processing (red-flag matching, slot extraction) —
 * never for patient-facing output. The patient always hears/reads responses
 * generated from the ORIGINAL transcript, to preserve their own language mix.
 *
 * Degrades to pass-through (returns the original text unchanged) if the
 * translation call fails or the circuit breaker has tripped for this
 * session — red-flag keyword matching then relies more heavily on Qwen 3's
 * own red_flag_detected opinion for that turn. This is a deliberate
 * degrade, logged so it's visible in testing and demo debugging, not a
 * silent failure.
 */
async function translateToEnglish(sessionId, nativeText) {
  if (!TRANSLATE_BASE_URL || !TRANSLATE_API_KEY) {
    console.warn('translate_service_not_configured — passing text through untranslated');
    return { text: nativeText, translated: false };
  }

  if (circuitBreaker.isOpen(sessionId, SERVICE_NAME)) {
    console.warn(`translate_circuit_open session=${sessionId} — passing text through untranslated`);
    return { text: nativeText, translated: false };
  }

  try {
    const response = await withTimeout(
      fetch(`${TRANSLATE_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TRANSLATE_API_KEY}`
        },
        body: JSON.stringify({
          model: TRANSLATE_MODEL,
          temperature: 0,
          messages: [
            {
              role: 'system',
              content:
                'Translate the user\'s message to English. The text may mix English with Nigerian Pidgin, Yoruba, Hausa, Swahili, or other African languages. Output ONLY the English translation, nothing else — no notes, no quotes, no explanation.'
            },
            { role: 'user', content: nativeText }
          ]
        })
      }),
      TRANSLATE_TIMEOUT_MS,
      'translate'
    );

    if (!response.ok) throw new Error(`translate_http_${response.status}`);

    const data = await response.json();
    const translated = data.choices?.[0]?.message?.content?.trim();
    if (!translated) throw new Error('translate_empty_response');

    circuitBreaker.recordSuccess(sessionId, SERVICE_NAME);
    return { text: translated, translated: true };
  } catch (err) {
    circuitBreaker.recordFailure(sessionId, SERVICE_NAME);
    console.error(`translate_failed session=${sessionId}`, err.message);
    // Degrade, don't throw — the turn must continue.
    return { text: nativeText, translated: false };
  }
}

module.exports = { translateToEnglish };
