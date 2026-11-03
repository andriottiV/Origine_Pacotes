// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {cleanup,render,screen,waitFor} from "@testing-library/react";import userEvent from "@testing-library/user-event";import {afterEach,beforeEach,expect,it,vi} from "vitest";
const {api,support,home,binding,clear,requestPermission,subscribe}=vi.hoisted(()=>({api:vi.fn(),support:vi.fn(()=>true),home:vi.fn(()=>false),binding:vi.fn(),clear:vi.fn(),requestPermission:vi.fn(),subscribe:vi.fn()}));
vi.mock("@/lib/push/browser",()=>({pushApi:api,supportsPush:support,needsHomeScreen:home,setLocalPushBinding:binding,clearLocalPush:clear,applicationServerKey:()=>new Uint8Array([4])}));
import {readyConfiguration} from "../../tests/push-config";
import PushSettings from "./push-settings";
beforeEach(()=>{vi.clearAllMocks();support.mockReturnValue(true);home.mockReturnValue(false);api.mockResolvedValue({configuration:readyConfiguration,publicKey:"test",active:false,preferences:{used:true,reversed:true,low_balance:true,expiring:true},bindingToken:"binding"});requestPermission.mockResolvedValue("granted");subscribe.mockResolvedValue({toJSON:()=>({endpoint:"test"}),unsubscribe:vi.fn()});Object.defineProperty(window,"Notification",{configurable:true,value:{permission:"default",requestPermission}});const registration={pushManager:{getSubscription:vi.fn().mockResolvedValue(null),subscribe},active:{}};Object.defineProperty(navigator,"serviceWorker",{configurable:true,value:{register:vi.fn().mockResolvedValue(registration),getRegistration:vi.fn().mockResolvedValue(registration),ready:Promise.resolve(registration)}});});
afterEach(cleanup);
it("does not prompt on mount; explicit activation persists then binds the device",async()=>{
 const user=userEvent.setup();render(<PushSettings publicKey="test" configuration={readyConfiguration}/>);await waitFor(()=>expect(screen.getByRole("button",{name:"Ativar notificações"})).toBeEnabled());expect(requestPermission).not.toHaveBeenCalled();await user.click(screen.getByRole("button",{name:"Ativar notificações"}));await screen.findByText("Notificações ativadas neste aparelho.");expect(requestPermission).toHaveBeenCalledTimes(1);expect(api).toHaveBeenCalledWith("subscription","POST",{endpoint:"test"});expect(binding).toHaveBeenCalledWith(expect.anything(),"binding");
});
it("does not subscribe after denied consent",async()=>{
 requestPermission.mockResolvedValue("denied");const user=userEvent.setup();render(<PushSettings publicKey="test" configuration={readyConfiguration}/>);await waitFor(()=>expect(screen.getByRole("button",{name:"Ativar notificações"})).toBeEnabled());await user.click(screen.getByRole("button",{name:"Ativar notificações"}));await screen.findByText(/A permissão foi bloqueada/);expect(subscribe).not.toHaveBeenCalled();
});
it("explains Home Screen installation and leaves the portal accessible",async()=>{
 home.mockReturnValue(true);render(<PushSettings publicKey="test" configuration={readyConfiguration}/>);expect(screen.getByText(/Adicionar à Tela de Início/)).toBeInTheDocument();expect(screen.getByRole("button",{name:"Ativar notificações"})).toBeDisabled();await waitFor(()=>expect(screen.queryByText("Consultando este aparelho…")).not.toBeInTheDocument());expect(requestPermission).not.toHaveBeenCalled();
});
it("reports unsupported browsers without prompting",async()=>{
 support.mockReturnValue(false);render(<PushSettings publicKey="test" configuration={readyConfiguration}/>);expect(screen.getByText(/não oferece Web Push/)).toBeInTheDocument();expect(requestPermission).not.toHaveBeenCalled();await waitFor(()=>expect(screen.queryByText("Consultando este aparelho…")).not.toBeInTheDocument());
});

