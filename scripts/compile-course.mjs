import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import katex from 'katex';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'src', 'generated');
const OUT_FILE = path.join(OUT_DIR, 'courseData.json');

marked.setOptions({
  gfm: true,
  breaks: false,
});

let mathRenderCount = 0;
let mathErrors = [];

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[`*_~]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
}

function mapMdPathToRoute(relPath) {
  const clean = decodeURIComponent(relPath).replace(/\\/g, '/').replace(/^\.\//, '');
  if (/^README\.md$/i.test(clean)) return '#/overview';
  if (/^Part-1-/i.test(clean)) return '#/master-plan';
  if (/^Part-2-Day-0?(\d)/i.test(clean)) {
    const d = clean.match(/^Part-2-Day-0?(\d)/i)[1];
    return `#/day/${d}/1`;
  }
  if (/Vocabulary-Notebook/i.test(clean)) return '#/vocab';
  if (/SAT-Error-Log/i.test(clean)) return '#/error-log';
  return null;
}

function rewriteInternalLinks(md) {
  // 1. Rewrite any legacy file:/// links pointing to workspace Markdown files
  let out = md.replace(
    /\[([^\]]+)\]\(file:\/\/\/[^)]+?\/SAT(?:\s|%20)2\/([^)#]+)(?:#([^)]+))?\)/gi,
    (full, label, relPath) => {
      const route = mapMdPathToRoute(relPath.trim());
      return route ? `[${label}](${route})` : full;
    }
  );
  // 2. Rewrite relative repository .md links (e.g. ./Part-1-Seven-Day-Master-Study-Plan.md) into SPA hash routes
  out = out.replace(
    /\[([^\]]+)\]\(((?:\.\/)?(?:Trackers\/)?[A-Za-z0-9._-]+\.md)(?:#([^)]+))?\)/g,
    (full, label, relPath) => {
      const route = mapMdPathToRoute(relPath.trim());
      return route ? `[${label}](${route})` : full;
    }
  );
  return out;
}

function protectAndRenderMath(md, sourceLabel) {
  const tokens = [];
  const stash = (html) => {
    const key = `%%COURSEMATH${tokens.length}END%%`;
    tokens.push(html);
    return key;
  };

  // 1. Protect fenced code blocks first
  let out = md.replace(/```[\s\S]*?```/g, (block) => stash(marked.parse(block)));

  // 2. Protect inline code spans (`...`) so `$` or `_` inside backticks are untouched
  const codeSpans = [];
  out = out.replace(/`([^`\n]+)`/g, (_m, inner) => {
    const idx = codeSpans.length;
    codeSpans.push(inner);
    return `%%COURSECODE${idx}END%%`;
  });

  // 3. Render display math $$...$$
  out = out.replace(/\$\$([\s\S]+?)\$\$/g, (_m, expr) => {
    try {
      mathRenderCount++;
      const rendered = katex.renderToString(expr.trim(), {
        displayMode: true,
        output: 'html',
        throwOnError: true,
        strict: false,
      });
      return stash(`<div class="math-display">${rendered}</div>`);
    } catch (err) {
      mathErrors.push({ sourceLabel, expr, message: err.message });
      return stash(`<div class="math-display math-fallback">${expr}</div>`);
    }
  });

  // 4. Protect escaped literal \$
  out = out.replace(/\\\$/g, () => stash('&#36;'));

  // 5. Render inline math $...$
  out = out.replace(/\$(?!\s)((?:\\.|[^$\n])+?)(?<!\s)\$/g, (_m, expr) => {
    try {
      mathRenderCount++;
      const rendered = katex.renderToString(expr.trim(), {
        displayMode: false,
        output: 'html',
        throwOnError: true,
        strict: false,
      });
      return stash(`<span class="math-inline">${rendered}</span>`);
    } catch (err) {
      mathErrors.push({ sourceLabel, expr, message: err.message });
      return stash(`<span class="math-inline math-fallback">${expr}</span>`);
    }
  });

  // Restore inline code spans before Marked runs so Marked renders `<code>` properly
  out = out.replace(/%%COURSECODE(\d+)END%%/g, (_m, i) => `\`${codeSpans[Number(i)]}\``);

  return { text: out, tokens };
}

function restoreTokens(html, tokens) {
  let out = html;
  let guard = 0;
  while (/%%COURSEMATH(\d+)END%%/.test(out) && guard < 5) {
    out = out.replace(/%%COURSEMATH(\d+)END%%/g, (_m, i) => tokens[Number(i)]);
    guard++;
  }
  return out;
}

