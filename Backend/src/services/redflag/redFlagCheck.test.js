const { test } = require('node:test');
const assert = require('node:assert');
const { checkRedFlags } = require('./redFlagCheck');

test('detects chest pain', () => {
  const result = checkRedFlags('I have had chest pain since this morning');
  assert.strictEqual(result.triggered, true);
});

test('detects suicidal ideation', () => {
  const result = checkRedFlags('I feel like I want to die and see no point');
  assert.strictEqual(result.triggered, true);
});

test('does not trigger on normal symptom description', () => {
  const result = checkRedFlags('I have had a mild headache for two days and some nausea');
  assert.strictEqual(result.triggered, false);
});

test('does not trigger on empty or null input', () => {
  assert.strictEqual(checkRedFlags('').triggered, false);
  assert.strictEqual(checkRedFlags(null).triggered, false);
  assert.strictEqual(checkRedFlags(undefined).triggered, false);
});

test('detects red flag embedded mid-transcript alongside normal symptom talk', () => {
  const transcript =
    "I've had a cough for three days, nothing serious, but today I suddenly couldn't breathe properly for a minute";
  const result = checkRedFlags(transcript);
  assert.strictEqual(result.triggered, true);
});
