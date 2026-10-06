/**
 * Frames for the live vision tests, synthesised rather than captured from a
 * real video: the wire format and the model's ability to read on-screen recipe
 * text are what is under test, and a rendered card exercises both without a
 * fixture video committed to the repo.
 */

/** Playwright is an optional dev dep; callers skip cleanly when it is absent. */
export let chromium: typeof import("playwright").chromium | null = null;
try {
  ({ chromium } = await import("playwright"));
} catch {
  chromium = null;
}

/** Render text as a JPEG frame, base64 encoded exactly as captureFrames emits. */
export async function renderFrame(body: string): Promise<string> {
  const browser = await chromium!.launch({ channel: "chromium" });
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  await page.setContent(`<html><body style="margin:0;background:#111;color:#fff;
    font: 30px/1.45 -apple-system, system-ui, sans-serif; padding:56px;
    letter-spacing:.2px; white-space:pre-wrap;">${body}</body></html>`);
  const buffer = await page.screenshot({ type: "jpeg", quality: 82 });
  await browser.close();
  return buffer.toString("base64");
}
