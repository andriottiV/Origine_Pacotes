-- Review and apply only after the existing migrations. No existing data is deleted.
begin;

-- Private primitive shared by the existing onboarding RPC and the Auth trigger.
-- Caller-provided tenant ids/roles are never accepted.
create or replace function public.provision_professional_account(
  p_user_id uuid, p_business_name text, p_full_name text, p_accent_color text default '#D94F35'
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  organization_id_result uuid;
  auth_metadata jsonb;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));
  select u.raw_user_meta_data into auth_metadata from auth.users u where u.id = p_user_id;
  if not found then raise exception 'Conta indisponível'; end if;
  if auth_metadata->>'portal' = 'client'
     or exists(select 1 from public.client_identities ci where ci.user_id = p_user_id)
  then raise exception 'Contas de cliente não podem criar organizações'; end if;

  insert into public.profiles(id, full_name)
    values(p_user_id, nullif(trim(coalesce(p_full_name, '')), ''))
    on conflict(id) do nothing;

  select m.organization_id into organization_id_result
    from public.organization_members m where m.user_id = p_user_id
    order by m.organization_id limit 1;
  if organization_id_result is not null then return organization_id_result; end if;

  if char_length(trim(coalesce(p_business_name, ''))) not between 2 and 160
  then raise exception 'Nome do negócio inválido'; end if;
  if p_accent_color is null or p_accent_color !~ '^#[0-9A-Fa-f]{6}$'
  then raise exception 'Cor de destaque inválida'; end if;

  insert into public.organizations(name, accent_color)
    values(trim(p_business_name), p_accent_color) returning id into organization_id_result;
  insert into public.organization_members(organization_id, user_id, role)
    values(organization_id_result, p_user_id, 'owner');
  -- Keep the catalog defaults already used by create_organization.
  insert into public.package_types(organization_id, name, service_count, price, duration_months)
    values(organization_id_result, 'Pacote 4 serviços', 4, 180, 1),
          (organization_id_result, 'Pacote 6 serviços', 6, 270, 1),
          (organization_id_result, 'Pacote 8 serviços', 8, 360, 1);
  insert into public.audit_logs(organization_id, actor_id, action, entity_type, entity_id)
    values(organization_id_result, p_user_id, 'organization.created', 'organization', organization_id_result);
  return organization_id_result;
end $$;
revoke all on function public.provision_professional_account(uuid,text,text,text) from public, anon, authenticated;

-- Replace, rather than duplicate, the existing Auth trigger.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, full_name)
    values(new.id, nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), ''))
    on conflict(id) do nothing;
  if new.raw_user_meta_data->>'account_type' = 'professional'
     and coalesce(new.raw_user_meta_data->>'portal', '') <> 'client' then
    perform public.provision_professional_account(
      new.id, new.raw_user_meta_data->>'business_name', new.raw_user_meta_data->>'full_name'
    );
  end if;
  return new;
end $$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Existing onboarding is now idempotent too; it cannot upgrade a member's role.
create or replace function public.create_organization(p_name text, p_accent_color text default '#D94F35')
returns public.organizations language plpgsql security definer set search_path = '' as $$
declare
  organization_id_result uuid;
  organization_result public.organizations;
  professional auth.users;
begin
  if auth.uid() is null then raise exception 'Autenticação obrigatória'; end if;
  select * into professional from auth.users u where u.id = auth.uid();
  if professional.email_confirmed_at is null then raise exception 'Confirme seu e-mail'; end if;
  if exists(select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]'::jsonb)) a where a->>'method' = 'recovery')
  then raise exception 'Conclua a recuperação de senha'; end if;
  organization_id_result := public.provision_professional_account(
    auth.uid(), p_name, professional.raw_user_meta_data->>'full_name', p_accent_color
  );
  select * into organization_result from public.organizations o where o.id = organization_id_result;
  return organization_result;
end $$;
revoke all on function public.create_organization(text,text) from public, anon;
grant execute on function public.create_organization(text,text) to authenticated;

create or replace function public.complete_professional_signup() returns uuid
language plpgsql security definer set search_path = '' as $$
declare professional auth.users;
begin
  if auth.uid() is null then raise exception 'Autenticação obrigatória'; end if;
  select * into professional from auth.users u where u.id = auth.uid();
  if professional.email_confirmed_at is null then raise exception 'Confirme seu e-mail'; end if;
  if exists(select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]'::jsonb)) a where a->>'method' = 'recovery')
  then raise exception 'Conclua a recuperação de senha'; end if;
  return public.provision_professional_account(
    auth.uid(), professional.raw_user_meta_data->>'business_name', professional.raw_user_meta_data->>'full_name'
  );
end $$;
revoke all on function public.complete_professional_signup() from public, anon;
grant execute on function public.complete_professional_signup() to authenticated;

-- Only the trusted application server can issue/claim recovery grants.
-- Store a hash of the random cookie, never passwords or Auth tokens.
create table public.password_recovery_grants (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index password_recovery_grants_expiry_idx on public.password_recovery_grants(expires_at);
alter table public.password_recovery_grants enable row level security;
revoke all on public.password_recovery_grants from public, anon, authenticated;
grant select, insert, update, delete on public.password_recovery_grants to service_role;
comment on table public.password_recovery_grants is 'Server-only, session-bound, short-lived and single-use password recovery authorization.';
commit;