function enhanceRenderedHtml(html, scopePrefix) {
  let checkCounter = 0;

  // 1. Transform GitHub-style alert blockquotes (> [!IMPORTANT] etc.)
  let out = html.replace(
    /<blockquote>\s*<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(?:<br\s*\/?>|\n)?([\s\S]*?)<\/blockquote>/gi,
    (_m, kind, inner) => {
      const k = kind.toLowerCase();
      const titles = {
        note: 'Instructional Note',
        tip: 'Strategic Tip',
        important: 'Essential Rule',
        warning: 'Exam Trap Alert',
        caution: 'High-Priority Caution',
      };
      return `<aside class="course-callout callout-${k}"><div class="callout-label">${titles[k] || kind}</div><div class="callout-body"><p>${inner}</div></aside>`;
    }
  );

  // 2. Give every checkbox a deterministic data-check-id so state persists in localStorage
  out = out.replace(/<input\s+(checked=""\s+)?disabled=""\s+type="checkbox"\s*\/?>/gi, (_m, checkedAttr) => {
    const id = `${scopePrefix}-chk-${++checkCounter}`;
    const defaultChecked = checkedAttr ? ' data-default-checked="true"' : '';
    return `<input type="checkbox" class="course-checkbox" data-check-id="${id}"${defaultChecked} />`;
  });

  // Also convert literal `[ ]` cells inside tables (e.g. Escalation / Retrieval logs)
  out = out.replace(/<td>\s*(?:<em>)?\[\s*\](?:<\/em>)?\s*<\/td>/gi, () => {
    const id = `${scopePrefix}-tblchk-${++checkCounter}`;
    return `<td class="td-checkbox"><input type="checkbox" class="course-checkbox" data-check-id="${id}" /></td>`;
  });

  // 3. Wrap tables in responsive scroll container
  out = out.replace(/<table>/g, '<div class="table-scroll-wrap"><table class="course-table">').replace(/<\/table>/g, '</table></div>');

  // 4. Add heading IDs & collect outline
  const outline = [];
  const usedSlugs = new Map();
  out = out.replace(/<h([2-4])>([\s\S]*?)<\/h\1>/g, (_m, lvl, inner) => {
    const base = slugify(inner) || 'section';
    const count = (usedSlugs.get(base) || 0) + 1;
    usedSlugs.set(base, count);
    const id = count === 1 ? `${scopePrefix}-${base}` : `${scopePrefix}-${base}-${count}`;
    const plain = inner
      .replace(/<[^>]+>/g, '')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&rarr;/g, '→')
      .trim();
    outline.push({ id, level: Number(lvl), text: plain });
    return `<h${lvl} id="${id}">${inner}</h${lvl}>`;
  });

  return { html: out, outline };
}

function renderMarkdownBlock(md, scopePrefix) {
  if (!md || !md.trim()) return { html: '', outline: [] };
  const linked = rewriteInternalLinks(md);
  const { text, tokens } = protectAndRenderMath(linked, scopePrefix);
  const parsed = marked.parse(text);
  const restored = restoreTokens(parsed, tokens);
  return enhanceRenderedHtml(restored, scopePrefix);
}

function renderInlineMarkdown(md, scopePrefix) {
  if (!md || !md.trim()) return '';
  const linked = rewriteInternalLinks(md);
  const { text, tokens } = protectAndRenderMath(linked, scopePrefix);
  const parsed = marked.parseInline(text);
  return restoreTokens(parsed, tokens);
}

