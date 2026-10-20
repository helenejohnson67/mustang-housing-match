// Address normalisation and Listing identity. Pure.
import type { Listing, SourceId } from "./domain";

const TOKEN_MAP: Record<string, string> = {
  street: "st", avenue: "ave", av: "ave", road: "rd", drive: "dr", boulevard: "blvd", court: "ct", lane: "ln",
  place: "pl", circle: "cir", terrace: "ter", parkway: "pkwy", highway: "hwy",
  apartment: "unit", apt: "unit", ste: "unit", suite: "unit", "#": "unit", no: "unit",
  north: "n", south: "s", east: "e", west: "w",
};
const DROP_PHRASES = [/\bsan luis obispo\b/g, /\bcalifornia\b/g, /\busa\b/g, /\bunited states\b/g];

/** Lowercase, punctuation-free, abbreviation-consistent form of a street address, city/state/zip removed, unit kept. */
export function normalizeAddress(raw: string): string {
  let s = raw.toLowerCase();
  s = s.replace(/#\s*/g, " # ");
  s = s.replace(/[.,;:()'"]/g, " ");
  for (const re of DROP_PHRASES) s = s.replace(re, " ");
  s = s.replace(/\b\d{5}(-\d{4})?\b/g, " ");
  const tokens = s
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => TOKEN_MAP[t] ?? t)
    .filter((t) => t !== "ca");
  // "unit unit 3" → "unit 3" (e.g. "Apt #3")
  const out: string[] = [];
  for (const t of tokens) if (!(t === "unit" && out[out.length - 1] === "unit")) out.push(t);
  return out.join(" ");
}

/** Lowercase host, no query, no hash, no trailing slash. Returns the input unchanged when it is not a URL. */
export function canonicalSourceUrl(url: string): string {
  try {
    const u = new URL(url);
    let path = u.pathname.replace(/\/+$/, "");
    if (path === "") path = "";
    return `${u.protocol}//${u.host.toLowerCase()}${path}`;
  } catch {
    return url.trim();
  }
}

export interface IdentityInput {
  source: SourceId;
  sourceUrl: string | null;
  floorPlanId: string | null;
  address: string | null;
}

/** Canonical source URL plus Floor Plan, or the normalised address when there is no URL. */
export function listingIdentity(input: IdentityInput): string {
  if (input.sourceUrl) {
    const base = canonicalSourceUrl(input.sourceUrl);
    return input.floorPlanId ? `${base}#plan=${input.floorPlanId}` : base;
  }
  return `address:${normalizeAddress(input.address ?? "")}`;
}

/** Same identity, or same normalised address (unit number kept). */
export function isDuplicate(a: Listing, b: Listing): boolean {
  if (a.id === b.id) return true;
  const aa = a.facts.address.value;
  const ba = b.facts.address.value;
  if (!aa || !ba) return false;
  const na = normalizeAddress(aa);
  const nb = normalizeAddress(ba);
  return na.length > 0 && na === nb;
}
