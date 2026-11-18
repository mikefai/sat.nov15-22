import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { buildStudentOverviewRecords } from '../src/utils/adminAnalytics.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const course = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src', 'generated', 'courseData.json'), 'utf8')
);

// 1. Rich student fixture + brand-new empty student fixture
const profiles = [
  {
    id: 'stu-active',
    email: 'hana.lee@example.com',
    display_name: 'Hana Lee',
    avatar_url: null,
    target_score: 1450,
    exam_date: '2026-12-05',
    created_at: '2026-11-15T09:00:00Z',
    updated_at: '2026-11-18T08:00:00Z',
  },
  {
    id: 'stu-empty',
    email: 'newbie@example.com',
    display_name: null,
    avatar_url: null,
    target_score: 1400,
    exam_date: '2026-12-05',
    created_at: '2026-11-18T07:00:00Z',
    updated_at: '2026-11-18T07:00:00Z',
  },
];

const rwQ1 = course.days[0].rwPractice.questions[0];
const rwQ2 = course.days[0].rwPractice.questions[1];
const mathQ1 = course.days[0].mathPractice.questions[0];
const mathQ2 = course.days[0].mathPractice.questions[1];

const wrongLetter = (correct) => (correct === 'A' ? 'B' : 'A');

const progressRows = [
  {
    user_id: 'stu-active',
    state_version: 1,
    last_route_hash: '#/day/1/5',
    solved_questions: 4,
    correct_questions: 2,
    completed_steps: 2,
    mastered_words: 1,
    error_log_count: 3,
    updated_at: '2026-11-18T08:30:00Z',
    progress_json: {
      version: 1,
      lastRouteHash: '#/day/1/5',
      questionAttempts: {
        [rwQ1.id]: {
          selectedChoice: rwQ1.correctAnswer,
          checked: true,
          isCorrect: true,
          confidence: 'C',
          eliminatedChoices: [],
          flagged: false,
        },
        [rwQ2.id]: {
          selectedChoice: wrongLetter(rwQ2.correctAnswer),
          checked: true,
          isCorrect: false,
          confidence: '?',
          eliminatedChoices: [],
          flagged: true,
        },
        [mathQ1.id]: {
          selectedChoice: mathQ1.format === 'MC' ? mathQ1.correctAnswer : undefined,
          sprInput: mathQ1.format === 'SPR' ? mathQ1.correctAnswer : undefined,
          checked: true,
          isCorrect: true,
          confidence: 'C',
          eliminatedChoices: [],
          flagged: false,
        },
        [mathQ2.id]: {
          selectedChoice: mathQ2.format === 'MC' ? wrongLetter(mathQ2.correctAnswer) : undefined,
          sprInput: mathQ2.format === 'SPR' ? '9999' : undefined,
          checked: true,
          isCorrect: false,
          confidence: '?',
          eliminatedChoices: [],
          flagged: false,
        },
      },
      checkedBoxes: { 'd1-s1-chk-1': true },
      completedSteps: { 'd1-s1': true, 'd1-s5': true },
      vocabProgress: {
        'word-1': {
          status: 'mastered',
          mySentence: 'Empirical data must substantiate every scientific claim.',
          starred: true,
        },
      },
      customVocab: [
        {
          id: 'cv-1',
          word: 'equivocal',
          partOfSpeech: 'adj.',
          simpleMeaning: 'open to more than one interpretation',
          satContext: 'The committee issued an equivocal statement.',
          synonymsContrast: 'Syn: ambiguous',
          mySentence: 'Avoid equivocal wording in thesis statements.',
          reviewDates: 'Nov 19, Nov 22',
        },
      ],
      errorEntries: [
        {
          id: 'e1',
          dateLabel: 'Nov 16',
          questionId: rwQ2.id,
          section: 'R&W',
          topic: 'Boundaries',
          questionType: 'Punctuation',
          eCode: 'E2',
          vCode: '',
          whyMissed: 'Comma splice',
          correctMethod: 'Two independent clauses require period or semicolon',
          nextTimeRule: 'Strip modifiers before checking comma',
          coldResolveStatus: 'pending',
          createdAt: '2026-11-16T10:00:00Z',
        },
        {
          id: 'e2',
          dateLabel: 'Nov 17',
          questionId: 'RW-D2-Q3',
          section: 'R&W',
          topic: 'Boundaries',
          questionType: 'Conjunctive Adverb',
          eCode: 'E2',
          vCode: '',
          whyMissed: 'Conjunctive adverb comma',
          correctMethod: 'However between clauses needs semicolon',
          nextTimeRule: 'Spot however -> check both sides for finite verbs',
          coldResolveStatus: 'resolved',
          createdAt: '2026-11-17T10:00:00Z',
        },
        {
          id: 'e3',
          dateLabel: 'Nov 18',
          questionId: 'RW-D3-Q5',
          section: 'R&W',
          topic: 'Boundaries',
          questionType: 'Subordination',
          eCode: 'E2',
          vCode: '',
          whyMissed: 'Rushed boundary check',
          correctMethod: 'Subordinate clause cannot stand alone',
          nextTimeRule: 'Circle finite verbs first',
          coldResolveStatus: 'needs-repair',
          createdAt: '2026-11-18T08:15:00Z',
        },
      ],
      dailyReflections: {
        '1': {
          improvedToday: 'Clause stripping speed',
          recurringMistake: 'Comma splices around transitions',
          vocabRetained: 'substantiate, corroborate',
          pacingNotes: 'Finished with 90s buffer',
          tomorrowPriority: 'Drill Day 2 Boundaries',
        },
      },
      masteryProgress: {},
      caseProgress: {},
    },
  },
];

