import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const readMigration = (name: string) =>
  readFileSync(resolve(process.cwd(), "supabase/migrations", name), "utf8");

describe("sale RPC contract", () => {
  it("keeps the exact named-parameter signature expected by the form", () => {
    const sql = readMigration("20261027171000_fix_sell_client_package_status_ambiguity.sql");

    for (const parameter of [
      "p_client_id uuid",
      "p_package_type_id uuid",
      "p_validity text",
      "p_custom_expires_on date",
      "p_discount numeric",
      "p_payment_amount numeric",
      "p_payment_method public.payment_method",
      "p_idempotency_key uuid",
    ]) {
      expect(sql).toContain(parameter);
    }
  });

  it("qualifies the client status column and avoids a colliding status variable", () => {
    const sql = readMigration("20261027171000_fix_sell_client_package_status_ambiguity.sql");

    expect(sql).toContain("and client.status = 'active'");
    expect(sql).toContain("package_payment_status public.payment_status");
    expect(sql).not.toMatch(/\bstatus\s+public\.payment_status/);
  });
});
