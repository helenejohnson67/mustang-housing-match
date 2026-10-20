# Mustang Housing Match v0.1.0 Alpha Release Notes

**Release date:** October 19, 2026  
**Release type:** IME 4403 Sprint 2 alpha  
**Platform:** Chrome Extension, Manifest V3 side panel

## Purpose

Mustang Housing Match helps a Cal Poly student capture the facts from one off-campus rental listing and understand how that listing fits the student's stated priorities. Version 0.1.0 is intentionally small, local, and demoable without a backend, account, API key, or cloud deployment.

## Completed features

### Feature 1: Capture Rental Listing

- **User Story 1.1 - Detect a Supported Listing:** Detects individual Zillow, Apartments.com, and Craigslist listing pages when their supported URL patterns match. The Analyze screen clearly identifies supported pages. Unsupported sites, homepages, and search-results pages receive a helpful unsupported-page message and a disabled Analyze Listing action.
- **User Story 1.2 - Extract Listing Information:** The **Analyze Listing** action reads locally available listing data for property address, monthly rent, bedrooms, bathrooms, lease term, and listed amenities. Missing values display as **Not listed**. Extraction problems are shown as warnings or an error instead of fabricated data.
- **User Story 1.3 - Correct Extracted Information:** Address, rent, bedrooms, bathrooms, lease term, and every supported amenity are editable. **Save Changes** stores the latest corrected listing in `chrome.storage.local`, confirms the save, and makes corrections available to the score.

### Feature 2: Personalized Fit Score

- **User Story 2.1 - Enter Housing Preferences:** **My Preferences** saves a monthly budget, transportation mode, lease preference, bedroom and bathroom counts, and parking, laundry, pet, utility, and furnishing preferences locally. Reasonable defaults are clearly labeled and persist between sessions.
- **User Story 2.2 - Calculate a Fit Score:** A dedicated deterministic scoring module returns a consistent score from 0 to 100 using saved preferences and captured or corrected listing facts. Budget has the highest weight. Scores recalculate after preference updates and listing edits.
- **User Story 2.3 - View Benefits and Watch-Outs:** **Fit Score & Results** shows the address, key details, Fit Score, Benefits, and Watch-Outs derived from the actual saved facts and preferences. It identifies conflicts and unavailable information rather than claiming unlisted data is a match.

## Score design

The documented fixed weights are:

| Factor | Points |
| --- | ---: |
| Monthly budget | 40 |
| Bedrooms and bathrooms (8 + 7) | 15 |
| Lease term | 15 |
| Selected amenities | 25 |
| Transportation | 5 |

The weights total 100. The implementation is in `src/core/scoring.ts` and does not use AI, a remote service, random values, or demo-only outcomes.

## Installation

### Install the release ZIP

1. Extract `Mustang-Housing-Match-v0.1.zip`.
2. Open `chrome://extensions` in Chrome 116 or newer.
3. Enable **Developer mode**.
4. Select **Load unpacked**.
5. Select the extracted folder that directly contains `manifest.json`.
6. Select the Mustang Housing Match toolbar icon to open the side panel.

### Build from source

From the extension directory:

```powershell
npm install
npm run build
```

Then use **Load unpacked** and select `dist/`. The release archive must mirror `dist/` so its `manifest.json` is at the ZIP's top level.

## How to use

1. In **My Preferences**, enter and save the student's priorities.
2. Visit a supported individual listing and open **Analyze Listing**.
3. Confirm the supported status and select **Analyze Listing**.
4. Review the captured data. Complete or correct fields when necessary, then select **Save Changes**.
5. Open **Fit Score & Results** to view the score, Benefits, and Watch-Outs. Edit preferences or the listing to see the result recalculate.

## Known limitations

- Only the supported individual URL patterns for Zillow, Apartments.com, and Craigslist can be analyzed. Site homepages, search results, other rental sites, and changed/unusual layouts may not be recognized or fully captured.
- Capture depends on facts exposed by each live page. A missing or unparsable fact remains **Not listed** and should be checked with the landlord or property manager.
- Non-standard or range lease terms remain visible and editable, but are not treated as an exact match for the three alpha preference choices.
- The alpha saves one most recently saved listing and one preference profile locally in the current Chrome profile. It does not maintain a shared or multi-listing collection.
- No travel-time or distance service is used. For walking, biking, and public transit, the extension can report that transportation compatibility cannot be determined from the available listing facts. Driving compatibility is based on parking information.
- The Fit Score is a transparent comparison aid, not a guarantee of affordability, availability, lease eligibility, or housing quality.
- The app has no account, cloud sync, backend authentication, roommate matching, collaboration, referral, advanced comparison, or AI recommendation functionality in this alpha.

## Testing status

The repository includes automated unit tests and build/type-check scripts. Live Chrome testing against real rental pages is still required; no unchecked item in [`TESTING.md`](TESTING.md) should be treated as a passed test. Record the tester, Chrome version, date, listing URL, and result when executing the checklist.

## Planned future improvements

- Broaden and maintain the site readers as supported sites change their layouts.
- Support multiple locally saved listings and carefully designed comparison views.
- Consider opt-in roommate collaboration only after the core capture and score workflow is validated.
- Add additional accessibility, usability, and live-page regression testing based on pilot feedback.
