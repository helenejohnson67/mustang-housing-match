import { emptyFacts, listed, type FloorPlan, type ListingFacts } from "@/core/domain";
import { leaseTypeFromMonths, leaseTypeFromText, parseMoney } from "@/core/textListing";
import { applyAmenityText, get, hasType, jsonLd, num, postalAddress, setLeaseTerm, str } from "./shared";
import type { RawCapture } from "./types";

type RecordValue = Record<string, unknown>;

interface CachedProperty {
  property: RecordValue;
  /** Includes the cache query key when one is available. */
  path: string;
}

function nextData(doc: Document): unknown {
  const el = doc.getElementById("__NEXT_DATA__");
  if (!el) return null;
  try {
    return JSON.parse(el.textContent ?? "");
  } catch {
    return null;
  }
}

function record(value: unknown): RecordValue | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : undefined;
}

/**
 * Zillow's gdpClientCache is not a stable single object.  It has appeared as
 * JSON, as an object, and with more than one query result.  Scan all of the
 * cache entries instead of trusting object insertion order.
 */
function gdpCaches(nd: unknown): unknown[] {
  const caches: unknown[] = [];
  const seen = new Set<object>();
  const visit = (value: unknown, depth: number): void => {
    if (!value || typeof value !== "object" || depth > 12) return;
    if (seen.has(value)) return;
    seen.add(value);
    for (const [key, child] of Object.entries(value as RecordValue)) {
      if (key === "gdpClientCache") caches.push(child);
      else visit(child, depth + 1);
    }
  };
  visit(nd, 0);
  return caches;
}

function parseCache(cacheRaw: unknown, warnings: string[]): unknown {
  if (typeof cacheRaw !== "string") return cacheRaw;
  try {
    return JSON.parse(cacheRaw);
  } catch {
    warnings.push("gdpClientCache was not valid JSON");
    return null;
  }
}

