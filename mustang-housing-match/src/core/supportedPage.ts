// Supported Page detection: which Source a URL belongs to, by the patterns in the sources decision (issue #8).

export type SourceKind = "home" | "building" | "listing";
export interface DetectedSource {
  source: "zillow" | "craigslist" | "apartments" | "redfin" | "facebook" | "california-west" | "farrell-smyth" | "rpm-central-coast";
  kind: SourceKind;
}
const FIXTURE_HOSTS = new Set(["localhost", "127.0.0.1"]);

/** Returns the Source and page kind for a Supported Page, or null for an Unsupported Page. */
export function detectSource(url: string): DetectedSource | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  const path = u.pathname;

  // Fixture pages for the e2e build: ?mhm-source=zillow&kind=home on localhost.
  if (FIXTURE_HOSTS.has(host)) {
    const source = u.searchParams.get("mhm-source");
    const kind = u.searchParams.get("kind");
    if (source === "zillow") return { source, kind: kind === "building" ? "building" : "home" };
    if (source === "craigslist" || source === "apartments") return { source, kind: "listing" };
    return null;
  }

  if (host === "zillow.com" || host.endsWith(".zillow.com")) {
    if (/^\/homedetails\/[^/]+\/\d+_zpid\/?$/.test(path)) return { source: "zillow", kind: "home" };
    if (/^\/apartments\/[^/]+\/[^/]+\/[A-Za-z0-9]+\/?$/.test(path)) return { source: "zillow", kind: "building" };
    return null;
  }
  if (host === "craigslist.org" || host.endsWith(".craigslist.org")) {
    if (/^\/view\/d\/[^/]+\/[A-Za-z0-9]+\/?$/.test(path)) return { source: "craigslist", kind: "listing" };
    // Classic URLs expose a category. Limit the recognized patterns to
    // apartment, room/share, and sublet listings instead of treating every
    // Craigslist detail page (jobs, sales, services, etc.) as rental housing.
    if (/^\/(?:apa|roo|sub)\/d\/[^/]+\/\d+\.html$/.test(path)) return { source: "craigslist", kind: "listing" };
    return null;
  }
  if (host === "apartments.com" || host.endsWith(".apartments.com")) {
    if (/^\/[a-z0-9-]+\/[a-z0-9]{7}\/?$/.test(path)) return { source: "apartments", kind: "listing" };
    return null;
  }
  if ((host === "redfin.com" || host.endsWith(".redfin.com")) && /\/[^/]+\/home\/\d+/.test(path)) return { source: "redfin", kind: "listing" };
  if ((host === "facebook.com" || host.endsWith(".facebook.com")) && path.includes("/marketplace/item/")) return { source: "facebook", kind: "listing" };
  // These providers vary their markup frequently. They are recognized so the panel can offer manual entry,
  // rather than claiming reliable automatic extraction.
  if (host.includes("californiawest")) return { source: "california-west", kind: "listing" };
  if (host.includes("farrellsmyth")) return { source: "farrell-smyth", kind: "listing" };
  if (host.includes("rpmcentralcoast")) return { source: "rpm-central-coast", kind: "listing" };
  return null;
}
