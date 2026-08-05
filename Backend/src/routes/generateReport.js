const express = require('express');
const interviewState = require('../services/state/interviewState');
const { translateToEnglish } = require('../services/translation/translateService');
const qwenService = require('../services/qwen/qwenService');
const reportsStore = require('../services/db/reportsStore');
const circuitBreaker = require('../lib/circuitBreaker');

const router = express.Router();

router.post('/api/generate-report', async (req, res) => {
  const { session_id, chief_complaint, full_transcript } = req.body;

  if (!session_id || typeof chief_complaint !== 'string' || typeof full_transcript !== 'string') {
    return res.status(400).json({ error: 'invalid_request_shape' });
  }

  // Idempotency: if a report already exists for this session (frontend
  // retry, double-fire, client timeout-then-retry), return the existing one
  // rather than creating a duplicate.
  const existing = reportsStore.findExistingReportForSession(session_id);
  if (existing) return res.json(existing);

  const session = interviewState.getSession(session_id);
  const { text: fullTranscriptEnglish } = await translateToEnglish(session_id, full_transcript);

  let qwenResult = null;
  if (!circuitBreaker.isOpen(session_id, 'qwen3')) {
    try {
      qwenResult = await qwenService.generateReport(session_id, {
        chiefComplaint: chief_complaint,
        fullTranscriptEnglish
      });
    } catch (err) {
      console.error(`qwen_report_failed session=${session_id}`, err.message);
      qwenResult = null;
    }
  }

  // Degrade: if Qwen 3 can't produce the report, fall back to whatever
  // slots the backend already accumulated during the interview turns rather
  // than failing the whole request — the patient should never see nothing.
  const finalSlots = qwenResult
    ? {
        duration: qwenResult.duration,
        severity: qwenResult.severity,
        associated_symptoms: qwenResult.associated_symptoms,
        relevant_history: qwenResult.relevant_history,
        anything_else: qwenResult.anything_else
      }
    : session.slots;

  const redFlagDetected = qwenResult?.red_flag_detected ?? false;

  const report = reportsStore.createReport({
    sessionId: session_id,
    chiefComplaint: chief_complaint,
    slots: finalSlots,
    redFlagDetected,
    recommendEmergency: redFlagDetected,
    fullTranscript: full_transcript, // native-language transcript stored, not the English normalization
    turnsUsed: session.turns_used
  });

  interviewState.clearSession(session_id);
  return res.json(report);
});

module.exports = router;
