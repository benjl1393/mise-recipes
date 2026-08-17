import { formatTicket } from "./markdown";
import type { Ticket } from "./types";

/** Search across title, tags, source, and ticket number. */
export function filterTickets(tickets: Ticket[], query: string): Ticket[] {
  const q = query.trim().toLowerCase();
  if (!q) return tickets;
  return tickets.filter((ticket) => {
    const haystack = [
      ticket.recipe.title,
      ticket.recipe.tags.join(" "),
      ticket.frontmatter.source,
      formatTicket(ticket.frontmatter.ticket),
      String(ticket.frontmatter.ticket),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}
