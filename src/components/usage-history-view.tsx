import UsageList, { type UsageListProps } from "./usage-list";
// Read-only portal history renders on the server; no reversal action/dialog JS.
export default function UsageHistoryView(props: UsageListProps) {
  return <section className="card client-form usage-history"><h2>Histórico de usos</h2><UsageList {...props} /></section>;
}
