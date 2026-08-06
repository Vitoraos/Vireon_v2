const express = require('express');
const reportsStore = require('../services/db/reportsStore');

const router = express.Router();

/**
 * NEW — was missing. The doctor dashboard has no way to know a report_id
 * generated on a separate patient device, and this project's MVP scope is
 * explicitly "single active report view for the demo" — so the doctor
 * dashboard should default to loading the current one, not require an ID
 * pasted into the URL. Registered BEFORE the :report_id route below so the
 * literal "latest" path takes precedence over being parsed as an ID.
 */
router.get('/api/reports/latest', (req, res) => {
  const report = reportsStore.getLatestReport();
  if (!report) return res.status(404).json({ error: 'no_reports_yet' });
  return res.json(report);
});

router.get('/api/reports/:report_id', (req, res) => {
  const report = reportsStore.getReportById(req.params.report_id);
  if (!report) return res.status(404).json({ error: 'report_not_found' });
  return res.json(report);
});

module.exports = router;
