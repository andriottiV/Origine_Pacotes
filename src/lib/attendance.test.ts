import { describe, expect, it } from "vitest";
import { remainingServices, todayInSaoPaulo } from "./attendance";
describe("attendance data helpers", () => {
  it("does not count reversed usages because the caller supplies only active rows", () => expect(remainingServices("a", 6, [{client_package_id:"a",quantity:2},{client_package_id:"b",quantity:5}])).toBe(4));
  it("uses the São Paulo calendar date", () => expect(todayInSaoPaulo(new Date("2026-10-28T02:30:00.000Z"))).toBe("2026-10-27"));
});

describe("shared ledger balances", () => {
  it.each([[4, 2, 2], [8, 2, 6], [6, 1, 5]])("%i services minus %i leaves %i", (total, quantity, expected) => {
    expect(remainingServices("a", total, [{ client_package_id: "a", quantity }])).toBe(expected);
  });
  it("returns exactly the reversed quantity while preserving legacy usages", () => {
    expect(remainingServices("a", 8, [{ client_package_id: "a", quantity: 3 }, { client_package_id: "a", quantity: 2, reversed_at: "2026-11-01" }])).toBe(5);
  });
});
