import { describe, expect, it } from "vitest";
import { allowedViews, parseRoute, routeHref } from "../../src/routes.js";

describe("Lab 4 dashboard routes", () => {
  it("keeps navigation role-scoped and ordered", () => {
    expect(allowedViews("REQUESTER")).toEqual(["dashboard", "newTicket", "myTickets"]);
    expect(allowedViews("IT_STAFF")).toEqual(["dashboard", "queue"]);
    expect(allowedViews("ADMINISTRATOR")).toEqual(["dashboard", "queue", "users"]);
  });

  it("round-trips dashboard filters into exact API list query names", () => {
    expect(routeHref({ view: "queue", filters: { ownerId: "unassigned", open: true, recent: true, itPriority: "High", sortBy: "updatedAt" } })).toBe("#/queue?ownerId=unassigned&itPriority=High&open=1&recent=1&sortBy=updatedAt");
    expect(routeHref({ view: "myTickets", filters: { status: "Resolved", recent: true } })).toBe("#/my-tickets?status=Resolved&recent=1");
    expect(parseRoute("#/queue?ownerId=unassigned&open=1&unknown=bad")).toEqual({ view: "queue", filters: { ownerId: "unassigned", open: true } });
  });

  it("drops unknown views and accepts deep-linked ticket details", () => {
    expect(parseRoute("#/not-a-page?open=1")).toEqual({ view: "dashboard" });
    expect(parseRoute("#/queue/17?section=actions-taken&ownerId=me")).toEqual({ view: "queue", filters: { ownerId: "me" }, ticketId: 17, section: "actions-taken" });
    expect(parseRoute("#/queue/not-an-id")).toEqual({ view: "queue", filters: {} });
  });
});