it("reports incomplete server configuration separately from browser support",async()=>{
 const missing={...readyConfiguration,configured:false,issues:["private_key_missing"] as const,checks:{...readyConfiguration.checks,privateKeyPresent:false}};
 api.mockResolvedValue({configuration:missing,publicKey:"test",active:false,preferences:{used:true,reversed:true,low_balance:true,expiring:true}});
 render(<PushSettings publicKey="test" configuration={readyConfiguration}/>);
 await screen.findByText(/Configuração do servidor incompleta/);
 expect(screen.getByText(/VAPID_PRIVATE_KEY não está configurada/)).toBeInTheDocument();
 expect(screen.getByRole("button",{name:"Ativar notificações"})).toBeDisabled();expect(requestPermission).not.toHaveBeenCalled();
});
it("shows API load failure and offers retry without claiming configuration is missing",async()=>{
 api.mockRejectedValueOnce(new Error("HTTP 503"));const user=userEvent.setup();render(<PushSettings publicKey="test" configuration={readyConfiguration}/>);
 expect(await screen.findByRole("alert")).toHaveTextContent("Falha ao carregar a configuração");
 expect(screen.queryByText(/Configuração do servidor incompleta/)).not.toBeInTheDocument();expect(screen.getByRole("button",{name:"Ativar notificações"})).toBeDisabled();
 await user.click(screen.getByRole("button",{name:"Tentar carregar novamente"}));
 await waitFor(()=>expect(screen.getByRole("button",{name:"Ativar notificações"})).toBeEnabled());expect(requestPermission).not.toHaveBeenCalled();
});
it("treats absent SW registration as normal, not missing server configuration",async()=>{
 vi.mocked(navigator.serviceWorker.getRegistration).mockResolvedValueOnce(undefined);render(<PushSettings publicKey="test" configuration={readyConfiguration}/>);
 await waitFor(()=>expect(screen.getByRole("button",{name:"Ativar notificações"})).toBeEnabled());expect(screen.getByText(/será registrado somente ao ativar/)).toBeInTheDocument();expect(navigator.serviceWorker.register).not.toHaveBeenCalled();
});
it("distinguishes SW inspection failure from API configuration failure",async()=>{
 vi.mocked(navigator.serviceWorker.getRegistration).mockRejectedValueOnce(new Error("browser failure"));render(<PushSettings publicKey="test" configuration={readyConfiguration}/>);
 expect(await screen.findByRole("alert")).toHaveTextContent("Falha ao consultar o service worker");expect(screen.queryByText(/Configuração do servidor incompleta/)).not.toBeInTheDocument();
});
it("distinguishes registration failure and subscription API failure",async()=>{
 const user=userEvent.setup();vi.mocked(navigator.serviceWorker.register).mockRejectedValueOnce(new Error("script failure"));render(<PushSettings publicKey="test" configuration={readyConfiguration}/>);
 await waitFor(()=>expect(screen.getByRole("button",{name:"Ativar notificações"})).toBeEnabled());await user.click(screen.getByRole("button",{name:"Ativar notificações"}));
 await screen.findByText(/Falha ao registrar ou configurar o service worker/);
 api.mockRejectedValueOnce(new Error("HTTP 503"));await user.click(screen.getByRole("button",{name:"Ativar notificações"}));await screen.findByText(/Falha ao salvar a assinatura no servidor/);
});

it("refreshes an initially disabled server render instead of staying stuck",async()=>{
 const initial={...readyConfiguration,configured:false,issues:["push_disabled"] as ("push_disabled")[],checks:{...readyConfiguration.checks,enabled:false}};
 render(<PushSettings publicKey="" configuration={initial}/>);
 await waitFor(()=>expect(screen.getByRole("button",{name:"Ativar notificações"})).toBeEnabled());
 expect(screen.queryByText(/Configuração do servidor incompleta/)).not.toBeInTheDocument();expect(requestPermission).not.toHaveBeenCalled();
});
