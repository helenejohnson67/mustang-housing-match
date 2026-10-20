import { useEffect, useMemo, useState } from "preact/hooks";
import { TabBar, type TabId } from "./components/TabBar";
import { createServices, type Services } from "./services";
import { MatchController } from "./state/match";
import { useStore } from "./state/store";
import { PreferencesScreen } from "./screens/PreferencesScreen";
import { AnalyzeScreen } from "./screens/AnalyzeScreen";
import { ResultsScreen } from "./screens/ResultsScreen";

export function App({ services: injected }: { services?: Services } = {}) {
  const [services, setServices] = useState<Services | undefined>(injected);
  useEffect(() => {
    if (!services) void createServices().then(setServices);
  }, []);
  const controller = useMemo(() => (services ? new MatchController(services) : undefined), [services]);
  useEffect(() => () => { controller?.dispose(); }, [controller]);
  if (!services || !controller) return <div class="app"><div class="empty">Loading…</div></div>;
  return <LoadedApp controller={controller} />;
}

function LoadedApp({ controller }: { controller: MatchController }) {
  const s = useStore(controller.store);
  useEffect(() => {
    if (!s.loaded) void controller.init();
  }, [controller, s.loaded]);

  const tab: TabId = s.screen;
  const setTab = (id: TabId) => controller.go(id);

  return (
    <div class="app">
      <header class="app__header">
        <div class="app__logo" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" /></svg>
        </div>
        <div>
          <div class="app__title">Mustang Housing Match</div>
          <div class="app__subtitle">Cal Poly · San Luis Obispo · v0.1.0</div>
        </div>
      </header>
      <div class="app__notice">Missing listing details stay Not listed. Confirm facts with the landlord.</div>
      <main class="app__main" data-tab={tab}>
        {!s.loaded ? (
          <div class="empty">Loading…</div>
        ) : tab === "preferences" ? (
          <PreferencesScreen initial={s.prefs} saved={s.prefsSaved} onSave={(p) => void controller.savePreferences(p)} />
        ) : tab === "analyze" ? (
          <AnalyzeScreen
            state={s}
            onAnalyze={() => void controller.analyze()}
            onEdit={(k, v) => controller.editFact(k, v)}
            onAmenity={(id, v) => controller.editAmenity(id, v)}
            onPlan={(id) => controller.pickFloorPlan(id)}
            onSave={() => void controller.saveListingChanges()}
          />
        ) : (
          <ResultsScreen
            listing={s.listing}
            result={s.scorecard}
            prefs={s.prefs}
            onEdit={() => controller.go("analyze")}
            onPreferences={() => controller.go("preferences")}
          />
        )}
      </main>
      <TabBar active={tab} onChange={setTab} />
    </div>
  );
}
