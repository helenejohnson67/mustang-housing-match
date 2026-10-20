import { emptyFacts, listed, type ListingFacts } from "@/core/domain";
import { leaseTypeFromText, parseMoney } from "@/core/textListing";
import { applyAmenityText, hasType, jsonLd, num, postalAddress, setLeaseTerm, text } from "./shared";
import type { RawCapture } from "./types";

function hasReadableFacts(facts: ListingFacts): boolean {
  const direct = [facts.address, facts.rent, facts.bedrooms, facts.bathrooms, facts.leaseType, facts.deposit, facts.applicationFee, facts.parkingFee, facts.otherMonthlyFees];
  return direct.some((fact) => fact.provenance !== "NotListed") || Object.values(facts.amenities).some((fact) => fact.provenance !== "NotListed");
}

export function readCraigslist(doc: Document, url: string): RawCapture {
  const warnings: string[] = [];
  const facts = emptyFacts();

  const apt = jsonLd(doc).find((n) => hasType(n, "Apartment")) as Record<string, unknown> | undefined;
  const addr = postalAddress(apt?.address) ?? text(doc.querySelector("h2.street-address")) ?? "";
  const mapAddr = text(doc.querySelector(".mapaddress"));
  if (addr) facts.address = listed(addr);
  else if (mapAddr) facts.address = listed(mapAddr);

  const period = text(doc.querySelector(".attr.rent_period")).toLowerCase();
  const price = parseMoney(text(doc.querySelector(".postingtitletext .price")) || text(doc.querySelector(".price")));
  if (price != null) {
    if (/month/.test(period)) facts.rent = listed(price);
    else if (period) warnings.push(`Rent period is "${period.replace(/rent period:\s*/, "")}", not monthly; rent left Not Listed`);
    else warnings.push("Rent period was not listed; price was left Not Listed");
  }

  const important = Array.from(doc.querySelectorAll(".attrgroup .attr.important, .attrgroup .shared-line-bubble")).map(text).join(" ");
  const bb = /(\d+)\s*BR\s*\/\s*(\d+(?:\.\d)?)\s*Ba/i.exec(important);
  if (bb && bb[1] && bb[2]) {
    facts.bedrooms = listed(Number(bb[1]));
    facts.bathrooms = listed(Number(bb[2]));
  } else {
    const beds = num(apt?.numberOfBedrooms);
    if (beds != null) facts.bedrooms = listed(beds);
    const baths = num(apt?.numberOfBathroomsTotal);
    if (baths != null) facts.bathrooms = listed(baths);
  }

  const attrs = Array.from(doc.querySelectorAll(".attrgroup .attr")).map(text).filter((t) => !/^\d+BR/i.test(t) && !/rent period/i.test(t));
  applyAmenityText(facts, attrs.join(". "));

  // Rooms and sublets are listed per person; apartments per unit.
  const crumbs = jsonLd(doc).find((n) => hasType(n, "BreadcrumbList")) as Record<string, unknown> | undefined;
  const crumbText = JSON.stringify(crumbs ?? {}) + " " + text(doc.querySelector(".breadcrumbs"));
  const title = text(doc.querySelector("#titletextonly")) || doc.title;
  if (/cat=roo|cat=sub|rooms\s*(\/|&)\s*shared|sublets?/i.test(crumbText) || /\broom\b/i.test(title)) facts.rentBasis = "per-person";

  const body = text(doc.querySelector("#postingbody"));
  const rawLease = /\b\d+\s*(?:-|–|to)\s*\d+\s*(?:months?|mos?)\b/i.exec(body)?.[0]
    ?? /\b(?:\d+\s*(?:months?|mos?)|school[\s-]*year|academic[\s-]*year|month[\s-]*to[\s-]*month)\b/i.exec(body)?.[0]
    ?? null;
  const lease = leaseTypeFromText(rawLease ?? body);
  setLeaseTerm(facts, rawLease, lease);
  applyAmenityText(facts, body);
  const dep = /deposit[^$\d]{0,20}\$?\s*(\d{1,3}(?:,\d{3})+|\d{3,5})/i.exec(body);
  if (dep && dep[1]) facts.deposit = listed(Number(dep[1].replace(/,/g, "")));

  if (!apt && !price) warnings.push("Neither JSON-LD Apartment nor a .price element was found");
  if (!hasReadableFacts(facts)) warnings.push("No readable listing information was found");
  return { url, title, source: "craigslist", kind: "listing", facts, warnings };
}
