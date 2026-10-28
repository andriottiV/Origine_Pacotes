-- Regression test for an ISOLATED database only; fixtures are rolled back.
-- Requires all migrations, test auth.users/auth.uid/auth.jwt, and standard Supabase grants.
begin;
insert into auth.users(id, email, raw_user_meta_data, email_confirmed_at) values
 ('00000000-0000-4000-8000-000000000101','professional-a@example.invalid','{"account_type":"professional","business_name":"Isolated A","full_name":"Professional A","organization_id":"00000000-0000-4000-8000-000000000999","role":"admin"}',now()),
 ('00000000-0000-4000-8000-000000000102','professional-b@example.invalid','{"account_type":"professional","business_name":"Isolated B","full_name":"Professional B"}',null),
 ('00000000-0000-4000-8000-000000000103','client@example.invalid','{"portal":"client","full_name":"Portal Client"}',now());

do $$
begin
  if (select count(*) from public.organization_members where user_id in ('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000102')) <> 2 then raise exception 'Missing atomic provisioning'; end if;
  if (select count(distinct organization_id) from public.organization_members where user_id in ('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000102')) <> 2 then raise exception 'Tenants were linked'; end if;
  if exists(select 1 from public.organization_members where user_id='00000000-0000-4000-8000-000000000103') then raise exception 'Client was provisioned as a professional'; end if;
  if (select count(*) from public.profiles where id in ('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000000103')) <> 3 then raise exception 'Missing profiles'; end if;
end $$;
insert into public.clients(organization_id, full_name)
  select m.organization_id, case when m.user_id='00000000-0000-4000-8000-000000000101' then 'Client A' else 'Client B' end
  from public.organization_members m where m.user_id in ('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000102');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
select set_config('request.jwt.claims','{"amr":[{"method":"password"}]}',true);
set local role authenticated;
do $$
declare first_id uuid; repeated_id uuid; onboarding_id uuid;
begin
  first_id := public.complete_professional_signup();
  repeated_id := public.complete_professional_signup();
  select id into onboarding_id from public.create_organization('Ignored duplicate business name');
  if first_id <> repeated_id or first_id <> onboarding_id then raise exception 'Repeated callbacks created organizations'; end if;
  if (select count(*) from public.organization_members) <> 1 then raise exception 'Membership leakage'; end if;
  if (select role from public.organization_members limit 1) <> 'owner' then raise exception 'Missing ownership'; end if;
  if (select count(*) from public.organizations) <> 1 then raise exception 'Organization RLS leakage'; end if;
  if (select count(*) from public.clients) <> 1 or exists(select 1 from public.clients where full_name='Client B') then raise exception 'Client RLS leakage'; end if;
  begin
    perform public.provision_professional_account('00000000-0000-4000-8000-000000000102','Forged','Forged');
    raise exception 'Private provisioning was callable';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.organization_members(organization_id,user_id,role) values(first_id,'00000000-0000-4000-8000-000000000102','owner');
    raise exception 'Forged membership was allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform 1 from public.password_recovery_grants;
    raise exception 'Recovery grants were visible to the browser';
  exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claims','{"amr":[{"method":"recovery"}]}',true);
do $$ begin
  begin perform public.complete_professional_signup(); raise exception 'Recovery entered setup';
  exception when raise_exception then if sqlerrm <> 'Conclua a recuperação de senha' then raise; end if; end;
end $$;
select set_config('request.jwt.claims','{"amr":[{"method":"password"}]}',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000102',true);
do $$ begin
  begin perform public.complete_professional_signup(); raise exception 'Unconfirmed account entered setup';
  exception when raise_exception then if sqlerrm <> 'Confirme seu e-mail' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000103',true);
do $$ begin
  begin perform public.create_organization('Unauthorized client business'); raise exception 'Client created organization';
  exception when raise_exception then if sqlerrm <> 'Contas de cliente não podem criar organizações' then raise; end if; end;
end $$;
reset role;
update auth.users set email_confirmed_at=now() where id='00000000-0000-4000-8000-000000000102';
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000102',true);
set local role authenticated;
select public.complete_professional_signup();
reset role;

insert into public.password_recovery_grants(token_hash,user_id,session_id,expires_at)
  values(repeat('a',64),'00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000201',now()+interval '15 minutes'),
        (repeat('b',64),'00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000201',now()-interval '1 minute');
set local role service_role;
do $$
declare n integer;
begin
  with claimed as (update public.password_recovery_grants set used_at=now() where token_hash=repeat('a',64) and user_id='00000000-0000-4000-8000-000000000102' and session_id='00000000-0000-4000-8000-000000000201' and used_at is null and expires_at>now() returning token_hash) select count(*) into n from claimed;
  if n<>0 then raise exception 'Grant used by wrong user'; end if;
  with claimed as (update public.password_recovery_grants set used_at=now() where token_hash=repeat('a',64) and user_id='00000000-0000-4000-8000-000000000101' and session_id='00000000-0000-4000-8000-000000000202' and used_at is null and expires_at>now() returning token_hash) select count(*) into n from claimed;
  if n<>0 then raise exception 'Grant used by wrong session'; end if;
  with claimed as (update public.password_recovery_grants set used_at=now() where token_hash=repeat('a',64) and user_id='00000000-0000-4000-8000-000000000101' and session_id='00000000-0000-4000-8000-000000000201' and used_at is null and expires_at>now() returning token_hash) select count(*) into n from claimed;
  if n<>1 then raise exception 'Grant could not be claimed'; end if;
  with claimed as (update public.password_recovery_grants set used_at=now() where token_hash=repeat('a',64) and used_at is null and expires_at>now() returning token_hash) select count(*) into n from claimed;
  if n<>0 then raise exception 'Grant was reused'; end if;
  with claimed as (update public.password_recovery_grants set used_at=now() where token_hash=repeat('b',64) and used_at is null and expires_at>now() returning token_hash) select count(*) into n from claimed;
  if n<>0 then raise exception 'Expired grant was used'; end if;
end $$;
reset role;
do $$ begin
  if (select count(*) from public.organization_members where user_id='00000000-0000-4000-8000-000000000101')<>1 then raise exception 'Duplicate owner after retries'; end if;
  if (select count(*) from public.package_types where organization_id in (select organization_id from public.organization_members where user_id in ('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000102')))<>6 then raise exception 'Duplicated or missing default catalog'; end if;
end $$;
rollback;
