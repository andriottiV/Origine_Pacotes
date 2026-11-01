// Opt-in, server-side only. Never log URLs with query parameters, credentials,
// request bodies, client names, user ids or organization ids.
export async function timed<T>(stage: string, operation: () => PromiseLike<T>): Promise<T> {
  if (process.env.ORIGINE_PERF !== "1") return await operation();
  const started = performance.now();
  try { return await operation(); }
  finally { console.info("origine-perf", { stage, ms: Math.round((performance.now() - started) * 100) / 100 }); }
}
export function createTimedFetch(surface: "proxy" | "server"): typeof fetch {
  const trace = surface + "." + crypto.randomUUID().slice(0, 8);
  return async (input, init) => {
    if (process.env.ORIGINE_PERF !== "1") return fetch(input, init);
    const url = new URL(input instanceof Request ? input.url : String(input));
    const parts = url.pathname.split("/").filter(Boolean);
    const stage = trace + "." + parts.slice(0, parts[0] === "rest" && parts[2] === "rpc" ? 4 : 3).join(".");
    return timed(stage, () => fetch(input, init));
  };
}
