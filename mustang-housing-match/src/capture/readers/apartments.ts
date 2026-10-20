import { emptyFacts, listed, type FloorPlan, type ListingFacts } from "@/core/domain";
import { leaseTypeFromText, parseMoney } from "@/core/textListing";
import { applyAmenityText, hasType, jsonLd, postalAddress, setLeaseTerm, text } from "./shared";
import type { RawCapture } from "./types";

type RecordValue = Record<string, unknown>;

interface PriceResult {
  value: number | null;
  range: boolean;
}

function record(value: unknown): RecordValue | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : undefined;
}

function exactNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value !== "string" || !/^\s*\d+(?:\.\d+)?\s*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function exactPrice(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value !== "string" || !/^\s*\$?\s*(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?\s*$/.test(value)) return null;
  return parseMoney(value);
}

/** Returns a price only when the displayed text represents one unqualified amount. */
function priceFromText(value: string): PriceResult {
  const trimmed = value.replace(/\s+/g, " ").trim();
  const amount = "(?:\\d{1,3}(?:,\\d{3})+|\\d+)";
  const range = new RegExp(`\\$?\\s*${amount}(?:\\.\\d{1,2})?\\s*(?:-|\\u2013|\\u2014|to)\\s*\\$?\\s*${amount}(?:\\.\\d{1,2})?`, "i").test(trimmed)
    || new RegExp(`\\$\\s*${amount}(?:\\.\\d{1,2})?\\s*\\+`).test(trimmed)
    || /\b(?:from|starting\s+at|as\s+low\s+as|up\s+to)\s*\$/i.test(trimmed)
    || /\band\s+up\b/i.test(trimmed);
  if (range) return { value: null, range: true };
  const prices = [...trimmed.matchAll(/\$\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?/g)];
  if (prices.length !== 1 || !prices[0]?.[0]) return { value: null, range: false };
  return { value: parseMoney(prices[0][0]), range: false };
}

function hasReadableFacts(facts: ListingFacts): boolean {
  const direct = [facts.address, facts.rent, facts.bedrooms, facts.bathrooms, facts.leaseType, facts.deposit, facts.applicationFee, facts.parkingFee, facts.otherMonthlyFees];
  return direct.some((fact) => fact.provenance !== "NotListed") || Object.values(facts.amenities).some((fact) => fact.provenance !== "NotListed");
}

function hasReadableFloorPlans(plans: FloorPlan[]): boolean {
  return plans.some((plan) => Object.values(plan.facts).some((fact) => fact?.provenance !== "NotListed"));
}

function isListingNode(node: unknown): node is RecordValue {
  return hasType(node, "RealEstateListing") || hasType(node, "Product") || hasType(node, "Apartment") || hasType(node, "ApartmentComplex");
}

function listingNodes(doc: Document): RecordValue[] {
  const nodes: RecordValue[] = [];
  for (const raw of jsonLd(doc)) {
    const root = record(raw);
    if (!root) continue;
    if (isListingNode(root)) nodes.push(root);
    for (const nested of [root.mainEntity, root.about, root.itemOffered]) {
      if (isListingNode(nested)) nodes.push(nested);
    }
  }
  return nodes;
}

function offers(value: unknown): RecordValue[] {
  if (Array.isArray(value)) return value.flatMap((item) => {
    const offer = record(item);
    return offer ? [offer] : [];
  });
  const offer = record(value);
  return offer ? [offer] : [];
}

function entities(node: RecordValue): RecordValue[] {
  return [node, record(node.mainEntity), record(node.about), record(node.itemOffered), ...offers(node.offers).map((offer) => record(offer.itemOffered))]
    .filter((item): item is RecordValue => Boolean(item));
}

