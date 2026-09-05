import { describe, expect, it } from "vitest";
import { generateTicketNumber } from "../../src/ticket-number.js";

describe("generateTicketNumber", () => {
  it("formats database IDs as six-digit TokTickIT ticket numbers", () => {
    expect(generateTicketNumber(1)).toBe("TK-000001");
    expect(generateTicketNumber(42)).toBe("TK-000042");
    expect(generateTicketNumber(123456)).toBe("TK-123456");
  });
});
