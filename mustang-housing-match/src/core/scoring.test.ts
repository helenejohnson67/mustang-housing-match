import { describe, expect, it } from "vitest";
import {
  amenitiesFraction,
  budgetFraction,
  fitScore,
  leaseFraction,
  roomCountFraction,
  roomsFraction,
  SCORE_WEIGHTS,
  transportFraction,
} from "./scoring";
import { corrected, DEFAULT_PREFERENCES, emptyFacts, listed, type ListingFacts, type Preferences } from "./domain";

const prefs: Preferences = { ...DEFAULT_PREFERENCES };

function facts(patch: (f: ListingFacts) => void): ListingFacts {
  const f = emptyFacts();
  patch(f);
  return f;
}

describe("score weights", () => {
  it("are fixed and total 100 points", () => {
    expect(SCORE_WEIGHTS).toEqual({ budget: 40, rooms: 15, lease: 15, amenities: 25, transport: 5 });
    expect(Object.values(SCORE_WEIGHTS).reduce((sum, weight) => sum + weight, 0)).toBe(100);
  });
});

describe("budgetFraction", () => {
  it("is 1 at or under budget, linear to 0 at 1.5×, and 0 when rent is missing", () => {
    expect(budgetFraction(1400, 1500)).toBe(1);
    expect(budgetFraction(1500, 1500)).toBe(1);
    expect(budgetFraction(1750, 1500)).toBeCloseTo(2 / 3, 6);
    expect(budgetFraction(2250, 1500)).toBe(0);
    expect(budgetFraction(null, 1500)).toBe(0);
  });
});

describe("leaseFraction", () => {
  it("gives credit only for an explicitly listed matching lease", () => {
    expect(leaseFraction(facts((f) => { f.leaseType = listed("school-year"); }), prefs)).toBe(1);
    expect(leaseFraction(emptyFacts(), prefs)).toBe(0);
    expect(leaseFraction(facts((f) => { f.leaseType = listed("12-month"); }), prefs)).toBe(0);
    expect(leaseFraction(facts((f) => { f.leaseType = listed("6–12 months"); }), prefs)).toBe(0);
  });
});

describe("roomsFraction", () => {
  it("scores bedrooms and bathrooms independently without private/shared inference", () => {
    const matching = facts((f) => {
      f.bedrooms = listed(2);
      f.bathrooms = listed(1);
    });
    const noBathroom = facts((f) => { f.bedrooms = listed(2); });
    const noBedroom = facts((f) => { f.bathrooms = listed(1); });

    expect(roomsFraction(matching, prefs)).toBe(1);
    expect(roomsFraction(noBathroom, prefs)).toBeCloseTo(8 / 15, 6);
    expect(roomsFraction(noBedroom, prefs)).toBeCloseTo(7 / 15, 6);
    expect(roomCountFraction(null, 2)).toBe(0);
    expect(roomCountFraction(3, 2)).toBe(0.5);
  });
});

describe("amenitiesFraction", () => {
  it("gives missing and unavailable requested amenities zero credit", () => {
    expect(amenitiesFraction(emptyFacts(), prefs)).toBe(0);

    const matching = facts((f) => {
      f.amenities.parking = listed(true);
      f.amenities.laundry = listed(true);
      f.amenities.utilitiesIncluded = listed(true);
    });
    expect(amenitiesFraction(matching, prefs)).toBe(1);
    expect(amenitiesFraction(matching, {
      ...prefs,
      parkingRequired: false,
      laundryRequired: false,
      utilitiesIncludedPreferred: false,
    })).toBe(1);
  });
});

describe("transportFraction", () => {
  it("uses listed parking for drivers and gives unknown modes no inferred credit", () => {
    const withParking = facts((f) => { f.amenities.parking = listed(true); });
    expect(transportFraction(withParking, { ...prefs, transportMode: "car" })).toBe(1);
    expect(transportFraction(emptyFacts(), { ...prefs, transportMode: "car" })).toBe(0);
    expect(transportFraction(withParking, { ...prefs, transportMode: "bike" })).toBe(0);
  });
});

describe("fitScore", () => {
  it("returns a deterministic 0–100 integer from listed facts", () => {
    const listing = facts((f) => {
      f.address = listed("870 Foothill Blvd, San Luis Obispo, CA 93405");
      f.rent = listed(1250);
      f.bedrooms = listed(2);
      f.bathrooms = listed(1);
      f.leaseType = listed("school-year");
      f.amenities.parking = listed(true);
      f.amenities.laundry = listed(true);
      f.amenities.utilitiesIncluded = listed(true);
    });
    const a = fitScore(listing, prefs);
    const b = fitScore(listing, prefs);

    expect(a).toEqual(b);
    expect(Number.isInteger(a.score)).toBe(true);
    expect(a.score).toBeGreaterThanOrEqual(0);
    expect(a.score).toBeLessThanOrEqual(100);
    expect(a.benefits.some((i) => /bathroom preference/i.test(i.text))).toBe(true);
  });

  it("drops when rent exceeds budget and names that as a watch-out", () => {
    const listing = facts((f) => {
      f.rent = listed(2200);
      f.bedrooms = listed(2);
      f.bathrooms = listed(1);
      f.leaseType = listed("school-year");
      f.amenities.parking = listed(true);
      f.amenities.laundry = listed(true);
      f.amenities.utilitiesIncluded = listed(true);
    });
    const under = fitScore(listing, { ...prefs, budget: 2500 });
    const over = fitScore(listing, { ...prefs, budget: 1500 });

    expect(over.score).toBeLessThan(under.score);
    expect(over.watchOuts.some((w) => /exceeds your/.test(w.text))).toBe(true);
  });

  it("uses a corrected bathroom value on the next calculation", () => {
    const listing = facts((f) => {
      f.rent = listed(1250);
      f.bedrooms = listed(2);
      f.leaseType = listed("school-year");
      f.amenities.parking = listed(true);
      f.amenities.laundry = listed(true);
      f.amenities.utilitiesIncluded = listed(true);
    });
    const before = fitScore(listing, { ...prefs, transportMode: "car" });
    listing.bathrooms = corrected(1);
    const after = fitScore(listing, { ...prefs, transportMode: "car" });

    expect(after.score).toBeGreaterThan(before.score);
    expect(after.benefits.some((i) => /bathroom preference/i.test(i.text))).toBe(true);
  });

  it("gives zero points to a listing with only missing relevant facts", () => {
    const result = fitScore(emptyFacts(), prefs);

    expect(result.score).toBe(0);
    expect(result.factors.budget.fraction).toBe(0);
    expect(result.factors.rooms.fraction).toBe(0);
    expect(result.factors.lease.fraction).toBe(0);
    expect(result.factors.amenities.fraction).toBe(0);
    expect(result.factors.transport.fraction).toBe(0);
    expect(result.watchOuts.some((w) => /rent is not listed/i.test(w.text))).toBe(true);
    expect(result.watchOuts.some((w) => /bathroom count is not listed/i.test(w.text))).toBe(true);
    expect(result.benefits).toEqual([]);
  });

  it("keeps a non-standard listed lease term visible instead of calling it missing", () => {
    const listing = facts((f) => {
      f.leaseType = listed("6–12 months");
    });

    const result = fitScore(listing, prefs);
    expect(result.watchOuts.some((w) => /listed as “6–12 months”/i.test(w.text))).toBe(true);
    expect(result.watchOuts.some((w) => /lease length is not listed/i.test(w.text))).toBe(false);
  });
});
