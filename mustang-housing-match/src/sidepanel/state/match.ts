import {
  DEFAULT_BUDGET, DEFAULT_PREFERENCES, corrected, emptyFacts, type Fact, type FloorPlan, type Listing, type ListingFacts,
  type Preferences, type SourceId,
} from "@/core/domain";
import { fitScore, type FitScoreResult } from "@/core/scoring";
import { isDuplicate, listingIdentity } from "@/core/address";
import { detectSource, type DetectedSource } from "@/core/supportedPage";
import type { RawCapture } from "@/capture/readers/types";
import { KEYS, type Services } from "../services";
import { createStore, type Store } from "./store";

export type Screen = "home" | "preferences" | "saved" | "compare" | "help" | "analyze" | "results";

export type PageState =
  | { status: "unknown" }
  | { status: "supported"; tabId: number; url: string; title: string; detected: DetectedSource }
  | { status: "unsupported"; tabId: number | null; url: string | null; title: string };

export interface ReviewDraft {
  source: SourceId;
  sourceUrl: string | null;
  title: string;
  facts: ListingFacts;
  floorPlans: FloorPlan[];
  floorPlanId: string | null;
  warnings: string[];
  captured: ListingFacts;
}
export interface MatchState {
  loaded: boolean;
  prefs: Preferences;
  screen: Screen;
  page: PageState;
  capture: { status: "idle" } | { status: "capturing" } | { status: "error"; message: string };
  review: ReviewDraft | null;
  listing: Listing | null;
  scorecard: FitScoreResult | null;
  prefsSaved: boolean;
  listingSaved: boolean;
  listings: Listing[];
  selectedIds: string[];
  onboardingComplete: boolean;
  notice: string | null;
}

export const initialMatchState: MatchState = {
  loaded: false,
  prefs: DEFAULT_PREFERENCES,
  screen: "home",
  page: { status: "unknown" },
  capture: { status: "idle" },
  review: null,
  listing: null,
  scorecard: null,
  prefsSaved: false,
  listingSaved: false,
  listings: [], selectedIds: [], onboardingComplete: false, notice: null,
};

export const SOURCE_LABEL: Record<SourceId, string> = {
  zillow: "Zillow", craigslist: "Craigslist", apartments: "Apartments.com", redfin: "Redfin", facebook: "Facebook Marketplace", "california-west": "California-West", "farrell-smyth": "Farrell Smyth", "rpm-central-coast": "RPM Central Coast", manual: "Manual entry",
};

export const UNSUPPORTED_TEXT =
  "This page is not a supported rental listing, so it cannot be analyzed. Open an individual listing on Zillow, Apartments.com, or Craigslist — not a homepage or search-results page.";

function applyFloorPlan(base: ListingFacts, plan: FloorPlan | undefined): ListingFacts {
  if (!plan) return base;
  return { ...base, ...plan.facts } as ListingFacts;
}

function mergePrefs(stored: Partial<Preferences> | undefined): Preferences {
  if (!stored) return DEFAULT_PREFERENCES;
  const budget = typeof stored.budget === "number" && stored.budget > 0 ? stored.budget : DEFAULT_BUDGET;
  const preferredBedrooms = typeof stored.preferredBedrooms === "number" && stored.preferredBedrooms >= 0 && stored.preferredBedrooms <= 8
    ? stored.preferredBedrooms
    : DEFAULT_PREFERENCES.preferredBedrooms;
  const preferredBathrooms = typeof stored.preferredBathrooms === "number" && stored.preferredBathrooms > 0 && stored.preferredBathrooms <= 8
    ? stored.preferredBathrooms
    : DEFAULT_PREFERENCES.preferredBathrooms;
  return { ...DEFAULT_PREFERENCES, ...stored, priorities: { ...DEFAULT_PREFERENCES.priorities, ...stored.priorities }, budget, preferredBedrooms, preferredBathrooms };
}

export class MatchController {
  readonly store: Store<MatchState>;
  private stopTabs: (() => void) | undefined;

  constructor(private readonly services: Services, store?: Store<MatchState>) {
    this.store = store ?? createStore(initialMatchState);
  }

  private patch(p: Partial<MatchState>) {
    this.store.set((s) => ({ ...s, ...p }));
  }

