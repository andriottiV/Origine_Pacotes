import { createECDH } from "node:crypto";
import { beforeEach,describe,expect,it,vi } from "vitest";
const {lookup}=vi.hoisted(()=>({lookup:vi.fn()}));vi.mock("node:dns/promises",()=>({lookup}));
import { isPublicAddress,parsePushSubscription,pushEndpoint,resolvePushEndpoint } from "./endpoints";
beforeEach(()=>vi.clearAllMocks());
describe("push SSRF boundary",()=>{
 it.each(["http://fcm.googleapis.com/x","https://localhost/x","https://127.0.0.1/x","https://[::1]/x","https://fcm.googleapis.com.evil.invalid/x","https://evil@fcm.googleapis.com/x","https://fcm.googleapis.com:444/x","https://fcm.googleapis.com/x#secret","https://metadata.google.internal/x"])("rejects %s",value=>expect(()=>pushEndpoint(value)).toThrow());
 it.each(["127.0.0.1","10.1.1.1","172.16.2.2","192.168.1.1","169.254.169.254","100.64.0.1","0.0.0.0","::1","fe80::1","fc00::1","::ffff:127.0.0.1","::ffff:192.168.1.1","2001:db8::1"])("rejects private/reserved address %s",ip=>expect(isPublicAddress(ip)).toBe(false));
 it("validates all DNS answers and returns a public address to pin",async()=>{
  lookup.mockResolvedValueOnce([{address:"8.8.8.8",family:4},{address:"127.0.0.1",family:4}]);await expect(resolvePushEndpoint("https://fcm.googleapis.com/x")).rejects.toThrow();
  lookup.mockResolvedValueOnce([{address:"8.8.8.8",family:4}]);expect(await resolvePushEndpoint("https://fcm.googleapis.com/x")).toMatchObject({address:"8.8.8.8",family:4});
 });
 it("rejects browser supplied identity and malformed keys",()=>{
  const ecdh = createECDH("prime256v1"); ecdh.generateKeys();
  const sub={endpoint:"https://fcm.googleapis.com/x",keys:{p256dh:ecdh.getPublicKey().toString("base64url"),auth:Buffer.alloc(16).toString("base64url")}};
  expect(parsePushSubscription(sub).endpoint).toBe(sub.endpoint);
  expect(()=>parsePushSubscription({...sub,client_id:"other"})).toThrow();expect(()=>parsePushSubscription({...sub,keys:{...sub.keys,p256dh:"bad"}})).toThrow();
 });
});
