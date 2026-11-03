import "server-only";
import { createECDH, ECDH } from "node:crypto";
import type { PushConfiguration, PushConfigurationIssue } from "./configuration";
// This direct NEXT_PUBLIC access is deliberately frozen by Next at build time.
export function getPushPublicKey() { return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ""; }
export function inspectPushConfiguration(buildPublicKey: string, env: Record<string, string | undefined>): PushConfiguration {
  const issues: PushConfigurationIssue[] = [];
  const privateKey = env.VAPID_PRIVATE_KEY || ""; const subject = env.VAPID_SUBJECT || "";
  const runtimePublicKey = env["NEXT_PUBLIC_VAPID_PUBLIC_KEY"] || "";
  const checks: PushConfiguration["checks"] = { enabled: env.PUSH_ENABLED === "true", publicKeyInBuild: Boolean(buildPublicKey), publicKeyAtRuntime: Boolean(runtimePublicKey), privateKeyPresent: Boolean(privateKey), subjectPresent: Boolean(subject), keyPairMatches: null, adminKeyPresent: Boolean(env.SUPABASE_SERVICE_ROLE_KEY?.trim()), siteUrlPresent: Boolean(env.SITE_URL?.trim()) };
  if (!checks.enabled) issues.push("push_disabled");
  let publicBytes: Buffer | null = null;
  if (!buildPublicKey) issues.push("public_key_missing_build");
  else {
    try {
      if (!/^[\w-]{87}$/.test(buildPublicKey)) throw new Error();
      publicBytes = Buffer.from(buildPublicKey, "base64url");
      if (publicBytes.length !== 65 || publicBytes[0] !== 4) throw new Error();
      ECDH.convertKey(publicBytes, "prime256v1");
    } catch { publicBytes = null; issues.push("public_key_invalid_build"); }
  }
  if (buildPublicKey && runtimePublicKey && runtimePublicKey !== buildPublicKey) issues.push("public_key_build_mismatch");
  if (!privateKey) issues.push("private_key_missing");
  else {
    try {
      if (!/^[\w-]{43}$/.test(privateKey)) throw new Error();
      const key = createECDH("prime256v1"); key.setPrivateKey(Buffer.from(privateKey, "base64url"));
      if (publicBytes) { checks.keyPairMatches = key.getPublicKey().equals(publicBytes); if (!checks.keyPairMatches) issues.push("key_pair_mismatch"); }
    } catch { issues.push("private_key_invalid"); }
  }
  if (!subject) issues.push("subject_missing");
  else {
    try { const url = new URL(subject); if (subject !== subject.trim() || !["mailto:", "https:"].includes(url.protocol) || (url.protocol === "mailto:" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(url.pathname))) throw new Error(); }
    catch { issues.push("subject_invalid"); }
  }
  if (!checks.adminKeyPresent) issues.push("admin_key_missing");
  if (!checks.siteUrlPresent) issues.push("site_url_missing");
  else {
    try { const url = new URL(env.SITE_URL!); const local = env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(url.hostname); if (url.username || url.password || url.pathname !== "/" || url.search || url.hash || (url.protocol !== "https:" && !(local && url.protocol === "http:"))) throw new Error(); }
    catch { issues.push("site_url_invalid"); }
  }
  return { version: 1, configured: issues.length === 0, issues, checks };
}
export function getPushConfiguration() {
  // Passing process.env as an object preserves runtime lookup; it is not a
  // second direct public-variable reference that Next would replace at build.
  return inspectPushConfiguration(getPushPublicKey(), process.env);
}
export function pushConfigured() { return getPushConfiguration().configured; }
