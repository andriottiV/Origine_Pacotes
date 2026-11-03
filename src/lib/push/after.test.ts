import {beforeEach,expect,it,vi} from "vitest";
const {after,process,configured}=vi.hoisted(()=>({after:vi.fn(),process:vi.fn(),configured:vi.fn(()=>true)}));vi.mock("next/server",()=>({after}));vi.mock("./worker",()=>({processPushBatch:process}));vi.mock("./config",()=>({pushConfigured:configured}));import {schedulePushProcessing} from "./after";
beforeEach(()=>{vi.clearAllMocks();configured.mockReturnValue(true);});
it("schedules only after the response and contains push failures",async()=>{process.mockRejectedValue(new Error("provider offline"));schedulePushProcessing();expect(process).not.toHaveBeenCalled();const run=after.mock.calls[0][0];await expect(run()).resolves.toBeUndefined();});
it("does not fail an attendance if scheduling is unavailable",()=>{after.mockImplementationOnce(()=>{throw new Error("unavailable")});expect(()=>schedulePushProcessing()).not.toThrow();});