function offerPrice(offer: RecordValue): PriceResult {
  const specified = record(offer.priceSpecification);
  const rawPrice = typeof offer.price === "string" ? priceFromText(offer.price) : null;
  const rawSpecifiedPrice = typeof specified?.price === "string" ? priceFromText(specified.price) : null;
  if (rawPrice?.range || rawSpecifiedPrice?.range) return { value: null, range: true };
  const direct = exactPrice(offer.price) ?? exactPrice(specified?.price);
  if (direct != null) return { value: direct, range: false };
  const low = exactPrice(offer.lowPrice);
  const high = exactPrice(offer.highPrice);
  if (low != null && high != null && low !== high) return { value: null, range: true };
  // Apartments.com exposes a single advertised price as lowPrice in some JSON-LD.
  return { value: low ?? high, range: false };
}

function jsonLdPrice(nodes: RecordValue[]): PriceResult {
  let sawRange = false;
  for (const node of nodes) {
    for (const offer of offers(node.offers)) {
      const result = offerPrice(offer);
      if (result.value != null) return result;
      sawRange ||= result.range;
    }
  }
  return { value: null, range: sawRange };
}

function detailForLabel(doc: Document, labelPattern: RegExp): string {
  for (const label of Array.from(doc.querySelectorAll(".rentInfoLabel"))) {
    if (!labelPattern.test(text(label))) continue;
    const container = label.parentElement;
    const detail = container ? text(container.querySelector(".rentInfoDetail")) : "";
    return detail || text(container);
  }
  return "";
}

function bedsBaths(s: string): { beds: number | null; baths: number | null } {
  const bedRange = /(?:studio|\d+)\s*(?:-|\u2013|\u2014|to)\s*(?:studio|\d+)\s*(?:bd|bed|beds)\b/i.test(s);
  const bathRange = /\d+(?:\.\d+)?\s*(?:-|\u2013|\u2014|to)\s*\d+(?:\.\d+)?\s*(?:ba|bath|baths)\b/i.test(s);
  const b = /(\d+|studio)\s*(?:bd|bed|beds)\b/i.exec(s);
  const ba = /(\d+(?:\.\d)?)\s*(?:ba|bath|baths)\b/i.exec(s);
  return {
    beds: !bedRange && b && b[1] ? (/studio/i.test(b[1]) ? 0 : Number(b[1])) : null,
    baths: !bathRange && ba && ba[1] ? Number(ba[1]) : null,
  };
}

