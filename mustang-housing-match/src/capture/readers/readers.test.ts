// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { capturePage } from "./index";

const fixture = (name: string): Document => {
  const html = readFileSync(join(process.cwd(), "e2e/fixtures", name), "utf8");
  return new DOMParser().parseFromString(html, "text/html");
};

describe("capturePage dispatch", () => {
  it("returns unsupported for pages no Source matches", () => {
    const doc = new DOMParser().parseFromString("<title>Hi</title>", "text/html");
    expect(capturePage(doc, "https://example.com/")).toEqual({ url: "https://example.com/", title: "Hi", source: "unsupported", warnings: [] });
  });
  it("never throws on a Supported Page with no data", () => {
    const doc = new DOMParser().parseFromString("<title>Empty</title>", "text/html");
    const r = capturePage(doc, "https://www.zillow.com/homedetails/x/1_zpid/");
    expect(r.source).toBe("zillow");
    expect(r.facts?.rent.provenance).toBe("NotListed");
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe("reader safety guards", () => {
  const doc = (html: string): Document => new DOMParser().parseFromString(html, "text/html");

  it("scans all Zillow cache entries and prefers an identified rental over a for-sale entry", () => {
    const cache = {
      ForSaleQuery: { property: { homeStatus: "FOR_SALE", price: 900000, streetAddress: "Sale House" } },
      ForRentQuery: {
        property: {
          isForRent: true,
          price: 2100,
          streetAddress: "Rental House",
          bedrooms: 2,
          bathrooms: 1,
        },
      },
    };
    const page = doc(`<title>Zillow</title><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { componentProps: { gdpClientCache: JSON.stringify(cache) } } } })}</script>`);
    const result = capturePage(page, "https://www.zillow.com/homedetails/rental-house/123_zpid/");

    expect(result.facts!.rent.value).toBe(2100);
    expect(result.facts!.address.value).toBe("Rental House");
  });

  it("does not label a Zillow for-sale price as rent", () => {
    const cache = {
      ForSaleQuery: { property: { homeStatus: "FOR_SALE", price: 900000, streetAddress: "Sale House" } },
    };
    const page = doc(`<title>Zillow</title><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { componentProps: { gdpClientCache: JSON.stringify(cache) } } } })}</script>`);
    const result = capturePage(page, "https://www.zillow.com/homedetails/sale-house/123_zpid/");

    expect(result.facts!.rent.provenance).toBe("NotListed");
    expect(result.warnings.join(" ")).toMatch(/not confirmed as a rental/i);
  });

  it("leaves an Apartments.com displayed rent range unscored instead of selecting one endpoint", () => {
    const page = doc(`
      <title>Apartment range</title>
      <div class="priceBedRangeInfo"><div class="priceBedRangeInfoInnerContainer">
        <p class="rentInfoLabel">Monthly Rent</p><p class="rentInfoDetail">$1500-$2100</p>
      </div></div>
      <script type="application/ld+json">{"@type":"ApartmentComplex","offers":{"price":1700}}</script>
    `);
    const result = capturePage(page, "https://www.apartments.com/example-place/abc1234/");

    expect(result.facts!.rent.provenance).toBe("NotListed");
    expect(result.warnings.join(" ")).toMatch(/range or starting price/i);
  });

  it("uses ApartmentComplex JSON-LD when the visual summary is unavailable", () => {
    const page = doc(`
      <title>JSON-LD apartment</title>
      <script type="application/ld+json">{
        "@type":"ApartmentComplex",
        "address":{"streetAddress":"55 Higuera St","addressLocality":"San Luis Obispo","addressRegion":"CA","postalCode":"93401"},
        "numberOfBedrooms":2,
        "numberOfBathroomsTotal":1,
        "offers":{"price":"1850"}
      }</script>
    `);
    const result = capturePage(page, "https://www.apartments.com/example-place/abc1234/");

    expect(result.facts!.address.value).toBe("55 Higuera St, San Luis Obispo, CA 93401");
    expect(result.facts!.rent.value).toBe(1850);
    expect(result.facts!.bedrooms.value).toBe(2);
    expect(result.facts!.bathrooms.value).toBe(1);
  });

  it("does not assume a Craigslist price is monthly when its rent period is absent", () => {
    const page = doc(`<title>Craigslist listing</title><h1 class="postingtitletext"><span class="price">$800</span></h1>`);
    const result = capturePage(page, "https://www.craigslist.org/view/d/example/abc123/");

    expect(result.facts!.rent.provenance).toBe("NotListed");
    expect(result.warnings.join(" ")).toMatch(/rent period was not listed/i);
  });

  it("warns when a supported reader cannot find any readable listing information", () => {
    for (const url of [
      "https://www.zillow.com/homedetails/empty/123_zpid/",
      "https://www.apartments.com/example-place/abc1234/",
      "https://www.craigslist.org/view/d/example/abc123/",
    ]) {
      const result = capturePage(doc("<title>Empty</title>"), url);
      expect(result.warnings).toContain("No readable listing information was found");
    }
  });
});

describe("Zillow home-detail page", () => {
  const r = capturePage(fixture("zillow-home.html"), "https://www.zillow.com/homedetails/870-Foothill-Blvd-San-Luis-Obispo-CA-93405/123456789_zpid/");
  it("reads every Listing Fact from __NEXT_DATA__", () => {
    expect(r.source).toBe("zillow");
    expect(r.kind).toBe("home");
    expect(r.floorPlans).toBeUndefined();
    const f = r.facts!;
    expect(f.address).toEqual({ value: "870 Foothill Blvd, San Luis Obispo, CA 93405", provenance: "Listed" });
    expect(f.rent.value).toBe(1250);
    expect(f.rentBasis).toBe("per-unit");
    expect(f.bedrooms.value).toBe(3);
    expect(f.bathrooms.value).toBe(2);
    expect(f.leaseType.value).toBe("12-month");
    expect(f.deposit.value).toBe(1250);
    expect(f.applicationFee.value).toBe(35);
    expect(f.parkingFee.value).toBe(40);
    expect(f.otherMonthlyFees.value).toBe(15);
    expect(f.amenities.parking.value).toBe(true);
    expect(f.amenities.laundry.value).toBe(true);
    expect(f.amenities.pets.value).toBe(false);
    expect(f.amenities.furnished.value).toBe(false);
    expect(f.amenities.utilitiesIncluded.provenance).toBe("NotListed");
    expect(r.warnings).toEqual([]);
  });
  it("falls back to JSON-LD without __NEXT_DATA__", () => {
    const doc = fixture("zillow-home.html");
    doc.getElementById("__NEXT_DATA__")!.remove();
    const r2 = capturePage(doc, "https://www.zillow.com/homedetails/870-Foothill-Blvd/123456789_zpid/");
    expect(r2.facts!.rent.value).toBe(1250);
    expect(r2.facts!.bedrooms.value).toBe(3);
    expect(r2.facts!.address.value).toBe("870 Foothill Blvd, San Luis Obispo, CA 93405");
    expect(r2.facts!.leaseType.provenance).toBe("NotListed");
    expect(r2.warnings[0]).toMatch(/No __NEXT_DATA__/);
  });
});

describe("Zillow building page", () => {
  const r = capturePage(fixture("zillow-building.html"), "https://www.zillow.com/apartments/san-luis-obispo-ca/the-junction/CmPcXD/");
  it("returns one Floor Plan per unit and building-level facts", () => {
    expect(r.kind).toBe("building");
    expect(r.floorPlans).toHaveLength(2);
    const [a, b] = r.floorPlans!;
    expect(a!.name).toBe("A1 · Unit 104 · 2 bd / 1 ba · $2,100");
    expect(a!.facts.rent?.value).toBe(2100);
    expect(a!.facts.bedrooms?.value).toBe(2);
    expect(a!.facts.bathrooms?.value).toBe(1);
    expect(a!.facts.deposit?.value).toBe(500);
    expect(a!.facts.leaseType?.value).toBe("12-month");
    expect(b!.facts.rent?.value).toBe(3300);
    expect(b!.facts.leaseType?.value).toBe("Contact For Details");
    const f = r.facts!;
    expect(f.address.value).toBe("1150 Chorro St, San Luis Obispo, CA 93401");
    expect(f.rent.provenance).toBe("NotListed"); // picker decides
    expect(f.applicationFee.value).toBe(45);
    expect(f.deposit.value).toBe(500);
    expect(f.amenities.utilitiesIncluded.value).toBe(true);
    expect(f.amenities.parking.value).toBe(true);
    expect(f.amenities.laundry.value).toBe(true);
    expect(f.amenities.pets.value).toBe(true);
    expect(r.warnings).toEqual([]);
  });
});

describe("Craigslist posting", () => {
  const r = capturePage(fixture("craigslist.html"), "https://www.craigslist.org/view/d/room-in-4bd-house-near-cal-poly/5BdQGNL6Xjb6zsddTd1PB5");
  it("reads JSON-LD, price, attrgroups and the posting body", () => {
    expect(r.source).toBe("craigslist");
    const f = r.facts!;
    expect(f.address.value).toBe("124 Hathway Ave, San Luis Obispo, CA 93405");
    expect(f.rent.value).toBe(1320);
    expect(f.rentBasis).toBe("per-person");
    expect(f.bedrooms.value).toBe(4);
    expect(f.bathrooms.value).toBe(2);
    expect(f.leaseType.value).toBe("school-year");
    expect(f.deposit.value).toBe(1000);
    expect(f.amenities.laundry.value).toBe(true);
    expect(f.amenities.parking.value).toBe(true);
    expect(f.amenities.pets.value).toBe(true);
    expect(f.amenities.furnished.value).toBe(true);
    expect(f.amenities.utilitiesIncluded.value).toBe(true);
    expect(f.applicationFee.provenance).toBe("NotListed");
    expect(r.title).toBe("Room in 4bd house near Cal Poly");
    expect(r.warnings).toEqual([]);
  });
  it("leaves rent Not Listed when the rent period is not monthly", () => {
    const doc = fixture("craigslist.html");
    doc.querySelector(".attr.rent_period .valu")!.textContent = "weekly";
    const r2 = capturePage(doc, "https://www.craigslist.org/view/d/x/5BdQGNL6Xjb6zsddTd1PB5");
    expect(r2.facts!.rent.provenance).toBe("NotListed");
    expect(r2.warnings[0]).toMatch(/weekly/);
  });
});

describe("Apartments.com property page", () => {
  const r = capturePage(fixture("apartments.html"), "https://www.apartments.com/twin-creeks-san-luis-obispo-ca/sqnz3v4/");
  it("reads the DOM sections and the pricing grid", () => {
    expect(r.source).toBe("apartments");
    const f = r.facts!;
    expect(f.address.value).toBe("791 Orcutt Rd, San Luis Obispo, CA 93401");
    expect(f.rent.value).toBe(3850);
    expect(f.bedrooms.value).toBe(3);
    expect(f.bathrooms.value).toBe(3);
    expect(f.leaseType.value).toBe("6 - 12 Month");
    expect(f.applicationFee.value).toBe(40);
    expect(f.parkingFee.value).toBe(25);
    expect(f.amenities.parking.value).toBe(true);
    expect(f.amenities.laundry.value).toBe(true);
    expect(f.amenities.pets.value).toBe(true);
    expect(f.amenities.furnished.provenance).toBe("NotListed");
    expect(r.floorPlans).toHaveLength(2);
    expect(r.floorPlans![0]!.name).toBe("Townhome A · 3 bd / 3 ba · $3,850");
    expect(r.floorPlans![0]!.facts.deposit?.value).toBe(1500);
    expect(r.floorPlans![1]!.facts.bathrooms?.value).toBe(2.5);
    expect(r.warnings).toEqual([]);
  });
  it("uses JSON-LD when the DOM summary is missing", () => {
    const doc = fixture("apartments.html");
    doc.querySelector(".priceBedRangeInfo")!.remove();
    doc.getElementById("propertyAddressRow")!.remove();
    doc.querySelector(".propertyAddressContainer")!.remove();
    const r2 = capturePage(doc, "https://www.apartments.com/twin-creeks-san-luis-obispo-ca/sqnz3v4/");
    expect(r2.facts!.rent.value).toBe(3850);
    expect(r2.facts!.bedrooms.value).toBe(3);
    expect(r2.facts!.address.value).toBe("791 Orcutt Rd, San Luis Obispo, CA 93401");
  });
});
