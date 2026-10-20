import { describe, it, expect } from "vitest";
import { memoryStore } from "@/core/storage";
import { DEFAULT_PREFERENCES, emptyFacts, listed } from "@/core/domain";
import type { RawCapture } from "@/capture/readers/types";
import type { Services } from "../services";
import { MatchController } from "./match";

function foothillCapture(): RawCapture {
  const facts = emptyFacts();
  facts.address = listed("870 Foothill Blvd, San Luis Obispo, CA 93405");
  facts.rent = listed(1250);
  facts.bedrooms = listed(3);
  facts.bathrooms = listed(2);
  facts.leaseType = listed("12-month");
  facts.amenities.parking = listed(true);
  facts.amenities.laundry = listed(true);
  return { url: "https://www.zillow.com/homedetails/870-foothill/1_zpid/", title: "870 Foothill Blvd", source: "zillow", kind: "home", facts, warnings: [] };
}

function fakeServices(over: Partial<Services> = {}): Services {
  return {
    local: memoryStore(),
    tabs: {
      listingTab: async () => ({ id: 7, url: "https://www.zillow.com/homedetails/870-foothill/1_zpid/", title: "870 Foothill Blvd" }),
      onChange: () => () => {},
    },
    capture: async () => foothillCapture(),
    now: () => new Date("2026-10-12T10:00:00Z"),
    ...over,
  };
}

describe("MatchController", () => {
  it("detects a supported listing page", async () => {
    const c = new MatchController(fakeServices());
    await c.init();
    expect(c.state.page.status).toBe("supported");
  });

  it("shows unsupported for other sites and does not capture", async () => {
    const c = new MatchController(fakeServices({
      tabs: {
        listingTab: async () => ({ id: 1, url: "https://example.com/", title: "Example" }),
        onChange: () => () => {},
      },
    }));
    await c.init();
    expect(c.state.page.status).toBe("unsupported");
    await c.analyze();
    expect(c.state.review).toBeNull();
  });

  it("extracts listing facts and scores them against saved preferences", async () => {
    const c = new MatchController(fakeServices());
    await c.init();
    await c.analyze();
    expect(c.state.review?.facts.rent.value).toBe(1250);
    expect(c.state.scorecard).not.toBeNull();
    expect(c.state.scorecard!.score).toBeGreaterThanOrEqual(0);
    expect(c.state.scorecard!.score).toBeLessThanOrEqual(100);
  });

  it("uses corrected facts for scoring and persists them", async () => {
    const s = fakeServices();
    const c = new MatchController(s);
    await c.init();
    await c.analyze();
    const before = c.state.scorecard!.score;
    c.editFact("rent", { value: 3000, provenance: "Corrected" });
    expect(c.state.scorecard!.score).toBeLessThan(before);
    await c.saveListingChanges();
    const again = new MatchController(s);
    await again.init();
    expect(again.state.listing?.facts.rent.value).toBe(3000);
    expect(again.state.listing?.facts.rent.provenance).toBe("Corrected");
  });

  it("persists preferences and recalculates when budget changes", async () => {
    const s = fakeServices();
    const c = new MatchController(s);
    await c.init();
    await c.analyze();
    const mid = c.state.scorecard!.score;
    await c.savePreferences({ ...DEFAULT_PREFERENCES, budget: 800 });
    expect(c.state.scorecard!.score).toBeLessThan(mid);
    const again = new MatchController(s);
    await again.init();
    expect(again.state.prefs.budget).toBe(800);
  });
});