export function readApartments(doc: Document, url: string): RawCapture {
  const warnings: string[] = [];
  const facts = emptyFacts();
  facts.rentBasis = "per-unit";

  const addr = text(doc.querySelector("#propertyAddressRow")) || text(doc.querySelector(".propertyAddressContainer")) || text(doc.querySelector(".delivery-address"));
  const ldNodes = listingNodes(doc);
  const ldEntities = ldNodes.flatMap(entities);
  const ldAddr = ldEntities.map((entity) => postalAddress(entity.address)).find((value): value is string => Boolean(value));
  if (addr) facts.address = listed(addr);
  else if (ldAddr) facts.address = listed(ldAddr);

  const summary = text(doc.querySelector(".priceBedRangeInfoInnerContainer")) || text(doc.querySelector(".priceBedRangeInfo"));
  const rentText = detailForLabel(doc, /(?:monthly\s+)?rent/i) || summary;
  const domRent = priceFromText(rentText);
  if (domRent.value != null) facts.rent = listed(domRent.value);
  else if (domRent.range) warnings.push("Monthly rent is shown as a range or starting price; rent was left Not Listed");
  else {
    const ldRent = jsonLdPrice(ldNodes);
    if (ldRent.value != null) facts.rent = listed(ldRent.value);
    else if (ldRent.range) warnings.push("JSON-LD rent is a range; rent was left Not Listed");
  }

  const summaryBeds = detailForLabel(doc, /bedrooms?/i) || summary;
  const summaryBaths = detailForLabel(doc, /bathrooms?/i) || summary;
  const { beds } = bedsBaths(summaryBeds);
  const { baths } = bedsBaths(summaryBaths);
  const ldBeds = ldEntities.map((entity) => exactNumber(entity.numberOfBedrooms)).find((value): value is number => value != null);
  const ldBaths = ldEntities.map((entity) => exactNumber(entity.numberOfBathroomsTotal)).find((value): value is number => value != null);
  if (beds != null) facts.bedrooms = listed(beds);
  else if (ldBeds != null) facts.bedrooms = listed(ldBeds);
  if (baths != null) facts.bathrooms = listed(baths);
  else if (ldBaths != null) facts.bathrooms = listed(ldBaths);

  const fees = text(doc.querySelector("#feesSection"));
  const app = /application fee[^$]{0,40}\$\s*([\d,]+)/i.exec(fees);
  if (app && app[1]) facts.applicationFee = listed(Number(app[1].replace(/,/g, "")));
  const park = /(?:parking|garage|carport|surface lot|covered)[^$]{0,60}\$\s*([\d,]+)(?:\s*\/\s*(?:mo|month))?/i.exec(fees);
  if (park && park[1]) facts.parkingFee = listed(Number(park[1].replace(/,/g, "")));
  const leaseOpt = /lease options?:?\s*([^.]*?(?:months?|mos?|leases?))/i.exec(fees);
  const rawLease = leaseOpt?.[1]?.trim() || /lease[^.]{0,60}/i.exec(fees)?.[0]?.trim() || null;
  const lease = leaseTypeFromText(rawLease);
  setLeaseTerm(facts, rawLease, lease);
  if (/parking[^.]{0,80}(included|free)|free parking/i.test(fees)) facts.parkingFee = listed(0);

  const amenities = text(doc.querySelector("#amenitiesSection"));
  const ldAmen = ldEntities.flatMap((entity) => Array.isArray(entity.amenityFeature) ? entity.amenityFeature : []).map((a) => (a && typeof a === "object" ? String((a as Record<string, unknown>).name ?? "") : String(a))).join(", ");
  applyAmenityText(facts, [amenities, ldAmen, fees].join(". "));
  if (ldEntities.some((entity) => entity.petsAllowed === true) && facts.amenities.pets.provenance === "NotListed") facts.amenities.pets = listed(true);
  if (facts.amenities.parking.provenance === "NotListed" && facts.parkingFee.value != null) facts.amenities.parking = listed(true);

  // Floor plans: pricing grid rows.
  const rows = Array.from(doc.querySelectorAll(".pricingGridItem"));
  const plans: FloorPlan[] = rows.map((row, i) => {
    const name = text(row.querySelector(".modelName")) || `Plan ${i + 1}`;
    const t = text(row);
    const price = priceFromText(text(row.querySelector(".rentLabel")) || t).value;
    const bb = bedsBaths(text(row.querySelector(".detailsTextWrapper")) || t);
    const dep = /\$\s*([\d,]+)\s*deposit/i.exec(t);
    const f: FloorPlan["facts"] = {};
    if (price != null) f.rent = listed(price);
    if (bb.beds != null) f.bedrooms = listed(bb.beds);
    if (bb.baths != null) f.bathrooms = listed(bb.baths);
    if (dep && dep[1]) f.deposit = listed(Number(dep[1].replace(/,/g, "")));
    const label = [bb.beds != null ? `${bb.beds} bd` : null, bb.baths != null ? `${bb.baths} ba` : null].filter(Boolean).join(" / ");
    return { id: name, name: `${name} · ${label}${price != null ? ` · $${price.toLocaleString("en-US")}` : ""}`, facts: f };
  });
  if (plans.length === 1) Object.assign(facts, plans[0]!.facts);
  else if (plans.length === 0) {
    const dep = /\$\s*([\d,]+)\s*deposit/i.exec(text(doc.body));
    if (dep && dep[1]) facts.deposit = listed(Number(dep[1].replace(/,/g, "")));
  }
  const result: RawCapture = { url, title: doc.title, source: "apartments", kind: "listing", facts, warnings };
  if (plans.length > 1) result.floorPlans = plans;
  if (!summary && ldNodes.length === 0) warnings.push("Neither the price summary nor JSON-LD was found");
  if (!hasReadableFacts(facts) && !hasReadableFloorPlans(plans)) warnings.push("No readable listing information was found");
  return result;
}
