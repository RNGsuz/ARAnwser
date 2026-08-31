import { describe, expect, it } from "vitest";
import { shouldResendImageForFollowUp } from "./follow-up-policy.js";

const previous = { image: Buffer.from("image"), imageMimeType: "image/jpeg", question: "Was ist das?", locale: "de-DE" };

describe("follow-up image policy", () => {
  it("uses extracted context for conceptual follow-ups", () => {
    expect(shouldResendImageForFollowUp("Warum ist das interessant?", previous)).toBe(false);
    expect(shouldResendImageForFollowUp("Erkläre den zweiten Rechenschritt.", previous)).toBe(false);
  });

  it("resends the image for new visual details", () => {
    expect(shouldResendImageForFollowUp("Welche Farbe hat das Objekt links?", previous)).toBe(true);
    expect(shouldResendImageForFollowUp("Was steht in der dritten Tabellenzeile?", previous)).toBe(true);
  });

  it("cannot resend an expired image", () => {
    expect(shouldResendImageForFollowUp("Was steht auf dem Bild?", { question: "alt", locale: "de-DE" })).toBe(false);
  });
});
