import { filterTickets } from "../../lib/archive-filter";
import { formatTicket } from "../../lib/markdown";
import { clearArchive, listTickets } from "../../lib/storage";
import { displayUrl, renderCard } from "../render";
import type { Ticket } from "../../lib/types";

/**
 * The Archive — every recipe fired from this device.
 *
 * Renamed from "The Pass" on 2026-08-17: the kitchen term was too opaque to
 * say what the view holds, the same reason "In the Weeds" became "Kitchen
 * Error". Archive also names the product's actual promise — artifacts you
 * own in perpetuity — rather than the mechanism that produced them.
 *
 * A row expands into the real card via renderCard, so the Archive and the
 * extraction screen can never drift into two renderings of one recipe.
 */
export function mountArchive(root: HTMLElement): void {
  root.innerHTML = `
    <div class="ticket-top"><span class="brand">MISE · ARCHIVE</span></div>
    <div class="arch-tools">
      <input id="arch-search" type="search" placeholder="search recipes"
             aria-label="Search the archive" />
      <button id="arch-clear" type="button">Clear</button>
    </div>
    <div id="arch-list" class="arch-list" aria-live="polite"></div>`;

  const list = root.querySelector("#arch-list") as HTMLElement;
  const search = root.querySelector("#arch-search") as HTMLInputElement;
  const clearBtn = root.querySelector("#arch-clear") as HTMLButtonElement;

  let tickets: Ticket[] = [];
  let expanded: number | null = null;

  function row(ticket: Ticket, isOpen: boolean): HTMLButtonElement {
    const { frontmatter: fm, recipe } = ticket;
    const el = document.createElement("button");
    el.type = "button";
    el.className = "arch-row";
    el.setAttribute("aria-expanded", String(isOpen));

    const no = document.createElement("span");
    no.className = "no";
    no.textContent = formatTicket(fm.ticket);

    const title = document.createElement("span");
    title.className = "title";
    title.textContent = recipe.title;

    // At 400px the date and source share one line under the title.
    const meta = document.createElement("span");
    meta.className = "meta";
    meta.textContent = `${fm.captured.slice(0, 10)} · ${displayUrl(fm.source)}`;

    el.append(no, title, meta);
    el.addEventListener("click", () => {
      expanded = isOpen ? null : fm.ticket;
      draw();
    });
    return el;
  }

  function detail(ticket: Ticket): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "arch-detail";
    const card = document.createElement("article");
    card.className = "popup";
    // The stored `captured` is a display string; renderCard wants a Date.
    card.innerHTML = renderCard(ticket.recipe, {
      ...ticket.frontmatter,
      captured: new Date(ticket.frontmatter.captured),
    });
    wrap.append(card);
    return wrap;
  }

  function draw() {
    const rows = filterTickets(tickets, search.value);

    if (rows.length === 0) {
      const empty = document.createElement("p");
      empty.className = "arch-empty";
      empty.textContent = tickets.length === 0 ? "Nothing fired yet" : "No recipes match";
      list.replaceChildren(empty);
      return;
    }

    list.replaceChildren(
      ...rows.flatMap((ticket) => {
        const isOpen = expanded === ticket.frontmatter.ticket;
        return isOpen ? [row(ticket, true), detail(ticket)] : [row(ticket, false)];
      }),
    );
  }

  search.addEventListener("input", draw);

  clearBtn.addEventListener("click", () => {
    void (async () => {
      await clearArchive();
      tickets = [];
      expanded = null;
      draw();
    })();
  });

  void (async () => {
    tickets = await listTickets();
    draw();
  })();
}
