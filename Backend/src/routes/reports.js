const express = require('express');
const reportsStore = require('../services/db/reportsStore');

const router = express.Router();

router.get('/api/reports/:report_id', (req, res) => {
  const report = reportsStore.getReportById(req.params.report_id);
  if (!report) return res.status(404).json({ error: 'report_not_found' });
  return res.json(report);
});

module.exports = router;
