import { Fragment, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { AnswerBlock } from './types';

interface AnswerContentProps {
  blocks?: AnswerBlock[];
  fallback: string;
  compact?: boolean;
}

const symbolCommands: Record<string, string> = {
  '\\sum': '∑', '\\prod': '∏', '\\int': '∫', '\\iint': '∬', '\\infty': '∞',
  '\\cdot': '·', '\\times': '×', '\\div': '÷', '\\pm': '±', '\\leq': '≤',
  '\\geq': '≥', '\\neq': '≠', '\\approx': '≈', '\\rightarrow': '→', '\\Rightarrow': '⇒',
  '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ', '\\theta': 'θ',
  '\\lambda': 'λ', '\\mu': 'μ', '\\pi': 'π', '\\sigma': 'σ', '\\phi': 'φ', '\\omega': 'ω',
};

const superscript: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', n: 'ⁿ', i: 'ⁱ', x: 'ˣ', y: 'ʸ',
};

const subscript: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎', a: 'ₐ', e: 'ₑ', h: 'ₕ', i: 'ᵢ', j: 'ⱼ', k: 'ₖ', n: 'ₙ', x: 'ₓ',
};

function script(value: string, table: Record<string, string>, marker: string): string {
  const converted = [...value].map((character) => table[character]).join('');
  return converted.length === value.length ? converted : `${marker}(${value})`;
}

function readableLatex(value: string): string {
  let result = value
    .replace(/\\boxed\{([^{}]*)\}/g, '$1')
    .replace(/\\displaystyle/g, '')
    .replace(/\\begin\{(?:aligned\*?|align\*?|equation\*?)\}/g, '')
    .replace(/\\end\{(?:aligned\*?|align\*?|equation\*?)\}/g, '')
    .replace(/\\left|\\right/g, '')
    .replace(/&/g, '')
    .replace(/\\\\/g, '\n')
    .replace(/\\,/g, ' ')
    .replace(/\\text\{([^}]*)\}/g, '$1')
    .replace(/\\operatorname\{([^}]*)\}/g, '$1')
    .replace(/\\sqrt\{([^{}]*)\}/g, '√($1)');
  for (const [command, symbol] of Object.entries(symbolCommands)) result = result.replaceAll(command, symbol);
  result = result
    .replace(/\^\{([^{}]+)\}/g, (_match, content: string) => script(content, superscript, '^'))
    .replace(/_\{([^{}]+)\}/g, (_match, content: string) => script(content, subscript, '_'))
    .replace(/\^([A-Za-z0-9+-])/g, (_match, content: string) => script(content, superscript, '^'))
    .replace(/_([A-Za-z0-9+-])/g, (_match, content: string) => script(content, subscript, '_'))
    .replace(/[{}]/g, '')
    .replace(/\\([A-Za-z]+)/g, '$1');
  return result.trim();
}

function findClosingBrace(value: string, start: number): number {
  let depth = 0;
  for (let index = start; index < value.length; index += 1) {
    if (value[index] === '{') depth += 1;
    if (value[index] === '}') depth -= 1;
    if (depth === 0) return index;
  }
  return -1;
}

function MathExpression({ latex, compact = false, dense = false }: { latex: string; compact?: boolean; dense?: boolean }) {
  const parts: ReactNode[] = [];
  let cursor = 0;
  let key = 0;
  while (cursor < latex.length) {
    const fractionStart = latex.indexOf('\\frac{', cursor);
    if (fractionStart < 0) {
      parts.push(<Text style={[styles.mathText, compact && styles.mathTextCompact, dense && styles.mathTextDense]} key={key++}>{readableLatex(latex.slice(cursor))}</Text>);
      break;
    }
    if (fractionStart > cursor) {
      parts.push(<Text style={[styles.mathText, compact && styles.mathTextCompact, dense && styles.mathTextDense]} key={key++}>{readableLatex(latex.slice(cursor, fractionStart))}</Text>);
    }
    const numeratorStart = fractionStart + 5;
    const numeratorEnd = findClosingBrace(latex, numeratorStart);
    const denominatorStart = numeratorEnd + 1;
    if (numeratorEnd < 0 || latex[denominatorStart] !== '{') {
      parts.push(<Text style={styles.mathText} key={key++}>{readableLatex(latex.slice(fractionStart))}</Text>);
      break;
    }
    const denominatorEnd = findClosingBrace(latex, denominatorStart);
    if (denominatorEnd < 0) break;
    parts.push(
      <View style={styles.fraction} key={key++}>
        <Text style={[styles.fractionText, compact && styles.fractionTextCompact, dense && styles.fractionTextDense]}>{readableLatex(latex.slice(numeratorStart + 1, numeratorEnd))}</Text>
        <View style={styles.fractionLine} />
        <Text style={[styles.fractionText, compact && styles.fractionTextCompact, dense && styles.fractionTextDense]}>{readableLatex(latex.slice(denominatorStart + 1, denominatorEnd))}</Text>
      </View>,
    );
    cursor = denominatorEnd + 1;
  }
  return <View style={styles.mathRow}>{parts}</View>;
}

