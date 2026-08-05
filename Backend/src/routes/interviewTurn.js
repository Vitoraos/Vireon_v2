const express = require('express');
const interviewState = require('../services/state/interviewState');
const { translateToEnglish } = require('../services/translation/translateService');
const { checkRedFlags } = require('../services/redflag/redFlagCheck');
const qwenService = require('../services/qwen/qwenService');
const circuitBreaker = require('../lib/circuitBreaker');

const router = express.Router();

const RED_FLAG_SAFETY_LINE =
  'This may be a medical emergency. Please seek emergency care immediately, or call your local emergency number now.';

const FALLBACK_QUESTIONS = [
  'Can you tell me more about that?',
  'Is there anything else you have noticed alongside this?',
  'How long has this been going on?'
];

function pickFallbackQuestion(sessionId) {
  const turnsUsed = interviewState.getSession(sessionId).turns_used;
  return FALLBACK_QUESTIONS[turnsUsed % FALLBACK_QUESTIONS.length];
}

router.post('/api/interview-turn', async (req, res) => {
  const { session_id, transcript, history } = req.body;

  // Guard: input shape — never trust the frontend sent well-formed data
  if (!session_id || typeof transcript !== 'string' || !Array.isArray(history)) {
    return res.status(400).json({ error: 'invalid_request_shape' });
  }

  interviewState.appendHistory(session_id, 'patient', transcript);

  // --- Layer 1: deterministic red-flag check, runs before anything else,
  // independent of Qwen 3 or translation availability ---
  const { text: englishTranscript } = await translateToEnglish(session_id, transcript);
  const keywordRedFlag = checkRedFlags(englishTranscript);

  if (keywordRedFlag.triggered) {
    interviewState.incrementTurn(session_id);
    return res.json(buildRedFlagResponse(session_id));
  }

  // --- Layer 2: Qwen 3 call, with circuit breaker + fallback ---
  const turnsUsed = interviewState.incrementTurn(session_id);
  const currentSlots = interviewState.getSession(session_id).slots;
  const unfilledSlots = interviewState.nextUnfilledSlots(session_id);

  let qwenResult = null;
  if (!circuitBreaker.isOpen(session_id, 'qwen3')) {
    try {
      qwenResult = await qwenService.getNextTurn(session_id, {
        englishTranscript,
        currentSlots,
        unfilledSlots,
        recentHistory: interviewState.getSession(session_id).history
      });
    } catch (err) {
      console.error(`qwen_turn_failed session=${session_id}`, err.message);
      qwenResult = null; // fall through to degrade below
    }
  } else {
    console.warn(`qwen_circuit_open session=${session_id} — using fallback question`);
  }

  // --- Layer 2 opinion also counts toward red-flag detection ---
  if (qwenResult?.red_flag_detected) {
    return res.json(buildRedFlagResponse(session_id));
  }

  // --- Degrade path: Qwen 3 unavailable/failed — keep the interview moving
  // with a safe generic question rather than surfacing an error to the patient ---
  if (!qwenResult) {
    const nextQuestion = pickFallbackQuestion(session_id);
    interviewState.appendHistory(session_id, 'agent', nextQuestion);
    const done = interviewState.isDone(session_id);
    return res.json({
      next_question: done ? null : nextQuestion,
      slot_targeted: null,
      slots_filled: { ...currentSlots },
      red_flag_detected: false,
      recommend_emergency: false,
      turns_used: turnsUsed,
      done
    });
  }

  // --- Happy path: backend merges slots and decides done, never trusts
  // the model's own self-report ---
  const mergedSlots = interviewState.mergeSlots(session_id, qwenResult.slots_filled);
  const done = interviewState.isDone(session_id);

  if (qwenResult.next_question) {
    interviewState.appendHistory(session_id, 'agent', qwenResult.next_question);
  }

  return res.json({
    next_question: done ? null : qwenResult.next_question,
    slot_targeted: qwenResult.slot_targeted,
    slots_filled: mergedSlots,
    red_flag_detected: false,
    recommend_emergency: false,
    turns_used: turnsUsed,
    done
  });
});

function buildRedFlagResponse(sessionId) {
  const session = interviewState.getSession(sessionId);
  return {
    next_question: RED_FLAG_SAFETY_LINE, // canned, not model-generated — never leave safety messaging to chance
    slot_targeted: null,
    slots_filled: { ...session.slots },
    red_flag_detected: true,
    recommend_emergency: true,
    turns_used: session.turns_used,
    done: true
  };
}

module.exports = router;
