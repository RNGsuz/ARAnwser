import { describe, expect, it } from "vitest";
import { SessionStore } from "./session-store.js";

describe("session store", () => {
  it("preserves its private image copy while updating the same session", () => {
    const store = new SessionStore(60_000);
    const initial = Buffer.from([1, 2, 3, 4]);
    store.set("session", { image: initial, imageMimeType: "image/jpeg", question: "first", locale: "de-DE" });
    const previous = store.get("session");
    expect(previous?.image).toEqual(initial);
    store.set("session", { ...previous!, question: "follow-up" });
    expect(store.get("session")?.image).toEqual(initial);
    store.close();
  });
});
