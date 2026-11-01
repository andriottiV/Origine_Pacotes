-- Bounded history includes reversed rows, unlike the existing active-only index.
-- Existing usage_package_idx already supports the active-usage SUM; keep it.
create index if not exists service_usages_org_history_idx
  on public.service_usages (organization_id, occurred_at desc, id desc);
create index if not exists service_usages_client_history_idx
  on public.service_usages (client_id, occurred_at desc, id desc);
create index if not exists clients_org_recent_idx
  on public.clients (organization_id, created_at desc, id desc);

-- Read-only functions run as the caller: table RLS applies to every relation.
-- No balance cache/counter: the same active ledger remains the source of truth.
create or replace function public.client_service_balances(p_client_ids uuid[], p_organization_id uuid)
returns table(client_id uuid, remaining bigint)
language sql stable security invoker set search_path = public as $$
  select cp.client_id, sum(cp.total_services - used.quantity)::bigint as remaining
  from public.client_packages as cp
  cross join lateral (
    select coalesce(sum(su.quantity), 0) as quantity from public.service_usages as su
    where su.client_package_id = cp.id and su.reversed_at is null
  ) as used
  where cardinality(p_client_ids) <= 50 and cp.client_id = any(p_client_ids)
    and cp.organization_id = p_organization_id
    and cp.starts_on <= (now() at time zone 'America/Sao_Paulo')::date
    and cp.expires_on >= (now() at time zone 'America/Sao_Paulo')::date
    and cp.payment_status in ('pending', 'partial', 'paid')
  group by cp.client_id
$$;

create or replace function public.client_package_balances(
  p_client_id uuid, p_organization_id uuid, p_usable_only boolean default false,
  p_offset integer default 0, p_limit integer default 20
) returns table(id uuid, client_id uuid, package_name text, total_services integer,
  starts_on date, expires_on date, payment_status public.payment_status, remaining bigint)
language sql stable security invoker set search_path = public as $$
  select cp.id, cp.client_id, cp.package_name, cp.total_services, cp.starts_on,
    cp.expires_on, cp.payment_status, cp.total_services - used.quantity as remaining
  from public.client_packages as cp
  cross join lateral (
    select coalesce(sum(su.quantity), 0) as quantity from public.service_usages as su
    where su.client_package_id = cp.id and su.reversed_at is null
  ) as used
  where cp.client_id = p_client_id and cp.organization_id = p_organization_id
    and (not p_usable_only or (
      cp.starts_on <= (now() at time zone 'America/Sao_Paulo')::date
      and cp.expires_on >= (now() at time zone 'America/Sao_Paulo')::date
      and cp.payment_status in ('pending', 'partial', 'paid')
      and cp.total_services > used.quantity))
  order by cp.created_at desc, cp.id desc
  limit greatest(1, least(coalesce(p_limit, 20), 51))
  offset greatest(0, least(coalesce(p_offset, 0), 100000))
$$;
revoke all on function public.client_service_balances(uuid[], uuid) from public, anon;
revoke all on function public.client_package_balances(uuid, uuid, boolean, integer, integer) from public, anon;
grant execute on function public.client_service_balances(uuid[], uuid) to authenticated;
grant execute on function public.client_package_balances(uuid, uuid, boolean, integer, integer) to authenticated;
