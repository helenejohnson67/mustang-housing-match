import type { PageState } from "../state/match";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Header } from "../components/Header";
export function HomeScreen({ page, onAnalyze, onPreferences }: { page: PageState; onAnalyze: () => void; onPreferences: () => void }) { const ready = page.status === "supported"; return <div class="stack"><Header context="Home" title="Find your next home" lede="Capture a listing, check its fit, then compare your saved options."/><Card><b>{ready ? "Rental listing detected" : "No supported listing detected"}</b><p class="muted">{ready ? page.title || page.url : "You can still add listings manually from Saved Listings."}</p><div class="actions"><Button onClick={onAnalyze} disabled={!ready}>Analyze Listing</Button><Button variant="secondary" onClick={onPreferences}>Set preferences</Button></div></Card></div>; }