export function MathLine({ latex, compact = true, dense = false }: { latex: string; compact?: boolean; dense?: boolean }) {
  return <MathExpression latex={latex} compact={compact} dense={dense} />;
}

function MathBlock({ latex, compact = false }: { latex: string; compact?: boolean }) {
  const matrix = latex.match(/\\begin\{(?:bmatrix|pmatrix|matrix)\}([\s\S]*?)\\end\{(?:bmatrix|pmatrix|matrix)\}/);
  if (matrix) {
    const rows = matrix[1].split('\\\\').map((row) => row.split('&').map((cell) => readableLatex(cell)));
    return (
      <View style={[styles.mathCard, compact && styles.compactCard]}>
        <View style={styles.matrix}>
          {rows.map((row, rowIndex) => (
            <View style={styles.matrixRow} key={rowIndex}>
              {row.map((cell, cellIndex) => <Text style={styles.matrixCell} key={cellIndex}>{cell}</Text>)}
            </View>
          ))}
        </View>
      </View>
    );
  }
  const aligned = latex.match(/\\begin\{(?:aligned\*?|align\*?|equation\*?)\}([\s\S]*?)\\end\{(?:aligned\*?|align\*?|equation\*?)\}/);
  if (aligned) {
    const rows = aligned[1].split('\\\\').map((row) => row.replaceAll('&', '').trim()).filter(Boolean);
    return (
      <View style={[styles.mathCard, styles.alignedMath, compact && styles.compactCard]}>
        {rows.map((row, index) => <MathExpression latex={row} compact={compact} key={index} />)}
      </View>
    );
  }
  return <View style={[styles.mathCard, compact && styles.compactCard]}><MathExpression latex={latex} compact={compact} /></View>;
}

function InlineMarkdown({ children }: { children: string }) {
  const tokens = children.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return (
    <Text style={styles.paragraph}>
      {tokens.map((token, index) => token.startsWith('**')
        ? <Text style={styles.bold} key={index}>{token.slice(2, -2)}</Text>
        : token.startsWith('`')
          ? <Text style={styles.inlineCode} key={index}>{token.slice(1, -1)}</Text>
          : <Fragment key={index}>{token}</Fragment>)}
    </Text>
  );
}

function TextBlock({ markdown, compact = false }: { markdown: string; compact?: boolean }) {
  const lines = markdown.split('\n').filter((line, index, all) => line.trim() || all[index - 1]?.trim());
  return (
    <View style={styles.textBlock}>
      {lines.slice(0, compact ? 4 : undefined).map((line, index) => {
        if (line.startsWith('### ')) return <Text style={styles.headingSmall} key={index}>{line.slice(4)}</Text>;
        if (line.startsWith('## ')) return <Text style={styles.heading} key={index}>{line.slice(3)}</Text>;
        if (line.startsWith('# ')) return <Text style={styles.headingLarge} key={index}>{line.slice(2)}</Text>;
        if (/^[-*] /.test(line)) return <View style={styles.bulletRow} key={index}><Text style={styles.bullet}>•</Text><InlineMarkdown>{line.slice(2)}</InlineMarkdown></View>;
        if (/^\d+\. /.test(line)) {
          const match = line.match(/^(\d+\.)\s(.*)$/);
          return <View style={styles.bulletRow} key={index}><Text style={styles.bullet}>{match?.[1]}</Text><InlineMarkdown>{match?.[2] || line}</InlineMarkdown></View>;
        }
        return <InlineMarkdown key={index}>{line}</InlineMarkdown>;
      })}
    </View>
  );
}

