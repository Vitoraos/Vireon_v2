/**
 * Deterministic backstop red-flag detector.
 *
 * IMPORTANT: this runs on the ENGLISH-NORMALIZED transcript (see
 * translateService.js), not the raw native-language transcript. That
 * means this list only ever needs to be maintained in one language,
 * regardless of how many code-switch languages the patient uses —
 * translation is the layer that does the multilingual work, this
 * function stays simple and testable.
 *
 * This is a backstop, not the only red-flag signal — the Qwen 3 slot-filling
 * call also returns its own red_flag_detected opinion. Either one firing
 * is treated as triggered (see interviewTurn route). Never rely on only one.
 */

const RED_FLAG_PATTERNS = [
  // Cardiac / respiratory
  /\bchest pain\b/i,
  /\btightness in (my|the) chest\b/i,
  /\b(can'?t|couldn'?t|unable to) breathe\b/i,
  /\bdifficulty breathing\b/i,
  /\bstruggling to breathe\b/i,
  /\bshort(ness)? of breath\b/i,
  /\bgasping for air\b/i,

  // Bleeding / consciousness
  /\bsevere bleeding\b/i,
  /\buncontrolled bleeding\b/i,
  /\bwon'?t stop bleeding\b/i,
  /\blost consciousness\b/i,
  /\bpassed out\b/i,
  /\bblacked out\b/i,
  /\bunresponsive\b/i,

  // Neuro / stroke
  /\bsudden severe headache\b/i,
  /\bworst headache of my life\b/i,
  /\bface (is )?drooping\b/i,
  /\barm weakness\b/i,
  /\bslurred speech\b/i,
  /\bcan'?t speak properly\b/i,
  /\bone side (of my body )?(is )?numb\b/i,

  // Suicidal ideation / self-harm
  /\bwant to die\b/i,
  /\bkill myself\b/i,
  /\bend my life\b/i,
  /\bsuicidal\b/i,
  /\bharm(ing)? myself\b/i,
  /\bno reason to live\b/i
];

/**
 * @param {string} englishNormalizedText
 * @returns {{ triggered: boolean, matchedPattern: string|null }}
 */
function checkRedFlags(englishNormalizedText) {
  if (!englishNormalizedText || typeof englishNormalizedText !== 'string') {
    return { triggered: false, matchedPattern: null };
  }

  for (const pattern of RED_FLAG_PATTERNS) {
    if (pattern.test(englishNormalizedText)) {
      return { triggered: true, matchedPattern: pattern.source };
    }
  }

  return { triggered: false, matchedPattern: null };
}

module.exports = { checkRedFlags, RED_FLAG_PATTERNS };
