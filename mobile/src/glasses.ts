import type { AnswerBlock, DocumentAnswer, SolutionStep } from './types';

export interface GlassesCodeLine {
  sourceLine: number;
  text: string;
  continuation: boolean;
}

export type GlassesCard =
  | { type: 'summary'; title: string; format: 'text' | 'output'; lines: string[]; nextHint: string | null }
  | { type: 'step'; title: string; number: number; total: number; step: SolutionStep }
  | { type: 'code'; title: string; lines: GlassesCodeLine[] }
  | { type: 'math'; title: string; block: Extract<AnswerBlock, { type: 'math' }> }
  | { type: 'note'; title: string; text: string };

const maxCodeColumns = 60;
const codeLinesPerCard = 5;
const summaryLinesPerCard = 5;

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
  solutionSteps.forEach((step, index) => detailCards.push({
    type: 'step', title: `SCHRITT ${index + 1}/${solutionSteps.length}`, number: index + 1, total: solutionSteps.length, step,
  }));
  for (const block of blocks) {
    if (block.type === 'code') {
      for (const page of chunks(wrapCode(block.code), codeLinesPerCard)) {
        detailCards.push({ type: 'code', title: block.language?.toUpperCase() || 'CODE', lines: page });
      }
    }
    if (block.type === 'math') detailCards.push({ type: 'math', title: 'FORMEL', block });
  }
  if (answer.evidence[0]) detailCards.push({ type: 'note', title: 'WARUM?', text: answer.evidence[0] });
  const firstDetail = detailCards[0];
  const nextHint = firstDetail?.type === 'code'
    ? 'Tippen für Code'
    : firstDetail?.type === 'math'
      ? 'Tippen für Formel'
      : firstDetail?.type === 'step'
        ? 'Tippen für Lösungsweg'
      : firstDetail
        ? 'Tippen für Details'
        : null;
  const summary = answer.glassesSummary ?? { format: 'text' as const, lines: [answer.shortAnswer] };
  const summaryPages = chunks(summary.lines, summaryLinesPerCard);
  const summaryCards: GlassesCard[] = summaryPages.map((lines, index) => ({
    type: 'summary',
    title: summaryPages.length > 1 ? `KURZANTWORT ${index + 1}/${summaryPages.length}` : 'KURZANTWORT',
    format: summary.format,
    lines,
    nextHint: index === summaryPages.length - 1 ? nextHint : 'Tippen für weitere Ergebnisse',
  }));
  return [...summaryCards, ...detailCards];
}
