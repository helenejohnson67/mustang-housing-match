# Mustang Housing Match v0.1.0 Alpha Testing Checklist

**Status:** Manual Chrome verification is required. This checklist starts unchecked and does not claim that a build, test, or live-page check has passed.

## Test-run record

Complete this once for each test run:

| Field | Record |
| --- | --- |
| Tester | |
| Date and time | |
| Chrome version | |
| Operating system | |
| Extension version / commit | |
| Build source (`dist` or ZIP) | |
| Zillow test URL | |
| Apartments.com test URL | |
| Craigslist test URL | |

Use an individual, publicly viewable rental listing for each supported source. Do not put account credentials, application information, or other private renter data in this file.

## Preflight and install

- [ ] Run `npm install` from the extension directory without an unresolved dependency error.
- [ ] Run `npm run typecheck` and record the result.
- [ ] Run `npm test` and record the result.
- [ ] Run `npm run build` and confirm `dist/manifest.json` exists.
- [ ] In Chrome 116 or newer, open `chrome://extensions`, enable **Developer mode**, select **Load unpacked**, and choose `dist/`.
- [ ] Confirm the extension loads without a manifest error and its toolbar icon opens a side panel.
- [ ] If testing the deliverable archive, extract `Mustang-Housing-Match-v0.1.zip`, load the folder containing its top-level `manifest.json`, and confirm it loads independently of npm.

## Test A - Supported Website Detection (User Story 1.1)

Repeat the supported-page checks for each source where a live listing is available.

- [ ] Visit an individual Zillow listing and open **Analyze Listing**. Confirm the source and **Supported listing** status appear.
- [ ] Visit an individual Apartments.com listing and repeat the supported-status check.
- [ ] Visit an individual Craigslist housing listing and repeat the supported-status check.
- [ ] Visit a Zillow, Apartments.com, or Craigslist homepage or search-results page. Confirm the panel says it is not a supported rental listing.
- [ ] Visit an unrelated site. Confirm the same helpful unsupported-page message appears.
- [ ] Confirm the unsupported state disables **Analyze Listing**, shows no stale listing facts as newly extracted data, and does not crash.

**Result / notes:**

## Test B - Listing Extraction (User Story 1.2)

For each available supported source:

- [ ] Open an individual listing and select **Analyze Listing**.
- [ ] Compare the displayed property address, monthly rent, bedrooms, bathrooms, lease term, and amenities with the actual page.
- [ ] Confirm that a factual value that is absent from the source page displays as **Not listed**, not an invented value.
- [ ] Confirm that a changed or unusual layout produces a readable warning or error rather than a crash.
- [ ] Confirm the captured information is presented in the editable results panel.

**Result / notes:**

## Test C - Correct Information (User Story 1.3)

- [ ] Analyze a supported listing.
- [ ] Intentionally change at least one captured field, such as monthly rent or an amenity, to a known test value.
- [ ] Select **Save Changes** and confirm the success message appears.
- [ ] Close and reopen the side panel without clearing extension storage.
- [ ] Confirm the corrected value persists and is shown as the saved listing value.
- [ ] Confirm the Fit Score, Benefits, or Watch-Outs change to use the corrected value rather than the original capture.

**Result / notes:**

## Test D - Housing Preferences (User Story 2.1)

- [ ] Open **My Preferences** without first analyzing a listing.
- [ ] Confirm the form includes budget, transportation, lease, bedroom and bathroom counts, parking, laundry, pet, utility, and furnishing controls.
- [ ] Enter a budget and several non-default preferences, then select **Save Preferences**.
- [ ] Confirm the save confirmation appears.
- [ ] Close and reopen the side panel without clearing extension storage.
- [ ] Confirm the saved preferences persist.
- [ ] Enter an invalid budget and confirm the form gives a clear validation message instead of saving it.

**Result / notes:**

## Test E - Fit Score (User Story 2.2)

- [ ] With saved preferences and an analyzed listing, open **Fit Score & Results**.
- [ ] Confirm the Fit Score is an integer from 0 to 100.
- [ ] Verify the displayed score agrees with the published fixed weights: budget 40, bedrooms/bathrooms 15 (8 + 7), lease 15, amenities 25, transportation 5.
- [ ] Change the budget to a meaningfully lower or higher value, save preferences, and confirm the Fit Score recalculates in the expected direction when rent is known.
- [ ] Change a listing field or amenity, save the listing, and confirm the Fit Score recalculates.
- [ ] Reopen the Results screen or run the calculation again without changing inputs. Confirm the score remains identical.
- [ ] Confirm an unlisted rent, lease, or amenity is not displayed as a confirmed match.

**Result / notes:**

## Test F - Benefits and Watch-Outs (User Story 2.3)

- [ ] Confirm each listed Benefit is tied to an actual captured or corrected listing fact and a saved preference.
- [ ] Confirm rent within budget appears as a Benefit only when the saved budget supports it; confirm over-budget rent appears as a Watch-Out.
- [ ] Confirm requested amenities that are unavailable or **Not listed** appear as Watch-Outs instead of invented Benefits.
- [ ] Confirm missing lease, room, bathroom, or transportation information is identified transparently when relevant.
- [ ] Edit an amenity, rent, or lease field and confirm the related Benefits and Watch-Outs update.
- [ ] Confirm no explanation claims a commute time, property quality, policy, or amenity that is absent from the listing facts.

**Result / notes:**

## Completion summary

| Area | Pass / fail / blocked | Evidence or issue link |
| --- | --- | --- |
| Build and unpacked installation | | |
| Test A - Detection | | |
| Test B - Extraction | | |
| Test C - Corrections | | |
| Test D - Preferences | | |
| Test E - Fit Score | | |
| Test F - Benefits and Watch-Outs | | |
| ZIP installation | | |

Do not describe the alpha as fully verified until the relevant checkboxes and summary have been completed with real evidence.