  get state() {
    return this.store.get();
  }

  async init(): Promise<void> {
    const [prefs, listing, listings, onboardingComplete] = await Promise.all([
      this.services.local.get<Preferences>(KEYS.preferences),
      this.services.local.get<Listing>(KEYS.lastListing),
      this.services.local.get<Listing[]>(KEYS.listings),
      this.services.local.get<boolean>(KEYS.onboardingComplete),
    ]);
    this.patch({
      loaded: true,
      prefs: mergePrefs(prefs),
      listing: listing ?? null,
      review: listing ? {
        source: listing.source,
        sourceUrl: listing.sourceUrl,
        title: listing.title,
        facts: listing.facts,
        floorPlans: [],
        floorPlanId: listing.floorPlanId,
        warnings: [],
        captured: listing.facts,
      } : null,
      listings: listings ?? (listing ? [listing] : []), onboardingComplete: onboardingComplete === true,
    });
    this.recompute();
    await this.refreshPage();
    this.stopTabs = this.services.tabs.onChange(() => { void this.refreshPage(); });
  }

  dispose() {
    this.stopTabs?.();
  }

  go(screen: Screen) {
    this.patch({ screen, prefsSaved: false, listingSaved: false });
  }

  async completeOnboarding(screen: Screen = "preferences") { await this.services.local.set(KEYS.onboardingComplete, true); this.patch({ onboardingComplete: true, screen }); }
  async reopenOnboarding() { await this.services.local.remove(KEYS.onboardingComplete); this.patch({ onboardingComplete: false }); }
  toggleCompare(id: string) {
    const selectedIds = this.state.selectedIds.includes(id) ? this.state.selectedIds.filter((x) => x !== id) : this.state.selectedIds.length < 4 ? [...this.state.selectedIds, id] : this.state.selectedIds;
    this.patch({ selectedIds, notice: selectedIds.length >= 2 ? null : "Select 2–4 properties to compare." });
  }
  openListing(listing: Listing) { this.patch({ listing, review: { source: listing.source, sourceUrl: listing.sourceUrl, title: listing.title, facts: listing.facts, floorPlans: [], floorPlanId: listing.floorPlanId, warnings: [], captured: listing.facts }, screen: "results" }); this.recompute(); }
  async deleteListing(id: string) { const listings = this.state.listings.filter((l) => l.id !== id); await this.services.local.set(KEYS.listings, listings); this.patch({ listings, selectedIds: this.state.selectedIds.filter((x) => x !== id) }); }
  addManualListing() {
    const facts = emptyFacts();
    const listing = this.toListing({ source: "manual", sourceUrl: null, title: "New property", facts, floorPlanId: null });
    this.patch({ listing, review: { source: "manual", sourceUrl: null, title: "New property", facts, floorPlans: [], floorPlanId: null, warnings: [], captured: facts }, screen: "analyze", listingSaved: false });
    this.recompute();
  }

  async savePreferences(prefs: Preferences) {
    await this.services.local.set(KEYS.preferences, prefs);
    this.patch({ prefs, prefsSaved: true });
    this.recompute();
  }

  async refreshPage() {
    try {
      const tab = await this.services.tabs.listingTab();
      if (!tab || !tab.url) {
        this.patch({ page: { status: "unsupported", tabId: tab?.id ?? null, url: null, title: tab?.title ?? "" } });
        return;
      }
      const detected = detectSource(tab.url);
      if (detected) this.patch({ page: { status: "supported", tabId: tab.id, url: tab.url, title: tab.title ?? "", detected } });
      else this.patch({ page: { status: "unsupported", tabId: tab.id, url: tab.url, title: tab.title ?? "" } });
    } catch {
      // Chrome does not expose URLs for all tabs (for example chrome:// pages).
      // Treat an unavailable tab as unsupported rather than leaving the panel stale.
      this.patch({ page: { status: "unsupported", tabId: null, url: null, title: "" } });
    }
  }

