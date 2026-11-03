import { afterEach,beforeEach,expect,it,vi } from "vitest";
const {identity,rpc,origin,parse,resolve,configuration}=vi.hoisted(()=>({identity:vi.fn(),rpc:vi.fn(),origin:vi.fn(()=>true),parse:vi.fn(),resolve:vi.fn(),configuration:vi.fn()}));
vi.mock("@/lib/push/config",()=>({getPushConfiguration:configuration,getPushPublicKey:()=>"test-public"}));
vi.mock("@/lib/push/server",()=>({pushIdentity:identity,currentDevice:async()=>({value:"opaque-device-cookie",hash:"server-device-hash"}),deviceCookie:"op_push_device",sameOrigin:origin,smallJson:(r:Request)=>r.json(),detachPushDevice:async()=>{},privateJson:(v:unknown,status=200)=>Response.json(v,{status})}));
vi.mock("@/lib/supabase/admin",()=>({createSupabaseAdminClient:vi.fn(()=>({rpc,from:()=>({select(){return this},eq(){return this},maybeSingle:async()=>({data:{used:true,reversed:true,low_balance:true,expiring:true},error:null})})}))}));vi.mock("@/lib/push/endpoints",()=>({parsePushSubscription:parse,resolvePushEndpoint:resolve}));
import { GET,POST } from "./route";
import {createSupabaseAdminClient} from "@/lib/supabase/admin";
import {readyConfiguration} from "../../../../../tests/push-config";
beforeEach(()=>{vi.clearAllMocks();configuration.mockReturnValue(readyConfiguration);vi.stubEnv("PUSH_ENABLED","true");vi.stubEnv("VAPID_PRIVATE_KEY","test-private");vi.stubEnv("VAPID_SUBJECT","mailto:test@example.invalid");vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY","test-public");identity.mockResolvedValue({id:"real-identity",client_id:"real-client",organization_id:"real-org"});origin.mockReturnValue(true);parse.mockReturnValue({endpoint:"https://fcm.googleapis.com/test",keys:{p256dh:"test",auth:"test"}});resolve.mockResolvedValue({});rpc.mockResolvedValue({data:"binding",error:null});});
const request=()=>new Request("https://example.invalid/api/push/subscription",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({client_id:"forged-client",organization_id:"forged-org"})});
it("binds only to the authenticated server identity and opaque device cookie",async()=>{
 const response=await POST(request());expect(response.status).toBe(200);expect(rpc).toHaveBeenCalledWith("bind_push_subscription",{p_identity_id:"real-identity",p_device_hash:"server-device-hash",p_endpoint:"https://fcm.googleapis.com/test",p_p256dh:"test",p_auth:"test"});expect(response.headers.get("set-cookie")).toContain("HttpOnly");
});
it("rejects missing identity and cross-origin mutation before privileged operations",async()=>{
 identity.mockResolvedValue(null);expect((await POST(request())).status).toBe(401);expect(rpc).not.toHaveBeenCalled();origin.mockReturnValue(false);expect((await POST(request())).status).toBe(403);
});
it("never logs or exposes a failed subscription capability",async()=>{
 rpc.mockResolvedValue({error:{message:"secret endpoint/keys"}});const response=await POST(request());expect(response.status).toBe(503);expect(await response.text()).not.toContain("secret endpoint");
});

afterEach(()=>vi.unstubAllEnvs());

it("returns safe configuration before querying subscriptions when server is incomplete",async()=>{
 configuration.mockReturnValue({...readyConfiguration,configured:false,issues:["private_key_missing"]});
 const response=await GET();expect(response.status).toBe(200);expect(await response.json()).toMatchObject({configuration:{configured:false,issues:["private_key_missing"]}});expect(createSupabaseAdminClient).not.toHaveBeenCalled();
});
it("rejects activation with structured configuration errors before accepting a subscription",async()=>{
 configuration.mockReturnValue({...readyConfiguration,configured:false,issues:["push_disabled"]});
 const response=await POST(request());expect(response.status).toBe(503);expect(await response.json()).toMatchObject({configuration:{issues:["push_disabled"]}});expect(parse).not.toHaveBeenCalled();
});
