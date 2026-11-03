import "server-only";
import { after } from "next/server";
import { pushConfigured } from "./config";
export function schedulePushProcessing() {
  if (!pushConfigured()) return;
  // Best-effort kick, never a replacement for the durable scheduled processor.
  // Registering/running the callback must never fail the confirmed attendance.
  try { after(async () => { try { const { processPushBatch } = await import("./worker"); await processPushBatch(5); } catch { /* Durable outbox retries via authenticated scheduler. */ } }); }
  catch { /* Not all execution environments support after; the outbox persists. */ }
}
