import { filterTickets } from "../lib/pass-filter";
import { formatTicket } from "../lib/markdown";
import { clearPass, listTickets } from "../lib/storage";
import { displayUrl, renderCard } from "../popup/render";
import type { Ticket } from "../lib/types";

const list = document.getElementById("list") as HTMLElement;
const search = document.getElementById("search") as HTMLInputElement;
const clearBtn = document.getElementById("clear") as HTMLButtonElement;

let tickets: Ticket[] = [];
let expanded: number | null = null;

function row(ticket: Ticket, isOpen: boolean): HTMLButtonElement {
  const { frontmatter: fm, recipe } = ticket;
  const el = document.createElement("button");
  el.type = "button";
  el.className = "pass-row";
  el.setAttribute("aria-expanded", String(isOpen));

  const no = document.createElement("span");
  no.className = "no";
  no.textContent = formatTicket(fm.ticket);

  const title = document.createElement("span");
  title.className = "title";
  title.textContent = recipe.title;

  const date = document.createElement("span");
  date.className = "meta";
  date.textContent = fm.captured.slice(0, 10);

  const source = document.createElement("span");
  source.className = "meta";
  source.textContent = displayUrl(fm.source);

  el.append(no, title, date, source);
  el.addEventListener("click", () => {
    expanded = isOpen ? null : fm.ticket;
    draw();
  });
  return el;
}

function detail(ticket: Ticket): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "pass-detail";
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
    empty.className = "pass-empty";
    empty.textContent =
      tickets.length === 0 ? "NOTHING ACROSS THE PASS YET" : "NO TICKETS MATCH";
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

clearBtn.addEventListener("click", async () => {
  await clearPass();
  tickets = [];
  expanded = null;
  draw();
});

void (async () => {
  tickets = await listTickets();
  draw();
})();
