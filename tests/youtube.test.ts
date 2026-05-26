import { describe, it, expect } from "vitest";
import { extractYouTubeId } from "../convex/lib/youtube";

describe("extractYouTubeId", () => {
  it("parses watch?v=", () => {
    expect(extractYouTubeId("https://www.youtube.com/watch?v=aqz-KE-bpKQ")).toBe("aqz-KE-bpKQ");
  });
  it("parses youtu.be short links", () => {
    expect(extractYouTubeId("https://youtu.be/aqz-KE-bpKQ")).toBe("aqz-KE-bpKQ");
  });
  it("parses /embed/", () => {
    expect(extractYouTubeId("https://www.youtube.com/embed/aqz-KE-bpKQ?rel=0")).toBe("aqz-KE-bpKQ");
  });
  it("parses /shorts/", () => {
    expect(extractYouTubeId("https://youtube.com/shorts/aqz-KE-bpKQ")).toBe("aqz-KE-bpKQ");
  });
  it("accepts bare ids", () => {
    expect(extractYouTubeId("aqz-KE-bpKQ")).toBe("aqz-KE-bpKQ");
  });
  it("rejects garbage", () => {
    expect(extractYouTubeId("https://example.com/foo")).toBeNull();
    expect(extractYouTubeId("hello")).toBeNull();
    expect(extractYouTubeId("")).toBeNull();
  });
});
