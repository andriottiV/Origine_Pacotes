import { beforeEach,expect,it,vi } from "vitest";
const {rpc,send,configured}=vi.hoisted(()=>({rpc:vi.fn(),send:vi.fn(),configured:vi.fn(()=>true)}));
vi.mock("@/lib/supabase/admin",()=>({createSupabaseAdminClient:()=>({rpc})}));
vi.mock("./transport",()=>({pushConfigured:configured,sendPush:send}));
import {processPushBatch} from "./worker";
const claim={event_id:"event",subscription_id:"device",claim_token:"lease"};
const event={endpoint:"https://test.invalid/never-sent",p256dh:"fake",auth_key:"fake",binding_token:"binding",kind:"used",quantity:2,remaining:6,client_package_id:"10000000-0000-4000-8000-000000000040",expires_at:new Date(Date.now()+3600000).toISOString()};
beforeEach(()=>{vi.clearAllMocks();configured.mockReturnValue(true);send.mockResolvedValue(201);rpc.mockImplementation(async(name:string)=>({data:name==="claim_push_deliveries"?[claim]:name==="authorize_push_delivery"?[event]:null,error:null}));});
it("rechecks authorization and sends only the immutable snapshot",async()=>{
 expect(await processPushBatch()).toMatchObject({claimed:1,accepted:1});expect(send).toHaveBeenCalledTimes(1);
 expect(JSON.parse(send.mock.calls[0][1])).toMatchObject({body:"Foram utilizados 2 serviços do seu pacote. Você ainda tem 6 serviços disponíveis.",url:"/cliente/pacotes/10000000-0000-4000-8000-000000000040"});
 expect(rpc).toHaveBeenCalledWith("finish_push_delivery",expect.objectContaining({p_code:201,p_claim_token:"lease"}));
});
it("does not send if preferences, subscription or identity were revoked",async()=>{
 rpc.mockImplementation(async(name:string)=>({data:name==="claim_push_deliveries"?[claim]:[],error:null}));await processPushBatch();expect(send).not.toHaveBeenCalled();expect(rpc).toHaveBeenCalledWith("finish_push_delivery",expect.objectContaining({p_code:499}));
});
it("leaves provider failures to limited per-device database retry state",async()=>{
 send.mockRejectedValue(new Error("mock network failure, never logged"));await expect(processPushBatch()).resolves.toMatchObject({accepted:0});expect(rpc).toHaveBeenCalledWith("finish_push_delivery",expect.objectContaining({p_code:0}));
});
it("does not claim jobs when VAPID is not configured",async()=>{configured.mockReturnValue(false);await processPushBatch();expect(rpc).not.toHaveBeenCalled();});

it("isolates an unexpected device failure and finishes the other device",async()=>{
 rpc.mockImplementation(async(name:string,args?:{p_subscription_id?:string})=>{
   if(name==="claim_push_deliveries")return {data:[{...claim,subscription_id:"broken"},claim],error:null};
   if(name==="authorize_push_delivery"&&args?.p_subscription_id==="broken")throw new Error("mock unavailable");
   return {data:name==="authorize_push_delivery"?[event]:null,error:null};
 });
 await expect(processPushBatch()).resolves.toMatchObject({claimed:2,accepted:1});
 expect(rpc).toHaveBeenCalledWith("finish_push_delivery",expect.objectContaining({p_subscription_id:"device",p_code:201}));
});
