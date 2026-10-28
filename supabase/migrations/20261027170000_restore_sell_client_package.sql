-- Restores the missing sale RPC discovered in the remote schema cache.
-- This is incremental and does not modify or remove existing sales.
create or replace function public.sell_client_package(
  p_client_id uuid, p_package_type_id uuid, p_validity text, p_custom_expires_on date,
  p_discount numeric, p_payment_amount numeric, p_payment_method public.payment_method,
  p_idempotency_key uuid
) returns public.client_packages
language plpgsql security definer set search_path = public as $$
declare org_id uuid; c public.clients; t public.package_types; pkg public.client_packages;
  final_amount numeric(12,2); expiry date; prior_payment numeric(12,2); status public.payment_status;
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
  if coalesce(p_discount,0)<0 or coalesce(p_discount,0)>t.price then raise exception 'Desconto inválido'; end if;
  final_amount:=t.price-coalesce(p_discount,0);
  if coalesce(p_payment_amount,0)<0 or coalesce(p_payment_amount,0)>final_amount then raise exception 'Valor recebido inválido'; end if;
  if p_validity='month_end' then expiry:=(date_trunc('month',current_date)+interval '1 month - 1 day')::date;
  elsif p_validity='one_month' then expiry:=(current_date+interval '1 month')::date;
  elsif p_validity='custom' and p_custom_expires_on>=current_date then expiry:=p_custom_expires_on;
  else raise exception 'Validade inválida'; end if;
  status:=case when p_payment_amount=0 then 'pending'::public.payment_status when p_payment_amount=final_amount then 'paid'::public.payment_status else 'partial'::public.payment_status end;
  insert into public.client_packages(organization_id,client_id,package_type_id,package_name,total_services,contracted_price,discount,final_price,starts_on,expires_on,payment_status,created_by,idempotency_key)
    values(org_id,c.id,t.id,t.name,t.service_count,t.price,coalesce(p_discount,0),final_amount,current_date,expiry,status,auth.uid(),p_idempotency_key) returning * into pkg;
  if p_payment_amount>0 then insert into public.payments(organization_id,client_package_id,amount,method,status,created_by) values(org_id,pkg.id,p_payment_amount,p_payment_method,'paid',auth.uid()); end if;
  insert into public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details) values(org_id,auth.uid(),'package.sold','client_package',pkg.id,jsonb_build_object('client_id',c.id,'payment_amount',p_payment_amount));
  return pkg;
end $$;
revoke all on function public.sell_client_package(uuid,uuid,text,date,numeric,numeric,public.payment_method,uuid) from public, anon;
grant execute on function public.sell_client_package(uuid,uuid,text,date,numeric,numeric,public.payment_method,uuid) to authenticated;
notify pgrst, 'reload schema';
