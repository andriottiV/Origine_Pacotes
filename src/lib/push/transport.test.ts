import {EventEmitter} from "node:events";import {beforeEach,expect,it,vi} from "vitest";
const {request,resolve,details}=vi.hoisted(()=>({request:vi.fn(),resolve:vi.fn(),details:vi.fn()}));
vi.mock("node:https",()=>({request}));vi.mock("web-push",()=>({default:{generateRequestDetails:details}}));
vi.mock("./endpoints",async original=>({...await original<typeof import("./endpoints")>(),resolvePushEndpoint:resolve}));
import {sendPush} from "./transport";
beforeEach(()=>{vi.clearAllMocks();resolve.mockResolvedValue({url:new URL("https://fcm.googleapis.com/send/test"),address:"8.8.8.8",family:4});details.mockReturnValue({headers:{Authorization:"test-only"},body:Buffer.from("encrypted-test")});});
const target={endpoint:"https://fcm.googleapis.com/send/test",p256dh:"fake",auth_key:"fake"};
it("pins DNS, preserves TLS hostname and does not follow redirects",async()=>{
 const req=new EventEmitter() as EventEmitter & {end:()=>void;destroy:()=>void};req.destroy=vi.fn();request.mockImplementation((_options,callback)=>{req.end=()=>callback({statusCode:302,headers:{location:"http://127.0.0.1"},resume:vi.fn()});return req});
 expect(await sendPush(target,"private encrypted payload",30)).toBe(302);expect(request).toHaveBeenCalledTimes(1);const options=request.mock.calls[0][0];expect(options).toMatchObject({hostname:"fcm.googleapis.com",servername:"fcm.googleapis.com",family:4,agent:false,method:"POST"});const cb=vi.fn();options.lookup("fcm.googleapis.com",{},cb);expect(cb).toHaveBeenCalledWith(null,"8.8.8.8",4);
});
it("returns a retryable result for a DNS/network outage without connecting",async()=>{resolve.mockRejectedValue(new Error("dns_timeout"));expect(await sendPush(target,"test",30)).toBe(0);expect(request).not.toHaveBeenCalled();});
