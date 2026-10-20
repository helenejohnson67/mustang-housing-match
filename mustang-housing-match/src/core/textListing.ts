// Free-text helpers used by the Zillow, Craigslist, and Apartments.com readers.
// Every helper returns null / NotListed when the text says nothing; nothing is guessed.

import { type AmenityId, type Fact, type LeaseType, type ListingFacts, type RentBasis, emptyFacts, listed, notListed } from "./domain";

/** "$2,900" | "2,900" | "$1,250.00" → 2900 | 1250. Null when no number. */
export function parseMoney(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = /\$?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?/.exec(text);
  if (!m || !m[1]) return null;
  const n = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Maps lease wording to a Lease Type. Null when nothing recognisable. */
export function leaseTypeFromText(text: string | null | undefined): LeaseType | null {
  if (!text) return null;
  const t = text.toLowerCase();
  // A range such as "6–12 months" is genuine information, but it is not an
  // exact 12-month preference match. Callers retain the raw text instead.
  if (/\b\d+\s*(?:-|–|to)\s*\d+\s*(?:months?|mos?)\b/.test(t)) return null;
  if (/month[\s-]*to[\s-]*month|\bm2m\b|\bmtm\b|monthly lease/.test(t)) return "month-to-month";
  if (/school[\s-]*year|academic[\s-]*year|\b(9|10)[\s-]*months?\b|\bnine[\s-]*month|\bten[\s-]*month|sept(ember)?\s*(to|-|–|through)\s*june|fall\s*(to|-|–|through)\s*spring/.test(t)) return "school-year";
  if (/\b12[\s-]*months?\b|\btwelve[\s-]*month|\b1[\s-]*year\b|one[\s-]*year|year[\s-]*lease|\bannual\b|\byearly\b|12[\s-]*mo\b/.test(t)) return "12-month";
  return null;
}

/** Lease Type from a numeric lease duration in months. */
export function leaseTypeFromMonths(months: number | null | undefined): LeaseType | null {
  if (months == null || !Number.isFinite(months)) return null;
  if (months <= 1) return "month-to-month";
  if (months >= 9 && months <= 10) return "school-year";
  if (months === 12) return "12-month";
  return null;
}

/** Positive mentions of each amenity in free text. Absent → NotListed (we never infer "no"). */
export function amenityHints(text: string | null | undefined): Partial<Record<AmenityId, boolean>> {
  if (!text) return {};
  const t = text.toLowerCase();
  const out: Partial<Record<AmenityId, boolean>> = {};
  if (/\bno (off[\s-]*street )?parking\b|parking not (included|available)/.test(t)) out.parking = false;
  else if (/\bparking\b|\bgarage\b|\bcarport\b|\bdriveway\b/.test(t)) out.parking = true;
  if (/\bno laundry\b|no washer/.test(t)) out.laundry = false;
  else if (/\blaundry\b|washer|w\/d\b|\bdryer\b/.test(t)) out.laundry = true;
  if (/utilities?\s*(not|aren'?t|are not)\s*included|plus utilities|\+\s*utilities|utilities?\s*(extra|separate)/.test(t)) out.utilitiesIncluded = false;
  else if (/utilities?\s*(are\s*)?(included|incl\b|inc\b)|all utilities|includes? (all )?utilities|utils? included/.test(t)) out.utilitiesIncluded = true;
  if (/\bno pets\b|pets? not allowed|no animals/.test(t)) out.pets = false;
  else if (/\bpets?\s*(ok|okay|allowed|friendly|welcome|negotiable)|\b(cats?|dogs?)\s*(are\s*)?(ok|okay|allowed|welcome)|pet[\s-]*friendly/.test(t)) out.pets = true;
  if (/\bunfurnished\b|not furnished/.test(t)) out.furnished = false;
  else if (/\bfurnished\b/.test(t)) out.furnished = true;
  return out;
}

export function applyAmenityHints(facts: ListingFacts, hints: Partial<Record<AmenityId, boolean>>): void {
  for (const [k, v] of Object.entries(hints) as [AmenityId, boolean][]) {
    if (v !== undefined) facts.amenities[k] = listed(v);
  }
}

export function factOrNotListed<T>(value: T | null | undefined): Fact<T> {
  return value == null ? notListed<T>() : listed(value);
}

const WORD_NUMBERS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, studio: 0 };

function wordOrDigit(s: string): number | null {
  const lower = s.toLowerCase();
  if (lower in WORD_NUMBERS) return WORD_NUMBERS[lower]!;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const STREET_SUFFIX = "(?:St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Dr|Drive|Ln|Lane|Ct|Court|Way|Pl|Place|Cir|Circle|Ter|Terrace)";

export interface ParsedText {
  facts: ListingFacts;
  warnings: string[];
}

/** Parses a Facebook post (or any free text) into Listing Facts. Unmatched facts stay NotListed. */
export function parseTextListing(text: string): ParsedText {
  const facts = emptyFacts();
  const warnings: string[] = [];
  const t = text.replace(/\r/g, "");
  const lower = t.toLowerCase();

  // Rent: "$1,320/mo", "$1320 per person", "1,320 a month", "$1200 monthly"
  const rentRe = /\$\s*(\d{1,3}(?:,\d{3})+|\d{3,5})(?:\.\d{2})?\s*(?:\/|per|a|each|an?)?\s*(?:mo\b|month|person|room|bed|bedroom|monthly|pp\b|ppm\b)?|(\d{1,3}(?:,\d{3})+|\d{3,5})\s*(?:\/|per|a)\s*(?:mo\b|month)/i;
  const rentCandidates: number[] = [];
  const rentScan = new RegExp(rentRe.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = rentScan.exec(t))) {
    const raw = m[1] ?? m[2];
    const n = raw ? Number(raw.replace(/,/g, "")) : NaN;
    const around = t.slice(Math.max(0, m.index - 20), m.index + m[0].length + 20).toLowerCase();
    if (/deposit|fee|application/.test(around)) continue;
    if (Number.isFinite(n) && n >= 200 && n <= 20000) rentCandidates.push(n);
  }
  if (rentCandidates.length > 0) {
    facts.rent = listed(rentCandidates[0]!);
    if (rentCandidates.length > 1) warnings.push(`Several dollar amounts found; using the first (${rentCandidates.join(", ")})`);
  }

  // Rent Basis
  if (/per person|per room|\/person|\/room|\beach\b|\bpp\b|\bppm\b|per bed(room)?\b|a person|a room\b|for the room|room for rent|\broom\b/.test(lower)) facts.rentBasis = "per-person";
  if (/whole (house|unit|apartment|place)|\btotal\b|entire (house|unit|apartment)|for the (house|unit|apartment)/.test(lower)) facts.rentBasis = "per-unit";

  // Bedrooms / bathrooms: "4 bed", "4bd", "4br", "four bedroom", "2b2b", "3bd/2ba", "studio"
  const bb = /(\d|one|two|three|four|five|six)\s*(?:bd|br|bed|bedroom|b)\s*(?:rm|s)?\s*[\/,&x-]?\s*(\d(?:\.\d)?|one|two|three)\s*(?:ba|bath|bathroom|b)\b/i.exec(t);
  if (bb && bb[1] && bb[2]) {
    const beds = wordOrDigit(bb[1]);
    const baths = wordOrDigit(bb[2]);
    if (beds != null) facts.bedrooms = listed(beds);
    if (baths != null) facts.bathrooms = listed(baths);
  } else {
    const bed = /(\d|one|two|three|four|five|six)\s*[- ]?(?:bd|br|bed|bedroom)s?\b/i.exec(t);
    if (bed && bed[1]) {
      const n = wordOrDigit(bed[1]);
      if (n != null) facts.bedrooms = listed(n);
    } else if (/\bstudio\b/i.test(t)) facts.bedrooms = listed(0);
    const bath = /(\d(?:\.\d)?|one|two|three)\s*[- ]?(?:ba|bath|bathroom)s?\b/i.exec(t);
    if (bath && bath[1]) {
      const n = wordOrDigit(bath[1]);
      if (n != null) facts.bathrooms = listed(n);
    }
  }

  const lease = leaseTypeFromText(t);
  if (lease) facts.leaseType = listed(lease);

  applyAmenityHints(facts, amenityHints(t));

  const dep = /(?:security\s*)?deposit\s*(?:of|is|:|-)?\s*\$?\s*(\d{1,3}(?:,\d{3})+|\d{3,5})|\$\s*(\d{1,3}(?:,\d{3})+|\d{3,5})\s*(?:security\s*)?deposit/i.exec(t);
  if (dep) {
    const n = parseMoney(dep[1] ?? dep[2] ?? null);
    if (n != null) facts.deposit = listed(n);
  }

  const addr = new RegExp(`\\b(\\d{1,6}\\s+[A-Z][a-z]+(?:\\s+[A-Z][a-z]+)?\\s+${STREET_SUFFIX})\\b\\.?(?:[,\\s]+(?:#|unit|apt\\.?)\\s*\\w+)?`).exec(t);
  if (addr && addr[1]) facts.address = listed(addr[0].replace(/\.$/, "").trim());

  if (facts.rent.value == null) warnings.push("No monthly rent found in the text");
  return { facts, warnings };
}
