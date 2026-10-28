create extension if not exists pgcrypto;
create type public.member_role as enum ('owner','admin','staff');
create type public.payment_method as enum ('pix','cash','debit_card','credit_card','other');
create type public.payment_status as enum ('pending','partial','paid','cancelled','refunded');
create type public.adjustment_type as enum ('cancellation','refund','discount','correction');

create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, full_name text, created_at timestamptz not null default now());
create table public.organizations (id uuid primary key default gen_random_uuid(), name text not null, logo_url text, accent_color text not null default '#486B53', default_validity text not null default 'month_end', created_at timestamptz not null default now());
create table public.organization_members (organization_id uuid not null references public.organizations(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, role public.member_role not null default 'staff', primary key (organization_id,user_id));
create table public.clients (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict, full_name text not null check (char_length(trim(full_name)) >= 2), phone_normalized text, notes text, status text not null default 'active' check (status in ('active','archived')), created_at timestamptz not null default now(), archived_at timestamptz, unique(organization_id, phone_normalized));
create table public.package_types (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict, name text not null, service_count integer not null check (service_count > 0), price numeric(12,2) not null check (price >= 0), duration_months integer, active boolean not null default true, created_at timestamptz not null default now());
create table public.client_packages (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict, client_id uuid not null references public.clients(id) on delete restrict, package_type_id uuid references public.package_types(id) on delete set null, package_name text not null, total_services integer not null check(total_services > 0), contracted_price numeric(12,2) not null check(contracted_price >= 0), discount numeric(12,2) not null default 0 check(discount >= 0), final_price numeric(12,2) not null check(final_price >= 0), starts_on date not null, expires_on date not null check(expires_on >= starts_on), payment_status public.payment_status not null default 'pending', created_by uuid references auth.users(id), idempotency_key uuid not null unique, created_at timestamptz not null default now());
create table public.service_usages (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict, client_package_id uuid not null references public.client_packages(id) on delete restrict, client_id uuid not null references public.clients(id) on delete restrict, quantity integer not null default 1 check(quantity > 0), note text, occurred_at timestamptz not null default now(), created_by uuid references auth.users(id), reversed_at timestamptz, reversed_by uuid references auth.users(id), reversal_reason text);
create table public.payments (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict, client_package_id uuid not null references public.client_packages(id) on delete restrict, amount numeric(12,2) not null check(amount > 0), method public.payment_method not null, status public.payment_status not null default 'paid', paid_at timestamptz not null default now(), note text, created_by uuid references auth.users(id));
create table public.financial_adjustments (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict, client_package_id uuid not null references public.client_packages(id) on delete restrict, type public.adjustment_type not null, amount numeric(12,2) not null check(amount >= 0), note text not null, created_at timestamptz not null default now(), created_by uuid references auth.users(id));
create table public.audit_logs (id bigint generated always as identity primary key, organization_id uuid not null references public.organizations(id) on delete restrict, actor_id uuid references auth.users(id), action text not null, entity_type text not null, entity_id uuid, details jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());
create index clients_search_idx on public.clients(organization_id, full_name); create index packages_active_idx on public.client_packages(organization_id, client_id, expires_on); create index usage_package_idx on public.service_usages(client_package_id) where reversed_at is null;

create or replace function public.is_member(org_id uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.organization_members where organization_id=org_id and user_id=auth.uid()) $$;
create or replace function public.register_service_usage(p_package_id uuid, p_quantity integer, p_note text default null) returns public.service_usages language plpgsql security definer set search_path=public as $$
declare pkg public.client_packages; usage public.service_usages; used_count integer;
begin
  select * into pkg from public.client_packages where id=p_package_id for update;
  if not found or not public.is_member(pkg.organization_id) then raise exception 'Pacote não encontrado ou sem permissão'; end if;
  if current_date > pkg.expires_on then raise exception 'O pacote está vencido'; end if;
  select coalesce(sum(quantity),0) into used_count from public.service_usages where client_package_id=p_package_id and reversed_at is null;
  if p_quantity <= 0 or used_count + p_quantity > pkg.total_services then raise exception 'Saldo insuficiente'; end if;
  insert into public.service_usages(organization_id,client_package_id,client_id,quantity,note,created_by) values(pkg.organization_id,pkg.id,pkg.client_id,p_quantity,p_note,auth.uid()) returning * into usage;
  return usage;
end $$;

alter table public.profiles enable row level security; alter table public.organizations enable row level security; alter table public.organization_members enable row level security; alter table public.clients enable row level security; alter table public.package_types enable row level security; alter table public.client_packages enable row level security; alter table public.service_usages enable row level security; alter table public.payments enable row level security; alter table public.financial_adjustments enable row level security; alter table public.audit_logs enable row level security;
create policy "own profile" on public.profiles for all using (id=auth.uid()) with check (id=auth.uid());
create policy "members access organizations" on public.organizations for select using(public.is_member(id));
create policy "members see membership" on public.organization_members for select using(public.is_member(organization_id));
create policy "members manage clients" on public.clients for all using(public.is_member(organization_id)) with check(public.is_member(organization_id));
create policy "members manage package catalog" on public.package_types for all using(public.is_member(organization_id)) with check(public.is_member(organization_id));
create policy "members manage sales" on public.client_packages for all using(public.is_member(organization_id)) with check(public.is_member(organization_id));
create policy "members read services" on public.service_usages for select using(public.is_member(organization_id));
create policy "members manage payments" on public.payments for all using(public.is_member(organization_id)) with check(public.is_member(organization_id));
create policy "members manage adjustments" on public.financial_adjustments for all using(public.is_member(organization_id)) with check(public.is_member(organization_id));
create policy "members read audit" on public.audit_logs for select using(public.is_member(organization_id));
