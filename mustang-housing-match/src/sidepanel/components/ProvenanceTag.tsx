import type { Provenance } from "@/core/domain";

export const PROVENANCE_LABEL: Record<Provenance, string> = { Listed: "Listed", NotListed: "Not listed", Corrected: "Corrected" };

export function ProvenanceTag({ provenance }: { provenance: Provenance }) {
  return <span class={`tag tag--${provenance.toLowerCase()}`}>{PROVENANCE_LABEL[provenance]}</span>;
}
