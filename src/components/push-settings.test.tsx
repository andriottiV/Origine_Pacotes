// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {cleanup,render,screen,waitFor} from "@testing-library/react";import userEvent from "@testing-library/user-event";import {afterEach,beforeEach,expect,it,vi} from "vitest";
const {api,support,home,binding,clear,requestPermission,subscribe}=vi.hoisted(()=>({api:vi.fn(),support:vi.fn(()=>true),home:vi.fn(()=>false),binding:vi.fn(),clear:vi.fn(),requestPermission:vi.fn(),subscribe:vi.fn()}));
vi.mock("@/lib/push/browser",()=>({pushApi:api,supportsPush:support,needsHomeScreen:home,setLocalPushBinding:binding,clearLocalPush:clear,applicationServerKey:()=>new Uint8Array([4])}));
import PushSettings from "./push-settings";
beforeEach(()=>{vi.clearAllMocks();support.mockReturnValue(true);home.mockReturnValue(false);api.mockResolvedValue({active:false,preferences:{used:true,reversed:true,low_balance:true,expiring:true},bindingToken:"binding"});requestPermission.mockResolvedValue("granted");subscribe.mockResolvedValue({toJSON:()=>({endpoint:"test"}),unsubscribe:vi.fn()});Object.defineProperty(window,"Notification",{configurable:true,value:{permission:"default",requestPermission}});const registration={pushManager:{getSubscription:vi.fn().mockResolvedValue(null),subscribe},active:{}};Object.defineProperty(navigator,"serviceWorker",{configurable:true,value:{register:vi.fn().mockResolvedValue(registration),getRegistration:vi.fn().mockResolvedValue(registration),ready:Promise.resolve(registration)}});});
afterEach(cleanup);
it("does not prompt on mount; explicit activation persists then binds the device",async()=>{
 const user=userEvent.setup();render(<PushSettings publicKey="test" configured/>);await waitFor(()=>expect(screen.getByRole("button",{name:"Ativar notificações"})).toBeEnabled());expect(requestPermission).not.toHaveBeenCalled();await user.click(screen.getByRole("button",{name:"Ativar notificações"}));await screen.findByText("Notificações ativadas neste aparelho.");expect(requestPermission).toHaveBeenCalledTimes(1);expect(api).toHaveBeenCalledWith("subscription","POST",{endpoint:"test"});expect(binding).toHaveBeenCalledWith(expect.anything(),"binding");
});
it("does not subscribe after denied consent",async()=>{
 requestPermission.mockResolvedValue("denied");const user=userEvent.setup();render(<PushSettings publicKey="test" configured/>);await waitFor(()=>expect(screen.getByRole("button",{name:"Ativar notificações"})).toBeEnabled());await user.click(screen.getByRole("button",{name:"Ativar notificações"}));await screen.findByText(/A permissão foi bloqueada/);expect(subscribe).not.toHaveBeenCalled();
});
it("explains Home Screen installation and leaves the portal accessible",async()=>{
 home.mockReturnValue(true);render(<PushSettings publicKey="test" configured/>);expect(screen.getByText(/Adicionar à Tela de Início/)).toBeInTheDocument();expect(screen.getByRole("button",{name:"Ativar notificações"})).toBeDisabled();await waitFor(()=>expect(screen.queryByText("Consultando este aparelho…")).not.toBeInTheDocument());expect(requestPermission).not.toHaveBeenCalled();
});
it("reports unsupported browsers without prompting",async()=>{
 support.mockReturnValue(false);render(<PushSettings publicKey="test" configured/>);expect(screen.getByText(/não oferece Web Push/)).toBeInTheDocument();expect(requestPermission).not.toHaveBeenCalled();await waitFor(()=>expect(screen.queryByText("Consultando este aparelho…")).not.toBeInTheDocument());
});