function parseNestedJson(value: string): unknown | null {
  if (!/^\s*[{\[]/.test(value)) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function cachedProperties(cacheRaw: unknown, index: number, warnings: string[]): CachedProperty[] {
  const cache = parseCache(cacheRaw, warnings);
  const found: CachedProperty[] = [];
  const seen = new Set<object>();
  const visit = (value: unknown, path: string, depth: number): void => {
    if (depth > 12) return;
    if (typeof value === "string") {
      const parsed = parseNestedJson(value);
      if (parsed) visit(parsed, path, depth + 1);
      return;
    }
    if (!value || typeof value !== "object") return;
    if (seen.has(value)) return;
    seen.add(value);
    for (const [key, child] of Object.entries(value as RecordValue)) {
      const childPath = `${path}.${key}`;
      const property = key === "property" ? record(child) : undefined;
      if (property) found.push({ property, path: childPath });
      visit(child, childPath, depth + 1);
    }
  };
  visit(cache, `gdpClientCache[${index}]`, 0);
  return found;
}

function textValues(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (typeof value === "boolean") return [String(value)];
  return [];
}

function hasOwn(obj: RecordValue, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

/** True only when the cached property has a concrete rental signal. */
function isRentalProperty(property: RecordValue, path: string): boolean {
  const status = [
    ...textValues(property.homeStatus),
    ...textValues(property.homeStatusForHDP),
    ...textValues(property.listingStatus),
    ...textValues(property.marketingStatus),
    ...textValues(property.statusType),
  ].join(" ").toLowerCase();

  // A sale status must win over a stale query key so a sale price is never
  // presented as monthly rent.
  if (/for[_\s-]?sale|sold|pending|coming[_\s-]?soon|foreclosure/.test(status)) return false;
  if (property.isForRent === true || property.isRentalListing === true || property.isRental === true) return true;
  if (/for[_\s-]?rent|rental|lease/.test(status)) return true;

  if (record(property.rentalCostsAndFees) || record(property.rentalApplicationPriceDetail)) return true;
  if (hasOwn(property, "listPriceIncludesRequiredMonthlyFees")) return true;

  // The cache query itself is a reliable signal on Zillow's detail pages.
  return /for[_\s-]?rent|rental|leaseout/i.test(path);
}

function propertyCompleteness(property: RecordValue): number {
  return ["address", "streetAddress", "price", "bedrooms", "bathrooms", "resoFacts", "rentalCostsAndFees"].filter((key) => property[key] != null).length;
}

function selectCachedProperty(candidates: CachedProperty[]): CachedProperty | undefined {
  return candidates.slice().sort((a, b) => {
    const rentalDifference = Number(isRentalProperty(b.property, b.path)) - Number(isRentalProperty(a.property, a.path));
    return rentalDifference || propertyCompleteness(b.property) - propertyCompleteness(a.property);
  })[0];
}

/** Avoid turning a malformed value such as "$1,500 - $2,000" into 15002000. */
function exactMoney(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value !== "string" || !/^\s*\$?\s*(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?\s*$/.test(value)) return null;
  return parseMoney(value);
}

function hasReadableFacts(facts: ListingFacts): boolean {
  const direct = [facts.address, facts.rent, facts.bedrooms, facts.bathrooms, facts.leaseType, facts.deposit, facts.applicationFee, facts.parkingFee, facts.otherMonthlyFees];
  return direct.some((fact) => fact.provenance !== "NotListed") || Object.values(facts.amenities).some((fact) => fact.provenance !== "NotListed");
}

function hasReadableFloorPlans(plans: FloorPlan[] | undefined): boolean {
  return Boolean(plans?.some((plan) => Object.values(plan.facts).some((fact) => fact?.provenance !== "NotListed")));
}

function amenityBlob(res: Record<string, unknown> | undefined): string {
  if (!res) return "";
  const bits: string[] = [];
  for (const k of ["utilities", "parkingFeatures", "laundryFeatures", "appliances", "petsAllowed", "hasPetsAllowed", "furnished", "flooring", "communityFeatures", "exteriorFeatures", "interiorFeatures"]) {
    const v = res[k];
    const name = k.replace(/^has/, "").replace(/Allowed$/, "").replace(/Features$/, "");
    if (Array.isArray(v)) bits.push(`${name}: ${v.map(String).join(", ")}`);
    else if (typeof v === "string") bits.push(`${name} ${v}`);
    else if (typeof v === "boolean") bits.push(v ? `${name} allowed` : `no ${name}, not ${name}`);
  }
  return bits.join(". ");
}

function readHome(nd: unknown, facts: ListingFacts, warnings: string[]): boolean {
  const candidates = gdpCaches(nd).flatMap((cache, index) => cachedProperties(cache, index, warnings));
  const candidate = selectCachedProperty(candidates);
  if (!candidate) {
    warnings.push("No property in gdpClientCache");
    return false;
  }
  const p = candidate.property;
  const addr = postalAddress(p.address) ?? str(p.streetAddress);
  if (addr) facts.address = listed(addr);
  const price = exactMoney(p.price);
  if (price != null && isRentalProperty(p, candidate.path)) facts.rent = listed(price);
  else if (price != null) warnings.push("Zillow property was not confirmed as a rental; sale price was left Not Listed");
  const beds = num(p.bedrooms);
  if (beds != null) facts.bedrooms = listed(beds);
  const baths = num(p.bathrooms);
  if (baths != null) facts.bathrooms = listed(baths);

  const reso = (p.resoFacts && typeof p.resoFacts === "object" ? p.resoFacts : {}) as Record<string, unknown>;
  const leaseMonths = num(get(p, "rentalCostsAndFees.leaseDuration"));
  const rawLease = str(reso.leaseTerm) ?? (leaseMonths != null ? `${leaseMonths} months` : null);
  const lease = leaseTypeFromMonths(leaseMonths) ?? leaseTypeFromText(rawLease);
  setLeaseTerm(facts, rawLease, lease);

  const fees = Array.isArray(reso.feesAndDues) ? (reso.feesAndDues as Record<string, unknown>[]) : [];
  const dep = fees.find((f) => /deposit/i.test(String(f.type ?? f.name ?? "")));
  const depAmt = dep ? parseMoney(str(dep.fee) ?? str(dep.amount)) : null;
  if (depAmt != null) facts.deposit = listed(depAmt);

  const appCents = num(get(p, "rentalApplicationPriceDetail.actualPriceInCents"));
  if (appCents != null) facts.applicationFee = listed(Math.round(appCents) / 100);

  // Monthly fee groups: sum everything that is not parking; parking goes to parkingFee.
  const groups = get(p, "rentalCostsAndFees.fees.monthly.feeGroup");
  let other = 0;
  let sawOther = false;
  if (Array.isArray(groups)) {
    for (const g of groups as Record<string, unknown>[]) {
      const list = Array.isArray(g.fees) ? (g.fees as Record<string, unknown>[]) : [];
      for (const f of list) {
        const amt = parseMoney(str(f.fee) ?? str(f.amount) ?? (typeof f.amount === "number" ? String(f.amount) : null));
        if (amt == null) continue;
        if (/parking|garage/i.test(String(f.name ?? f.type ?? g.name ?? ""))) facts.parkingFee = listed(amt);
        else {
          other += amt;
          sawOther = true;
        }
      }
    }
  }
  if (sawOther) facts.otherMonthlyFees = listed(other);
  applyAmenityText(facts, amenityBlob(reso));
  return true;
}

function unitPlan(planName: string, unit: Record<string, unknown>, warnings: string[]): FloorPlan {
  const beds = num(unit.beds);
  const baths = num(unit.baths);
  const price = num(unit.price) ?? parseMoney(str(unit.price));
  const leaseDetail = (unit.leaseTermDetail && typeof unit.leaseTermDetail === "object" ? unit.leaseTermDetail : {}) as Record<string, unknown>;
  const rawLease = str(leaseDetail.leaseTerm);
  const lease = leaseTypeFromText(rawLease);
  const deposit = parseMoney(str(leaseDetail.deposit) ?? (typeof leaseDetail.deposit === "number" ? String(leaseDetail.deposit) : null)) ?? parseMoney(str(unit.depositsAndFees));
  const unitNo = str(unit.unitNumber) ?? str(unit.name);
  const label = [beds != null ? `${beds} bd` : null, baths != null ? `${baths} ba` : null].filter(Boolean).join(" / ");
  const facts: FloorPlan["facts"] = {};
  if (price != null) facts.rent = listed(price);
  if (beds != null) facts.bedrooms = listed(beds);
  if (baths != null) facts.bathrooms = listed(baths);
  if (deposit != null) facts.deposit = listed(deposit);
  if (lease || rawLease) facts.leaseType = listed(lease ?? rawLease!);
  return {
    id: [planName, unitNo].filter(Boolean).join("#") || label,
    name: `${planName}${unitNo ? ` · Unit ${unitNo}` : ""} · ${label}${price != null ? ` · $${price.toLocaleString("en-US")}` : ""}`,
    facts,
  };
}

function readBuilding(nd: unknown, facts: ListingFacts, warnings: string[]): FloorPlan[] | null {
  const b = get(nd, "props.pageProps.componentProps.initialReduxState.gdp.building");
  if (!b || typeof b !== "object") return null;
  const building = b as Record<string, unknown>;
  const addr = postalAddress(building.address);
  if (addr) facts.address = listed(addr);
  const attrs = (building.buildingAttributes && typeof building.buildingAttributes === "object" ? building.buildingAttributes : {}) as Record<string, unknown>;
  const app = num(attrs.applicationFee);
  if (app != null) facts.applicationFee = listed(app);
  const depMin = num(attrs.depositFeeMin);
  if (depMin != null) facts.deposit = listed(depMin);
  const blob: string[] = [];
  if (Array.isArray(attrs.utilitiesIncluded) && attrs.utilitiesIncluded.length) blob.push("utilities included: " + attrs.utilitiesIncluded.join(", "));
  if (Array.isArray(attrs.parkingTypes) && attrs.parkingTypes.length) blob.push("parking: " + attrs.parkingTypes.join(", "));
  const pets = attrs.petPolicies;
  if (Array.isArray(pets) && pets.length) blob.push("pets allowed: " + pets.map((p) => (typeof p === "object" && p ? JSON.stringify(p) : String(p))).join(", "));
  else if (pets && typeof pets === "object") blob.push("pets allowed " + JSON.stringify(pets));
  const raw = get(building, "amenityDetails.customAmenities.rawAmenities");
  if (Array.isArray(raw)) blob.push(raw.map(String).join(", "));
  const structured = building.structuredAmenities;
  if (structured && typeof structured === "object") blob.push(JSON.stringify(structured));
  applyAmenityText(facts, blob.join(". "));

  const plans: FloorPlan[] = [];
  const fps = Array.isArray(building.floorPlans) ? (building.floorPlans as Record<string, unknown>[]) : [];
  for (const fp of fps) {
    const planName = str(fp.name) ?? "Floor plan";
    const units = Array.isArray(fp.units) ? (fp.units as Record<string, unknown>[]) : [];
    if (units.length === 0) plans.push(unitPlan(planName, fp, warnings));
    for (const u of units) plans.push(unitPlan(planName, u, warnings));
  }
  if (plans.length === 1) {
    Object.assign(facts, plans[0]!.facts);
  }
  const rawBuildingLease = Array.isArray(attrs.leaseTerms) && attrs.leaseTerms.length ? attrs.leaseTerms.map(String).join("; ") : null;
  const buildingLease = leaseTypeFromText(rawBuildingLease);
  if (facts.leaseType.provenance === "NotListed") setLeaseTerm(facts, rawBuildingLease, buildingLease);
  return plans;
}

function offers(value: unknown): RecordValue[] {
  if (Array.isArray(value)) return value.flatMap((item) => {
    const offer = record(item);
    return offer ? [offer] : [];
  });
  const offer = record(value);
  return offer ? [offer] : [];
}

function rentalOffer(offer: RecordValue, node: RecordValue): boolean {
  const priceSpecification = record(offer.priceSpecification);
  const signal = [
    offer.businessFunction,
    offer.category,
    offer.description,
    offer.name,
    priceSpecification?.unitText,
    priceSpecification?.description,
    node.businessFunction,
    node.category,
    node.description,
  ].flatMap(textValues).join(" ");
  if (/for\s*sale|sale\s*price|\bsold\b|\bpending\b/i.test(signal)) return false;
  return /lease(?:out)?|rental|\brent\b|monthly|per\s+month/i.test(signal);
}

function offerPrice(offer: RecordValue): number | null {
  const direct = exactMoney(offer.price) ?? exactMoney(record(offer.priceSpecification)?.price);
  if (direct != null) return direct;
  const low = exactMoney(offer.lowPrice);
  const high = exactMoney(offer.highPrice);
  // An AggregateOffer can only stand in for one rental price when its bounds
  // agree. A low price alone is commonly a "from" price, not this listing's rent.
  return low != null && high != null && low === high ? low : null;
}

function readJsonLdFallback(doc: Document, facts: ListingFacts): boolean {
  let found = false;
  for (const node of jsonLd(doc)) {
    if (!hasType(node, "RealEstateListing") && !hasType(node, "Product")) continue;
    found = true;
    const nodeOffers = offers(node.offers);
    const itemCandidates = [
      record(node.itemOffered),
      ...nodeOffers.map((offer) => record(offer.itemOffered)),
      record(node.about),
      node,
    ].filter((item): item is RecordValue => Boolean(item));

    for (const item of itemCandidates) {
      const addr = postalAddress(item.address);
      if (addr && facts.address.provenance === "NotListed") facts.address = listed(addr);
      const beds = num(item.numberOfBedrooms);
      if (beds != null && facts.bedrooms.provenance === "NotListed") facts.bedrooms = listed(beds);
      const baths = num(item.numberOfBathroomsTotal);
      if (baths != null && facts.bathrooms.provenance === "NotListed") facts.bathrooms = listed(baths);
      const amen = item.amenityFeature;
      if (Array.isArray(amen)) applyAmenityText(facts, amen.map((a) => (a && typeof a === "object" ? String((a as Record<string, unknown>).name ?? "") : String(a))).join(", "));
      if (item.petsAllowed === true) applyAmenityText(facts, "pets allowed");
    }

    if (facts.rent.provenance === "NotListed") {
      const rental = nodeOffers.find((offer) => rentalOffer(offer, node));
      const price = rental ? offerPrice(rental) : null;
      if (price != null) facts.rent = listed(price);
    }
  }
  return found;
}

export function readZillow(doc: Document, url: string, kind: "home" | "building"): RawCapture {
  const warnings: string[] = [];
  const facts = emptyFacts();
  facts.rentBasis = "per-unit";
  const nd = nextData(doc);
  let floorPlans: FloorPlan[] | undefined;
  let ok = false;
  if (nd) {
    if (kind === "home") ok = readHome(nd, facts, warnings);
    else {
      const plans = readBuilding(nd, facts, warnings);
      if (plans) {
        ok = true;
        if (plans.length > 1) floorPlans = plans;
      }
    }
    if (!ok) warnings.push("__NEXT_DATA__ did not have the expected shape; used JSON-LD");
  } else warnings.push("No __NEXT_DATA__ on the page; used JSON-LD");
  const foundJsonLd = readJsonLdFallback(doc, facts);
  if (!ok && !foundJsonLd) warnings.push("No JSON-LD listing data found either");
  if (!hasReadableFacts(facts) && !hasReadableFloorPlans(floorPlans)) warnings.push("No readable listing information was found");
  const result: RawCapture = { url, title: doc.title, source: "zillow", kind, facts, warnings };
  if (floorPlans) result.floorPlans = floorPlans;
  return result;
}
