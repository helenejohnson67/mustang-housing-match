/**
 * Fit Score (0–100) for Alpha v0.1.
 *
 * Deterministic weighted sum of listing facts vs saved preferences.
 * Missing facts never count as a match. Same inputs always produce the same score.
 *
 * Weights (sum = 100):
 *   Budget 40  — monthly rent vs budget (most important)
 *   Rooms  15  — 8 for bedrooms and 7 for bathrooms
 *   Lease  15  — listed lease term vs preferred term
 *   Amenities 25 — parking, laundry, pets, utilities, furnishing when the student cares
 *   Transport 5  — parking can support a driving preference; other modes are not inferred
 *
 * A missing fact earns 0 for its relevant sub-factor. Listings never receive
 * neutral or inferred credit for information that was not listed.
 */
import {
  type AmenityId,
  type ListingFacts,
  type Preferences,
  type TransportMode,
} from "./domain";

export const SCORE_WEIGHTS = {
  budget: 40,
  rooms: 15,
  lease: 15,
  amenities: 25,
  transport: 5,
} as const;

/** The documented split of the 15-point `rooms` factor. */
export const ROOM_SUBWEIGHTS = {
  bedrooms: 8,
  bathrooms: 7,
} as const;

export type InsightKind = "benefit" | "watch-out";

export interface Insight {
  kind: InsightKind;
  factor: keyof typeof SCORE_WEIGHTS | AmenityId;
  text: string;
}

export interface FactorResult {
  points: number;
  max: number;
  fraction: number;
}

export interface FitScoreResult {
  score: number;
  factors: Record<keyof typeof SCORE_WEIGHTS, FactorResult>;
  benefits: Insight[];
  watchOuts: Insight[];
}

export const MODE_LABEL: Record<TransportMode, string> = {
  walk: "Walking",
  bike: "Biking",
  bus: "Public transit",
  car: "Driving",
};

export const LEASE_LABEL: Record<string, string> = {
  "school-year": "School-year",
  "month-to-month": "Month-to-month",
  "12-month": "12-month",
};

