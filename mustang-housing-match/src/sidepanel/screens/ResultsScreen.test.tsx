// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/preact";
import { DEFAULT_PREFERENCES, emptyFacts, listed, type Listing } from "@/core/domain";
import { fitScore } from "@/core/scoring";
import { ResultsScreen } from "./ResultsScreen";

describe("ResultsScreen", () => {
  it("shows score, benefits, and missing-data watch-outs", () => {
    const facts = emptyFacts();
    facts.address = listed("870 Foothill Blvd");
    facts.rent = listed(1250);
    facts.bedrooms = listed(2);
    facts.bathrooms = listed(1);
    facts.leaseType = listed("school-year");
    facts.amenities.parking = listed(true);
    facts.amenities.laundry = listed(true);
    const listing: Listing = {
      id: "1", source: "zillow", sourceUrl: "https://www.zillow.com/homedetails/x/1_zpid/", floorPlanId: null,
      title: "870 Foothill Blvd", facts, capturedAt: "2026-10-12T00:00:00Z",
    };
    const result = fitScore(facts, DEFAULT_PREFERENCES);
    render(<ResultsScreen listing={listing} result={result} prefs={DEFAULT_PREFERENCES} onEdit={() => {}} onPreferences={() => {}} />);
    expect(screen.getByRole("img", { name: `Fit Score ${result.score} out of 100` })).toBeTruthy();
    expect(screen.getAllByText("870 Foothill Blvd")).toHaveLength(2);
    expect(screen.getByText("Benefits")).toBeTruthy();
    expect(screen.getByText("Watch-Outs")).toBeTruthy();
  });
});
