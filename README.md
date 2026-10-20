# Mustang Housing Match

Mustang Housing Match v0.1.0 is a locally installable Chrome extension alpha for Cal Poly San Luis Obispo students evaluating off-campus rental listings. It deliberately focuses on two Sprint 2 features:

- Capture an individual rental listing from Zillow, Apartments.com, or Craigslist, then correct and save the captured facts locally.
- Calculate a transparent, deterministic 0-100 Fit Score from the student's saved housing preferences.

The installable extension project is in [`mustang-housing-match/`](mustang-housing-match/). That directory contains the build output, release notes, and test checklist used for the alpha submission.

## Quick start

From this repository root:

```powershell
cd .\mustang-housing-match
npm install
npm run build
```

Load `mustang-housing-match/dist` in Chrome via `chrome://extensions` -> **Developer mode** -> **Load unpacked**. Chrome 116 or newer is required. The completed release archive is named `Mustang-Housing-Match-v0.1.zip`; unzip it and select the extracted folder containing `manifest.json`.

No backend, cloud deployment, API key, or account is needed for the alpha. Preferences and the most recently saved listing remain in `chrome.storage.local` in the user's Chrome profile.

## Alpha architecture and scope

The Manifest V3 extension opens a Preact side panel. It detects supported listing URLs, injects a local capture script only for those pages, saves corrections with Chrome local storage, and calculates the score in a standalone TypeScript module. It does not include roommate matching, sharing, saved-list collaboration, comparisons, travel exploration, authentication, cloud sync, or AI recommendations.

The score has fixed weights: budget 40 points; bedrooms and bathrooms 15 (8 and 7 respectively); lease 15; selected amenities 25; and transportation 5. The total is always 0-100. Missing facts are labeled **Not listed**, receive no inferred match credit, and are surfaced as Watch-Outs.

## Verification status

The project includes automated tests and build/type-check commands, but live Chrome verification against real listing pages is still required for this release. Use the detailed checklist before submission; it intentionally begins with unchecked items so it does not imply completed testing.

- [Extension README](mustang-housing-match/README.md)
- [Release notes](mustang-housing-match/RELEASE_NOTES.md)
- [Alpha testing checklist](mustang-housing-match/TESTING.md)
