const express = require('express');
const multer = require('multer');
const sttService = require('../services/sahara/sttService');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

router.post('/api/transcribe', upload.single('audio_file_blob'), async (req, res) => {
  const { session_id } = req.body;

  if (!session_id || !req.file) {
    return res.status(400).json({ error: 'invalid_request_shape' });
  }

  try {
    const transcript = await sttService.transcribe(session_id, req.file.buffer, req.file.originalname);
    return res.json({ transcript, session_id });
  } catch (err) {
    console.error(`transcribe_failed session=${session_id}`, err.message);
    return res.status(200).json({ error: 'transcription_failed' });
    // 200, not 500: this is an anticipated, handled failure mode with a
    // defined frontend behavior (re-record), not a server crash.
  }
});

module.exports = router;
