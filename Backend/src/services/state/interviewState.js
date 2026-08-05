const SLOT_NAMES = [
  'duration',
  'severity',
  'associated_symptoms',
  'relevant_history',
  'anything_else'
];
const MAX_TURNS = 8;

// session_id -> { slots: {...}, turns_used: number, chief_complaint: string|null, transcripts: [] }
const sessions = new Map();

function getSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      slots: Object.fromEntries(SLOT_NAMES.map((s) => [s, null])),
      turns_used: 0,
      chief_complaint: null,
      history: [] // { role, text } — native language, used for tone-matching prompts
    });
  }
  return sessions.get(sessionId);
}

function mergeSlots(sessionId, newSlotValues) {
  const session = getSession(sessionId);
  for (const slot of SLOT_NAMES) {
    if (newSlotValues[slot] !== null && newSlotValues[slot] !== undefined) {
      session.slots[slot] = newSlotValues[slot];
    }
  }
  return { ...session.slots };
}

function incrementTurn(sessionId) {
  const session = getSession(sessionId);
  session.turns_used += 1;
  return session.turns_used;
}

function allSlotsFilled(sessionId) {
  const session = getSession(sessionId);
  return SLOT_NAMES.every((s) => session.slots[s] !== null);
}

function isDone(sessionId) {
  const session = getSession(sessionId);
  return allSlotsFilled(sessionId) || session.turns_used >= MAX_TURNS;
}

function nextUnfilledSlots(sessionId) {
  const session = getSession(sessionId);
  return SLOT_NAMES.filter((s) => session.slots[s] === null);
}

function appendHistory(sessionId, role, text) {
  const session = getSession(sessionId);
  session.history.push({ role, text });
  // keep only the last 12 turns in memory — plenty for slot-filling + tone context
  if (session.history.length > 12) session.history.shift();
}

function clearSession(sessionId) {
  sessions.delete(sessionId);
}

module.exports = {
  SLOT_NAMES,
  MAX_TURNS,
  getSession,
  mergeSlots,
  incrementTurn,
  allSlotsFilled,
  isDone,
  nextUnfilledSlots,
  appendHistory,
  clearSession
};
