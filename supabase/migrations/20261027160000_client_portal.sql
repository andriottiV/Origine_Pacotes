-- Client portal. This migration is intentionally safe to apply only after the
-- existing schema migrations. Passwords stay exclusively in Supabase Auth.
create table public.client_identities (
  id uuid primary key default gen_random_uuid(), user_id uuid not null unique references auth.users(id) on delete cascade,
  client_id uuid not null unique references public.clients(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  username text not null unique check (username ~ '^[a-z0-9][a-z0-9._-]{2,47}$'),
  must_change_password boolean not null default true, revoked_at timestamptz, last_login_at timestamptz,
  created_at timestamptz not null default now(), created_by uuid references auth.users(id),
  unique(organization_id,client_id),
  foreign key(organization_id,client_id) references public.clients(organization_id,id) on delete restrict
);
create index client_identities_org_idx on public.client_identities(organization_id);
alter table public.client_identities enable row level security;

create or replace function public.is_active_client_identity(p_client_id uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.client_identities where user_id=auth.uid() and client_id=p_client_id and revoked_at is null)
$$;
create or replace function public.has_client_identity() returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.client_identities where user_id=auth.uid())
$$;

-- A revoked identity cannot even read its own identity, so a still-valid Auth
-- session is insufficient for portal access.
create policy "managers manage client identities" on public.client_identities for all using(public.is_manager(organization_id)) with check(public.is_manager(organization_id));
create policy "active clients read own identity" on public.client_identities for select using(user_id=auth.uid() and revoked_at is null);
create policy "active clients read own profile" on public.clients for select using(public.is_active_client_identity(id));
create policy "active clients read own packages" on public.client_packages for select using(public.is_active_client_identity(client_id));
create policy "active clients read own usages" on public.service_usages for select using(public.is_active_client_identity(client_id));
create policy "active clients read own organization" on public.organizations for select using(exists(select 1 from public.client_identities where user_id=auth.uid() and organization_id=organizations.id and revoked_at is null));

-- No portal-facing function changes the first-access flag. The flag is changed
-- only by the protected server action after Auth's admin password update.
revoke all on function public.is_active_client_identity(uuid) from public, anon;
revoke all on function public.has_client_identity() from public, anon;
grant execute on function public.is_active_client_identity(uuid) to authenticated;
grant execute on function public.has_client_identity() to authenticated;

-- Prevent a client session from escaping into onboarding. Re-apply explicit
-- execute rights because this SECURITY DEFINER function is privileged.
create or replace function public.create_organization(p_name text, p_accent_color text default '#486B53') returns public.organizations language plpgsql security definer set search_path=public as $$
declare organization public.organizations;
begin
  if auth.uid() is null then raise exception 'Autenticação obrigatória'; end if;
  if exists(select 1 from public.client_identities where user_id=auth.uid()) then raise exception 'Contas de cliente não podem criar organizações'; end if;
  if char_length(trim(coalesce(p_name,''))) < 2 then raise exception 'Nome da organização inválido'; end if;
  if p_accent_color !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Cor de destaque inválida'; end if;
  insert into public.organizations(name,accent_color) values(trim(p_name),p_accent_color) returning * into organization;
  insert into public.organization_members(organization_id,user_id,role) values(organization.id,auth.uid(),'owner');
  insert into public.package_types(organization_id,name,service_count,price,duration_months) values(organization.id,'Pacote 4 serviços',4,180,1),(organization.id,'Pacote 6 serviços',6,270,1),(organization.id,'Pacote 8 serviços',8,360,1);
  insert into public.audit_logs(organization_id,actor_id,action,entity_type,entity_id) values(organization.id,auth.uid(),'organization.created','organization',organization.id);
  return organization;
end $$;
revoke all on function public.create_organization(text,text) from public, anon;
grant execute on function public.create_organization(text,text) to authenticated;
