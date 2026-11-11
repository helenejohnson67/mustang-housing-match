export type TabId = "home" | "preferences" | "saved" | "compare" | "help";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "home", label: "Home", icon: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" },
  { id: "preferences", label: "Preferences", icon: "M4 6h10M18 6h2M4 12h3M11 12h9M4 18h12M14 4v4M7 10v4M16 16v4" },
  { id: "saved", label: "Saved", icon: "M6 3h12v18l-6-4-6 4z" },
  { id: "compare", label: "Compare", icon: "M4 5h16M4 12h16M4 19h16" },
  { id: "help", label: "Help", icon: "M9 9a3 3 0 1 1 5.2 2c-.9.9-2.2 1.4-2.2 3M12 18h.01" },
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
