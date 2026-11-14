import React, { useState } from 'react';
import type { ErrorCodeInfo } from '../types/course';
import { useCourseStore } from '../state/useCourseStore';

interface QuickErrorLoggerProps {
  eCodes: ErrorCodeInfo[];
  vCodes: ErrorCodeInfo[];
  initialValues?: {
    dateLabel?: string;
    questionId?: string;
    section?: 'R&W' | 'Math';
    topic?: string;
    questionType?: string;
  };
  onSaved?: () => void;
  onCancel?: () => void;
}

export const QuickErrorLogger: React.FC<QuickErrorLoggerProps> = ({
  eCodes,
  vCodes,
  initialValues,
  onSaved,
  onCancel,
}) => {
  const { addErrorEntry } = useCourseStore();
  const [section, setSection] = useState<'R&W' | 'Math'>(initialValues?.section || 'R&W');
  const [dateLabel, setDateLabel] = useState(
    initialValues?.dateLabel || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  );
  const [questionId, setQuestionId] = useState(initialValues?.questionId || '');
  const [topic, setTopic] = useState(initialValues?.topic || '');
  const [questionType, setQuestionType] = useState(initialValues?.questionType || '');
  const [eCode, setECode] = useState('E2');
  const [vCode, setVCode] = useState(section === 'R&W' ? 'V4' : '');
  const [whyMissed, setWhyMissed] = useState('');
  const [correctMethod, setCorrectMethod] = useState('');
  const [nextTimeRule, setNextTimeRule] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!whyMissed.trim() && !nextTimeRule.trim()) return;
    addErrorEntry({
      dateLabel: dateLabel.trim() || 'Today',
      questionId: questionId.trim() || undefined,
      section,
      topic: topic.trim() || (section === 'R&W' ? 'Craft & Structure' : 'Algebra'),
      questionType: questionType.trim() || 'Practice Question',
      eCode,
      vCode: section === 'R&W' ? vCode : '',
      whyMissed: whyMissed.trim(),
      correctMethod: correctMethod.trim(),
      nextTimeRule: nextTimeRule.trim(),
      coldResolveStatus: 'pending',
    });
    setWhyMissed('');
    setCorrectMethod('');
    setNextTimeRule('');
    onSaved?.();
  };

  return (
    <form className="error-logger-card" onSubmit={handleSubmit}>
      <div className="error-logger-header">
        <h4>Log Diagnostic Mistake to Error Notebook</h4>
        {onCancel && (
          <button type="button" className="btn-text-subtle" onClick={onCancel}>
            Close
          </button>
        )}
      </div>

      <div className="logger-grid-4">
        <label>
          <span>Section</span>
          <select
            value={section}
            onChange={(e) => {
              const next = e.target.value as 'R&W' | 'Math';
              setSection(next);
              if (next === 'Math') setVCode('');
            }}
          >
            <option value="R&W">Reading &amp; Writing</option>
            <option value="Math">Math</option>
          </select>
        </label>

        <label>
          <span>Question ID / Source</span>
          <input
            type="text"
            value={questionId}
            placeholder="e.g. RW-D1-Q3 or PT4-M2-Q9"
            onChange={(e) => setQuestionId(e.target.value)}
          />
        </label>

        <label>
          <span>Domain</span>
          <input
            type="text"
            value={topic}
            placeholder="e.g. Craft and Structure"
            onChange={(e) => setTopic(e.target.value)}
          />
        </label>

        <label>
          <span>Skill &amp; Difficulty</span>
          <input
            type="text"
            value={questionType}
            placeholder="e.g. Words in Context (Hard)"
            onChange={(e) => setQuestionType(e.target.value)}
          />
        </label>
      </div>

      <div className="logger-grid-2">
        <label>
          <span>Primary Error Code (E1–E10)</span>
          <select value={eCode} onChange={(e) => setECode(e.target.value)}>
            {eCodes.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.label}: {c.description.slice(0, 62)}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Language / Vocab Sub-Code (V1–V7, R&amp;W)</span>
          <select
            value={vCode}
            disabled={section === 'Math'}
            onChange={(e) => setVCode(e.target.value)}
          >
            <option value="">— None / Not Language-Specific —</option>
            {vCodes.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="logger-grid-3">
        <label>
          <span>Why I Missed It (Exact Trap)</span>
          <textarea
            rows={2}
            required
            placeholder="e.g. Overlooked 'however' contrast and chose everyday sense of 'qualify'."
            value={whyMissed}
            onChange={(e) => setWhyMissed(e.target.value)}
          />
        </label>

        <label>
          <span>Correct Rule / Fast Desmos Method</span>
          <textarea
            rows={2}
            placeholder="e.g. Academic 'qualify' = narrow/limit a sweeping claim."
            value={correctMethod}
            onChange={(e) => setCorrectMethod(e.target.value)}
          />
        </label>

        <label>
          <span>What I Will Do Next Time (1-Sentence Firewall)</span>
          <textarea
            rows={2}
            required
            placeholder="e.g. Circle concession pivots and write +/- above blank before reading A-D."
            value={nextTimeRule}
            onChange={(e) => setNextTimeRule(e.target.value)}
          />
        </label>
      </div>

      <div className="logger-footer">
        <input
          type="text"
          className="logger-date-input"
          value={dateLabel}
          onChange={(e) => setDateLabel(e.target.value)}
          aria-label="Entry Date"
        />
        <button type="submit" className="btn-primary">
          Save to Error Log
        </button>
      </div>
    </form>
  );
};
