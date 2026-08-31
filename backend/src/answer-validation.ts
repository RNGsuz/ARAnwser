import { calculateArithmetic } from "./calculator.js";
import type { PipelineTool } from "./pipeline-policy.js";
import type { Answer, QueryInput } from "./types.js";

function bracesAreBalanced(code: string): boolean {
  let depth = 0;
  let quote: "'" | '"' | "`" | null = null;
  let escaped = false;
  for (const character of code) {
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === "'" || character === '"' || character === "`") quote = character;
    else if (character === "{") depth += 1;
    else if (character === "}" && --depth < 0) return false;
  }
  return depth === 0 && quote === null;
}

function requestedMethodNames(question: string): string[] {
  const names = new Set<string>();
  const signature = /\b(?:static\s+)?(?:void|boolean|byte|short|int|long|float|double|char|String|[A-Z][\w<>[\], ?]*)\s+(\w+)\s*\(/g;
  for (const match of question.matchAll(signature)) if (match[1]) names.add(match[1]);
  return [...names];
}

function validateCode(answer: Answer, question: string): void {
  const names = requestedMethodNames(question);
  const implementationRequested = /\b(implement|programmiere|schreib(?:e)?|write|create|erstell(?:e|en)?|code\s+für)\b/i.test(question);
  if (!answer.glassesCodeUnits.length) {
    if (names.length || implementationRequested) throw new Error("code_units_missing");
    return;
  }
  for (const unit of answer.glassesCodeUnits) {
    if (!unit.code.trimEnd().endsWith("}") || !bracesAreBalanced(unit.code)) throw new Error("code_unit_incomplete");
  }
  for (const name of names) {
    const matching = answer.glassesCodeUnits.filter((unit) => new RegExp(`\\b${name}\\s*\\(`).test(unit.code));
    if (matching.length !== 1) throw new Error("requested_code_unit_missing");
  }
}

function numericValue(value: string): number | null {
  const normalized = value.trim().replace(/,/g, ".");
  return /^-?\d+(?:\.\d+)?$/.test(normalized) ? Number(normalized) : null;
}

function validateArithmetic(answer: Answer): void {
  for (const exercise of answer.glassesExercises) {
    const source = exercise.sourceLatex.replace(/\\(?:cdot|times)/g, "*").replace(/\\div/g, "/");
    const expected = calculateArithmetic(source);
    const actual = numericValue(exercise.resultLatex);
    if (expected !== null && actual !== null && Math.abs(expected - actual) > 1e-9) throw new Error("numeric_result_mismatch");
  }
}

export function validateAnswerWithTools(answer: Answer, input: QueryInput, allowedTools: PipelineTool[]): Answer {
  if (allowedTools.includes("code_verifier")) validateCode(answer, input.question);
  if (allowedTools.includes("calculator")) validateArithmetic(answer);
  return answer;
}
