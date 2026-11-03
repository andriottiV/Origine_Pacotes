"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { defaultPushPreferences, pushKinds, type PushPreferences } from "@/lib/push/shared";
import { applicationServerKey, clearLocalPush, needsHomeScreen, pushApi, setLocalPushBinding, supportsPush } from "@/lib/push/browser";
const labels = { used: "Uso registrado", reversed: "Uso estornado", low_balance: "Saldo baixo", expiring: "Vencimento próximo" };
function subscribeBrowser(callback: () => void) {
  window.addEventListener("focus", callback); window.addEventListener("origine-push-status", callback);
  return () => { window.removeEventListener("focus", callback); window.removeEventListener("origine-push-status", callback); };
}
function browserSnapshot() { return JSON.stringify({ supported: supportsPush(), install: needsHomeScreen(), permission: "Notification" in window ? Notification.permission : "default" }); }
export default function PushSettings({ publicKey, configured }: { publicKey: string; configured: boolean }) {
  const snapshot = useSyncExternalStore(subscribeBrowser, browserSnapshot, () => "unknown");
  const features = snapshot === "unknown" ? null : JSON.parse(snapshot) as { supported: boolean; install: boolean; permission: NotificationPermission };
  const supported = features?.supported ?? null; const install = features?.install ?? false;
  const permission = features?.permission ?? "default";
  const [active, setActive] = useState(false);
  const [preferences, setPreferences] = useState<PushPreferences>(defaultPushPreferences);
  const [loaded, setLoaded] = useState(false);
  const loading = supported === null || (supported && configured && !loaded);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const lock = useRef(false);
  useEffect(() => {
    if (!supported || !configured) return;
    let mounted = true;
    // Reading status never requests permission or creates/rebinds a subscription.
    async function status() {
      try {
        const [saved, registration] = await Promise.all([pushApi("subscription"), navigator.serviceWorker.getRegistration("/")]);
        const sub = await registration?.pushManager.getSubscription();
        const currentKey = sub?.options.applicationServerKey;
        const matchesKey = !currentKey || Array.from(new Uint8Array(currentKey)).join() === Array.from(applicationServerKey(publicKey)).join();
        if (mounted) { setActive(saved.active && Boolean(sub) && matchesKey && Notification.permission === "granted"); setPreferences(saved.preferences); if (sub && !matchesKey) setMessage("A configuração foi atualizada. Ative novamente as notificações neste aparelho."); }
      } catch { if (mounted) setMessage("Não foi possível consultar o estado salvo. Você pode tentar ativar novamente."); }
      finally { if (mounted) setLoaded(true); }
    }
    void status(); return () => { mounted = false; };
  }, [configured, supported, publicKey]);
  async function enable() {
    if (lock.current || !supported || install) return;
    lock.current = true; setBusy(true); setMessage("");
    let subscription: PushSubscription | null = null;
    try {
      // Must occur directly from the click, before registration/network awaits.
      const granted = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      window.dispatchEvent(new Event("origine-push-status"));
      if (granted !== "granted") { setMessage(granted === "denied" ? "A permissão foi bloqueada. Libere as notificações nas configurações deste navegador ou aparelho." : "A ativação não foi autorizada. Você pode tentar novamente quando quiser."); return; }
      await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
      let readyTimer: ReturnType<typeof setTimeout> | undefined;
      const registration = await Promise.race([navigator.serviceWorker.ready, new Promise<never>((_, reject) => { readyTimer = setTimeout(() => reject(new Error("O navegador não conseguiu preparar as notificações. Tente novamente.")), 10000); })]).finally(() => clearTimeout(readyTimer));
      subscription = await registration.pushManager.getSubscription();
      const key = applicationServerKey(publicKey);
      const currentKey = subscription?.options.applicationServerKey;
      if (subscription && currentKey && Array.from(new Uint8Array(currentKey)).join() !== Array.from(key).join()) { await subscription.unsubscribe(); subscription = null; }
      subscription ||= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      const result = await pushApi("subscription", "POST", subscription.toJSON());
      await setLocalPushBinding(registration, result.bindingToken);
      setActive(true); setPreferences(result.preferences || defaultPushPreferences); setMessage("Notificações ativadas neste aparelho.");
    } catch (error) {
      await Promise.allSettled([clearLocalPush(), subscription?.unsubscribe()]);
      setActive(false); setMessage(error instanceof Error ? error.message : "Não foi possível ativar neste aparelho. Tente novamente.");
    } finally { setBusy(false); lock.current = false; }
  }
  async function disable() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setMessage("");
    const result = await Promise.allSettled([pushApi("subscription", "DELETE"), clearLocalPush()]);
    if (result.some(item => item.status === "fulfilled")) setActive(false);
    setMessage(result.every(item => item.status === "fulfilled") ? "Notificações desativadas neste aparelho." : result[0].status === "fulfilled" ? "Desativadas no servidor. Não foi possível limpar tudo no navegador; tente novamente." : result[1].status === "fulfilled" ? "Desativadas neste navegador. Não foi possível confirmar no servidor; tente novamente." : "Não foi possível desativar as notificações. Tente novamente ou bloqueie-as nas configurações do aparelho.");
    setBusy(false); lock.current = false;
  }
  async function save() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setMessage("");
    try { await pushApi("preferences", "PUT", preferences); setMessage("Preferências salvas para todos os seus aparelhos."); }
    catch { setMessage("Não foi possível salvar suas preferências. Tente novamente."); }
    finally { setBusy(false); lock.current = false; }
  }
  return <section className="card client-form push-settings"><h2>Notificações</h2>
    {loading && <p role="status">Consultando este aparelho…</p>}
    <p>Permissão neste aparelho: {permission === "granted" ? "permitida" : permission === "denied" ? "bloqueada" : "ainda não solicitada"}. {active ? "Notificações ativadas." : "Notificações desativadas."}</p>
    {install && <p>No iPhone/iPad com iOS/iPadOS 16.4 ou posterior, abra no Safari, toque em Compartilhar → Adicionar à Tela de Início e abra pelo ícone antes de ativar as notificações.</p>}
    {supported === false && !install && <p>Este navegador não oferece Web Push neste contexto. Use um navegador compatível e uma conexão HTTPS.</p>}
    {permission === "denied" && <p>A permissão está bloqueada. Altere-a nas configurações de notificações do navegador ou aparelho para ativar.</p>}
    {!configured && <p>As notificações ainda não estão disponíveis neste ambiente. O portal continua funcionando normalmente.</p>}
    <div className="dialog-actions"><button type="button" className="button primary" disabled={loading || busy || !supported || install || !configured || permission === "denied" || active} onClick={enable}>{busy ? "Processando…" : "Ativar notificações"}</button><button type="button" className="button secondary" disabled={busy || loading || !supported} onClick={disable}>Desativar neste aparelho</button></div>
    <fieldset className="usage-fields" disabled={busy || !active}><legend>Avisos em todos os seus aparelhos</legend>{pushKinds.map(kind => <label className="push-preference" key={kind}><input type="checkbox" checked={preferences[kind]} onChange={e => setPreferences({ ...preferences, [kind]: e.target.checked })} />{labels[kind]}</label>)}<button type="button" className="button secondary" onClick={save}>Salvar preferências</button></fieldset>
    {message && <p className="form-message" role="status">{message}</p>}
    <p className="form-intro">Ativar é opcional. A entrega depende da permissão, conexão e suporte do aparelho e pode falhar.</p>
  </section>;
}
