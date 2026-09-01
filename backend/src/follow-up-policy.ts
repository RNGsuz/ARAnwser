import type { QueryInput } from "./types.js";

const visualDetail = /\b(farbe|color|links|rechts|oben|unten|hintergrund|background|position|wo\s+(?:ist|steht|befindet)|zeile|tabellenzeile|row|spalte|column|tabelle|table|diagramm|chart|schild|label|beschriftung|klein(?:e|en|er)?\s+text|im\s+(?:bild|foto)|auf\s+dem\s+(?:bild|foto)|sichtbar|siehst\s+du|steht\s+dort)\b/i;
const selectionNumber = "(?:\\d+[a-z]?|ein(?:s)?|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|elf|zwölf|erste|zweite|dritte|vierte|fünfte|sechste|siebte|achte|neunte|one|two|three|four|first|second|third|fourth)";
const taskSelectionReference = new RegExp(
  `(?:\\b(?:aufgabe|beispiel|frage|task|exercise)\\s*(?:(?:nummer|nr\\.?)\\s*)?${selectionNumber}\\b|\\b(?:nummer|nr\\.?)\\s*${selectionNumber}\\b|\\b(?:die|der|das)\\s+(?:erste|zweite|dritte|vierte|fünfte|sechste|siebte|obere|untere|linke|rechte)\\b|^\\s*(?:${selectionNumber}|[a-z])\\s*[)!.:,]?\\s*$)`,
  "i",
);

export function shouldResendImageForFollowUp(question: string, previous: QueryInput): boolean {
  return Boolean(previous.image && previous.imageMimeType && (
    previous.awaitingSelection
    || (previous.hasTaskSelectionContext && taskSelectionReference.test(question))
    || visualDetail.test(question)
  ));
}
