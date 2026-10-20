import { useState } from "preact/hooks";
import { DEFAULT_BUDGET, type LeaseType, type Preferences, type TransportMode } from "@/core/domain";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Checkbox } from "../components/Checkbox";
import { ChoiceGroup } from "../components/ChoiceGroup";
import { Field } from "../components/Field";
import { Header } from "../components/Header";
import { Notice } from "../components/Notice";
import { WalkIcon, BikeIcon, BusIcon, CarIcon } from "../components/icons";

export function PreferencesScreen({ initial, onSave, saved }: {
  initial: Preferences; onSave: (p: Preferences) => void; saved: boolean;
}) {
  const [p, setP] = useState<Preferences>(initial);
  const [budgetText, setBudgetText] = useState(String(initial.budget));
  const [bedroomsText, setBedroomsText] = useState(String(initial.preferredBedrooms));
  const [bathroomsText, setBathroomsText] = useState(String(initial.preferredBathrooms));
  const [error, setError] = useState<string | null>(null);

  const update = (patch: Partial<Preferences>) => setP({ ...p, ...patch });

  const submit = (e: Event) => {
    e.preventDefault();
    const budget = Number(budgetText.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(budget) || budget <= 0) {
      setError("Enter a monthly budget greater than zero.");
      return;
    }
    const beds = Number(bedroomsText);
    if (!Number.isFinite(beds) || beds < 0 || beds > 8) {
      setError("Enter a bedroom count from 0 (studio) to 8.");
      return;
    }
    const baths = Number(bathroomsText);
    if (!Number.isFinite(baths) || baths <= 0 || baths > 8) {
      setError("Enter a bathroom count greater than zero and no more than 8.");
      return;
    }
    setError(null);
    onSave({ ...p, budget, preferredBedrooms: beds, preferredBathrooms: baths });
  };

  return (
    <form class="stack" onSubmit={submit} aria-label="My Preferences">
      <Header context="My Preferences" title="What matters for housing?" lede="These defaults are labeled. Save to keep them between sessions." />

      <Notice tone="info">Default settings: ${DEFAULT_BUDGET.toLocaleString("en-US")}/month, biking, a school-year lease, 2 bedrooms, 1 bathroom, with parking, laundry, and utilities included selected.</Notice>

      <Field
        label="Monthly housing budget"
        id="budget"
        hint={`Default is $${DEFAULT_BUDGET.toLocaleString("en-US")}.`}
        trailing="$ / month"
        error={error && error.includes("budget") ? error : null}
      >
        <input id="budget" inputMode="decimal" placeholder={String(DEFAULT_BUDGET)} value={budgetText} onInput={(e) => setBudgetText((e.currentTarget as HTMLInputElement).value)} />
      </Field>

      <ChoiceGroup<TransportMode>
        label="Transportation preference"
        value={p.transportMode}
        onChange={(transportMode) => update({ transportMode })}
        choices={[
          { value: "walk", label: "Walking", icon: <WalkIcon /> },
          { value: "bike", label: "Biking", icon: <BikeIcon /> },
          { value: "car", label: "Driving", icon: <CarIcon /> },
          { value: "bus", label: "Public transit", icon: <BusIcon /> },
        ]}
      />

      <ChoiceGroup<LeaseType>
        label="Preferred lease length"
        value={p.leaseType}
        onChange={(leaseType) => update({ leaseType })}
        choices={[
          { value: "school-year", label: "School-year" },
          { value: "12-month", label: "12-month" },
          { value: "month-to-month", label: "Month-to-month" },
        ]}
      />

      <Field label="Preferred bedrooms" id="beds" hint="Default is 2. Use 0 for a studio." error={error && error.includes("bedroom") ? error : null}>
        <input id="beds" inputMode="numeric" value={bedroomsText} onInput={(e) => setBedroomsText((e.currentTarget as HTMLInputElement).value)} />
      </Field>

      <Field label="Preferred bathrooms" id="baths" hint="Default is 1. Half-bath increments, such as 1.5, are allowed." error={error && error.includes("bathroom") ? error : null}>
        <input id="baths" inputMode="decimal" value={bathroomsText} onInput={(e) => setBathroomsText((e.currentTarget as HTMLInputElement).value)} />
      </Field>

      <div>
        <div class="row row--between"><span class="field__label" style="margin:0">Amenities and requirements</span><span class="fine">Optional</span></div>
        <Card class="amenities">
          <Checkbox id="need-parking" label="Parking required (default on)" checked={p.parkingRequired} onChange={(parkingRequired) => update({ parkingRequired })} />
          <Checkbox id="need-laundry" label="Laundry required (default on)" checked={p.laundryRequired} onChange={(laundryRequired) => update({ laundryRequired })} />
          <Checkbox id="need-pets" label="Pets must be allowed" checked={p.petsAllowedRequired} onChange={(petsAllowedRequired) => update({ petsAllowedRequired })} />
          <Checkbox id="need-utils" label="Prefer utilities included (default on)" checked={p.utilitiesIncludedPreferred} onChange={(utilitiesIncludedPreferred) => update({ utilitiesIncludedPreferred })} />
          <Checkbox id="need-furn" label="Prefer furnished" checked={p.furnishedPreferred} onChange={(furnishedPreferred) => update({ furnishedPreferred })} />
        </Card>
      </div>

      {saved && <Notice tone="success" role="status">Preferences saved.</Notice>}
      {error && !error.includes("budget") && <Notice tone="danger" role="alert">{error}</Notice>}

      <div class="actions">
        <Button type="submit">Save Preferences</Button>
      </div>
    </form>
  );
}
