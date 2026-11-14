import type { PracticeQuestion } from '../types/course';

export interface SprValidationResult {
  validFormat: boolean;
  formatHint?: string;
  numericValue: number | null;
}

export function parseSprStudentInput(raw: string): SprValidationResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { validFormat: false, formatHint: 'Enter an integer, decimal, or fraction (e.g. 7/2).', numericValue: null };
  }

  // Detect mixed number like "3 1/2" which Bluebook reads as 31/2!
  if (/^-?\d+\s+\d+\/\d+$/.test(trimmed)) {
    return {
      validFormat: false,
      formatHint: 'Bluebook does not accept mixed numbers like "3 1/2" — enter an improper fraction ("7/2") or decimal ("3.5").',
      numericValue: null,
    };
  }

  if (trimmed.includes('%') || trimmed.includes('$') || trimmed.includes(',')) {
    return {
      validFormat: false,
      formatHint: 'Enter digits, a decimal point, a negative sign, or "/" only (no commas, %, or $).',
      numericValue: null,
    };
  }

  // Standard integer or decimal (including .35 or -.5)
  if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(trimmed)) {
    return { validFormat: true, numericValue: Number(trimmed) };
  }

  // Fraction p/q
  const frac = trimmed.match(/^(-?\d+)\/(\d+)$/);
  if (frac) {
    const den = Number(frac[2]);
    if (den === 0) {
      return { validFormat: false, formatHint: 'Denominator cannot be 0.', numericValue: null };
    }
    return { validFormat: true, numericValue: Number(frac[1]) / den };
  }

  return {
    validFormat: false,
    formatHint: 'Invalid SPR format. Use integers (43), decimals (0.35), or fractions (7/20).',
    numericValue: null,
  };
}

export function checkQuestionAnswer(
  question: PracticeQuestion,
  selectedChoice?: string,
  sprInput?: string
): { isCorrect: boolean; formatHint?: string } {
  if (question.format === 'MC') {
    if (!selectedChoice) return { isCorrect: false };
    return { isCorrect: selectedChoice.toUpperCase() === question.correctAnswer.toUpperCase() };
  }

  const parsed = parseSprStudentInput(sprInput || '');
  if (!parsed.validFormat || parsed.numericValue === null) {
    return { isCorrect: false, formatHint: parsed.formatHint };
  }

  const normalizedRaw = (sprInput || '').trim();
  if (question.acceptableSpr.some((acc) => acc.trim() === normalizedRaw)) {
    return { isCorrect: true };
  }

  if (question.numericValue !== null) {
    // Official Digital SAT Bluebook accepts rounded or truncated 4-decimal equivalents (e.g. .2195 for 9/41)
    if (Math.abs(parsed.numericValue - question.numericValue) <= 0.0006) {
      return { isCorrect: true };
    }
  }

  return { isCorrect: false };
}
