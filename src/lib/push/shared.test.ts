import { describe,expect,it } from "vitest";
import { pushBody,safePushDestination } from "./shared";
describe("private push text",()=>{
  it("uses real quantity and balance with correct singular/plural",()=>{
    expect(pushBody({kind:"used",quantity:2,remaining:6})).toBe("Foram utilizados 2 serviços do seu pacote. Você ainda tem 6 serviços disponíveis.");
    expect(pushBody({kind:"used",quantity:1,remaining:1})).toBe("Foi utilizado 1 serviço do seu pacote. Você ainda tem 1 serviço disponível.");
    expect(pushBody({kind:"reversed",quantity:2,remaining:8})).toBe("Um uso foi estornado. Seu pacote agora tem 8 serviços disponíveis.");
    expect(pushBody({kind:"low_balance",quantity:1,remaining:2})).toContain("2 serviços disponíveis");
    expect(pushBody({kind:"expiring",quantity:null,remaining:1})).toBe("Seu pacote vence em 3 dias. Você ainda tem 1 serviço disponível.");
  });
  it.each(["used","reversed","low_balance","expiring"] as const)("has an explicit zero message for %s",kind=>expect(pushBody({kind,quantity:1,remaining:0})).toContain("Nenhum serviço disponível"));
  it.each(["https://evil.invalid","//evil.invalid","/cliente/../login","/cliente?next=//evil.invalid","/clientes","/cliente/pacotes/invalid"])("rejects unexpected destination %s",value=>expect(safePushDestination(value)).toBe("/cliente"));
  it("accepts only the exact package detail route",()=>expect(safePushDestination("/cliente/pacotes/10000000-0000-4000-8000-000000000040")).toBe("/cliente/pacotes/10000000-0000-4000-8000-000000000040"));
});