function splitByH2(md) {
  const lines = md.split(/\r?\n/);
  const introLines = [];
  const sections = [];
  let current = null;

  for (const line of lines) {
    const m = line.match(/^##\s+(.+)$/);
    if (m) {
      if (current) sections.push({ title: current.title, body: current.lines.join('\n').trim() });
      current = { title: m[1].trim(), lines: [] };
    } else if (current) {
      current.lines.push(line);
    } else {
      introLines.push(line);
    }
  }
  if (current) sections.push({ title: current.title, body: current.lines.join('\n').trim() });
  return { intro: introLines.join('\n').trim(), sections };
}

function splitByH3(md) {
  const lines = md.split(/\r?\n/);
  const introLines = [];
  const subSections = [];
  let current = null;

  for (const line of lines) {
    const m = line.match(/^###\s+(.+)$/);
    if (m) {
      if (current) subSections.push({ title: current.title, body: current.lines.join('\n').trim() });
      current = { title: m[1].trim(), lines: [] };
    } else if (current) {
      current.lines.push(line);
    } else {
      introLines.push(line);
    }
  }
  if (current) subSections.push({ title: current.title, body: current.lines.join('\n').trim() });
  return { intro: introLines.join('\n').trim(), subSections };
}

function parseSprNumericValue(str) {
  const cleaned = str.trim().replace(/^`|`$/g, '');
  if (/^-?\d+(\.\d+)?$/.test(cleaned)) return Number(cleaned);
  const frac = cleaned.match(/^(-?\d+)\/(-?\d+)$/);
  if (frac && Number(frac[2]) !== 0) return Number(frac[1]) / Number(frac[2]);
  return null;
}

function extractSection8Explanations(sec8Body, day) {
  // Returns maps for:
  // 1. questionMap: Map<questionId, { correctAnswer, acceptableSpr, answerHeadlineHtml, explanationHtml }>
  // 2. ccMap: Map<ccId, answerHtml>
  // 3. subSections: Array<{ id, title, html }>
  const { intro, subSections } = splitByH3(sec8Body);
  const questionMap = new Map();
  const ccMap = new Map();

  // Extract Comprehension Check answers from Subsection A
  const subA = subSections.find((s) => /^A\./i.test(s.title));
  if (subA) {
    const ccRegex = /^-\s+\*\*`?(CC-[A-Z0-9-]+)`?[^*]*\*\*:?\s*([\s\S]*?)(?=^-\s+\*\*`?CC-|^#{3,4}\s|\Z)/gm;
    // Simpler line-by-line accumulator for CC items
    const lines = subA.body.split(/\r?\n/);
    let curId = null;
    let curBuf = [];
    const flushCc = () => {
      if (curId && curBuf.length) {
        ccMap.set(curId, renderMarkdownBlock(curBuf.join('\n').trim(), `d${day}-cckey-${curId}`).html);
      }
      curId = null;
      curBuf = [];
    };
    for (const line of lines) {
      const m = line.match(/^-\s+\*\*`?(CC-[A-Z0-9-]+)`?(?:[^*]*)\*\*:?\s*(.*)$/);
      if (m) {
        flushCc();
        curId = m[1];
        curBuf.push(m[2]);
      } else if (/^#{3,4}\s/.test(line) || /^---\s*$/.test(line)) {
        flushCc();
      } else if (curId) {
        curBuf.push(line);
      }
    }
    flushCc();
    void ccRegex;
  }

  // Extract RW & MATH explanations from Subsections C & D
  for (const sub of subSections) {
    if (!/^[CD]\./i.test(sub.title)) continue;
    const lines = sub.body.split(/\r?\n/);
    let curId = null;
    let curHeaderRest = '';
    let curBuf = [];

    const flushQ = () => {
      if (!curId) return;
      const mcMatch = curHeaderRest.match(/Correct Answer:\s*([A-D])\b/i);
      const sprMatches = [...curHeaderRest.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
      let correctAnswer = '';
      let acceptableSpr = [];
      let numericValue = null;

      if (mcMatch) {
        correctAnswer = mcMatch[1].toUpperCase();
      } else {
        const sprPrimary = curHeaderRest.match(/Correct Answer(?:\s*\(SPR\))?:\s*`?([^`*\s)]+)`?/i);
        correctAnswer = sprPrimary ? sprPrimary[1].trim() : sprMatches[0] || '';
        acceptableSpr = sprMatches.length ? sprMatches : [correctAnswer];
        numericValue = parseSprNumericValue(correctAnswer);
      }

      const bodyMd = curBuf.join('\n').replace(/\n---\s*$/, '').trim();
      questionMap.set(curId, {
        correctAnswer,
        acceptableSpr,
        numericValue,
        answerHeadlineHtml: renderInlineMarkdown(curHeaderRest.replace(/^\*\*|\*\*$/g, ''), `d${day}-anshdr-${curId}`),
        explanationHtml: renderMarkdownBlock(bodyMd, `d${day}-exp-${curId}`).html,
      });
      curId = null;
      curHeaderRest = '';
      curBuf = [];
    };

    for (const line of lines) {
      // Format 1 (Days 1-5): #### `RW-D1-Q1` → **Correct Answer: A (`conserve`)**
      const m1 = line.match(/^#{3,4}\s+`?((?:RW|MATH)-D\d+-Q\d+)`?\s*(?:→|—|-)\s*(.+)$/);
      // Format 2 (Days 6-7): 1. **`RW-D6-Q1` — Correct Answer: B (`stools`)**
      const m2 = line.match(/^\d+\.\s+\*\*`?((?:RW|MATH)-D\d+-Q\d+)`?\s*(?:—|→|-)\s*(.+?)\*\*$/);

      if (m1) {
        flushQ();
        curId = m1[1];
        curHeaderRest = m1[2].trim();
      } else if (m2) {
        flushQ();
        curId = m2[1];
        curHeaderRest = m2[2].trim();
      } else if (curId) {
        // Dedent 3 spaces on Days 6-7 numbered list explanations so bullets render cleanly
        curBuf.push(line.replace(/^ {3}/, ''));
      }
    }
    flushQ();
  }

  const renderedSubSections = subSections.map((s, idx) => {
    const rendered = renderMarkdownBlock(s.body, `d${day}-s8-sub${idx + 1}`);
    return {
      id: `d${day}-s8-sub${idx + 1}`,
      title: s.title.replace(/`/g, ''),
      titleHtml: renderInlineMarkdown(s.title, `d${day}-s8-subhdr${idx + 1}`),
      html: rendered.html,
    };
  });

  return {
    introHtml: renderMarkdownBlock(intro, `d${day}-s8-intro`).html,
    subSections: renderedSubSections,
    questionMap,
    ccMap,
  };
}

function parsePracticeSection(secBody, sectionType, day, questionMap) {
  // Split intro before first question or first ### Part A
  const lines = secBody.split(/\r?\n/);
  const introLines = [];
  const questions = [];
  let currentPartTitle = '';
  let currentQ = null;

  const flushQuestion = () => {
    if (!currentQ) return;
    const rawBlock = currentQ.lines.join('\n').replace(/\n---\s*$/, '').trim();
    const metaParts = currentQ.metaStr
      .replace(/\*\[Original SAT-Style Practice\]\*/gi, '')
      .split('·')
      .map((s) => s.trim())
      .filter(Boolean);

    const isSpr =
      metaParts.some((p) => /\bSPR\b/i.test(p)) || /Your Answer \(SPR\)/i.test(rawBlock);

    const requiresConfidenceTag = metaParts.some((p) => /Confidence/i.test(p)) || day === 6;

    // Extract pacing note in italics like *(START PASS 1 HERE AT `32:00`!)*
    let pacingNote = '';
    const cleanedMetaParts = metaParts
      .map((p) => {
        const paceMatch = p.match(/\*\(([^)]+)\)\*/);
        if (paceMatch) {
          pacingNote = paceMatch[1].replace(/`/g, '');
          return p.replace(/\*\([^)]+\)\*/, '').trim();
        }
        return p;
      })
      .filter((p) => p && !/^(Multiple Choice|SPR)$/i.test(p) && !/^`?Confidence:/i.test(p));

    const domain = cleanedMetaParts[0] || (sectionType === 'RW' ? 'Reading & Writing' : 'Math');
    const skill = cleanedMetaParts[1] || '';
    const difficultyRaw =
      cleanedMetaParts.find((p) => /^(Easy|Medium|Hard|Easy\/Medium|Medium\/Hard)$/i.test(p)) ||
      cleanedMetaParts[cleanedMetaParts.length - 1] ||
      'Medium';

    let stemMd = rawBlock;
    const choices = [];

    if (isSpr) {
      stemMd = rawBlock.replace(/^\*\*Your Answer \(SPR\):\*\*.*$/im, '').trim();
    } else {
      // Extract trailing A) B) C) D) choices
      const qLines = rawBlock.split(/\r?\n/);
      const stemLines = [];
      let inChoices = false;
      let curChoice = null;

      for (const ql of qLines) {
        const cm = ql.match(/^([A-D])\)\s+(.+)$/);
        if (cm) {
          inChoices = true;
          if (curChoice) choices.push(curChoice);
          curChoice = { letter: cm[1], raw: cm[2].trim() };
        } else if (inChoices && curChoice && ql.trim() && !/^---/.test(ql)) {
          curChoice.raw += ' ' + ql.trim();
        } else if (!inChoices) {
          stemLines.push(ql);
        }
      }
      if (curChoice) choices.push(curChoice);
      stemMd = stemLines.join('\n').trim();
    }

    const expInfo = questionMap.get(currentQ.id);
    if (!expInfo) {
      throw new Error(`Missing Section 8 explanation for ${currentQ.id} on Day ${day}`);
    }

    questions.push({
      id: currentQ.id,
      number: questions.length + 1,
      day,
      section: sectionType,
      partTitle: currentQ.partTitle,
      domain: domain.replace(/`/g, ''),
      skill: skill.replace(/`/g, ''),
      difficulty: difficultyRaw.replace(/`/g, ''),
      format: isSpr ? 'SPR' : 'MC',
      pacingNote,
      requiresConfidenceTag,
      stemHtml: renderMarkdownBlock(stemMd, `q-${currentQ.id}-stem`).html,
      choices: choices.map((c) => ({
        letter: c.letter,
        raw: c.raw,
        html: renderInlineMarkdown(c.raw, `q-${currentQ.id}-c${c.letter}`),
      })),
      correctAnswer: expInfo.correctAnswer,
      acceptableSpr: expInfo.acceptableSpr,
      numericValue: expInfo.numericValue,
      answerHeadlineHtml: expInfo.answerHeadlineHtml,
      explanationHtml: expInfo.explanationHtml,
    });
    currentQ = null;
  };

  for (const line of lines) {
    const qHeader = line.match(/^#{3,4}\s+`?((?:RW|MATH)-D\d+-Q\d+)`?\s*·\s*(.+)$/);
    const partHeader = !qHeader ? line.match(/^###\s+(Part\s+[AB]:.+)$/) : null;

    if (partHeader) {
      flushQuestion();
      currentPartTitle = partHeader[1].replace(/`/g, '').trim();
    } else if (qHeader) {
      flushQuestion();
      currentQ = {
        id: qHeader[1],
        metaStr: qHeader[2],
        partTitle: currentPartTitle,
        lines: [],
      };
    } else if (currentQ) {
      currentQ.lines.push(line);
    } else {
      introLines.push(line);
    }
  }
  flushQuestion();

  const introClean = introLines.join('\n').replace(/\n---\s*$/, '').trim();
  return {
    introHtml: renderMarkdownBlock(introClean, `d${day}-${sectionType.toLowerCase()}-intro`).html,
    questions,
  };
}

function parseTeachingSection(secBody, day, secNum, ccMap) {
  const { intro, subSections } = splitByH3(secBody);
  const lessons = subSections.map((sub, idx) => {
    // Find any CC-* IDs mentioned in this lesson so we can attach interactive inline reveal cards!
    const mentionedIds = [...new Set([...sub.body.matchAll(/`(CC-[A-Z0-9-]+)`/g)].map((m) => m[1]))];
    const checks = mentionedIds
      .filter((id) => ccMap.has(id))
      .map((id) => {
        // Also extract the prompt line for this CC id from sub.body
        const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pMatch = sub.body.match(new RegExp(`^[-*0-9.]+\\s+\\*\\*\`?${escaped}\`?[^*]*\\*\\*:?\\s*(.+)$`, 'm'));
        return {
          id,
          promptHtml: pMatch ? renderInlineMarkdown(pMatch[1], `d${day}-ccprompt-${id}`) : '',
          answerHtml: ccMap.get(id),
        };
      });

    const rendered = renderMarkdownBlock(sub.body, `d${day}-s${secNum}-l${idx + 1}`);
    return {
      id: `d${day}-s${secNum}-l${idx + 1}`,
      title: sub.title.replace(/`/g, ''),
      titleHtml: renderInlineMarkdown(sub.title, `d${day}-s${secNum}-lhdr${idx + 1}`),
      html: rendered.html,
      outline: rendered.outline,
      checks,
    };
  });

  return {
    introHtml: renderMarkdownBlock(intro, `d${day}-s${secNum}-intro`).html,
    lessons,
  };
}

function parseSection9Cases(sec9Body, day) {
  // Split out the Case Lab Answer Key block (`#### ... Key ...`) so it isn't spoiled immediately!
  const keyHeaderRegex = /^####\s+.*(?:Key.*(?:Case Lab|Case Studies)|(?:Case Lab|Case Studies).*Key).*$/im;
  const keyMatch = sec9Body.match(keyHeaderRegex);

  if (!keyMatch) {
    const rendered = renderMarkdownBlock(sec9Body, `d${day}-s9`);
    return {
      beforeKeyHtml: rendered.html,
      caseKeyHtml: '',
      afterKeyHtml: '',
      cases: [],
    };
  }

  const beforeMd = sec9Body.slice(0, keyMatch.index).trim();
  const restMd = sec9Body.slice(keyMatch.index + keyMatch[0].length);
  const nextH3 = restMd.match(/^###\s+/m);
  const keyMd = (nextH3 ? restMd.slice(0, nextH3.index) : restMd).replace(/\n---\s*$/, '').trim();
  const afterMd = nextH3 ? restMd.slice(nextH3.index).trim() : '';

  // Parse individual cases (EL-CASE-1..5 or EL-D2-CASE-1..5)
  const caseAnswers = new Map();
  for (const line of keyMd.split(/\r?\n/)) {
    const m = line.match(/^-\s+\*\*`?(EL-(?:D\d+-)?CASE-\d+)`?[^*]*\*\*:?\s*(.+)$/);
    if (m) {
      caseAnswers.set(m[1], renderInlineMarkdown(m[2], `d${day}-caseans-${m[1]}`));
    }
  }

  // Strip the numbered case list from beforeMd so we render interactive case cards instead of duplicating them
  const beforeRemainingLines = [];
  const cases = [];
  for (const line of beforeMd.split(/\r?\n/)) {
    const m = line.match(/^\d+\.\s+\*\*`?(EL-(?:D\d+-)?CASE-\d+)`?\s*(\([^)]+\))?:?\*\*:?\s*(.+)$/);
    if (m) {
      const id = m[1];
      cases.push({
        id,
        categoryLabel: (m[2] || '').replace(/^\(|\)$/g, '').replace(/`/g, ''),
        promptHtml: renderInlineMarkdown(m[3], `d${day}-casep-${id}`),
        answerHtml: caseAnswers.get(id) || '',
      });
    } else {
      beforeRemainingLines.push(line);
    }
  }

  return {
    beforeKeyHtml: renderMarkdownBlock(beforeRemainingLines.join('\n').trim(), `d${day}-s9-before`).html,
    caseKeyHtml: renderMarkdownBlock(keyMd, `d${day}-s9-key`).html,
    afterKeyHtml: renderMarkdownBlock(afterMd, `d${day}-s9-after`).html,
    cases,
  };
}

function parseSection10Mastery(sec10Body, day) {
  // Split into: Prompts (before `### ... Answer Key`), Answer Key, and Matrix (`### ... Matrix` or `### ... Gate` or `### ... Ledger`)
  const keyMatch = sec10Body.match(/^###\s+.*Answer Key.*$/im);
  if (!keyMatch) {
    const rendered = renderMarkdownBlock(sec10Body, `d${day}-s10`);
    return {
      introHtml: rendered.html,
      masteryItems: [],
      keyHtml: '',
      matrixTitle: '',
      matrixHtml: '',
    };
  }

  const promptsMd = sec10Body.slice(0, keyMatch.index).replace(/\n---\s*$/, '').trim();
  const afterPromptMd = sec10Body.slice(keyMatch.index + keyMatch[0].length);
  const matrixMatch = afterPromptMd.match(/^###\s+(.+)$/m);

  const keyMd = (matrixMatch ? afterPromptMd.slice(0, matrixMatch.index) : afterPromptMd)
    .replace(/\n---\s*$/, '')
    .trim();
  const matrixTitle = matrixMatch ? matrixMatch[1].replace(/`/g, '').trim() : '';
  const matrixMd = matrixMatch ? afterPromptMd.slice(matrixMatch.index + matrixMatch[0].length).trim() : '';

  // Match numbered mastery questions `1. **`MA-D1-Q1` (Topic):** Prompt` with numbered answers `1. ...`
  const answerByNum = new Map();
  for (const line of keyMd.split(/\r?\n/)) {
    const am = line.match(/^(\d+)\.\s+(?:\*\*`?MA-D\d+-Q\d+`?[^*]*\*\*:?\s*)?(.+)$/);
    if (am) {
      answerByNum.set(Number(am[1]), renderInlineMarkdown(am[2], `d${day}-makey-${am[1]}`));
    }
  }

  const masteryItems = [];
  const introLines = [];
  for (const line of promptsMd.split(/\r?\n/)) {
    const pm = line.match(/^(\d+)\.\s+\*\*`?(MA-D\d+-Q\d+)`?\s*(?:\(([^)]+)\))?:?\*\*:?\s*(.+)$/);
    if (pm) {
      const num = Number(pm[1]);
      masteryItems.push({
        id: pm[2],
        number: num,
        topic: (pm[3] || '').trim(),
        promptHtml: renderInlineMarkdown(pm[4], `d${day}-maprompt-${pm[2]}`),
        answerHtml: answerByNum.get(num) || '',
      });
    } else {
      introLines.push(line);
    }
  }

  return {
    introHtml: renderMarkdownBlock(introLines.join('\n').trim(), `d${day}-s10-intro`).html,
    masteryItems,
    keyHtml: renderMarkdownBlock(keyMd, `d${day}-s10-key`).html,
    matrixTitle,
    matrixHtml: renderMarkdownBlock(matrixMd, `d${day}-s10-matrix`).html,
  };
}

const DAY_METADATA = [
  {
    day: 1,
    dateLabel: 'Sat, Nov 14, 2026',
    shortTitle: 'Diagnostic & Sentence Architecture',
    rwMinutes: 21,
    mathMinutes: 24,
  },
  {
    day: 2,
    dateLabel: 'Sun, Nov 15, 2026',
    shortTitle: 'Grammar Mastery & Linear Algebra',
    rwMinutes: 22,
    mathMinutes: 24,
  },
  {
    day: 3,
    dateLabel: 'Mon, Nov 16, 2026',
    shortTitle: 'Academic Prose & Advanced Math',
    rwMinutes: 23,
    mathMinutes: 25,
  },
  {
    day: 4,
    dateLabel: 'Tue, Nov 17, 2026',
    shortTitle: 'Hard Module 2 & Vocab Independence',
    rwMinutes: 25,
    mathMinutes: 26,
  },
  {
    day: 5,
    dateLabel: 'Wed, Nov 18, 2026',
    shortTitle: 'Full Timed Module Simulations',
    rwMinutes: 32,
    mathMinutes: 35,
  },
  {
    day: 6,
    dateLabel: 'Thu, Nov 19, 2026',
    shortTitle: 'Bluebook Exam Simulation & Triage',
    rwMinutes: 13,
    mathMinutes: 15,
  },
  {
    day: 7,
    dateLabel: 'Fri, Nov 20, 2026',
    shortTitle: 'Blind Cold Re-Solve & Graduation',
    rwMinutes: 16,
    mathMinutes: 18,
  },
];

const SECTION_SHORT_LABELS = [
  'Timetable & Plan',
  'Learning Objectives',
  'R&W Lessons',
  'Vocabulary Studio',
  'R&W Practice Set',
  'Math Lessons',
  'Math Practice Set',
  'Answer Keys Vault',
  'Error-Log Lab',
  'Mastery Gate',
];

function parseDayWorkbook(dayMeta) {
  const { day } = dayMeta;
  const filename = `Part-2-Day-0${day}-Complete-Learning-Package.md`;
  const raw = fs.readFileSync(path.join(ROOT, filename), 'utf8');
  const { intro, sections } = splitByH2(raw);

  if (sections.length !== 10) {
    throw new Error(`Expected 10 H2 sections in ${filename}, found ${sections.length}`);
  }

  // Extract metadata lines from intro
  const titleMatch = intro.match(/^#\s+(.+)$/m);
  const themeMatch = intro.match(/\*\*Day\s+\d+\s+Theme:\*\*\s*(.+)$/m);
  const budgetMatch = intro.match(/\*\*Active Study Budget:\*\*\s*(.+)$/m);
  const seqMatch = intro.match(/\*\*Learning Sequence:\*\*\s*(.+)$/m);
  const quoteMatch = intro.match(/^>\s+([\s\S]+?)(?:\n---|\Z)/m);

  // Parse Section 8 first so its answers/explanations link into Sections 3, 4, 5, 6, 7
  const sec8Parsed = extractSection8Explanations(sections[7].body, day);

  // Parse Sections 1 & 2
  const sec1Rendered = renderMarkdownBlock(sections[0].body, `d${day}-s1`);
  const sec2Rendered = renderMarkdownBlock(sections[1].body, `d${day}-s2`);

  // Parse Sections 3 & 6 (Teaching Lessons + inline CC reveal)
  const sec3Parsed = parseTeachingSection(sections[2].body, day, 3, sec8Parsed.ccMap);
  const sec6Parsed = parseTeachingSection(sections[5].body, day, 6, sec8Parsed.ccMap);

  // Parse Section 4 (Vocabulary Lessons & Exercises + matched Section 8B key)
  const sec4Split = splitByH3(sections[3].body);
  const sec8SubB = sec8Parsed.subSections.find((s) => /^B\./i.test(s.title)) || null;
  const sec4SubSections = sec4Split.subSections.map((sub, idx) => {
    const rendered = renderMarkdownBlock(sub.body, `d${day}-s4-sub${idx + 1}`);
    return {
      id: `d${day}-s4-sub${idx + 1}`,
      title: sub.title.replace(/`/g, ''),
      titleHtml: renderInlineMarkdown(sub.title, `d${day}-s4-hdr${idx + 1}`),
      html: rendered.html,
    };
  });

  // Parse Sections 5 & 7 (Interactive Practice Sets)
  const sec5Parsed = parsePracticeSection(sections[4].body, 'RW', day, sec8Parsed.questionMap);
  const sec7Parsed = parsePracticeSection(sections[6].body, 'MATH', day, sec8Parsed.questionMap);

  // Parse Sections 9 & 10
  const sec9Parsed = parseSection9Cases(sections[8].body, day);
  const sec10Parsed = parseSection10Mastery(sections[9].body, day);

  const stepMeta = sections.map((s, idx) => {
    const num = idx + 1;
    const cleanHeading = s.title.replace(/^\d+\.\s*/, '').replace(/`/g, '').trim();
    let badge = '';
    if (num === 5) badge = `${sec5Parsed.questions.length} Qs`;
    if (num === 7) badge = `${sec7Parsed.questions.length} Qs`;
    if (num === 8) badge = 'Spoiler Guard';
    if (num === 10) badge = `${sec10Parsed.masteryItems.length} Checks`;
    return {
      stepNumber: num,
      shortLabel: SECTION_SHORT_LABELS[idx],
      fullTitle: cleanHeading,
      badge,
    };
  });

  return {
    day,
    filename,
    title: titleMatch ? titleMatch[1].trim() : `Day ${day} Learning Package`,
    shortTitle: dayMeta.shortTitle,
    dateLabel: dayMeta.dateLabel,
    theme: themeMatch ? themeMatch[1].replace(/`/g, '').trim() : dayMeta.shortTitle,
    studyBudget: budgetMatch ? budgetMatch[1].replace(/`/g, '').trim() : '4.5 hours',
    learningSequence: seqMatch ? seqMatch[1].replace(/`/g, '').trim() : '',
    noticeHtml: quoteMatch ? renderMarkdownBlock(`> ${quoteMatch[1].trim()}`, `d${day}-notice`).html : '',
    recommendedTimers: {
      rwMinutes: dayMeta.rwMinutes,
      mathMinutes: dayMeta.mathMinutes,
    },
    steps: stepMeta,
    timetable: sec1Rendered,
    objectives: sec2Rendered,
    rwLessons: sec3Parsed,
    vocabulary: {
      introHtml: renderMarkdownBlock(sec4Split.intro, `d${day}-s4-intro`).html,
      subSections: sec4SubSections,
      answerKeyHtml: sec8SubB ? sec8SubB.html : '',
    },
    rwPractice: sec5Parsed,
    mathLessons: sec6Parsed,
    mathPractice: sec7Parsed,
    answerVault: {
      introHtml: sec8Parsed.introHtml,
      subSections: sec8Parsed.subSections,
    },
    errorLab: sec9Parsed,
    mastery: sec10Parsed,
  };
}

function parseVocabNotebook() {
  const raw = fs.readFileSync(
    path.join(ROOT, 'Trackers', 'Vocabulary-Notebook-and-Spaced-Review.md'),
    'utf8'
  );
  const { sections } = splitByH2(raw);
  const howToUse = renderMarkdownBlock(sections[0].body, 'vocab-howto');
  const wordParts = renderMarkdownBlock(sections[1].body, 'vocab-parts');
  const spacedSchedule = renderMarkdownBlock(sections[3].body, 'vocab-spaced');

  // Parse all 60 pre-loaded model entries from Section 3
  const { subSections } = splitByH3(sections[2].body);
  const words = [];
  let wordCounter = 0;

  for (const sub of subSections) {
    const dayMatch = sub.title.match(/^Day\s+(\d)/i);
    if (!dayMatch) continue;
    const day = Number(dayMatch[1]);
    const rows = sub.body
      .split(/\r?\n/)
      .filter((l) => l.trim().startsWith('|') && !/^\|\s*---/.test(l) && !/^\|\s*Word\s*\|/i.test(l));

    for (const row of rows) {
      const cols = row
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim());
      if (cols.length < 7 || !cols[0]) continue;
      wordCounter++;

      // Parse `**substantiate** *(v.)*`
      const wMatch = cols[0].match(/\*\*([^*]+)\*\*\s*(?:\*\(([^)]+)\)\*)?/);
      const word = wMatch ? wMatch[1].trim() : cols[0].replace(/[*_]/g, '').trim();
      const pos = wMatch && wMatch[2] ? wMatch[2].trim() : '';

      // Split Syn / Con
      const synMatch = cols[3].match(/\*\*Syn:\*\*\s*([\s\S]*?)(?:<br\s*\/?>|$)/i);
      const conMatch = cols[3].match(/\*\*Con:\*\*\s*([\s\S]*?)$/i);

      words.push({
        id: `word-${wordCounter}`,
        number: wordCounter,
        day,
        word,
        partOfSpeech: pos,
        simpleMeaning: cols[1].replace(/^\*|\*$/g, '').trim(),
        satContextHtml: renderInlineMarkdown(cols[2], `vw-${wordCounter}-ctx`),
        satContextRaw: cols[2].replace(/[*"]/g, '').trim(),
        synonyms: synMatch ? synMatch[1].replace(/<[^>]+>/g, '').trim() : cols[3],
        contrasts: conMatch ? conMatch[1].replace(/<[^>]+>/g, '').trim() : '',
        wordFamilyHtml: renderInlineMarkdown(cols[4], `vw-${wordCounter}-fam`),
        modelSentence: cols[5].replace(/[*"]/g, '').trim(),
        reviewDates: cols[6].trim(),
      });
    }
  }

  return {
    howToUseHtml: howToUse.html,
    wordPartsHtml: wordParts.html,
    spacedScheduleHtml: spacedSchedule.html,
    words,
  };
}

function parseErrorLogTracker() {
  const raw = fs.readFileSync(
    path.join(ROOT, 'Trackers', 'SAT-Error-Log-and-Daily-Reflections.md'),
    'utf8'
  );
  const { sections } = splitByH2(raw);
  const taxSub = splitByH3(sections[0].body).subSections;

  const parseCodeTable = (md) => {
    return md
      .split(/\r?\n/)
      .filter((l) => l.trim().startsWith('| `'))
      .map((row) => {
        const cols = row
          .split('|')
          .slice(1, -1)
          .map((c) => c.trim());
        return {
          code: cols[0].replace(/`/g, ''),
          label: cols[1].replace(/\*\*/g, ''),
          description: cols[2].replace(/`/g, ''),
        };
      });
  };

  const eCodes = parseCodeTable(taxSub[0].body);
  const vCodes = parseCodeTable(taxSub[1].body);
  const escalationHtml = renderMarkdownBlock(sections[1].body, 'err-escalation').html;
  const reflectionGuideHtml = renderMarkdownBlock(sections[3].body, 'err-reflection').html;

  // Model entries from Section 3
  const modelEntries = sections[2].body
    .split(/\r?\n/)
    .filter((l) => l.trim().startsWith('| *Nov'))
    .map((row, idx) => {
      const cols = row
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim().replace(/^\*|\*$/g, ''));
      return {
        id: `model-err-${idx + 1}`,
        date: cols[0],
        section: cols[1],
        topic: cols[2],
        questionType: cols[3],
        whyMissed: cols[4],
        correctMethod: cols[5],
        nextTimeRule: cols[6],
      };
    });

  return {
    eCodes,
    vCodes,
    escalationHtml,
    reflectionGuideHtml,
    modelEntries,
  };
}

function parseOverviewAndMasterPlan() {
  const readmeRaw = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  const readmeSplit = splitByH2(readmeRaw);
  const overview = {
    introHtml: renderMarkdownBlock(readmeSplit.intro, 'readme-intro').html,
    sections: readmeSplit.sections
      .filter((s) => !/<!--\s*repo-only\s*-->/i.test(s.body))
      .map((s, idx) => {
        const r = renderMarkdownBlock(s.body, `readme-s${idx + 1}`);
        return {
          id: `readme-s${idx + 1}`,
          title: s.title,
          html: r.html,
        };
      }),
  };

  const part1Raw = fs.readFileSync(
    path.join(ROOT, 'Part-1-Seven-Day-Master-Study-Plan.md'),
    'utf8'
  );
  const part1Split = splitByH2(part1Raw);
  const masterPlan = {
    introHtml: renderMarkdownBlock(part1Split.intro, 'p1-intro').html,
    chapters: part1Split.sections.map((s, idx) => {
      const r = renderMarkdownBlock(s.body, `p1-ch${idx + 1}`);
      return {
        id: `p1-ch${idx + 1}`,
        number: idx + 1,
        title: s.title.replace(/^\d+\.\s*/, '').trim(),
        fullTitle: s.title,
        html: r.html,
        outline: r.outline,
      };
    }),
  };

  return { overview, masterPlan };
}

function main() {
  const { overview, masterPlan } = parseOverviewAndMasterPlan();
  const days = DAY_METADATA.map((meta) => parseDayWorkbook(meta));
  const vocabStudio = parseVocabNotebook();
  const errorLogStudio = parseErrorLogTracker();

  const totalRwQuestions = days.reduce((acc, d) => acc + d.rwPractice.questions.length, 0);
  const totalMathQuestions = days.reduce((acc, d) => acc + d.mathPractice.questions.length, 0);
  const totalMasteryChecks = days.reduce((acc, d) => acc + d.mastery.masteryItems.length, 0);
  const totalCases = days.reduce((acc, d) => acc + d.errorLab.cases.length, 0);

  if (mathErrors.length > 0) {
    console.error('KaTeX compile errors found:', mathErrors);
    process.exit(1);
  }

  const courseData = {
    generatedAt: new Date().toISOString(),
    stats: {
      totalDays: days.length,
      totalQuestions: totalRwQuestions + totalMathQuestions,
      totalRwQuestions,
      totalMathQuestions,
      totalVocabWords: vocabStudio.words.length,
      totalMasteryChecks,
      totalDiagnosticCases: totalCases,
      mathExpressionsRendered: mathRenderCount,
    },
    overview,
    masterPlan,
    days,
    vocabStudio,
    errorLogStudio,
  };

  const jsonStr = JSON.stringify(courseData, null, 2);
  const leftoverFileLinks = jsonStr.match(/file:\/\/\/[^"\s)]+/g) || [];
  const leftoverTokens = jsonStr.match(/%%COURSE(?:MATH|CODE)\d*END%%|COURSE(?:MATH|CODE)\d+/g) || [];
  if (leftoverFileLinks.length > 0 || leftoverTokens.length > 0) {
    console.error('Leftover file links:', leftoverFileLinks.slice(0, 5));
    console.error('Leftover tokens:', leftoverTokens.slice(0, 5));
    const idx = jsonStr.indexOf(leftoverTokens[0]);
    if (idx !== -1) console.error('Context:', jsonStr.slice(Math.max(0, idx - 120), idx + 160));
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, jsonStr, 'utf8');

  console.log(
    `Compiled courseData.json successfully:\n` +
      `  - Days: ${days.length}\n` +
      `  - Practice Questions: ${courseData.stats.totalQuestions} (${totalRwQuestions} R&W + ${totalMathQuestions} Math)\n` +
      `  - Vocabulary Core Words: ${vocabStudio.words.length}\n` +
      `  - Diagnostic Cases: ${totalCases}\n` +
      `  - Mastery Gate Items: ${totalMasteryChecks}\n` +
      `  - KaTeX Expressions Rendered Cleanly: ${mathRenderCount} (0 errors)`
  );
}

main();
