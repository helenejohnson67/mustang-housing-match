import { useEffect, useMemo, useState } from "preact/hooks";
import { TabBar, type TabId } from "./components/TabBar";
import { createServices, type Services } from "./services";
import { MatchController } from "./state/match";
import { useStore } from "./state/store";
import { PreferencesScreen } from "./screens/PreferencesScreen";
import { AnalyzeScreen } from "./screens/AnalyzeScreen";
import { ResultsScreen } from "./screens/ResultsScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { SavedScreen } from "./screens/SavedScreen";
import { CompareScreen } from "./screens/CompareScreen";
import { HelpScreen } from "./screens/HelpScreen";
import { OnboardingScreen } from "./screens/OnboardingScreen";
import { Notice } from "./components/Notice";

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

  const tab: TabId = (s.screen === "analyze" || s.screen === "results" ? "home" : s.screen) as TabId;
  const setTab = (id: TabId) => controller.go(id);

  if (s.loaded && !s.onboardingComplete) return <div class="app"><main class="app__main"><OnboardingScreen onStart={() => void controller.completeOnboarding("preferences")} onSkip={() => void controller.completeOnboarding("home")} /></main></div>;
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
        {s.notice && <Notice tone="info" role="status">{s.notice}</Notice>}
        {!s.loaded ? (
          <div class="empty">Loading…</div>
        ) : s.screen === "analyze" ? (
          <AnalyzeScreen state={s} onAnalyze={() => void controller.analyze()} onEdit={(k, v) => controller.editFact(k, v)} onAmenity={(id, v) => controller.editAmenity(id, v)} onPlan={(id) => controller.pickFloorPlan(id)} onSave={() => void controller.saveListingChanges()} />
        ) : s.screen === "results" ? (
          <ResultsScreen listing={s.listing} result={s.scorecard} prefs={s.prefs} onEdit={() => controller.go("analyze")} onPreferences={() => controller.go("preferences")} />
        ) : tab === "home" ? (
          <HomeScreen page={s.page} onAnalyze={() => controller.go("analyze")} onPreferences={() => controller.go("preferences")} />
        ) : tab === "preferences" ? (
          <PreferencesScreen initial={s.prefs} saved={s.prefsSaved} onSave={(p) => void controller.savePreferences(p)} />
        ) : tab === "saved" ? (
          <SavedScreen listings={s.listings} prefs={s.prefs} selected={s.selectedIds} onToggle={(id) => controller.toggleCompare(id)} onOpen={(l) => controller.openListing(l)} onDelete={(id) => void controller.deleteListing(id)} onCompare={() => controller.go("compare")} onAdd={() => controller.addManualListing()} />
        ) : tab === "compare" ? (
          <CompareScreen listings={s.listings.filter((l) => s.selectedIds.includes(l.id))} prefs={s.prefs} />
        ) : (
          <HelpScreen onGuide={() => void controller.reopenOnboarding()} />
        )}
      </main>
      <TabBar active={tab} onChange={setTab} />
    </div>
  );
}