const records = buildStudentOverviewRecords(profiles, progressRows, course);
assert.equal(records.length, 2, 'Should return 2 student records');

const hana = records.find((r) => r.userId === 'stu-active');
assert.ok(hana, 'Active student record must exist');
assert.equal(hana.displayName, 'Hana Lee');
assert.equal(hana.solvedQuestions, 4);
assert.equal(hana.correctQuestions, 2);
assert.equal(hana.overallAccuracyPct, 50);
assert.equal(hana.rwAccuracyPct, 50);
assert.equal(hana.mathAccuracyPct, 50);
assert.equal(hana.completedSteps, 2);
assert.equal(hana.masteredWords, 1);
assert.deepEqual(hana.recurringErrorCodes, ['E2 (3)']);
assert.equal(hana.missedOrFlaggedQuestions.length, 2);
assert.equal(hana.writtenVocabItems.length, 2);
assert.equal(hana.reflections.length, 1);
assert.equal(hana.dayBreakdown[0].completedSteps, 2);
assert.equal(hana.dayBreakdown[0].solvedQuestions, 4);

const newbie = records.find((r) => r.userId === 'stu-empty');
assert.ok(newbie, 'Empty student record must exist');
assert.equal(newbie.displayName, 'newbie');
assert.equal(newbie.solvedQuestions, 0);
assert.equal(newbie.overallAccuracyPct, null);
assert.equal(newbie.rwAccuracyPct, null);
assert.equal(newbie.mathAccuracyPct, null);
assert.equal(newbie.dayBreakdown.length, 7);
assert.equal(newbie.dayBreakdown[0].completedSteps, 0);

// 2. Security check: verify plaintext instructor passcode never appears anywhere in src/
function collectSrcFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectSrcFiles(full));
    else if (/\.(ts|tsx|js|jsx|json|css)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const forbiddenSecret = ['SAT1400', 'INSTRUCTOR', '2026'].join('-');
for (const file of collectSrcFiles(path.join(ROOT, 'src'))) {
  const content = fs.readFileSync(file, 'utf8');
  assert.ok(
    !content.includes(forbiddenSecret),
    `Security violation: plaintext instructor code found in ${path.relative(ROOT, file)}`
  );
}

console.log(
  '✓ Admin analytics & security checks passed: active student metrics, empty student fallback, and zero frontend secret exposure verified.'
);
