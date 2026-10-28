-- Real package sales and idempotent service consumption.  This migration is
-- additive: it keeps RLS enabled and authorizes every SECURITY DEFINER entry
-- point from auth.uid(), never from caller supplied organization ids.

alter table public.service_usages add column if not exists idempotency_key uuid;
create unique index if not exists service_usages_idempotency_key_unique
  on public.service_usages (idempotency_key) where idempotency_key is not null;

create or replace function public.create_organization(p_name text, p_accent_color text default '#486B53') returns public.organizations
language plpgsql security definer set search_path = public as $$
declare organization public.organizations;
begin
  if auth.uid() is null then raise exception 'Autenticação obrigatória'; end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 then raise exception 'Nome da organização inválido'; end if;
  if p_accent_color !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Cor de destaque inválida'; end if;
  insert into public.organizations(name, accent_color) values (trim(p_name), p_accent_color) returning * into organization;
  insert into public.organization_members(organization_id, user_id, role) values (organization.id, auth.uid(), 'owner');
  insert into public.package_types(organization_id,name,service_count,price,duration_months)
    values (organization.id,'Pacote 4 serviços',4,180,1),(organization.id,'Pacote 6 serviços',6,270,1),(organization.id,'Pacote 8 serviços',8,360,1);
  insert into public.audit_logs(organization_id,actor_id,action,entity_type,entity_id)
    values (organization.id,auth.uid(),'organization.created','organization',organization.id);
  return organization;
end $$;

create or replace function public.ensure_default_package_types() returns setof public.package_types
language plpgsql security definer set search_path = public as $$
declare org_id uuid;
begin
  select organization_id into org_id from public.organization_members where user_id=auth.uid() limit 1;
  if org_id is null or not public.is_manager(org_id) then raise exception 'Sem permissão para configurar pacotes'; end if;
  if not exists (select 1 from public.package_types where organization_id=org_id) then
    insert into public.package_types(organization_id,name,service_count,price,duration_months)
      values (org_id,'Pacote 4 serviços',4,180,1),(org_id,'Pacote 6 serviços',6,270,1),(org_id,'Pacote 8 serviços',8,360,1);
  end if;
  return query select * from public.package_types where organization_id=org_id order by service_count;
end $$;

create or replace function public.sell_client_package(
  p_client_id uuid, p_package_type_id uuid, p_validity text, p_custom_expires_on date,
  p_discount numeric, p_payment_amount numeric, p_payment_method public.payment_method,
  p_idempotency_key uuid
) returns public.client_packages
language plpgsql security definer set search_path = public as $$
declare org_id uuid; c public.clients; t public.package_types; pkg public.client_packages;
  final_amount numeric(12,2); expiry date; paid numeric(12,2); status public.payment_status;
begin
  select organization_id into org_id from public.organization_members where user_id=auth.uid() limit 1;
  if org_id is null or not public.is_manager(org_id) then raise exception 'Sem permissão para vender pacotes'; end if;
  if p_idempotency_key is null then raise exception 'Chave de idempotência obrigatória'; end if;
  select * into pkg from public.client_packages where idempotency_key=p_idempotency_key;
  if found then
    if pkg.organization_id <> org_id then raise exception 'Chave de venda inválida'; end if;
    return pkg;
  end if;
  select * into c from public.clients where id=p_client_id and organization_id=org_id and status='active' for share;
  if not found then raise exception 'Cliente ativo não encontrado'; end if;
  select * into t from public.package_types where id=p_package_type_id and organization_id=org_id and active=true for share;
  if not found then raise exception 'Tipo de pacote ativo não encontrado'; end if;
  if coalesce(p_discount,0) < 0 or coalesce(p_discount,0) > t.price then raise exception 'Desconto inválido'; end if;
  final_amount := t.price - coalesce(p_discount,0);
  if coalesce(p_payment_amount,0) < 0 or coalesce(p_payment_amount,0) > final_amount then raise exception 'Valor recebido inválido'; end if;
  if p_validity='month_end' then expiry := (date_trunc('month',current_date) + interval '1 month - 1 day')::date;
  elsif p_validity='one_month' then expiry := (current_date + interval '1 month')::date;
  elsif p_validity='custom' and p_custom_expires_on >= current_date then expiry := p_custom_expires_on;
  else raise exception 'Validade inválida'; end if;
  status := case when p_payment_amount=0 then 'pending'::public.payment_status when p_payment_amount=final_amount then 'paid'::public.payment_status else 'partial'::public.payment_status end;
  insert into public.client_packages(organization_id,client_id,package_type_id,package_name,total_services,contracted_price,discount,final_price,starts_on,expires_on,payment_status,created_by,idempotency_key)
    values(org_id,c.id,t.id,t.name,t.service_count,t.price,coalesce(p_discount,0),final_amount,current_date,expiry,status,auth.uid(),p_idempotency_key) returning * into pkg;
  if p_payment_amount > 0 then insert into public.payments(organization_id,client_package_id,amount,method,status,created_by)
    values(org_id,pkg.id,p_payment_amount,p_payment_method,'paid',auth.uid()); end if;
  insert into public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
    values(org_id,auth.uid(),'package.sold','client_package',pkg.id,jsonb_build_object('client_id',c.id,'payment_amount',p_payment_amount));
  return pkg;
end $$;

create or replace function public.register_service_usage_idempotent(p_package_id uuid, p_quantity integer, p_note text, p_idempotency_key uuid) returns public.service_usages
language plpgsql security definer set search_path = public as $$
declare usage public.service_usages;
begin
  if p_idempotency_key is null then raise exception 'Chave de idempotência obrigatória'; end if;
  perform pg_advisory_xact_lock(hashtext(p_idempotency_key::text));
  select * into usage from public.service_usages where idempotency_key=p_idempotency_key;
  if found then return usage; end if;
  select * into usage from public.register_service_usage(p_package_id,p_quantity,p_note);
  update public.service_usages set idempotency_key=p_idempotency_key where id=usage.id returning * into usage;
  insert into public.audit_logs(organization_id,actor_id,action,entity_type,entity_id)
    values(usage.organization_id,auth.uid(),'service.used','service_usage',usage.id);
  return usage;
end $$;

revoke all on function public.ensure_default_package_types() from public, anon;
revoke all on function public.sell_client_package(uuid,uuid,text,date,numeric,numeric,public.payment_method,uuid) from public, anon;
revoke all on function public.register_service_usage_idempotent(uuid,integer,text,uuid) from public, anon;
grant execute on function public.ensure_default_package_types() to authenticated;
grant execute on function public.sell_client_package(uuid,uuid,text,date,numeric,numeric,public.payment_method,uuid) to authenticated;
grant execute on function public.register_service_usage_idempotent(uuid,integer,text,uuid) to authenticated;
