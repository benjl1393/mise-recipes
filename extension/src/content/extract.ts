import { pickSource } from "../lib/page-source";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "mise:extract") return false;
  try {
    const payload = pickSource(document, location.href);
    // Report the video's on-screen box so the popup can crop captured frames
    // to the player rather than the whole viewport.
    const video = document.querySelector("video");
    const rect = video?.getBoundingClientRect();
    sendResponse({
      ok: true,
      payload,
      videoRect:
        rect && rect.width > 0 && rect.height > 0
          ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
          : null,
      devicePixelRatio: window.devicePixelRatio,
    });
  } catch (error) {
    sendResponse({ ok: false, error: (error as Error).message });
  }
  return true; // keep the channel open for the async response
});
