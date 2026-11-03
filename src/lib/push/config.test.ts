import { describe, expect, it } from "vitest";
import { inspectPushConfiguration } from "./config";
// Fixed P-256 generator-point fixture (private scalar 1). Never used outside tests.
// No VAPID key pair is generated or changed by these tests.
const pub = Buffer.from("046b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c2964fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5", "hex").toString("base64url");
const priv = Buffer.from("00".repeat(31) + "01", "hex").toString("base64url");
const env = { PUSH_ENABLED: "true", NEXT_PUBLIC_VAPID_PUBLIC_KEY: pub, VAPID_PRIVATE_KEY: priv, VAPID_SUBJECT: "mailto:test@example.invalid", SUPABASE_SERVICE_ROLE_KEY: "test-admin-secret", SITE_URL: "https://example.invalid", NODE_ENV: "production" };
describe("push configuration diagnostic", () => {
  it("accepts the existing matching pair and full server configuration", () => expect(inspectPushConfiguration(pub, env)).toMatchObject({ configured: true, issues: [], checks: { keyPairMatches: true } }));
  it.each([undefined, "false", "TRUE", "1", '"true"', "true ", " true"])("requires PUSH_ENABLED exactly true: %s", value => expect(inspectPushConfiguration(pub, { ...env, PUSH_ENABLED: value })).toMatchObject({ configured: false, issues: ["push_disabled"] }));
  it("detects a key present at runtime but absent from the build", () => expect(inspectPushConfiguration("", env)).toMatchObject({ configured: false, issues: ["public_key_missing_build"], checks: { publicKeyInBuild: false, publicKeyAtRuntime: true } }));
  it("detects build/runtime mismatch without echoing either value", () => expect(inspectPushConfiguration(pub, { ...env, NEXT_PUBLIC_VAPID_PUBLIC_KEY: "other-public-fixture" }).issues).toContain("public_key_build_mismatch"));
  it.each([["VAPID_PRIVATE_KEY", "private_key_missing"], ["VAPID_SUBJECT", "subject_missing"], ["SUPABASE_SERVICE_ROLE_KEY", "admin_key_missing"], ["SITE_URL", "site_url_missing"]] as const)("reports the exact missing setting %s", (key, issue) => expect(inspectPushConfiguration(pub, { ...env, [key]: "" }).issues).toEqual([issue]));
  it("validates key pairing and syntax without generating new keys", () => {
    const otherPrivate = Buffer.from("00".repeat(31) + "02", "hex").toString("base64url");
    expect(inspectPushConfiguration(pub, { ...env, VAPID_PRIVATE_KEY: otherPrivate }).issues).toEqual(["key_pair_mismatch"]);
    expect(inspectPushConfiguration(pub, { ...env, VAPID_PRIVATE_KEY: "bad-private-value" }).issues).toEqual(["private_key_invalid"]);
    expect(inspectPushConfiguration(pub, { ...env, VAPID_SUBJECT: "not-a-contact" }).issues).toEqual(["subject_invalid"]);
    expect(inspectPushConfiguration(pub, { ...env, SITE_URL: "https://example.invalid/path" }).issues).toEqual(["site_url_invalid"]);
  });
  it("does not serialize keys, subject, service credentials or other environment variables", () => {
    const serialized = JSON.stringify(inspectPushConfiguration(pub, { ...env, UNRELATED_SECRET: "unrelated-private-value" }));
    for (const secret of [pub, priv, env.VAPID_SUBJECT, env.SUPABASE_SERVICE_ROLE_KEY, "unrelated-private-value"]) expect(serialized).not.toContain(secret);
  });
});
