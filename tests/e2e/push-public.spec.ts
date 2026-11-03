import { expect, test } from "@playwright/test";
// Public read-only smoke tests. No authenticated subscription, enqueue or send.
test("manifest and push worker are served with correct scope and cache headers", async ({ request }) => {
  const manifest = await request.get("/manifest.webmanifest"); expect(manifest.status()).toBe(200);
  expect(await manifest.json()).toMatchObject({ id: "/cliente", start_url: "/cliente", display: "standalone" });
  const worker = await request.get("/sw.js"); expect(worker.status()).toBe(200);
  expect(worker.headers()["service-worker-allowed"]).toBe("/"); expect(worker.headers()["cache-control"]).toContain("no-store");
  expect(worker.headers()["content-type"]).toContain("javascript");
  const icon = await request.get("/icons/push-192.png"); expect(icon.status()).toBe(200); expect(icon.headers()["content-type"]).toContain("image/png");
});
test("scheduler endpoints reject unauthenticated calls without processing jobs", async ({ request }) => {
  expect((await request.get("/api/push/process")).status()).toBe(401);
  expect((await request.post("/api/push/daily")).status()).toBe(401);
});
test("subscription administration rejects cross-origin and unauthenticated access", async ({ request }) => {
  const mutation = await request.post("/api/push/subscription", { headers: { Origin: "https://attacker.invalid" }, data: { client_id: "forged" } }); expect(mutation.status()).toBe(403);
  const status = await request.get("/api/push/subscription"); expect(status.status()).toBe(401); expect(status.headers()["cache-control"]).toContain("no-store");
});
test("protected package notification destination survives the login redirect", async ({ request }) => {
  const path = "/cliente/pacotes/10000000-0000-4000-8000-000000000040";
  const result = await request.get(path, { maxRedirects: 0 }); expect(result.status()).toBe(307);
  const target = new URL(result.headers().location, "http://127.0.0.1:3101"); expect(target.pathname).toBe("/cliente/login"); expect(target.searchParams.get("next")).toBe(path);
});
