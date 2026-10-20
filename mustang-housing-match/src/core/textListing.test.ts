import { describe, it, expect } from "vitest";
import { amenityHints, leaseTypeFromMonths, leaseTypeFromText, parseMoney, parseTextListing } from "./textListing";

describe("parseMoney", () => {
  it("parses dollar strings", () => {
    expect(parseMoney("$2,900")).toBe(2900);
    expect(parseMoney("Deposit: $1,250.00")).toBe(1250);
    expect(parseMoney("40")).toBe(40);
    expect(parseMoney("Contact for details")).toBeNull();
    expect(parseMoney(null)).toBeNull();
  });
});

describe("leaseTypeFromText", () => {
  it("maps common phrasings", () => {
    expect(leaseTypeFromText("1 Year")).toBe("12-month");
    expect(leaseTypeFromText("12-month lease")).toBe("12-month");
    expect(leaseTypeFromText("6 - 12 Month Leases")).toBeNull();
    expect(leaseTypeFromText("Month to Month")).toBe("month-to-month");
    expect(leaseTypeFromText("school year lease, Sept to June")).toBe("school-year");
    expect(leaseTypeFromText("10-month lease")).toBe("school-year");
    expect(leaseTypeFromText("Contact For Details")).toBeNull();
  });
  it("maps numeric durations", () => {
    expect(leaseTypeFromMonths(12)).toBe("12-month");
    expect(leaseTypeFromMonths(9)).toBe("school-year");
    expect(leaseTypeFromMonths(1)).toBe("month-to-month");
    expect(leaseTypeFromMonths(6)).toBeNull();
    expect(leaseTypeFromMonths(null)).toBeNull();
  });
});

describe("amenityHints", () => {
  it("finds positive and negative mentions, leaves the rest undefined", () => {
    expect(amenityHints("Off-street parking, laundry on site, cats are OK, furnished. Utilities not included.")).toEqual({
      parking: true, laundry: true, pets: true, furnished: true, utilitiesIncluded: false,
    });
    expect(amenityHints("No pets. All utilities included!")).toEqual({ pets: false, utilitiesIncluded: true });
    expect(amenityHints("Nice place")).toEqual({});
  });
});

describe("parseTextListing", () => {
  it("parses a typical Facebook group post", () => {
    const { facts, warnings } = parseTextListing(`Room available at 124 Hathway Ave starting September!
$1,320/mo per person, 4 bed 2 bath house, school year lease through June.
Utilities included, washer and dryer, parking in driveway. Deposit $1,000. No pets.`);
    expect(facts.rent).toEqual({ value: 1320, provenance: "Listed" });
    expect(facts.rentBasis).toBe("per-person");
    expect(facts.bedrooms.value).toBe(4);
    expect(facts.bathrooms.value).toBe(2);
    expect(facts.leaseType.value).toBe("school-year");
    expect(facts.amenities.utilitiesIncluded.value).toBe(true);
    expect(facts.amenities.laundry.value).toBe(true);
    expect(facts.amenities.parking.value).toBe(true);
    expect(facts.amenities.pets.value).toBe(false);
    expect(facts.amenities.furnished.provenance).toBe("NotListed");
    expect(facts.deposit.value).toBe(1000);
    expect(facts.address.value).toBe("124 Hathway Ave");
    expect(warnings).toEqual([]);
  });
  it("handles compact forms and defaults to per-unit", () => {
    const { facts } = parseTextListing("2bd/1ba apartment, $2400 a month for the whole unit, 12 month lease, m2m after");
    expect(facts.rent.value).toBe(2400);
    expect(facts.rentBasis).toBe("per-unit");
    expect(facts.bedrooms.value).toBe(2);
    expect(facts.bathrooms.value).toBe(1);
    // "month to month" wins when both appear because flexibility is the stronger signal
    expect(facts.leaseType.value).toBe("month-to-month");
  });
  it("reads word numbers and studios", () => {
    expect(parseTextListing("four bedroom house, $4,800 total").facts.bedrooms.value).toBe(4);
    expect(parseTextListing("Studio for $1,500").facts.bedrooms.value).toBe(0);
  });
  it("leaves everything NotListed and warns when nothing matches", () => {
    const { facts, warnings } = parseTextListing("Looking for roommates, dm me");
    expect(facts.rent.provenance).toBe("NotListed");
    expect(facts.bedrooms.provenance).toBe("NotListed");
    expect(facts.address.provenance).toBe("NotListed");
    expect(warnings).toContain("No monthly rent found in the text");
  });
  it("does not mistake the deposit for rent", () => {
    const { facts } = parseTextListing("Deposit $2,000. Rent is $950 per room.");
    expect(facts.rent.value).toBe(950);
    expect(facts.deposit.value).toBe(2000);
  });
});
