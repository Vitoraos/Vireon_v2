const crypto = require('crypto');

/**
 * PLACEHOLDER: in-memory store standing in for Supabase's `reports` and
 * `doctor_responses` tables. Field names match API-Contract exactly so
 * swapping this for real supabase-js calls later is a drop-in replacement —
 * routes only ever call the functions below, never touch storage directly.
 *
 * NOTE: in-memory means state is lost on server restart and won't work
 * across multiple backend instances — fine for a single-instance hackathon
 * deploy, not fine beyond that.
 */

const reportsBySessionId = new Map(); // session_id -> report
const reportsById = new Map(); // report_id -> report
const doctorResponsesByReportId = new Map(); // report_id -> response

function findExistingReportForSession(sessionId) {
  return reportsBySessionId.get(sessionId) || null;
}

function createReport({ sessionId, chiefComplaint, slots, redFlagDetected, recommendEmergency, fullTranscript, turnsUsed }) {
  const reportId = crypto.randomUUID();
  const report = {
    report_id: reportId,
    chief_complaint: chiefComplaint,
    duration: slots.duration,
    severity_score: slots.severity, // <-- the naming remap the contract calls out explicitly
    associated_symptoms: slots.associated_symptoms,
    relevant_history: slots.relevant_history,
    anything_else: slots.anything_else,
    red_flag_detected: redFlagDetected,
    recommend_emergency: recommendEmergency,
    full_transcript: fullTranscript,
    turns_used: turnsUsed,
    status: 'pending',
    created_at: new Date().toISOString()
  };
  reportsBySessionId.set(sessionId, report);
  reportsById.set(reportId, report);
  return report;
}

function getReportById(reportId) {
  return reportsById.get(reportId) || null;
}

function saveDoctorResponse({ reportId, action, note }) {
  const response = { report_id: reportId, action, note, created_at: new Date().toISOString() };
  doctorResponsesByReportId.set(reportId, response);

  const report = reportsById.get(reportId);
  if (report) report.status = 'responded';

  return response;
}

function getDoctorResponse(reportId) {
  return doctorResponsesByReportId.get(reportId) || null;
}

module.exports = {
  findExistingReportForSession,
  createReport,
  getReportById,
  saveDoctorResponse,
  getDoctorResponse
};
