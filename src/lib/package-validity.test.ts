import { describe, expect, it } from "vitest";
import { calculateExpiryDate, isPackageUsable } from "./package-validity";
const date = (value: string) => new Date(`${value}T12:00:00Z`);
describe("package validity", () => {
  it("uses the last day of the purchase month", () => expect(calculateExpiryDate(date("2026-02-12"), "month_end").toISOString().slice(0,10)).toBe("2026-02-28"));
  it("clamps monthly validity to the last calendar day", () => expect(calculateExpiryDate(date("2026-01-31"), "1_month").toISOString().slice(0,10)).toBe("2026-02-28"));
  it("handles leap years and year boundaries", () => { expect(calculateExpiryDate(date("2024-01-31"), "1_month").toISOString().slice(0,10)).toBe("2024-02-29"); expect(calculateExpiryDate(date("2026-12-31"), "2_months").toISOString().slice(0,10)).toBe("2027-02-28"); });
  it("allows use on the expiry day only", () => { const expiry = date("2026-06-30"); expect(isPackageUsable(expiry, date("2026-06-30"))).toBe(true); expect(isPackageUsable(expiry, date("2026-07-01"))).toBe(false); });
});
