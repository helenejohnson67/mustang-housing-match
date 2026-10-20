export async function runCaptureScript<T>(tabId: number): Promise<T> {
  const results = await chrome.scripting.executeScript({ target: { tabId }, files: ["capture.js"] });
  const first = results[0];
  if (!first) throw new Error("Capture script returned nothing");
  return first.result as T;
}