export const AMENITY_LABEL: Record<AmenityId, string> = {
  parking: "parking",
  laundry: "laundry",
  utilitiesIncluded: "utilities included",
  pets: "pets allowed",
  furnished: "furnished",
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/** 1 at or under budget, linear to 0 at 1.5× budget. Null rent → 0 (do not pretend it fits). */
export function budgetFraction(rent: number | null, budget: number): number {
  if (!(budget > 0) || rent === null) return 0;
  const r = rent / budget;
  if (r <= 1) return 1;
  if (r >= 1.5) return 0;
  return clamp01(1 - (r - 1) / 0.5);
}

/**
 * Exact room-count matches earn full credit; being one room away earns half.
 * A listing cannot reliably establish whether a room is private or shared, so
 * that preference is intentionally outside Alpha v0.1 scoring.
 */
export function roomCountFraction(actual: number | null, preferred: number): number {
  if (actual === null || !Number.isFinite(preferred) || preferred < 0) return 0;
  const difference = Math.abs(actual - preferred);
  if (difference === 0) return 1;
  if (difference === 1) return 0.5;
  return 0;
}

/**
 * The 15-point room factor is split into 8 points for bedrooms and 7 for
 * bathrooms. A missing count earns zero for only its own sub-factor.
 */
export function roomsFraction(facts: ListingFacts, prefs: Preferences): number {
  const bedrooms = roomCountFraction(facts.bedrooms.value, prefs.preferredBedrooms);
  const bathrooms = roomCountFraction(facts.bathrooms.value, prefs.preferredBathrooms);
  return (ROOM_SUBWEIGHTS.bedrooms * bedrooms + ROOM_SUBWEIGHTS.bathrooms * bathrooms) / SCORE_WEIGHTS.rooms;
}

export function leaseFraction(facts: ListingFacts, prefs: Preferences): number {
  const lease = facts.leaseType.value;
  return lease === prefs.leaseType ? 1 : 0;
}

export type AmenityNeed = { id: AmenityId; required: boolean };

export function activeAmenityNeeds(prefs: Preferences): AmenityNeed[] {
  const needs: AmenityNeed[] = [];
  if (prefs.parkingRequired) needs.push({ id: "parking", required: true });
  if (prefs.laundryRequired) needs.push({ id: "laundry", required: true });
  if (prefs.petsAllowedRequired) needs.push({ id: "pets", required: true });
  if (prefs.utilitiesIncludedPreferred) needs.push({ id: "utilitiesIncluded", required: false });
  if (prefs.furnishedPreferred) needs.push({ id: "furnished", required: false });
  return needs;
}

/** A selected amenity earns 1 only when it is listed as available; otherwise it earns 0. */
export function amenitiesFraction(facts: ListingFacts, prefs: Preferences): number {
  const needs = activeAmenityNeeds(prefs);
  // When a student has no selected amenity requirements, there is nothing in
  // this category for a listing to fail. This is not inferred listing credit:
  // it reflects the saved preference itself.
  if (needs.length === 0) return 1;
  let sum = 0;
  for (const n of needs) {
    const v = facts.amenities[n.id].value;
    sum += v === true ? 1 : 0;
  }
  return sum / needs.length;
}

/**
 * Driving can be judged from parking. Walking, biking, and transit cannot be
 * judged from the listing facts captured in Alpha v0.1, so they earn zero and
 * surface a watch-out rather than receiving neutral credit.
 */
export function transportFraction(facts: ListingFacts, prefs: Preferences): number {
  if (prefs.transportMode !== "car") return 0;
  const parking = facts.amenities.parking.value;
  return parking === true ? 1 : 0;
}

export function fitScore(facts: ListingFacts, prefs: Preferences): FitScoreResult {
  const fractions = {
    budget: budgetFraction(facts.rent.value, prefs.budget),
    rooms: roomsFraction(facts, prefs),
    lease: leaseFraction(facts, prefs),
    amenities: amenitiesFraction(facts, prefs),
    transport: transportFraction(facts, prefs),
  };

  const factors = {} as FitScoreResult["factors"];
  let sum = 0;
  for (const key of Object.keys(SCORE_WEIGHTS) as (keyof typeof SCORE_WEIGHTS)[]) {
    const max = SCORE_WEIGHTS[key];
    const points = max * fractions[key];
    factors[key] = { points, max, fraction: fractions[key] };
    sum += points;
  }
  const score = Math.max(0, Math.min(100, Math.round(sum)));

  const benefits: Insight[] = [];
  const watchOuts: Insight[] = [];

  const rent = facts.rent.value;
  if (rent === null) {
    watchOuts.push({ kind: "watch-out", factor: "budget", text: "Monthly rent is not listed, so budget fit cannot be confirmed." });
  } else if (rent <= prefs.budget) {
    benefits.push({
      kind: "benefit",
      factor: "budget",
      text: `Monthly rent (${money(rent)}) is within your ${money(prefs.budget)} budget.`,
    });
  } else {
    watchOuts.push({
      kind: "watch-out",
      factor: "budget",
      text: `Monthly rent (${money(rent)}) exceeds your ${money(prefs.budget)} budget.`,
    });
  }

  const beds = facts.bedrooms.value;
  if (beds === null) {
    watchOuts.push({ kind: "watch-out", factor: "rooms", text: "Bedroom count is not listed." });
  } else if (beds === prefs.preferredBedrooms) {
    benefits.push({
      kind: "benefit",
      factor: "rooms",
      text: `${bedroomLabel(beds)} matches your bedroom preference.`,
    });
  } else {
    watchOuts.push({
      kind: "watch-out",
      factor: "rooms",
      text: `Listed as ${bedroomLabel(beds).toLowerCase()}; you prefer ${bedroomLabel(prefs.preferredBedrooms).toLowerCase()}.`,
    });
  }

  const baths = facts.bathrooms.value;
  if (baths === null) {
    watchOuts.push({ kind: "watch-out", factor: "rooms", text: "Bathroom count is not listed." });
  } else if (baths === prefs.preferredBathrooms) {
    benefits.push({
      kind: "benefit",
      factor: "rooms",
      text: `${bathroomLabel(baths)} matches your bathroom preference.`,
    });
  } else {
    watchOuts.push({
      kind: "watch-out",
      factor: "rooms",
      text: `Listed as ${bathroomLabel(baths).toLowerCase()}; you prefer ${bathroomLabel(prefs.preferredBathrooms).toLowerCase()}.`,
    });
  }

  const lease = facts.leaseType.value;
  if (lease === null) {
    watchOuts.push({ kind: "watch-out", factor: "lease", text: "Lease length is not listed." });
  } else if (lease === prefs.leaseType) {
    benefits.push({ kind: "benefit", factor: "lease", text: `${LEASE_LABEL[lease]} lease matches your preferred term.` });
  } else if (LEASE_LABEL[lease]) {
    watchOuts.push({
      kind: "watch-out",
      factor: "lease",
      text: `Lease is ${LEASE_LABEL[lease]}; you prefer ${LEASE_LABEL[prefs.leaseType]!.toLowerCase()}.`,
    });
  } else {
    watchOuts.push({
      kind: "watch-out",
      factor: "lease",
      text: `Lease terms are listed as “${lease}”, but they cannot be compared to your ${LEASE_LABEL[prefs.leaseType]!.toLowerCase()} preference.`,
    });
  }

  for (const need of activeAmenityNeeds(prefs)) {
    const v = facts.amenities[need.id].value;
    const label = AMENITY_LABEL[need.id];
    if (v === true) {
      benefits.push({ kind: "benefit", factor: need.id, text: `${cap(label)} matches your preferences.` });
    } else if (v === false) {
      watchOuts.push({ kind: "watch-out", factor: need.id, text: `${cap(label)} is listed as not available.` });
    } else {
      watchOuts.push({ kind: "watch-out", factor: need.id, text: `${cap(label)} is not listed.` });
    }
  }

  if (prefs.transportMode === "car") {
    const parking = facts.amenities.parking.value;
    if (parking === true) {
      benefits.push({ kind: "benefit", factor: "transport", text: "Parking is available, which supports driving to campus." });
    } else if (parking === false) {
      watchOuts.push({ kind: "watch-out", factor: "transport", text: "Parking is listed as unavailable, which conflicts with driving to campus." });
    } else {
      watchOuts.push({ kind: "watch-out", factor: "transport", text: "Parking is not listed, so driving compatibility cannot be determined." });
    }
  } else {
    watchOuts.push({
      kind: "watch-out",
      factor: "transport",
      text: `Transportation compatibility for ${MODE_LABEL[prefs.transportMode].toLowerCase()} cannot be determined from available listing information.`,
    });
  }

  return { score, factors, benefits, watchOuts };
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function bedroomLabel(count: number) {
  return count === 0 ? "Studio" : `${count} bedroom${count === 1 ? "" : "s"}`;
}

function bathroomLabel(count: number) {
  return `${count} bathroom${count === 1 ? "" : "s"}`;
}

export function displayValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "Not listed";
  return String(value);
}
