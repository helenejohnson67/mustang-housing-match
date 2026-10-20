import { describe, it, expect } from "vitest";
import { normalizeAddress, canonicalSourceUrl, listingIdentity, isDuplicate } from "./address";
import { emptyFacts, listed, type Listing } from "./domain";

describe("normalizeAddress", () => {
  it("lowercases, strips punctuation, and abbreviates suffixes", () => {
    expect(normalizeAddress("870 Foothill Boulevard, San Luis Obispo, CA 93405")).toBe("870 foothill blvd");
    expect(normalizeAddress("870 FOOTHILL BLVD")).toBe("870 foothill blvd");
    expect(normalizeAddress("1150 Chorro Street")).toBe("1150 chorro st");
    expect(normalizeAddress("124 Hathway Ave.")).toBe("124 hathway ave");
  });
  it("keeps the unit number in one form", () => {
    expect(normalizeAddress("1453 Lizzie St Apt 2, San Luis Obispo CA")).toBe("1453 lizzie st unit 2");
    expect(normalizeAddress("1453 Lizzie St #2")).toBe("1453 lizzie st unit 2");
    expect(normalizeAddress("1453 Lizzie Street Unit 2")).toBe("1453 lizzie st unit 2");
    expect(normalizeAddress("1453 Lizzie St Apt #2")).toBe("1453 lizzie st unit 2");
  });
  it("removes city, state, zip and country but not street words", () => {
    expect(normalizeAddress("55 N Broad St, San Luis Obispo, California 93401, USA")).toBe("55 n broad st");
    expect(normalizeAddress("55 North Broad Street")).toBe("55 n broad st");
  });
  it("treats different units as different addresses", () => {
    expect(normalizeAddress("1453 Lizzie St #1")).not.toBe(normalizeAddress("1453 Lizzie St #2"));
  });
});

describe("canonicalSourceUrl", () => {
  it("drops query, hash and trailing slash; lowercases host", () => {
    expect(canonicalSourceUrl("https://WWW.Zillow.com/homedetails/870-Foothill/123_zpid/?utm=x#top")).toBe(
      "https://www.zillow.com/homedetails/870-Foothill/123_zpid",
    );
    expect(canonicalSourceUrl("https://sanluisobispo.craigslist.org/apa/d/x/777.html")).toBe(
      "https://sanluisobispo.craigslist.org/apa/d/x/777.html",
    );
  });
  it("returns non-URLs trimmed", () => {
    expect(canonicalSourceUrl("  not a url ")).toBe("not a url");
  });
});

describe("listingIdentity", () => {
  it("uses the canonical URL plus floor plan for structured Sources", () => {
    expect(listingIdentity({ source: "zillow", sourceUrl: "https://www.zillow.com/apartments/slo/the-junction/CmPcXD/?x=1", floorPlanId: "2br-a", address: null })).toBe(
      "https://www.zillow.com/apartments/slo/the-junction/CmPcXD#plan=2br-a",
    );
    expect(listingIdentity({ source: "craigslist", sourceUrl: "https://www.craigslist.org/view/d/x/1", floorPlanId: null, address: "ignored" })).toBe(
      "https://www.craigslist.org/view/d/x/1",
    );
  });
  it("uses the normalised address when there is no source URL", () => {
    expect(listingIdentity({ source: "zillow", sourceUrl: null, floorPlanId: null, address: "870 Foothill Blvd, SLO CA 93405" })).toBe("address:870 foothill blvd slo");
    expect(listingIdentity({ source: "craigslist", sourceUrl: null, floorPlanId: null, address: "870 Foothill Boulevard" })).toBe("address:870 foothill blvd");
  });
});

function mk(id: string, address: string | null): Listing {
  const facts = emptyFacts();
  if (address) facts.address = listed(address);
  return { id, source: "zillow", sourceUrl: null, floorPlanId: null, title: id, facts, capturedAt: "2026-10-12T00:00:00Z" };
}

describe("isDuplicate", () => {
  it("matches on identity", () => {
    expect(isDuplicate(mk("a", null), mk("a", null))).toBe(true);
  });
  it("matches on normalised address across Sources", () => {
    expect(isDuplicate(mk("zillow-1", "870 Foothill Blvd, San Luis Obispo, CA 93405"), mk("manual-1", "870 foothill boulevard"))).toBe(true);
  });
  it("keeps different units apart and ignores missing addresses", () => {
    expect(isDuplicate(mk("a", "1453 Lizzie St #1"), mk("b", "1453 Lizzie St #2"))).toBe(false);
    expect(isDuplicate(mk("a", null), mk("b", null))).toBe(false);
  });
});
