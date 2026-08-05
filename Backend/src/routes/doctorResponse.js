const express = require('express');
const reportsStore = require('../services/db/reportsStore');

const router = express.Router();

const VALID_ACTIONS = ['prescribe', 'request_appointment', 'recommend_emergency'];

router.post('/api/doctor-response', (req, res) => {
  const { report_id, action, note } = req.body;

  if (!report_id || !VALID_ACTIONS.includes(action) || typeof note !== 'string') {
    return res.status(400).json({ error: 'invalid_request_shape' });
  }

  const report = reportsStore.getReportById(report_id);
  if (!report) return res.status(404).json({ error: 'report_not_found' });

  // Idempotency: doctor dashboard double-submit shouldn't create two responses.
  const existing = reportsStore.getDoctorResponse(report_id);
  if (existing) return res.json({ ok: true });

  reportsStore.saveDoctorResponse({ reportId: report_id, action, note });
  return res.json({ ok: true });
});

router.get('/api/doctor-response/:report_id', (req, res) => {
  const response = reportsStore.getDoctorResponse(req.params.report_id);
  if (!response) return res.json({ responded: false, action: null, note: null });
  return res.json({ responded: true, action: response.action, note: response.note });
});

module.exports = router;
