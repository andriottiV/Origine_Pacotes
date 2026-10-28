-- Financial operations and organization preferences. Additive only; RLS stays enabled.
alter table public.organizations add column if not exists business_phone text;
alter table public.organizations add column if not exists whatsapp text;
alter table public.organizations add column if not exists address text;
alter table public.organizations add column if not exists description text;
alter table public.organizations add column if not exists expiry_alert_days integer not null default 5 check (expiry_alert_days in (3,5,7,10));

create index if not exists client_packages_org_created_idx on public.client_packages(organization_id, created_at desc);
create index if not exists payments_org_paid_idx on public.payments(organization_id, paid_at desc);
create index if not exists service_usages_org_occurred_idx on public.service_usages(organization_id, occurred_at desc) where reversed_at is null;

create or replace function public.record_package_payment(p_package_id uuid, p_amount numeric, p_method public.payment_method, p_note text, p_idempotency_key uuid) returns public.client_packages
language plpgsql security definer set search_path=public as $$
declare org_id uuid; pkg public.client_packages; prior_paid numeric(12,2); result public.client_packages;
begin
  select organization_id into org_id from public.organization_members where user_id=auth.uid() limit 1;
  if org_id is null or not public.is_manager(org_id) then raise exception 'Sem permissão para registrar recebimentos'; end if;
  if p_idempotency_key is null or p_amount is null or p_amount <= 0 then raise exception 'Recebimento inválido'; end if;
  select * into pkg from public.client_packages where id=p_package_id and organization_id=org_id for update;
  if not found or pkg.payment_status in ('cancelled','refunded') then raise exception 'Venda não disponível para recebimento'; end if;
  if exists(select 1 from public.payments where organization_id=org_id and note = concat('[idempotency:',p_idempotency_key::text,']')) then return pkg; end if;
  select coalesce(sum(amount),0) into prior_paid from public.payments where organization_id=org_id and client_package_id=pkg.id and status='paid';
  if p_amount > pkg.final_price-prior_paid then raise exception 'Valor maior que o saldo pendente'; end if;
  insert into public.payments(organization_id,client_package_id,amount,method,status,note,created_by)
    values(org_id,pkg.id,p_amount,p_method,'paid',concat('[idempotency:',p_idempotency_key::text,'] ',coalesce(nullif(trim(p_note),''),'')),auth.uid());
  update public.client_packages set payment_status=case when prior_paid+p_amount >= final_price then 'paid'::public.payment_status else 'partial'::public.payment_status end where id=pkg.id returning * into result;
  insert into public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details) values(org_id,auth.uid(),'payment.recorded','client_package',pkg.id,jsonb_build_object('amount',p_amount,'method',p_method));
  return result;
end $$;
revoke all on function public.record_package_payment(uuid,numeric,public.payment_method,text,uuid) from public, anon;
grant execute on function public.record_package_payment(uuid,numeric,public.payment_method,text,uuid) to authenticated;
