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

  it("resends the image when the previous answer asked the user to select a task", () => {
    const selection = { ...previous, awaitingSelection: true };
    expect(shouldResendImageForFollowUp("Aufgabe 2", selection)).toBe(true);
    expect(shouldResendImageForFollowUp("Die dritte bitte.", selection)).toBe(true);
  });

  it("keeps later numbered task selections visual without resending conceptual follow-ups", () => {
    const multiTask = { ...previous, awaitingSelection: false, hasTaskSelectionContext: true };
    expect(shouldResendImageForFollowUp("2!", multiTask)).toBe(true);
    expect(shouldResendImageForFollowUp("Aufgabe 3", multiTask)).toBe(true);
    expect(shouldResendImageForFollowUp("die zweite", multiTask)).toBe(true);
    expect(shouldResendImageForFollowUp("Frage zwei.", multiTask)).toBe(true);
    expect(shouldResendImageForFollowUp("Aufgabe Nummer zwei", multiTask)).toBe(true);
    expect(shouldResendImageForFollowUp("Zwei!", multiTask)).toBe(true);
    expect(shouldResendImageForFollowUp("Warum funktioniert das?", multiTask)).toBe(false);
  });

  it("cannot resend an expired image", () => {
    expect(shouldResendImageForFollowUp("Was steht auf dem Bild?", { question: "alt", locale: "de-DE" })).toBe(false);
  });
});
