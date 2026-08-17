// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import {
  renderCard,
  renderSkeleton,
  renderStamp,
  renderFired,
  displayUrl,
  viaBadge,
  stampTime,
} from "../src/popup/render";
import type { Recipe, Frontmatter } from "../src/lib/types";

const recipe: Recipe = {
  title: "Gochujang-Glazed Pork Belly",
  subtitle: "slow-rendered, sharply-sauced.",
  serves: "4",
  hands_on: "25m",
  total: "2h 10m",
  ingredients: [
    { qty: "800 g", item: "pork belly, skin-on" },
    { qty: "—", item: "spring onion to finish" },
  ],
  method: ["Score the skin.", "Roast at 160 °C."],
  tags: ["#cuisine/korean", "#pork"],
};

const fm: Frontmatter = {
  ticket: 427,
  captured: new Date("2026-04-22T16:28:00"),
  source: "https://instagram.com/p/C9xK2",
  via: "8 video frames",
};

function parse(html: string): Document {
  return new DOMParser().parseFromString(`<div class="popup">${html}</div>`, "text/html");
}

describe("displayUrl", () => {
  it("keeps host and path, drops scheme and www", () => {
    expect(displayUrl("https://www.instagram.com/p/C9xK2")).toBe("instagram.com/p/C9xK2");
  });

  it("drops a bare trailing slash", () => {
    expect(displayUrl("https://example.com/")).toBe("example.com");
  });

  it("passes through anything unparseable", () => {
    expect(displayUrl("not a url")).toBe("not a url");
  });
});

describe("viaBadge", () => {
  it("matches the specimen's badge vocabulary", () => {
    expect(viaBadge("8 video frames")).toBe("🎬 8 frames");
    expect(viaBadge("article text")).toBe("📝 article");
    expect(viaBadge("schema data")).toBe("📜 schema");
    expect(viaBadge("caption only")).toBe("🎬 caption");
  });
});

describe("stampTime", () => {
  it("uses the ticket-stamp date · time convention", () => {
    expect(stampTime(new Date("2026-04-22T16:28:00"))).toBe("2026-04-22 · 16:28");
  });
});

describe("renderCard", () => {
  const doc = parse(renderCard(recipe, fm));

  it("renders the ticket-top with the NO. display convention", () => {
    expect(doc.querySelector(".ticket-top .brand")!.textContent).toBe("MISE · NO. 00427");
  });

  it("shows host and path in the source row", () => {
    expect(doc.querySelector(".source .url")!.textContent!.trim()).toBe("instagram.com/p/C9xK2");
  });

  it("labels the facts row with SERVES / HANDS-ON / TOTAL and bolds the values", () => {
    const facts = [...doc.querySelectorAll(".facts .fact")].map((n) =>
      n.textContent!.replace(/\s+/g, " ").trim(),
    );
    expect(facts).toEqual(["SERVES 4", "HANDS-ON 25m", "TOTAL 2h 10m"]);
    expect(doc.querySelector(".facts .fact strong")!.textContent).toBe("4");
  });

  it("omits a fact whose value is absent", () => {
    const bare = parse(renderCard({ ...recipe, total: undefined }, fm));
    expect(bare.querySelectorAll(".facts .fact")).toHaveLength(2);
  });

  it("uses the tags the ported CSS styles", () => {
    expect(doc.querySelector("h2.title")!.textContent).toBe("Gochujang-Glazed Pork Belly");
    expect(doc.querySelectorAll("h3.section")).toHaveLength(2);
    expect(doc.querySelector("ul.ingredients")).not.toBeNull();
    expect(doc.querySelector("ol.method")).not.toBeNull();
  });

  it("uses semantic list markup with a qty column", () => {
    const items = doc.querySelectorAll("ul.ingredients li");
    expect(items).toHaveLength(2);
    expect(items[0]!.querySelector(".qty")!.textContent).toBe("800 g");
    expect(doc.querySelectorAll("ol.method li")).toHaveLength(2);
  });

  it("does not hand-number method steps — the CSS counter does that", () => {
    expect(doc.querySelector("ol.method li")!.textContent).toBe("Score the skin.");
  });

  it("escapes HTML in model output", () => {
    const evil = parse(renderCard({ ...recipe, title: "<img src=x onerror=alert(1)>" }, fm));
    expect(evil.querySelector("img")).toBeNull();
    expect(evil.querySelector("h2.title")!.textContent).toContain("<img");
  });

  it("omits the subtitle and notes blocks when absent", () => {
    const bare = parse(renderCard({ ...recipe, subtitle: undefined }, fm));
    expect(bare.querySelector(".subtitle")).toBeNull();
    expect(bare.querySelector(".notes")).toBeNull();
  });

  it("renders notes when present", () => {
    const withNotes = parse(renderCard({ ...recipe, notes: ["Use Korean gochujang."] }, fm));
    expect(withNotes.querySelectorAll("h3.section")).toHaveLength(3);
    expect(withNotes.querySelector("ul.notes li")!.textContent).toContain("Korean gochujang");
  });

  it("wraps content in .popup-body so the FIRED overlay can dim it", () => {
    expect(doc.querySelector(".popup > .popup-body")).not.toBeNull();
    expect(parse(renderSkeleton()).querySelector(".popup > .popup-body")).not.toBeNull();
  });

  it("renders the tag line and the footer glyph", () => {
    const tags = [...doc.querySelectorAll(".tags .tag")].map((n) => n.textContent);
    expect(tags).toEqual(["#cuisine/korean", "#pork"]);
    expect(doc.querySelector(".ticket-bottom")!.textContent).toContain("mise.app");
    expect(doc.querySelector(".ticket-bottom .glyph")!.textContent).toBe("✶");
  });
});

