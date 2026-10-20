# Mustang Housing Match

Mustang Housing Match is a Manifest V3 Chrome side-panel extension for Cal Poly San Luis Obispo students comparing an off-campus rental listing with their own housing priorities. This repository is the focused **Alpha Release v0.1.0** for IME 4403. It is not affiliated with Cal Poly, Zillow, Apartments.com, or Craigslist.

The alpha has exactly two features:

1. **Capture Rental Listing** - detect a supported individual listing, capture its stated facts, let the student correct every captured field, and save the corrected listing locally.
2. **Personalized Fit Score** - save housing preferences and receive a deterministic 0-100 score with Benefits and Watch-Outs based on the captured or corrected facts.

Everything else is deliberately out of scope for v0.1.0: roommate matching and collaboration, shared lists, referral systems, advanced comparisons, neighborhood or travel exploration, dashboards, cloud synchronization, backend authentication, API integrations, and AI recommendations.

## Requirements

- Google Chrome 116 or newer.
- Node.js and npm for development builds only.
- No API keys, backend, cloud account, or sign-in for core alpha behavior.

The extension uses `chrome.storage.local`. Preferences and the most recently saved listing remain in the current Chrome profile; they are not synchronized to a server.

## Build

Run these commands from this directory:

```powershell
npm install
npm run typecheck
npm test
npm run build
```

`npm run build` writes a directly loadable unpacked extension to `dist/`. The build includes the side panel, Manifest V3 service worker, local capture script, icons, and `manifest.json` at the top level of `dist/`.

Use `npm run check` to run the type check, unit tests, and build in sequence.

## Install in Chrome

### From the built folder

1. Run `npm run build`.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Select **Load unpacked**.
5. Select this project's `dist/` directory, which directly contains `manifest.json`.
6. Click the Mustang Housing Match toolbar icon to open the side panel.

### From the alpha ZIP

1. Extract `Mustang-Housing-Match-v0.1.zip`.
2. In `chrome://extensions`, enable **Developer mode** and select **Load unpacked**.
3. Select the extracted folder that directly contains `manifest.json` (not a parent folder containing another `dist/` folder).

The ZIP is an installation artifact only; it is intentionally ignored by Git. Its contents should mirror `dist/`, with `manifest.json` at the archive root.

## Use the alpha

1. Open **My Preferences** in the side panel. Set the monthly budget, transportation preference, preferred lease length, bedroom and bathroom counts, and parking, laundry, pet, utility, and furnishing preferences. Clearly labeled defaults are provided: $1,500/month, biking, a school-year lease, 2 bedrooms, 1 bathroom, and parking, laundry, and utilities included selected. Select **Save Preferences**.
2. Visit an individual rental listing on Zillow, Apartments.com, or Craigslist and open **Analyze Listing**. Homepages, search results, and unsupported sites are explicitly identified as unsupported and cannot be analyzed.
3. Select **Analyze Listing**. The extension captures only information stated on the page: address, monthly rent, bedrooms, bathrooms, lease term, and the supported amenities. A field that cannot be found displays **Not listed**.
4. Review the editable fields and amenity controls. Correct a value or add a missing value when needed, then select **Save Changes**. The Fit Score immediately uses edits; saving keeps the latest listing locally for the next side-panel session.
5. Open **Fit Score & Results** to view the address, key details, the 0-100 score, Benefits, and Watch-Outs. Use **Edit listing** or **Edit preferences** to update the inputs; the score recalculates from the new values.

Always confirm rent, lease terms, and amenities with the landlord or property manager before making a housing decision.

## Supported pages and capture behavior

The alpha recognizes individual listing URL patterns for:

- Zillow home and apartment-building listings.
- Apartments.com property-detail listings.
- Craigslist housing listing pages.

The capture readers use site-specific page data and visible structured information. Layout changes, unavailable facts, or unusual listings can leave a value as **Not listed** or display a capture warning. The extension does not invent missing facts. Each captured field and each amenity can be corrected in the side panel, and corrected values are what scoring uses.

## Fit Score

The score lives in [`src/core/scoring.ts`](src/core/scoring.ts), so it is readable and testable without the browser UI. It is a deterministic weighted calculation: the same listing facts and saved preferences always return the same score.

| Factor | Weight | What is evaluated |
| --- | ---: | --- |
| Monthly budget | 40 | Listed or corrected monthly rent compared with the saved budget. This is the most important factor. |
| Bedrooms and bathrooms | 15 | Bedroom count (8 points) and bathroom count (7 points) compared with the student's saved counts. |
| Lease term | 15 | The listed or corrected term is shown as written; exact school-year, 12-month, or month-to-month terms can be compared with the preference. |
| Amenities | 25 | The preference-selected parking, laundry, pet, utilities-included, and furnishing needs. |
| Transportation | 5 | Parking compatibility when driving is selected; other modes are marked indeterminate when listing data cannot establish compatibility. |

The weights total 100. Each factor generates concise explanations from real listing facts and preferences:

- **Benefits** describe a confirmed match, such as rent within budget or parking available for a driver.
- **Watch-Outs** identify a conflict, an unavailable requested amenity, or missing information. Missing facts never appear as a confirmed Benefit.

The scoring module handles unknown data transparently. A missing or unavailable fact earns zero for its relevant sub-factor and is still called out in a Watch-Out; it does not receive inferred or neutral match credit. A value one room away from the preferred bedroom or bathroom count receives partial credit, because that is an explicit listed value rather than missing data.

## Architecture

```text
public/manifest.json          Manifest V3 configuration and supported-site permissions
src/background/               Service worker that opens the side panel
src/sidepanel/                Preact app with Preferences, Analyze, and Results screens
src/capture/readers/          Local Zillow, Apartments.com, and Craigslist extraction readers
src/core/supportedPage.ts     Individual-listing URL detection
src/core/domain.ts            Shared listing and preference types plus defaults
src/core/scoring.ts           Deterministic score, Benefits, and Watch-Outs
src/sidepanel/state/match.ts  Local workflow, persistence, and recalculation control
src/chrome/                   Narrow wrappers around Chrome tabs, storage, and scripting APIs
```

The side panel reads the active tab only after it is identified as a supported individual listing. The capture code is bundled into the extension and runs locally in that tab. The app writes only to `chrome.storage.local`; v0.1.0 has no backend or external service dependency.

## Testing and release verification

Automated unit tests cover the scoring, supported-page detection, capture-reader behavior, and side-panel state. Run the commands in [Build](#build) to execute them. A passing local build does not prove that live listing pages work, because those sites can change their page layouts.

Live Chrome validation for this alpha is still required and has not been recorded as complete in this document. Follow [`TESTING.md`](TESTING.md) before submitting the release. It contains the six required acceptance tests, test-environment fields, and checks for persistence, recalculation, and the installation ZIP.

## Release documents

- [`RELEASE_NOTES.md`](RELEASE_NOTES.md) - scope, user stories, installation, limitations, and future work for v0.1.0.
- [`TESTING.md`](TESTING.md) - manual and automated verification checklist.
- [`docs/checklists/README.md`](docs/checklists/README.md) - pointer to the current alpha checklist.
