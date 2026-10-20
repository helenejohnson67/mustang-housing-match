import type { Listing, Preferences } from "@/core/domain";
import { LEASE_LABEL, displayValue, type FitScoreResult } from "@/core/scoring";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Header } from "../components/Header";
import { Notice } from "../components/Notice";
import { ScoreRing } from "../components/ScoreRing";
import { Section } from "../components/Section";
import { SOURCE_LABEL } from "../state/match";

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const FACTOR_LABEL = {
  budget: "Budget",
  rooms: "Bedrooms & bathrooms",
  lease: "Lease",
  amenities: "Amenities",
  transport: "Transportation",
} as const;

function points(points: number): string {
  return Number.isInteger(points) ? String(points) : points.toFixed(1);
}

function bedsLabel(n: number | null): string {
  if (n === null) return "Not listed";
  if (n === 0) return "Studio";
  return String(n);
}

function leaseLabel(term: string | null): string {
  if (term === null) return "Not listed";
  return LEASE_LABEL[term] ?? term;
}

export function ResultsScreen({ listing, result, prefs, onEdit, onPreferences }: {
  listing: Listing | null;
  result: FitScoreResult | null;
  prefs: Preferences;
  onEdit: () => void;
  onPreferences: () => void;
}) {
  if (!listing || !result) {
    return (
      <div class="stack">
        <Header context="Fit Score & Results" title="No listing analyzed yet" lede="Open a supported rental listing, then use Analyze Listing." />
        <Card><p class="muted">Your Fit Score will appear here after a listing is captured.</p></Card>
      </div>
    );
  }

  const f = listing.facts;
  return (
    <div class="stack">
      <Header context="Fit Score & Results" title={listing.title} lede={`${SOURCE_LABEL[listing.source]} · 0–100 against your saved preferences`} />

      <Card tone="brand">
        <div class="scorecard__hero">
          <ScoreRing score={result.score} label="of 100" />
          <div>
            <div class="scorecard__band">Fit Score</div>
            <div class="scorecard__summary">{result.score} out of 100. Budget is weighted most heavily (40 of 100 points).</div>
          </div>
        </div>
      </Card>

      <Section title="Score breakdown" aside="Fixed 100-point scale" id="breakdown">
        <Card>
          <div class="lines">
            {(Object.keys(FACTOR_LABEL) as (keyof typeof FACTOR_LABEL)[]).map((key) => (
              <div class="line" key={key}>
                <span class="line__label">{FACTOR_LABEL[key]}</span>
                <span class="line__value">{points(result.factors[key].points)} / {result.factors[key].max}</span>
              </div>
            ))}
          </div>
          <p class="fine" style="margin-top:12px">Missing listing details earn no inferred points. Budget is worth 40 of 100 points.</p>
        </Card>
      </Section>

      <Section title="Key property details" id="details">
        <Card>
          <div class="lines">
            <div class="line"><span class="line__label">Address</span><span class="line__value">{displayValue(f.address.value)}</span></div>
            <div class="line"><span class="line__label">Monthly rent</span><span class="line__value">{f.rent.value === null ? "Not listed" : money(f.rent.value)}</span></div>
            <div class="line"><span class="line__label">Bedrooms</span><span class="line__value">{bedsLabel(f.bedrooms.value)}</span></div>
            <div class="line"><span class="line__label">Bathrooms</span><span class="line__value">{displayValue(f.bathrooms.value)}</span></div>
            <div class="line"><span class="line__label">Lease terms</span><span class="line__value">{leaseLabel(f.leaseType.value)}</span></div>
          </div>
          <p class="fine" style="margin-top:12px">Your budget: {money(prefs.budget)} / month.</p>
        </Card>
      </Section>

      <Section title="Benefits" id="benefits">
        <Card>
          {result.benefits.length === 0 ? (
            <p class="muted">No matching factors from the listed information.</p>
          ) : (
            <ul class="insights">
              {result.benefits.map((b) => (
                <li class="insight insight--benefit" key={b.text}><span class="insight__mark">✓</span><span>{b.text}</span></li>
              ))}
            </ul>
          )}
        </Card>
      </Section>

      <Section title="Watch-Outs" id="watchouts">
        <Card>
          {result.watchOuts.length === 0 ? (
            <p class="muted">No conflicts or missing facts for the factors we score.</p>
          ) : (
            <ul class="insights">
              {result.watchOuts.map((w) => (
                <li class="insight insight--watch" key={w.text}><span class="insight__mark">!</span><span>{w.text}</span></li>
              ))}
            </ul>
          )}
        </Card>
      </Section>

      <Notice tone="info">Confirm rent, lease terms, and amenities with the landlord before deciding.</Notice>

      <div class="actions">
        <Button variant="secondary" onClick={onEdit}>Edit listing</Button>
        <Button variant="ghost" onClick={onPreferences}>Edit preferences</Button>
      </div>
    </div>
  );
}
