import { afterEach, describe, expect, it, vi } from "vitest";
import { authOrigin } from "./origin";
import { passwordPairSchema, recoveryClaims } from "./shared";
afterEach(() => vi.unstubAllEnvs());
describe("authentication boundaries", () => {
  it("uses only the configured production origin, never arbitrary Origin headers", () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("SITE_URL", "https://origine-pacotes.vercel.app/");
    expect(authOrigin("https://malicious.invalid")).toBe("https://origine-pacotes.vercel.app");
    expect(authOrigin("http://localhost:3000")).toBe("https://origine-pacotes.vercel.app");
  });
  it("allows only explicit local origins during development", () => {
    vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("SITE_URL", "https://origine-pacotes.vercel.app");
    expect(authOrigin("http://localhost:3000")).toBe("http://localhost:3000");
    expect(authOrigin("http://localhost:9999")).toBe("https://origine-pacotes.vercel.app");
  });
  it.each(["https://user:secret@example.invalid", "https://example.invalid/?next=external", "javascript:alert(1)", "https://example.invalid/path"])("rejects malformed canonical URLs", origin => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("SITE_URL", origin);
    expect(() => authOrigin()).toThrow();
  });
  it("requires recovery AMR rather than an ordinary password login", () => {
    expect(recoveryClaims({ amr: [{ method: "password" }] })).toBe(false);
    expect(recoveryClaims({ amr: [{ method: "recovery" }] })).toBe(true);
    expect(recoveryClaims({})).toBe(false);
  });
  it("reuses the application's minimum password rules and enforces matching confirmation", () => {
    expect(passwordPairSchema.safeParse({ password: "short1", confirmation: "short1" }).success).toBe(false);
    expect(passwordPairSchema.safeParse({ password: "OnlyTests123!", confirmation: "different" }).success).toBe(false);
    expect(passwordPairSchema.safeParse({ password: "OnlyTests123!", confirmation: "OnlyTests123!" }).success).toBe(true);
  });
});
