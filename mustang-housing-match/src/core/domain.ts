// Domain types shared by capture, scoring, and the side panel. Vocabulary follows CONTEXT.md.

export type Provenance = "Listed" | "NotListed" | "Corrected";

/** A Listing Fact: a value plus where it came from. NotListed facts carry value null and are never guessed. */
export interface Fact<T> {
  value: T | null;
  provenance: Provenance;
}
export const notListed = <T>(): Fact<T> => ({ value: null, provenance: "NotListed" });
export const listed = <T>(value: T): Fact<T> => ({ value, provenance: "Listed" });
export const corrected = <T>(value: T): Fact<T> => ({ value, provenance: "Corrected" });

export type SourceId = "zillow" | "craigslist" | "apartments" | "redfin" | "facebook" | "california-west" | "farrell-smyth" | "rpm-central-coast" | "manual";
export type Priority = "must" | "nice" | "none";
export type PriorityKey = "budget" | "rooms" | "parking" | "laundry" | "lease" | "pets" | "utilities" | "furnished" | "transport";
/** Canonical preference terms used for matching a listing. */
export type LeaseType = "school-year" | "month-to-month" | "12-month";
/**
 * The advertised lease text. Readers keep a non-standard term (for example,
 * "6–12 months") instead of falsely turning it into one of the canonical
 * preference terms.
 */
export type LeaseTerm = string;
export type AmenityId = "parking" | "laundry" | "utilitiesIncluded" | "pets" | "furnished";
export const AMENITIES: AmenityId[] = ["parking", "laundry", "utilitiesIncluded", "pets", "furnished"];
export type RentBasis = "per-unit" | "per-person";

export interface ListingFacts {
  address: Fact<string>;
  /** Monthly rent in dollars, as advertised. */
  rent: Fact<number>;
  rentBasis: RentBasis;
  bedrooms: Fact<number>;
  bathrooms: Fact<number>;
  /** Raw lease length or terms as the listing states them. */
  leaseType: Fact<LeaseTerm>;
  amenities: Record<AmenityId, Fact<boolean>>;
  deposit: Fact<number>;
  applicationFee: Fact<number>;
  parkingFee: Fact<number>;
  otherMonthlyFees: Fact<number>;
}

export function emptyFacts(): ListingFacts {
  return {
    address: notListed(),
    rent: notListed(),
    rentBasis: "per-unit",
    bedrooms: notListed(),
    bathrooms: notListed(),
    leaseType: notListed(),
    amenities: { parking: notListed(), laundry: notListed(), utilitiesIncluded: notListed(), pets: notListed(), furnished: notListed() },
    deposit: notListed(),
    applicationFee: notListed(),
    parkingFee: notListed(),
    otherMonthlyFees: notListed(),
  };
}

export interface FloorPlan {
  id: string;
  name: string;
  facts: Partial<Pick<ListingFacts, "rent" | "bedrooms" | "bathrooms" | "deposit" | "leaseType">>;
}

export interface Listing {
  id: string;
  source: SourceId;
  sourceUrl: string | null;
  floorPlanId: string | null;
  title: string;
  facts: ListingFacts;
  /** ISO 8601 */
  capturedAt: string;
}

export type TransportMode = "walk" | "bike" | "bus" | "car";
export const TRANSPORT_MODES: TransportMode[] = ["walk", "bike", "bus", "car"];

export interface Preferences {
  /** Maximum monthly rent the student will pay, in dollars. */
  budget: number;
  transportMode: TransportMode;
  leaseType: LeaseType;
  /** Desired bedroom count. Studio is 0. */
  preferredBedrooms: number;
  /** Desired bathroom count. Half-bath increments such as 1.5 are allowed. */
  preferredBathrooms: number;
  parkingRequired: boolean;
  laundryRequired: boolean;
  petsAllowedRequired: boolean;
  utilitiesIncludedPreferred: boolean;
  furnishedPreferred: boolean;
  /** Simple importance choices. Missing older saved values are migrated to sensible defaults. */
  priorities: Record<PriorityKey, Priority>;
}

export const DEFAULT_BUDGET = 1500;

export const DEFAULT_PREFERENCES: Preferences = {
  budget: DEFAULT_BUDGET,
  transportMode: "bike",
  leaseType: "school-year",
  preferredBedrooms: 2,
  preferredBathrooms: 1,
  parkingRequired: true,
  laundryRequired: true,
  petsAllowedRequired: false,
  utilitiesIncludedPreferred: true,
  furnishedPreferred: false,
  priorities: { budget: "must", rooms: "nice", parking: "must", laundry: "must", lease: "nice", pets: "none", utilities: "nice", furnished: "none", transport: "none" },
};
