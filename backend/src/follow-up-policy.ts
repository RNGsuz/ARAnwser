import type { QueryInput } from "./types.js";

const visualDetail = /\b(farbe|color|links|rechts|oben|unten|hintergrund|background|position|wo\s+(?:ist|steht|befindet)|zeile|tabellenzeile|row|spalte|column|tabelle|table|diagramm|chart|schild|label|beschriftung|klein(?:e|en|er)?\s+text|im\s+(?:bild|foto)|auf\s+dem\s+(?:bild|foto)|sichtbar|siehst\s+du|steht\s+dort)\b/i;

export function shouldResendImageForFollowUp(question: string, previous: QueryInput): boolean {
  return Boolean(previous.image && previous.imageMimeType && visualDetail.test(question));
}
