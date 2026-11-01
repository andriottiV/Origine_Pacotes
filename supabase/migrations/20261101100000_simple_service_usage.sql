-- Preserve the ledger, RLS and financial records. All writers lock the package.
create or replace function public.register_service_usage(p_package_id uuid, p_quantity integer, p_note text default null)
returns public.service_usages language plpgsql security definer set search_path = public as $$
declare v_pkg public.client_packages; v_usage public.service_usages; v_used bigint;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if auth.uid() is null then raise exception 'Autenticação obrigatória'; end if;
  if p_quantity is null or p_quantity not in (1, 2) then raise exception 'Escolha 1 ou 2 serviços'; end if;
  select cp.* into v_pkg from public.client_packages as cp where cp.id = p_package_id for update;
  if not found or not public.is_member(v_pkg.organization_id) then raise exception 'Pacote não encontrado ou sem permissão'; end if;
  if not exists (select 1 from public.clients as c where c.id = v_pkg.client_id and c.organization_id = v_pkg.organization_id) then
    raise exception 'Cliente do pacote inválido';
  end if;
  if v_today < v_pkg.starts_on then raise exception 'O pacote ainda não está vigente'; end if;
  if v_today > v_pkg.expires_on then raise exception 'O pacote está vencido'; end if;
  if v_pkg.payment_status not in ('pending', 'partial', 'paid') then raise exception 'Pacote cancelado ou reembolsado'; end if;
  select coalesce(sum(su.quantity), 0) into v_used from public.service_usages as su
    where su.client_package_id = v_pkg.id and su.reversed_at is null;
  if v_used + p_quantity > v_pkg.total_services then raise exception 'Saldo insuficiente'; end if;
  insert into public.service_usages(organization_id, client_package_id, client_id, quantity, note, created_by)
    values (v_pkg.organization_id, v_pkg.id, v_pkg.client_id, p_quantity, p_note, auth.uid()) returning * into v_usage;
  return v_usage;
end $$;

create or replace function public.register_service_usage_idempotent(p_package_id uuid, p_quantity integer, p_note text, p_idempotency_key uuid)
returns public.service_usages language plpgsql security definer set search_path = public as $$
declare v_usage public.service_usages;
begin
  if auth.uid() is null then raise exception 'Autenticação obrigatória'; end if;
  if p_quantity is null or p_quantity not in (1, 2) then raise exception 'Escolha 1 ou 2 serviços'; end if;
  if p_idempotency_key is null then raise exception 'Chave de idempotência obrigatória'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));
  select su.* into v_usage from public.service_usages as su where su.idempotency_key = p_idempotency_key;
  if found then
    if not public.is_member(v_usage.organization_id) or v_usage.created_by is distinct from auth.uid()
      or v_usage.client_package_id is distinct from p_package_id or v_usage.quantity is distinct from p_quantity
      or v_usage.note is distinct from p_note then raise exception 'Chave de uso inválida para esta solicitação'; end if;
    return v_usage;
  end if;
  select r.* into v_usage from public.register_service_usage(p_package_id, p_quantity, p_note) as r;
  update public.service_usages as su set idempotency_key = p_idempotency_key where su.id = v_usage.id returning su.* into v_usage;
  insert into public.audit_logs(organization_id, actor_id, action, entity_type, entity_id, details)
    values(v_usage.organization_id, auth.uid(), 'service.used', 'service_usage', v_usage.id, jsonb_build_object('quantity', v_usage.quantity));
  return v_usage;
end $$;

-- Bind the selected client and current organization to the package in SQL.
create or replace function public.register_service_usage_for_client(p_package_id uuid, p_client_id uuid, p_organization_id uuid, p_quantity integer, p_idempotency_key uuid)
returns public.service_usages language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_member(p_organization_id) then raise exception 'Sem permissão para registrar uso'; end if;
  if p_idempotency_key is null then raise exception 'Chave de idempotência obrigatória'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));
  perform 1 from public.client_packages as cp where cp.id = p_package_id
    and cp.client_id = p_client_id and cp.organization_id = p_organization_id for update;
  if not found then raise exception 'Pacote não pertence ao cliente e à organização selecionados'; end if;
  return public.register_service_usage_idempotent(p_package_id, p_quantity, null, p_idempotency_key);
end $$;

create or replace function public.reverse_service_usage(p_usage_id uuid, p_organization_id uuid)
returns public.service_usages language plpgsql security definer set search_path = public as $$
declare v_usage public.service_usages;
begin
  if auth.uid() is null or not public.is_member(p_organization_id) then raise exception 'Sem permissão para estornar uso'; end if;
  select su.* into v_usage from public.service_usages as su where su.id = p_usage_id and su.organization_id = p_organization_id;
  if not found then raise exception 'Uso não encontrado ou sem permissão'; end if;
  -- Same lock order as consumption, so reversals and uses serialize together.
  perform 1 from public.client_packages as cp where cp.id = v_usage.client_package_id for update;
  select su.* into v_usage from public.service_usages as su where su.id = p_usage_id for update;
  if v_usage.reversed_at is not null then return v_usage; end if;
  update public.service_usages as su set reversed_at = now(), reversed_by = auth.uid(), reversal_reason = 'Correção de uso'
    where su.id = p_usage_id returning su.* into v_usage;
  insert into public.audit_logs(organization_id, actor_id, action, entity_type, entity_id, details)
    values(v_usage.organization_id, auth.uid(), 'service.reversed', 'service_usage', v_usage.id, jsonb_build_object('quantity', v_usage.quantity));
  -- Balance comes from active usages. Never change dates or payment status.
  return v_usage;
end $$;

-- The non-idempotent entry point is internal; legacy ledger rows remain intact.
revoke all on function public.register_service_usage(uuid, integer, text) from public, anon, authenticated;
revoke all on function public.register_service_usage_idempotent(uuid, integer, text, uuid) from public, anon;
revoke all on function public.register_service_usage_for_client(uuid, uuid, uuid, integer, uuid) from public, anon;
revoke all on function public.reverse_service_usage(uuid, uuid) from public, anon;
grant execute on function public.register_service_usage_idempotent(uuid, integer, text, uuid) to authenticated;
grant execute on function public.register_service_usage_for_client(uuid, uuid, uuid, integer, uuid) to authenticated;
grant execute on function public.reverse_service_usage(uuid, uuid) to authenticated;

-- Staff can register uses and therefore need read access to the package chooser.
create policy "members read packages" on public.client_packages for select using (public.is_member(organization_id));

create or replace function public.usage_professionals(p_organization_id uuid)
returns table(user_id uuid, full_name text)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_member(p_organization_id) then raise exception 'Sem permissão'; end if;
  return query select om.user_id, coalesce(p.full_name, 'Profissional da organização')
    from public.organization_members as om left join public.profiles as p on p.id = om.user_id
    where om.organization_id = p_organization_id;
end $$;
revoke all on function public.usage_professionals(uuid) from public, anon;
grant execute on function public.usage_professionals(uuid) to authenticated;
