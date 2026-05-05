import { beforeEach, describe, expect, it } from "vitest";
import { addRecent, getRecents, removeRecent } from "@/lib/recents";

describe("recents (MRU)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts empty when localStorage has no key", () => {
    expect(getRecents()).toEqual([]);
  });

  it("prepends new entries and dedupes existing ones", () => {
    addRecent("/a.md");
    addRecent("/b.md");
    addRecent("/a.md"); // bump existing to top
    expect(getRecents()).toEqual(["/a.md", "/b.md"]);
  });

  it("caps the list at 10 entries", () => {
    for (let i = 0; i < 15; i++) addRecent(`/f${i}.md`);
    expect(getRecents()).toHaveLength(10);
    // Most recent first
    expect(getRecents()[0]).toBe("/f14.md");
  });

  it("removeRecent drops a single entry", () => {
    addRecent("/x.md");
    addRecent("/y.md");
    removeRecent("/x.md");
    expect(getRecents()).toEqual(["/y.md"]);
  });

  it("ignores empty paths", () => {
    addRecent("");
    expect(getRecents()).toEqual([]);
  });

  it("recovers gracefully from a malformed payload", () => {
    localStorage.setItem("tylike.recentFiles", "not json");
    expect(getRecents()).toEqual([]);
  });
});
