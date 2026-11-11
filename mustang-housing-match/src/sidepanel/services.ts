import type { KeyValueStore } from "@/core/storage";
import type { RawCapture } from "@/capture/readers/types";
import type { ActiveTab } from "@/chrome/tabs";

export interface Services {
  local: KeyValueStore;
  tabs: {
    listingTab(): Promise<ActiveTab | undefined>;
    onChange(cb: () => void): () => void;
  };
  capture(tabId: number): Promise<RawCapture>;
  now(): Date;
}

export const KEYS = {
  preferences: "mhm.preferences",
  lastListing: "mhm.lastListing",
  listings: "mhm.listings",
  onboardingComplete: "mhm.onboardingComplete",
} as const;

let instance: Services | undefined;

export async function createServices(): Promise<Services> {
  if (instance) return instance;
  const [{ chromeStore }, tabs, scripting] = await Promise.all([
    import("@/chrome/storage"),
    import("@/chrome/tabs"),
    import("@/chrome/scripting"),
  ]);
  instance = {
    local: chromeStore("local"),
    tabs: { listingTab: tabs.listingTab, onChange: tabs.onActiveTabChanged },
    capture: (tabId) => scripting.runCaptureScript<RawCapture>(tabId),
    now: () => new Date(),
  };
  return instance;
}
