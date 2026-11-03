import type { PushConfiguration } from "../src/lib/push/configuration";
export const readyConfiguration: PushConfiguration = { version: 1, configured: true, issues: [], checks: { enabled: true, publicKeyInBuild: true, publicKeyAtRuntime: true, privateKeyPresent: true, subjectPresent: true, keyPairMatches: true, adminKeyPresent: true, siteUrlPresent: true } };
