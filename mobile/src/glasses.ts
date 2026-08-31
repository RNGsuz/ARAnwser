import type { AnswerBlock, DiscoveryInfo, DocumentAnswer, GlassesCodeUnit, GlassesExercise, ReadingInfo, RecognizedItem, SolutionStep } from './types';

export interface GlassesCodeLine {
  sourceLine: number;
  text: string;
  continuation: boolean;
}

export type GlassesCard =
  | { type: 'summary'; title: string; format: 'text' | 'output'; lines: string[]; nextHint: string | null }
  | { type: 'exercise'; title: string; exercise: GlassesExercise; transformations: GlassesExercise['transformations']; page: number; pages: number }
  | { type: 'recognized'; title: string; items: RecognizedItem[]; page: number; pages: number }
  | { type: 'codeUnit'; title: string; unit: GlassesCodeUnit }
  | { type: 'discovery'; title: string; info: DiscoveryInfo; facts: string[]; page: number; pages: number }
  | { type: 'reading'; title: string; info: ReadingInfo; lines: string[] }
  | { type: 'step'; title: string; number: number; total: number; step: SolutionStep }
  | { type: 'code'; title: string; lines: GlassesCodeLine[] }
  | { type: 'math'; title: string; block: Extract<AnswerBlock, { type: 'math' }> }
  | { type: 'note'; title: string; text: string };

// 56 leaves room for the line-number gutter and avoids clipping on narrower phones.
const maxCodeColumns = 56;
const codeLinesPerCard = 5;
const summaryLinesPerCard = 5;
const transformationsPerCard = 5;
const recognizedItemsPerCard = 2;

function splitAtReadableBoundary(value: string, limit: number): [string, string] {
  if (value.length <= limit) return [value, ''];
  const candidate = value.slice(0, limit + 1);
  const preferred = Math.max(
    candidate.lastIndexOf(' '), candidate.lastIndexOf(','), candidate.lastIndexOf(';'),
    candidate.lastIndexOf('('), candidate.lastIndexOf(')'),
  );
  const splitAt = preferred >= Math.floor(limit * 0.7) ? preferred + 1 : limit;
  return [value.slice(0, splitAt).trimEnd(), value.slice(splitAt).trimStart()];
}

export function wrapCode(code: string, columns = maxCodeColumns): GlassesCodeLine[] {
  const result: GlassesCodeLine[] = [];
  code.replace(/\t/g, '  ').split('\n').forEach((source, index) => {
    const sourceLine = index + 1;
    const indent = source.match(/^\s*/)?.[0] ?? '';
    let remaining = source;
    let continuation = false;
    if (!remaining) {
      result.push({ sourceLine, text: '', continuation: false });
      return;
    }
    while (remaining.length) {
      const prefix = continuation ? `${indent}  ` : '';
      const [visible, rest] = splitAtReadableBoundary(remaining, Math.max(12, columns - prefix.length));
      result.push({ sourceLine, text: `${prefix}${visible}`, continuation });
      remaining = rest;
      continuation = true;
    }
  });
  return result;
}

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

