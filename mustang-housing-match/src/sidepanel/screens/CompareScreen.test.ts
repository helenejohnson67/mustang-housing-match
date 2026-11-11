import { describe, expect, it } from "vitest";
import { emptyFacts, listed, DEFAULT_PREFERENCES, type Listing } from "@/core/domain";
import { comparisonSummary } from "./CompareScreen";

describe("comparisonSummary", () => {
  it("uses saved listing facts and source links", () => {
    const facts = emptyFacts(); facts.address = listed("1 Mustang Way"); facts.rent = listed(1200);
    const listing: Listing = { id: "one", source: "manual", sourceUrl: "https://example.test/one", floorPlanId: null, title: "1 Mustang Way", facts, capturedAt: "2026-01-01T00:00:00Z" };
    const text = comparisonSummary([listing], DEFAULT_PREFERENCES);
    expect(text).toContain("$1200/month"); expect(text).toContain("https://example.test/one"); expect(text).toContain("not listed");
  });
});
