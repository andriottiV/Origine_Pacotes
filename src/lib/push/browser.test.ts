// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {needsHomeScreen,supportsPush} from "./browser";
beforeEach(()=>{
 vi.stubGlobal("isSecureContext",true);vi.stubGlobal("PushManager",function(){});vi.stubGlobal("Notification",{permission:"default",requestPermission:vi.fn()});vi.stubGlobal("matchMedia",vi.fn(()=>({matches:false})));
 Object.defineProperty(navigator,"serviceWorker",{configurable:true,value:{register:vi.fn(),getRegistration:vi.fn()}});
 Object.defineProperty(navigator,"userAgent",{configurable:true,value:"iPhone"});Object.defineProperty(navigator,"platform",{configurable:true,value:"iPhone"});Object.defineProperty(navigator,"standalone",{configurable:true,value:false});
});
afterEach(()=>vi.unstubAllGlobals());
it("supports HTTPS installed iPhone without treating absent registration as unsupported",()=>{Object.defineProperty(navigator,"standalone",{configurable:true,value:true});expect(supportsPush()).toBe(true);expect(needsHomeScreen()).toBe(false);expect(navigator.serviceWorker.getRegistration).not.toHaveBeenCalled();});
it("distinguishes iPhone in the browser from a Home Screen app",()=>{expect(needsHomeScreen()).toBe(true);vi.mocked(window.matchMedia).mockReturnValue({matches:true} as MediaQueryList);expect(needsHomeScreen()).toBe(false);});
it("detects iPad desktop mode through platform and touch points",()=>{Object.defineProperty(navigator,"userAgent",{configurable:true,value:"Macintosh"});Object.defineProperty(navigator,"platform",{configurable:true,value:"MacIntel"});Object.defineProperty(navigator,"maxTouchPoints",{configurable:true,value:5});expect(needsHomeScreen()).toBe(true);});
it("rejects insecure context and incomplete push APIs",()=>{vi.stubGlobal("isSecureContext",false);expect(supportsPush()).toBe(false);vi.stubGlobal("isSecureContext",true);Object.defineProperty(navigator,"serviceWorker",{configurable:true,value:{}});expect(supportsPush()).toBe(false);});
