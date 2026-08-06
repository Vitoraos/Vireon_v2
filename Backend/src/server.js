require('dotenv').config();
const express = require('express');
const cors = require('cors');

const transcribeRoute = require('./routes/transcribe');
const interviewTurnRoute = require('./routes/interviewTurn');
const generateReportRoute = require('./routes/generateReport');
const reportsRoute = require('./routes/reports');
const doctorResponseRoute = require('./routes/doctorResponse');
const ttsRoute = require('./routes/tts');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.use(transcribeRoute);
app.use(interviewTurnRoute);
app.use(generateReportRoute);
app.use(reportsRoute);
app.use(doctorResponseRoute);
app.use(ttsRoute);

app.get('/health', (req, res) => res.json({ ok: true }));

// Last-resort safety net — an unhandled error anywhere still returns the
// contract's error shape instead of crashing the process mid-demo.
app.use((err, req, res, next) => {
  console.error('unhandled_error', err);
  res.status(500).json({ error: 'internal_error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`backend listening on :${PORT}`));
