const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { withTimeout } = require('../../lib/timeout');
const circuitBreaker = require('../../lib/circuitBreaker');
const {
  InterviewTurnQwenSchema,
  INTERVIEW_TURN_JSON_SCHEMA,
  GenerateReportQwenSchema,
  GENERATE_REPORT_JSON_SCHEMA
} = require('../../schemas/qwenSchemas');

const QWEN_BASE_URL = process.env.QWEN_BASE_URL;
const QWEN_MODEL = process.env.QWEN_MODEL;
const QWEN_API_KEY = process.env.QWEN_API_KEY; // required for hosted providers (Groq etc), unused for local vLLM
const QWEN_ENABLE_THINKING = process.env.QWEN_ENABLE_THINKING === 'true';
const QWEN_TIMEOUT_MS = Number(process.env.QWEN_TIMEOUT_MS || 8000);
// 'json_schema' = OpenAI-style response_format (Groq, OpenRouter, most hosted providers)
// 'guided_json' = vLLM-specific extra_body (only if self-hosting Qwen 3 yourself)
const QWEN_STRUCTURED_MODE = process.env.QWEN_STRUCTURED_MODE || 'json_schema';
const SERVICE_NAME = 'qwen3';

const SYSTEM_PROMPT_PATH = path.join(__dirname, 'qwen3-intake-system-prompt.txt');
let SYSTEM_PROMPT = 'You are a clinical intake assistant. Output JSON only.';
try {
  SYSTEM_PROMPT = fs.readFileSync(SYSTEM_PROMPT_PATH, 'utf8');
} catch {
  console.warn(`qwen_system_prompt_missing at ${SYSTEM_PROMPT_PATH} — using minimal fallback prompt`);
}

function stripFences(text) {
  return text.replace(/```json\s*|\s*```/g, '').trim();
}

/**
 * Core structured-call helper. Supports two structured-output mechanisms
 * depending on where Qwen 3 is hosted, selected via QWEN_STRUCTURED_MODE:
 *
 *  - 'json_schema' (default): OpenAI-style response_format, used by Groq,
 *    OpenRouter, and most hosted providers. This is what you want when
 *    using a free hosted API key rather than self-hosting.
 *  - 'guided_json': vLLM-specific extra_body param, only valid if you are
 *    self-hosting Qwen 3 yourself via vLLM.
 *
 * Either way this eliminates malformed-JSON errors but NOT semantic errors
 * (see qwenSchemas.js comments), hence the zod validation pass after parsing.
 *
 * KNOWN GOTCHA (guided_json mode only): guided_json + Qwen3 has a documented
 * breakage when enable_thinking=false is combined with guided_json on some
 * vLLM versions. Test explicitly against your actual vLLM version if you
 * self-host — if broken, the defensive parse/retry path below is what keeps
 * the turn alive instead of hard-failing.
 */
async function callQwenStructured(sessionId, userMessage, jsonSchema, schemaName, zodSchema, { isRetry = false } = {}) {
  if (circuitBreaker.isOpen(sessionId, SERVICE_NAME)) {
    throw new Error('qwen_circuit_open');
  }

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userMessage }
  ];

  if (isRetry) {
    messages.push({
      role: 'user',
      content:
        'Your previous response was not valid JSON matching the required schema. Respond with ONLY the JSON object, no prose, no markdown code fences.'
    });
  }

  const body = { model: QWEN_MODEL, messages };

  if (QWEN_STRUCTURED_MODE === 'guided_json') {
    body.chat_template_kwargs = { enable_thinking: QWEN_ENABLE_THINKING };
    body.extra_body = { guided_json: jsonSchema };
  } else {
    body.response_format = {
      type: 'json_schema',
      json_schema: { name: schemaName, schema: jsonSchema, strict: true }
    };
  }

  try {
    const response = await withTimeout(
      fetch(`${QWEN_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(QWEN_API_KEY ? { Authorization: `Bearer ${QWEN_API_KEY}` } : {})
        },
        body: JSON.stringify(body)
      }),
      QWEN_TIMEOUT_MS,
      'qwen3'
    );

    if (!response.ok) throw new Error(`qwen_http_${response.status}`);
    const data = await response.json();
    const rawText = data.choices?.[0]?.message?.content;
    if (!rawText) throw new Error('qwen_empty_response');

    const cleaned = stripFences(rawText);
    const parsed = JSON.parse(cleaned);
    const validated = zodSchema.parse(parsed);

    circuitBreaker.recordSuccess(sessionId, SERVICE_NAME);
    return validated;
  } catch (err) {
    if (!isRetry) {
      // one corrective retry per the project's coding rules, before giving up
      return callQwenStructured(sessionId, userMessage, jsonSchema, schemaName, zodSchema, { isRetry: true });
    }
    circuitBreaker.recordFailure(sessionId, SERVICE_NAME);
    throw err; // caller (routes) is responsible for the fallback response
  }
}

/**
 * @param {string} sessionId
 * @param {object} params - { englishTranscript, nativeTranscript, currentSlots, unfilledSlots, recentHistory }
 */
async function getNextTurn(sessionId, params) {
  const { englishTranscript, currentSlots, unfilledSlots, recentHistory } = params;

  const userMessage = JSON.stringify({
    task: 'pick_next_slot_and_question',
    english_normalized_transcript: englishTranscript,
    current_slots: currentSlots,
    unfilled_slots: unfilledSlots,
    // native-language history included so the model can mirror the patient's
    // own code-switch pattern when phrasing next_question — see PRD requirement
    recent_history_native_language: recentHistory
  });

  return callQwenStructured(sessionId, userMessage, INTERVIEW_TURN_JSON_SCHEMA, 'interview_turn', InterviewTurnQwenSchema);
}

/**
 * @param {string} sessionId
 * @param {object} params - { chiefComplaint, fullTranscriptEnglish }
 */
async function generateReport(sessionId, params) {
  const { chiefComplaint, fullTranscriptEnglish } = params;

  const userMessage = JSON.stringify({
    task: 'generate_structured_report',
    chief_complaint: chiefComplaint,
    full_transcript_english_normalized: fullTranscriptEnglish
  });

  return callQwenStructured(sessionId, userMessage, GENERATE_REPORT_JSON_SCHEMA, 'clinical_report', GenerateReportQwenSchema);
}

module.exports = { getNextTurn, generateReport };
