import { describe, it, expect } from "vitest";
import { generateRoomCode } from "../convex/lib/code";

describe("generateRoomCode", () => {
  it("is 6 chars", () => {
    for (let i = 0; i < 50; i++) expect(generateRoomCode()).toHaveLength(6);
  });
  it("avoids confusable characters", () => {
    for (let i = 0; i < 200; i++) {
      const c = generateRoomCode();
      expect(c).not.toMatch(/[01OIL]/);
      expect(c).toMatch(/^[A-Z2-9]{6}$/);
    }
  });
});
