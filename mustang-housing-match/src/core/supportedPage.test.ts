import { describe, it, expect } from "vitest";
import { detectSource } from "./supportedPage";

describe("detectSource", () => {
  it("recognises Zillow home-detail and building pages", () => {
    expect(detectSource("https://www.zillow.com/homedetails/1453-1-2-Lizzie-St-San-Luis-Obispo-CA-93401/464770776_zpid/")).toEqual({ source: "zillow", kind: "home" });
    expect(detectSource("https://www.zillow.com/apartments/san-luis-obispo-ca/the-junction/CmPcXD/")).toEqual({ source: "zillow", kind: "building" });
    expect(detectSource("https://www.zillow.com/san-luis-obispo-ca/rentals/")).toBeNull();
  });
  it("recognises both Craigslist posting URL shapes", () => {
    expect(detectSource("https://www.craigslist.org/view/d/atascadero-air-conditioning-business/5BdQGNL6Xjb6zsddTd1PB5")).toEqual({ source: "craigslist", kind: "listing" });
    expect(detectSource("https://slo.craigslist.org/apa/d/atascadero-air-conditioning-business/7976313438.html")).toEqual({ source: "craigslist", kind: "listing" });
    expect(detectSource("https://slo.craigslist.org/sss/d/atascadero-table/7976313438.html")).toBeNull();
    expect(detectSource("https://www.craigslist.org/search/area/slo?cat=apa")).toBeNull();
  });
  it("recognises Apartments.com detail pages but not search pages", () => {
    expect(detectSource("https://www.apartments.com/twin-creeks-san-luis-obispo-ca/sqnz3v4/")).toEqual({ source: "apartments", kind: "listing" });
    expect(detectSource("https://www.apartments.com/san-luis-obispo-ca/")).toBeNull();
  });
  it("honours the fixture override on localhost only", () => {
    expect(detectSource("http://localhost:4173/zillow-home.html?mhm-source=zillow&kind=home")).toEqual({ source: "zillow", kind: "home" });
    expect(detectSource("http://localhost:4173/zillow-building.html?mhm-source=zillow&kind=building")).toEqual({ source: "zillow", kind: "building" });
    expect(detectSource("http://localhost:4173/craigslist.html?mhm-source=craigslist")).toEqual({ source: "craigslist", kind: "listing" });
    expect(detectSource("https://evil.example/?mhm-source=zillow")).toBeNull();
    expect(detectSource("http://localhost:4173/")).toBeNull();
  });
  it("returns null for junk", () => {
    expect(detectSource("not a url")).toBeNull();
    expect(detectSource("https://example.com/")).toBeNull();
  });
});
