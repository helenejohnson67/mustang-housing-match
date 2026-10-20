import { listed, type AmenityId, type LeaseType, type ListingFacts } from "@/core/domain";
import { amenityHints } from "@/core/textListing";

export function text(el: Element | null | undefined): string {
  return (el?.textContent ?? "").replace(/\s+/g, " ").trim();
}

export function jsonLd(doc: Document): unknown[] {
  const out: unknown[] = [];
  for (const s of Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))) {
    try {
      const parsed = JSON.parse(s.textContent ?? "");
      if (Array.isArray(parsed)) out.push(...parsed);
      else if (parsed && typeof parsed === "object" && Array.isArray((parsed as { "@graph"?: unknown[] })["@graph"])) {
        out.push(...((parsed as { "@graph": unknown[] })["@graph"]));
      } else out.push(parsed);
    } catch {
      /* ignore malformed JSON-LD */
    }
  }
  return out;
}

export function hasType(node: unknown, type: string): node is Record<string, unknown> {
  if (!node || typeof node !== "object") return false;
  const t = (node as Record<string, unknown>)["@type"];
  return t === type || (Array.isArray(t) && t.includes(type));
}

export function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^0-9.]/g, ""));
    return v.trim() !== "" && Number.isFinite(n) ? n : null;
  }
  return null;
}

export function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

export function get(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const key of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

export function postalAddress(a: unknown): string | null {
  if (!a || typeof a !== "object") return null;
  const r = a as Record<string, unknown>;
  const parts = [str(r.streetAddress), str(r.addressLocality) ?? str(r.city), [str(r.addressRegion) ?? str(r.state), str(r.postalCode) ?? str(r.zipcode)].filter(Boolean).join(" ")].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

/** Applies positive/negative amenity mentions from a blob of text, leaving unmentioned ones untouched. */
export function applyAmenityText(facts: ListingFacts, blob: string): void {
  const hints = amenityHints(blob);
  for (const [k, v] of Object.entries(hints) as [AmenityId, boolean][]) {
    if (v !== undefined && facts.amenities[k].provenance === "NotListed") facts.amenities[k] = listed(v);
  }
}

/**
 * Keep the terms a source actually states. A canonical value is used only
 * when the text represents an exact scoring term; otherwise the raw value is
 * still shown and remains editable instead of being mislabeled Not listed.
 */
export function setLeaseTerm(facts: ListingFacts, raw: string | null | undefined, canonical: LeaseType | null): void {
  const text = raw?.replace(/\s+/g, " ").trim();
  if (canonical) facts.leaseType = listed(canonical);
  else if (text) facts.leaseType = listed(text);
}
