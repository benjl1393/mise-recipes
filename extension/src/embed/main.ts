import { mountEmbed } from "./embed";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const embed = mountEmbed(document, { reducedMotion });

// Opened on its own there is no page to say "visible", so start at once.
let started = false;
const start = () => {
  if (started) return;
  started = true;
  embed.replay();
};
if (window.parent === window) start();

window.addEventListener("message", (event) => {
  if (event.origin !== window.location.origin) return;
  const type = (event.data as { type?: string } | null)?.type;
  if (type === "mise:visible") start();
  if (type === "mise:replay") {
    started = true;
    embed.replay();
  }
});
