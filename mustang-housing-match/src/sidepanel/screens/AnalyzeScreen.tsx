import { AMENITIES, corrected, notListed, type AmenityId, type Fact, type ListingFacts } from "@/core/domain";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { ChoiceGroup } from "../components/ChoiceGroup";
import { Header } from "../components/Header";
import { Notice } from "../components/Notice";
import { ProvenanceTag } from "../components/ProvenanceTag";
import { Section } from "../components/Section";
import { CheckIcon } from "../components/icons";
import { SOURCE_LABEL, UNSUPPORTED_TEXT, type MatchState } from "../state/match";

const AMENITY_TEXT: Record<AmenityId, string> = {
  parking: "Parking", laundry: "Laundry", utilitiesIncluded: "Utilities included", pets: "Pets allowed", furnished: "Furnished",
};

function numberFact(raw: string, original: Fact<number>): Fact<number> {
  const t = raw.trim();
  if (t === "") return notListed();
  const n = Number(t.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n)) return original;
  return original.value === n && original.provenance !== "NotListed" ? original : corrected(n);
}

function FactField({ label, fact, onChange, inputMode = "decimal", prefix, id }: {
  label: string; fact: Fact<number>; onChange: (f: Fact<number>) => void; inputMode?: "decimal" | "numeric"; prefix?: string; id: string;
}) {
  return (
    <div class={`field ${fact.value === null ? "field--unlisted" : ""}`}>
      <label class="fact__label" for={id}><span>{label}</span><ProvenanceTag provenance={fact.provenance} /></label>
      <div class="field__control">
        <input
          id={id} inputMode={inputMode} placeholder="Not listed"
          value={fact.value === null ? "" : `${prefix ?? ""}${fact.value}`}
          onChange={(e) => onChange(numberFact((e.currentTarget as HTMLInputElement).value, fact))}
        />
      </div>
    </div>
  );
}

export function AnalyzeScreen({ state, onAnalyze, onEdit, onAmenity, onPlan, onSave }: {
  state: MatchState;
  onAnalyze: () => void;
  onEdit: <K extends keyof ListingFacts>(key: K, value: ListingFacts[K]) => void;
  onAmenity: (id: AmenityId, value: boolean | null) => void;
  onPlan: (id: string) => void;
  onSave: () => void;
}) {
  const { page, capture, review } = state;
  const busy = capture.status === "capturing";
  const supported = page.status === "supported";
  // A saved/captured listing remains available on the Results tab, but it must
  // never appear as data for whichever unrelated page the user visits next.
  const currentReview = review && supported && review.sourceUrl === page.url ? review : null;
  const f = currentReview?.facts;

  return (
    <div class="stack">
      <Header
        context="Analyze Listing"
        title={supported ? "This listing is supported" : "This page is not supported"}
        lede={supported ? "We only extract facts that appear on the page. Missing values stay Not listed." : undefined}
      />

      {supported && (
        <Card>
          <div class="row row--between">
            <span class="pagecard__source">{SOURCE_LABEL[page.detected.source]}</span>
            <span class="pagecard__status"><CheckIcon /> Supported listing</span>
          </div>
          <div class="pagecard__title">{page.title || page.url}</div>
          <div class="pagecard__url">{page.url}</div>
          <div class="actions" style="margin-top:16px">
            <Button onClick={onAnalyze} disabled={busy}>{busy ? "Reading the listing…" : "Analyze Listing"}</Button>
          </div>
        </Card>
      )}

      {!supported && (
        <Card>
          <p>{UNSUPPORTED_TEXT}</p>
          <div class="actions" style="margin-top:16px">
            <Button disabled>Analyze Listing</Button>
          </div>
        </Card>
      )}

      {capture.status === "error" && <Notice tone="danger" title="Couldn't read this page" role="alert">{capture.message}</Notice>}

      {currentReview && f && (
        <>
          <Section title="Captured information" aside="Editable" id="facts">
            {currentReview.floorPlans.length > 1 && (
              <div class="plans" role="radiogroup" aria-label="Floor plan" style="margin-bottom:12px">
                {currentReview.floorPlans.map((p) => (
                  <button type="button" role="radio" aria-checked={currentReview.floorPlanId === p.id} class="plan" key={p.id} onClick={() => onPlan(p.id)}>
                    <span class="plan__name">{p.name}</span>
                    {currentReview.floorPlanId === p.id && <span class="small">Selected</span>}
                  </button>
                ))}
              </div>
            )}
            <Card class="stack stack--tight">
              <div class={`field ${!f.address.value?.trim() ? "field--unlisted" : ""}`}>
                <label class="fact__label" for="f-address"><span>Property address</span><ProvenanceTag provenance={f.address.provenance} /></label>
                <div class="field__control">
                  <input id="f-address" value={f.address.value ?? ""} placeholder="Not listed"
                    onChange={(e) => {
                      const v = (e.currentTarget as HTMLInputElement).value.trim();
                      onEdit("address", v ? (v === f.address.value ? f.address : corrected(v)) : notListed());
                    }} />
                </div>
              </div>
              <FactField id="f-rent" label="Monthly rent" fact={f.rent} onChange={(fact) => onEdit("rent", fact)} prefix="$" />
              <div class="factgrid">
                <FactField id="f-beds" label="Bedrooms" fact={f.bedrooms} onChange={(fact) => onEdit("bedrooms", fact)} inputMode="numeric" />
                <FactField id="f-baths" label="Bathrooms" fact={f.bathrooms} onChange={(fact) => onEdit("bathrooms", fact)} />
              </div>
              <div class={`field ${f.leaseType.value === null ? "field--unlisted" : ""}`}>
                <label class="fact__label" for="f-lease"><span>Lease length or terms</span><ProvenanceTag provenance={f.leaseType.provenance} /></label>
                <div class="field__control">
                  <input id="f-lease" value={f.leaseType.value ?? ""} placeholder="Not listed" onChange={(e) => {
                    const v = (e.currentTarget as HTMLInputElement).value.trim();
                    onEdit("leaseType", v ? (v === f.leaseType.value ? f.leaseType : corrected(v)) : notListed());
                  }} />
                </div>
                <p class="field__hint">Common terms are scored when they match school-year, 12-month, or month-to-month.</p>
              </div>
            </Card>
          </Section>

          <Section title="Listed amenities" aside="Yes, no, or not listed" id="amenities">
            <Card>
              <div class="amenity-grid">
                {AMENITIES.map((a) => (
                  <div class="amenity" key={a}>
                    <span class="amenity__name">{AMENITY_TEXT[a]} {f.amenities[a].provenance === "Corrected" && <ProvenanceTag provenance="Corrected" />}</span>
                    <ChoiceGroup<"yes" | "no" | "nl">
                      label={AMENITY_TEXT[a]} hideLabel compact
                      value={f.amenities[a].value === true ? "yes" : f.amenities[a].value === false ? "no" : "nl"}
                      onChange={(v) => onAmenity(a, v === "yes" ? true : v === "no" ? false : null)}
                      choices={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }, { value: "nl", label: "Not listed" }]}
                    />
                  </div>
                ))}
              </div>
            </Card>
          </Section>

          {currentReview.warnings.length > 0 && <p class="fine">{currentReview.warnings.join(" ")}</p>}
          {state.listingSaved && <Notice tone="success" role="status">Changes saved. Fit Score uses these values.</Notice>}
          <div class="actions">
            <Button onClick={onSave}>Save Changes</Button>
          </div>
        </>
      )}
    </div>
  );
}
