import { describe, expect, it } from "vitest";
import { remainingServices, todayInSaoPaulo } from "./attendance";
describe("attendance data helpers", () => {
  it("does not count reversed usages because the caller supplies only active rows", () => expect(remainingServices("a", 6, [{client_package_id:"a",quantity:2},{client_package_id:"b",quantity:5}])).toBe(4));
  it("uses the São Paulo calendar date", () => expect(todayInSaoPaulo(new Date("2026-10-28T02:30:00.000Z"))).toBe("2026-10-27"));
});
