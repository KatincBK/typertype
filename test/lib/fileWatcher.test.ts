import { describe, expect, it } from "vitest";
import { isOwnWrite } from "@/lib/fileWatcher";

// Guards the file-watcher self-write filter: an incoming disk change that is
// really the echo of one of OUR writes must NOT be treated as an external
// change (no "file changed externally" prompt).
describe("isOwnWrite", () => {
  it("ignores content equal to the in-memory saved baseline", () => {
    expect(isOwnWrite("hello", "hello", [])).toBe(true);
  });

  it("treats genuinely different content as an external change", () => {
    expect(isOwnWrite("from someone else", "hello", [])).toBe(false);
  });

  // The core regression: the watcher event can arrive before setSavedMd has
  // propagated, so savedMd is still STALE while disk already holds our newest
  // write. The recent-writes ring must still recognise it as ours.
  it("recognises a write whose echo beats the savedMd state update", () => {
    const justWrote = "edited, save in flight";
    const staleSaved = "older saved baseline";
    expect(isOwnWrite(justWrote, staleSaved, [staleSaved, justWrote])).toBe(true);
  });

  it("matches any entry in the ring, not just the latest", () => {
    expect(isOwnWrite("v1", "v3", ["v1", "v2", "v3"])).toBe(true);
  });

  it("does not match when the content is in neither baseline nor ring", () => {
    expect(isOwnWrite("external edit", "v3", ["v1", "v2", "v3"])).toBe(false);
  });
});