export function buildGlassesCards(answer: DocumentAnswer): GlassesCard[] {
  const blocks = answer.blocks ?? [];
  const detailCards: GlassesCard[] = [];
  const solutionSteps = answer.solution?.steps ?? [];
  const exercises = answer.glassesExercises ?? [];
  const recognizedItems = answer.recognizedItems ?? [];
  const codeUnits = answer.glassesCodeUnits ?? [];
  const discovery = answer.discoveryInfo;
  const reading = answer.readingInfo;
  const hasPrimaryMathDisplay = exercises.length > 0 || recognizedItems.length > 0;
  const codeLivesInSolution = solutionSteps.some((step) => step.contentType === 'code');
  if (discovery) {
    const factPages = chunks(discovery.facts, 2);
    factPages.forEach((facts, index) => detailCards.push({
      type: 'discovery', title: factPages.length > 1 ? `NICE TO KNOW ${index + 1}/${factPages.length}` : 'NICE TO KNOW', info: discovery, facts, page: index + 1, pages: factPages.length,
    }));
    if (discovery.safetyNote) detailCards.push({ type: 'note', title: 'HINWEIS', text: discovery.safetyNote });
  } else if (reading) {
    if (reading.keyPoints.length) detailCards.push({ type: 'reading', title: 'KERNAUSSAGEN', info: reading, lines: reading.keyPoints });
    if (reading.visualFindings.length) detailCards.push({ type: 'reading', title: 'VISUELL ERKANNT', info: reading, lines: reading.visualFindings });
  } else if (hasPrimaryMathDisplay) {
    for (const exercise of exercises) {
      if (!exercise.transformations.length) continue;
      const pages = chunks(exercise.transformations, transformationsPerCard);
      pages.forEach((transformations, index) => detailCards.push({
        type: 'exercise',
        title: `${exercise.label} · LÖSUNGSWEG${pages.length > 1 ? ` ${index + 1}/${pages.length}` : ''}`,
        exercise,
        transformations,
        page: index + 1,
        pages: pages.length,
      }));
    }
    const recognizedPages = chunks(recognizedItems, recognizedItemsPerCard);
    recognizedPages.forEach((items, index) => detailCards.push({
      type: 'recognized', title: recognizedPages.length > 1 ? `ERKANNT ${index + 1}/${recognizedPages.length}` : 'ERKANNT', items, page: index + 1, pages: recognizedPages.length,
    }));
  } else if (codeUnits.length) {
    codeUnits.forEach((unit) => detailCards.push({ type: 'codeUnit', title: unit.label, unit }));
  } else {
    solutionSteps.forEach((step, index) => detailCards.push({
      type: 'step', title: `SCHRITT ${index + 1}/${solutionSteps.length}`, number: index + 1, total: solutionSteps.length, step,
    }));
    for (const block of blocks) {
      if (block.type === 'code' && !codeLivesInSolution) {
        for (const page of chunks(wrapCode(block.code), codeLinesPerCard)) {
          detailCards.push({ type: 'code', title: block.language?.toUpperCase() || 'CODE', lines: page });
        }
      }
      if (block.type === 'math') detailCards.push({ type: 'math', title: 'FORMEL', block });
    }
    if (answer.evidence[0]) detailCards.push({ type: 'note', title: 'WARUM?', text: answer.evidence[0] });
  }
  const firstDetail = detailCards[0];
  const nextHint = firstDetail?.type === 'code'
    ? 'Nach links für Code'
    : firstDetail?.type === 'codeUnit'
      ? 'Nach links für Methoden'
    : firstDetail?.type === 'math'
      ? 'Nach links für Formel'
      : firstDetail?.type === 'step'
        ? 'Nach links für Lösungsweg'
      : firstDetail?.type === 'exercise'
        ? 'Nach links für Lösungsweg'
      : firstDetail?.type === 'recognized'
        ? 'Nach links für erkannten Inhalt'
      : firstDetail?.type === 'discovery'
        ? 'Nach links für Fakten'
      : firstDetail?.type === 'reading'
        ? 'Nach links für Kernaussagen'
      : firstDetail
        ? 'Nach links für Details'
        : null;
  const summary = answer.glassesSummary ?? { format: 'text' as const, lines: [answer.shortAnswer] };
  const summaryPages = chunks(summary.lines, summaryLinesPerCard);
  const summaryCards: GlassesCard[] = summaryPages.map((lines, index) => ({
    type: 'summary',
    title: summaryPages.length > 1 ? `KURZANTWORT ${index + 1}/${summaryPages.length}` : 'KURZANTWORT',
    format: summary.format,
    lines,
    nextHint: index === summaryPages.length - 1 ? nextHint : 'Nach links für weitere Ergebnisse',
  }));
  return [...summaryCards, ...detailCards];
}
