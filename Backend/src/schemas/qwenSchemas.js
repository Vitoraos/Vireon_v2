const { z } = require('zod');

// --- /api/interview-turn shape (Qwen 3's partial contribution — backend still
// owns turns_used/done, see interviewState.js and the interviewTurn route) ---

const SLOT_ENUM = ['duration', 'severity', 'associated_symptoms', 'relevant_history', 'anything_else'];

const InterviewTurnQwenSchema = z.object({
  next_question: z.string().nullable(),
  slot_targeted: z.enum(SLOT_ENUM).nullable(),
  slots_filled: z.object({
    duration: z.string().nullable(),
    severity: z.number().int().min(1).max(10).nullable(),
    associated_symptoms: z.string().nullable(),
    relevant_history: z.string().nullable(),
    anything_else: z.string().nullable()
  }),
  red_flag_detected: z.boolean() // Qwen's own opinion — one of two independent signals, see redFlagCheck.js
});

// Keep this in sync by hand with InterviewTurnQwenSchema above — used for vLLM's guided_json param.
const INTERVIEW_TURN_JSON_SCHEMA = {
  type: 'object',
  properties: {
    next_question: { type: ['string', 'null'] },
    slot_targeted: {
      enum: ['duration', 'severity', 'associated_symptoms', 'relevant_history', 'anything_else', null]
    },
    slots_filled: {
      type: 'object',
      properties: {
        duration: { type: ['string', 'null'] },
        severity: { type: ['integer', 'null'], minimum: 1, maximum: 10 },
        associated_symptoms: { type: ['string', 'null'] },
        relevant_history: { type: ['string', 'null'] },
        anything_else: { type: ['string', 'null'] }
      },
      required: ['duration', 'severity', 'associated_symptoms', 'relevant_history', 'anything_else']
    },
    red_flag_detected: { type: 'boolean' }
  },
  required: ['next_question', 'slot_targeted', 'slots_filled', 'red_flag_detected']
};

// --- /api/generate-report shape (Qwen's contribution before backend remaps
// severity -> severity_score and adds report_id/status, see generateReport route) ---

const GenerateReportQwenSchema = z.object({
  duration: z.string().nullable(),
  severity: z.number().int().min(1).max(10).nullable(),
  associated_symptoms: z.string().nullable(),
  relevant_history: z.string().nullable(),
  anything_else: z.string().nullable(),
  red_flag_detected: z.boolean()
});

const GENERATE_REPORT_JSON_SCHEMA = {
  type: 'object',
  properties: {
    duration: { type: ['string', 'null'] },
    severity: { type: ['integer', 'null'], minimum: 1, maximum: 10 },
    associated_symptoms: { type: ['string', 'null'] },
    relevant_history: { type: ['string', 'null'] },
    anything_else: { type: ['string', 'null'] },
    red_flag_detected: { type: 'boolean' }
  },
  required: ['duration', 'severity', 'associated_symptoms', 'relevant_history', 'anything_else', 'red_flag_detected']
};

module.exports = {
  InterviewTurnQwenSchema,
  INTERVIEW_TURN_JSON_SCHEMA,
  GenerateReportQwenSchema,
  GENERATE_REPORT_JSON_SCHEMA,
  SLOT_ENUM
};