describe("renderSkeleton", () => {
  it("emits skeleton bars and no recipe content", () => {
    const doc = parse(renderSkeleton());
    expect(doc.querySelectorAll(".bar").length).toBeGreaterThan(0);
    expect(doc.querySelector("ul.ingredients")).toBeNull();
    expect(doc.querySelector("h2.title")).toBeNull();
  });

  it("shows a pending badge carrying the current phase", () => {
    const doc = parse(renderSkeleton("capturing"));
    expect(doc.querySelector(".badge.pending")!.textContent).toBe("capturing");
  });
});

describe("renderStamp", () => {
  it("uses the locked stamp titles in source case (CSS uppercases them)", () => {
    expect(parse(renderStamp("error")).querySelector("h2.stamp-title")!.textContent).toBe(
      "Kitchen Error",
    );
    expect(parse(renderStamp("offmenu")).querySelector("h2.stamp-title")!.textContent).toBe(
      "Off Menu",
    );
  });

  it("carries the pixel-art glyph the specimen uses", () => {
    expect(parse(renderStamp("error")).querySelector(".glyph-mark svg")).not.toBeNull();
    expect(parse(renderStamp("offmenu")).querySelector(".glyph-mark svg")).not.toBeNull();
  });

  it("marks only the error stamp with the .err modifier", () => {
    expect(parse(renderStamp("error")).querySelector(".stamp.err")).not.toBeNull();
    expect(parse(renderStamp("offmenu")).querySelector(".stamp.err")).toBeNull();
    expect(parse(renderStamp("offmenu")).querySelector(".stamp")).not.toBeNull();
  });

  it("escapes the detail line", () => {
    expect(renderStamp("error", "<b>boom</b>")).toContain("&lt;b&gt;boom&lt;/b&gt;");
  });
});

describe("renderFired", () => {
  it("shows the check, the FIRED word, and the saved filename", () => {
    const doc = parse(renderFired("00427-gochujang.md"));
    expect(doc.querySelector(".fired-stamp .check")!.textContent).toBe("✓");
    expect(doc.querySelector(".line1")!.textContent).toContain("FIRED");
    expect(doc.querySelector(".line2")!.textContent).toBe("saved to 00427-gochujang.md");
  });

  it("announces itself to screen readers", () => {
    expect(parse(renderFired("x.md")).querySelector("[aria-live]")).not.toBeNull();
  });
});