  async analyze() {
    // The user may have changed tabs between the status update and this click.
    // Refresh immediately so a capture is never injected into an old tab.
    await this.refreshPage();
    const page = this.state.page;
    if (page.status !== "supported") return;
    this.patch({ capture: { status: "capturing" }, listingSaved: false });
    let raw: RawCapture;
    try {
      raw = await this.services.capture(page.tabId);
    } catch (e) {
      this.patch({ capture: { status: "error", message: e instanceof Error ? e.message : "Capture failed" } });
      return;
    }
    if (raw.source === "unsupported" || !raw.facts) {
      this.patch({ capture: { status: "error", message: raw.warnings[0] ?? "Nothing could be read from this page." } });
      return;
    }
    const floorPlans = raw.floorPlans ?? [];
    const first = floorPlans[0];
    const facts = floorPlans.length > 1 ? applyFloorPlan(raw.facts, first) : raw.facts;
    const listing = this.toListing({
      source: raw.source,
      sourceUrl: raw.url,
      title: raw.title,
      facts,
      floorPlanId: floorPlans.length > 1 && first ? first.id : null,
    });
    this.patch({
      capture: { status: "idle" },
      review: {
        source: raw.source, sourceUrl: raw.url, title: raw.title, facts, captured: raw.facts,
        floorPlans, floorPlanId: listing.floorPlanId, warnings: raw.warnings,
      },
      listing,
    });
    this.recompute();
  }

  editFact<K extends keyof ListingFacts>(key: K, value: ListingFacts[K]) {
    const review = this.state.review;
    if (!review) return;
    const facts = { ...review.facts, [key]: value };
    this.patch({ review: { ...review, facts }, listingSaved: false });
    this.applyFacts(facts);
  }

  editAmenity(id: keyof ListingFacts["amenities"], value: boolean | null) {
    const review = this.state.review;
    if (!review) return;
    const fact: Fact<boolean> = value === null ? { value: null, provenance: "NotListed" } : corrected(value);
    const facts = { ...review.facts, amenities: { ...review.facts.amenities, [id]: fact } };
    this.patch({ review: { ...review, facts }, listingSaved: false });
    this.applyFacts(facts);
  }

  pickFloorPlan(floorPlanId: string) {
    const review = this.state.review;
    if (!review) return;
    const plan = review.floorPlans.find((p) => p.id === floorPlanId);
    // Apply a newly chosen plan over the current draft so edits to address,
    // amenities, and other shared facts are not lost while the user compares plans.
    const facts = applyFloorPlan(review.facts, plan);
    this.patch({ review: { ...review, floorPlanId, facts }, listingSaved: false });
    this.applyFacts(facts, floorPlanId);
  }

  async saveListingChanges(): Promise<void> {
    const listing = this.state.listing;
    if (!listing) return;
    const existing = this.state.listings.find((l) => l.id !== listing.id && isDuplicate(l, listing));
    if (existing) { this.patch({ listing: existing, listingSaved: false, notice: "This property is already saved. Opened the existing listing so your corrections are preserved." }); this.recompute(); return; }
    const listings = [...this.state.listings.filter((l) => l.id !== listing.id), listing];
    await this.services.local.set(KEYS.listings, listings);
    await this.services.local.set(KEYS.lastListing, listing);
    this.patch({ listings, listingSaved: true, notice: null });
    this.recompute();
  }

  private applyFacts(facts: ListingFacts, floorPlanId?: string | null) {
    const review = this.state.review;
    if (!review) return;
    const listing = this.toListing({
      source: review.source,
      sourceUrl: review.sourceUrl,
      title: review.title,
      facts,
      floorPlanId: floorPlanId === undefined ? review.floorPlanId : floorPlanId,
    });
    this.patch({ listing });
    this.recompute();
  }

  private toListing(input: { source: SourceId; sourceUrl: string | null; title: string; facts: ListingFacts; floorPlanId: string | null }): Listing {
    const address = input.facts.address.value?.trim() ?? "";
    return {
      id: listingIdentity({ source: input.source, sourceUrl: input.sourceUrl, floorPlanId: input.floorPlanId, address: address || null }),
      source: input.source,
      sourceUrl: input.sourceUrl,
      floorPlanId: input.floorPlanId,
      title: address || input.title,
      facts: input.facts,
      capturedAt: this.services.now().toISOString(),
    };
  }

  recompute() {
    const { listing, prefs } = this.state;
    if (!listing) {
      this.patch({ scorecard: null });
      return;
    }
    this.patch({ scorecard: fitScore(listing.facts, prefs) });
  }
}
