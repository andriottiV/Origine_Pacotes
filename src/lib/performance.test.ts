import { afterEach, expect, it, vi } from "vitest";
import { createTimedFetch, timed } from "./performance";
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it("logs only stage and duration without query values, headers or bodies", async () => {
  vi.stubEnv("ORIGINE_PERF", "1");
  const log = vi.spyOn(console, "info").mockImplementation(() => {});
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}")));
  await createTimedFetch("server")("https://example.invalid/rest/v1/service_usages?organization_id=secret-tenant", { headers: { Authorization: "Bearer secret-token" } });
  const output = JSON.stringify(log.mock.calls);
  expect(output).toContain("rest.v1.service_usages"); expect(output).not.toContain("secret-tenant"); expect(output).not.toContain("secret-token");
});
it("keeps diagnostics off by default and preserves results/errors", async () => {
  vi.stubEnv("ORIGINE_PERF", "0"); const log = vi.spyOn(console, "info").mockImplementation(() => {});
  expect(await timed("test", async () => 42)).toBe(42);
  await expect(timed("test", async () => { throw new Error("failed"); })).rejects.toThrow("failed");
  expect(log).not.toHaveBeenCalled();
});
