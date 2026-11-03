export const pushKinds = ["used", "reversed", "low_balance", "expiring"] as const;
export type PushKind = typeof pushKinds[number];
export type PushPreferences = Record<PushKind, boolean>;
export const defaultPushPreferences: PushPreferences = { used: true, reversed: true, low_balance: true, expiring: true };
const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
export function safePushDestination(value?: string | null) {
  return value && (value === "/cliente" || new RegExp("^/cliente/pacotes/" + uuid + "$", "i").test(value)) ? value : "/cliente";
}
export function pushBody(event: { kind: PushKind; quantity: number | null; remaining: number }) {
  const n = Number(event.remaining);
  const balance = n === 0 ? "Nenhum serviço disponível." : n === 1 ? "Você ainda tem 1 serviço disponível." : 'Você ainda tem ' + n + ' serviços disponíveis.';
  switch (event.kind) {
    case "used": return (event.quantity === 1 ? "Foi utilizado 1 serviço do seu pacote. " : 'Foram utilizados ' + event.quantity + ' serviços do seu pacote. ') + balance;
    case "reversed": return n === 0 ? "Um uso foi estornado. Nenhum serviço disponível." : 'Um uso foi estornado. Seu pacote agora tem ' + n + (n === 1 ? ' serviço disponível.' : ' serviços disponíveis.');
    case "low_balance": return n === 0 ? "Nenhum serviço disponível." : 'Seu pacote está acabando: você tem ' + n + (n === 1 ? ' serviço disponível.' : ' serviços disponíveis.');
    case "expiring": return "Seu pacote vence em 3 dias. " + balance;
  }
}
