import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'src', 'generated', 'courseData.json');

const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));

assert.equal(data.days.length, 7, 'Must have 7 daily workbooks');
assert.equal(data.stats.totalQuestions, 232, 'Must have 232 total practice questions');
assert.equal(data.stats.totalRwQuestions, 125, 'Must have 125 R&W practice questions');
assert.equal(data.stats.totalMathQuestions, 107, 'Must have 107 Math practice questions');
assert.equal(data.vocabStudio.words.length, 60, 'Must have 60 core vocabulary words');
assert.equal(data.stats.totalDiagnosticCases, 35, 'Must have 35 diagnostic student cases');
assert.equal(data.stats.totalMasteryChecks, 66, 'Must have 66 mastery gate items');
assert.equal(data.errorLogStudio.eCodes.length, 10, 'Must have 10 E-codes (E1-E10)');
assert.equal(data.errorLogStudio.vCodes.length, 7, 'Must have 7 V-codes (V1-V7)');

for (const day of data.days) {
  assert.equal(day.steps.length, 10, `Day ${day.day} must have 10 steps`);
  const allQs = [...day.rwPractice.questions, ...day.mathPractice.questions];
  for (const q of allQs) {
    assert.ok(q.number >= 1, `${q.id} must have a valid question number`);
    assert.ok(q.stemHtml.length > 20, `${q.id} must have rendered stem HTML`);
    assert.ok(q.explanationHtml.length > 20, `${q.id} must have rendered explanation HTML`);
    if (q.format === 'MC') {
      assert.equal(q.choices.length, 4, `${q.id} must have 4 MC choices`);
      assert.match(q.correctAnswer, /^[A-D]$/, `${q.id} MC answer must be A-D`);
    } else {
      assert.ok(q.correctAnswer.length > 0, `${q.id} SPR answer must be non-empty`);
      assert.ok(
        typeof q.numericValue === 'number' && !Number.isNaN(q.numericValue),
        `${q.id} SPR numericValue must be a valid number (got ${q.numericValue})`
      );
    }
  }
  assert.ok(day.vocabulary.exercises.length >= 15, `Day ${day.day} must have interactive vocab exercises`);
  day.vocabulary.exercises.forEach((ex, idx) => {
    assert.equal(ex.number, idx + 1, `${ex.id} must have sequential number`);
    assert.ok(ex.promptHtml.length > 10, `${ex.id} must have promptHtml`);
    assert.ok(ex.answerHtml.length > 0, `${ex.id} must have answerHtml`);
    if (ex.format === 'MC') {
      assert.equal(ex.choices.length, 4, `${ex.id} MC vocab drill must have 4 choices`);
      assert.match(ex.correctAnswer, /^[A-D]$/, `${ex.id} MC vocab drill must have A-D key`);
    }
  });
}

for (const w of data.vocabStudio.words) {
  assert.ok(w.word.length > 1, `Vocab #${w.number} must have headword`);
  assert.ok(w.simpleMeaning.length > 5, `Vocab #${w.number} must have simpleMeaning`);
  assert.ok(w.satContextHtml.length > 10, `Vocab #${w.number} must have satContextHtml`);
}

console.log(
  '✓ Webapp curriculum integrity checks passed: 7 days, 70 steps, 232 questions, 60 words, 35 cases, 66 mastery items, E1-E10 & V1-V7 verified.'
);
