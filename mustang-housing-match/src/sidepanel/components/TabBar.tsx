export type TabId = "preferences" | "analyze" | "results";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "preferences", label: "Preferences", icon: "M4 6h10M18 6h2M4 12h3M11 12h9M4 18h12M14 4v4M7 10v4M16 16v4" },
  { id: "analyze", label: "Analyze", icon: "M4 7V4h3M17 4h3v3M20 17v3h-3M7 20H4v-3M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" },
  { id: "results", label: "Fit Score", icon: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" },
];

export function TabBar({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  return (
    <nav class="app__tabbar" role="tablist" aria-label="Screens">
      {TABS.map((t) => (
        <button key={t.id} role="tab" class="tab" aria-selected={active === t.id} onClick={() => onChange(t.id)}>
          <svg class="tab__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d={t.icon} />
          </svg>
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
