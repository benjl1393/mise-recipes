/**
 * The web app that lived here ("Order Up") extracted recipes through a
 * server-side API route that spent a server-held Anthropic key. Mise replaced
 * it as a browser extension where every user brings their own key, so the
 * route, its extractors and the form were retired on 2026-10-01 when the
 * repository went public. This page only points to the extension.
 */
export default function Home() {
  return (
    <main className="min-h-screen bg-bg">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <h1 className="font-[family-name:var(--font-pixel)] text-[36px] md:text-[48px] uppercase tracking-[0.08em] leading-none text-black mb-3">
          Mise
        </h1>
        <p className="text-[12px] text-gray uppercase tracking-[0.2em]">
          Mise is a browser extension now:{" "}
          <a
            href="https://github.com/benjl1393/mise-recipes"
            className="text-black underline underline-offset-4"
          >
            github.com/benjl1393/mise-recipes
          </a>
        </p>
      </div>
    </main>
  );
}