function CodeBlock({ language, code, compact = false }: { language: string; code: string; compact?: boolean }) {
  const visibleCode = compact ? code.split('\n').slice(0, 4).join('\n') : code;
  return (
    <View style={[styles.codeCard, compact && styles.compactCard]}>
      <Text style={styles.codeLanguage}>{language || 'CODE'}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={!compact}>
        <Text selectable={!compact} style={[styles.code, compact && styles.codeCompact]}>{visibleCode}</Text>
      </ScrollView>
    </View>
  );
}

export function AnswerContent({ blocks, fallback, compact = false }: AnswerContentProps) {
  const content = blocks?.length ? blocks : [{ type: 'text' as const, markdown: fallback }];
  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      {content.slice(0, compact ? 3 : undefined).map((block, index) => {
        if (block.type === 'code') return <CodeBlock key={index} {...block} compact={compact} />;
        if (block.type === 'math') return <MathBlock key={index} latex={block.latex} compact={compact} />;
        return <TextBlock key={index} markdown={block.markdown} compact={compact} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14 }, containerCompact: { gap: 9 }, textBlock: { gap: 8 },
  paragraph: { color: '#dce7df', fontSize: 16, lineHeight: 24 }, bold: { color: '#f5fff8', fontWeight: '800' }, inlineCode: { color: '#b8f7c9', fontFamily: 'monospace', backgroundColor: '#1b2b21' },
  headingLarge: { color: '#f3fff7', fontSize: 22, lineHeight: 28, fontWeight: '900' }, heading: { color: '#effaf2', fontSize: 19, lineHeight: 25, fontWeight: '800' }, headingSmall: { color: '#dce9e0', fontSize: 16, lineHeight: 22, fontWeight: '800' },
  bulletRow: { flexDirection: 'row', gap: 9, paddingRight: 12 }, bullet: { minWidth: 18, color: '#70ff9b', fontSize: 16, lineHeight: 24, fontWeight: '800' },
  codeCard: { borderRadius: 16, backgroundColor: '#050a07', borderWidth: 1, borderColor: '#293a30', overflow: 'hidden' }, codeLanguage: { color: '#70ff9b', fontSize: 10, fontWeight: '900', letterSpacing: 1.2, paddingHorizontal: 14, paddingTop: 11 }, code: { color: '#d8e6dc', fontFamily: 'monospace', fontSize: 14, lineHeight: 21, padding: 14 }, codeCompact: { fontSize: 12, lineHeight: 17, paddingTop: 9 },
  mathCard: { minHeight: 66, borderRadius: 16, backgroundColor: '#0a1710', borderWidth: 1, borderColor: '#31503b', padding: 14, alignItems: 'center', justifyContent: 'center' }, alignedMath: { gap: 5 }, compactCard: { minHeight: 48, padding: 9 }, mathRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 4 }, mathText: { color: '#e9fff0', fontFamily: 'serif', fontSize: 24, lineHeight: 34 }, mathTextCompact: { fontSize: 19, lineHeight: 26 }, mathTextDense: { fontSize: 15, lineHeight: 20 },
  fraction: { minWidth: 28, alignItems: 'stretch', marginHorizontal: 3 }, fractionText: { color: '#e9fff0', fontFamily: 'serif', fontSize: 18, textAlign: 'center', paddingHorizontal: 3 }, fractionTextCompact: { fontSize: 14 }, fractionTextDense: { fontSize: 11 }, fractionLine: { height: 1.5, backgroundColor: '#e9fff0', marginVertical: 2 },
  matrix: { borderLeftWidth: 2, borderRightWidth: 2, borderColor: '#bdf8cc', paddingHorizontal: 8, gap: 4 }, matrixRow: { flexDirection: 'row' }, matrixCell: { minWidth: 42, color: '#e9fff0', fontFamily: 'serif', fontSize: 19, textAlign: 'center' },
});
