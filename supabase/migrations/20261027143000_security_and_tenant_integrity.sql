-- Security and tenant-integrity hardening for 20261027140000_initial_schema.sql.
-- Apply after the initial schema. This migration does not disable RLS or delete data.

-- Every foreign-key relationship that crosses a tenant boundary must prove that
-- both rows belong to the same organization.
alter table public.clients add constraint clients_organization_id_id_key unique (organization_id, id);
alter table public.package_types add constraint package_types_organization_id_id_key unique (organization_id, id);
alter table public.client_packages add constraint client_packages_organization_id_id_key unique (organization_id, id);

alter table public.client_packages
  add constraint client_packages_client_same_organization_fk
  foreign key (organization_id, client_id) references public.clients(organization_id, id) on delete restrict,
  add constraint client_packages_type_same_organization_fk
  foreign key (organization_id, package_type_id) references public.package_types(organization_id, id) on delete set null;

alter table public.service_usages
  add constraint service_usages_package_same_organization_fk
  foreign key (organization_id, client_package_id) references public.client_packages(organization_id, id) on delete restrict,
  add constraint service_usages_client_same_organization_fk
  foreign key (organization_id, client_id) references public.clients(organization_id, id) on delete restrict;

alter table public.payments add constraint payments_package_same_organization_fk
  foreign key (organization_id, client_package_id) references public.client_packages(organization_id, id) on delete restrict;
alter table public.financial_adjustments add constraint financial_adjustments_package_same_organization_fk
  foreign key (organization_id, client_package_id) references public.client_packages(organization_id, id) on delete restrict;

-- An authenticated member may read their organization, but only an owner/admin
-- can change catalog, sales and financial records.
create or replace function public.is_manager(org_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = org_id and user_id = auth.uid() and role in ('owner', 'admin')
  )
$$;

drop policy if exists "members manage package catalog" on public.package_types;
drop policy if exists "members manage sales" on public.client_packages;
drop policy if exists "members manage payments" on public.payments;
drop policy if exists "members manage adjustments" on public.financial_adjustments;
create policy "managers manage package catalog" on public.package_types for all using (public.is_manager(organization_id)) with check (public.is_manager(organization_id));
create policy "managers manage sales" on public.client_packages for all using (public.is_manager(organization_id)) with check (public.is_manager(organization_id));
create policy "managers manage payments" on public.payments for all using (public.is_manager(organization_id)) with check (public.is_manager(organization_id));
create policy "managers manage adjustments" on public.financial_adjustments for all using (public.is_manager(organization_id)) with check (public.is_manager(organization_id));

-- Profiles are created from Auth on the server. No client can choose another
-- user's profile id during sign-up.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name) values (new.id, nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), '')) on conflict (id) do nothing;
  return new;
end
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- The first organization can be created only by the signed-in user. The
-- membership row is created atomically and cannot be forged from the browser.
create or replace function public.create_organization(p_name text, p_accent_color text default '#486B53') returns public.organizations
language plpgsql security definer set search_path = public as $$
declare organization public.organizations;
begin
  if auth.uid() is null then raise exception 'Autenticação obrigatória'; end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 then raise exception 'Nome da organização inválido'; end if;
  if p_accent_color !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Cor de destaque inválida'; end if;
  insert into public.organizations(name, accent_color) values (trim(p_name), p_accent_color) returning * into organization;
  insert into public.organization_members(organization_id, user_id, role) values (organization.id, auth.uid(), 'owner');
  insert into public.audit_logs(organization_id, actor_id, action, entity_type, entity_id) values (organization.id, auth.uid(), 'organization.created', 'organization', organization.id);
  return organization;
end
$$;

-- Functions run with elevated database ownership only after their own
-- authorization checks. Do not leave them executable by anon/public.
revoke all on function public.is_member(uuid) from public, anon;
revoke all on function public.is_manager(uuid) from public, anon;
revoke all on function public.register_service_usage(uuid, integer, text) from public, anon;
revoke all on function public.create_organization(text, text) from public, anon;
grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.is_manager(uuid) to authenticated;
grant execute on function public.register_service_usage(uuid, integer, text) to authenticated;
grant execute on function public.create_organization(text, text) to authenticated;
