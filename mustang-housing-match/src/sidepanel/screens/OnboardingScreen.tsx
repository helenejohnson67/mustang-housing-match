import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Header } from "../components/Header";
export function OnboardingScreen({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  return <div class="stack"><Header context="Welcome" title="Welcome to Mustang Housing Match" lede="Find your next home with confidence. Capture rental listings, compare your options, and share your favorites with roommates." />
    <Card><ol class="insights"><li><b>1. Set Your Preferences</b><span>Enter your budget, priorities, and desired amenities.</span></li><li><b>2. Capture Listings</b><span>Browse rental websites and save properties.</span></li><li><b>3. Compare & Share</b><span>Evaluate properties and share comparisons with roommates.</span></li></ol></Card>
    <div class="actions"><Button onClick={onStart}>Get Started</Button><Button variant="ghost" onClick={onSkip}>Skip for Now</Button></div><p class="fine">Step 1 of 1</p></div>;
}
