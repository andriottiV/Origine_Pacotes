-- Private transactional outbox. No network I/O or new consumption write path.
create table public.push_preferences (
  client_id uuid primary key references public.clients(id),
  organization_id uuid not null references public.organizations(id),
  used boolean not null default true, reversed boolean not null default true,
  low_balance boolean not null default true, expiring boolean not null default true,
  updated_at timestamptz not null default now(),
  foreign key(organization_id,client_id) references public.clients(organization_id,id)
);
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  client_id uuid not null references public.clients(id),
  identity_id uuid not null references public.client_identities(id),
  user_id uuid not null references auth.users(id),
  device_hash text not null unique check(length(device_hash)=64),
  endpoint text not null unique check(length(endpoint) <= 2048),
  p256dh text not null, auth_key text not null,
  binding_token uuid not null default gen_random_uuid(),
  active boolean not null default true,
  consented_at timestamptz not null default now(), disabled_at timestamptz,
  foreign key(organization_id,client_id) references public.clients(organization_id,id)
);
create index push_subscriptions_client_active_idx on public.push_subscriptions(client_id) where active;
create table public.push_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  client_id uuid not null references public.clients(id),
  client_package_id uuid not null references public.client_packages(id),
  usage_id uuid references public.service_usages(id),
  kind text not null check(kind in ('used','reversed','low_balance','expiring')),
  quantity integer, remaining bigint not null check(remaining >= 0),
  expires_on date, created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '6 hours', fanout_at timestamptz,
  foreign key(organization_id,client_id) references public.clients(organization_id,id),
  foreign key(organization_id,client_package_id) references public.client_packages(organization_id,id)
);
create unique index push_usage_event_unique on public.push_events(usage_id,kind) where usage_id is not null and kind in ('used','reversed');
create unique index push_low_balance_once on public.push_events(client_package_id) where kind='low_balance';
create unique index push_expiring_once on public.push_events(client_package_id,expires_on) where kind='expiring';
create index push_events_fanout_idx on public.push_events(created_at,id) where fanout_at is null;
create index push_events_expired_idx on public.push_events(expires_at) where fanout_at is null;
create index push_events_client_idx on public.push_events(client_id,kind);
create table public.push_deliveries (
  event_id uuid not null references public.push_events(id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  status text not null default 'pending' check(status in ('pending','sending','sent','skipped','dead')),
  attempts integer not null default 0, next_attempt_at timestamptz not null default now(),
  claim_token uuid, reserved_until timestamptz, completed_at timestamptz,
  last_code integer,
  primary key(event_id,subscription_id)
);
create index push_delivery_pending_idx on public.push_deliveries(next_attempt_at) where status='pending';
create index push_delivery_lease_idx on public.push_deliveries(reserved_until) where status='sending';
create index push_delivery_subscription_idx on public.push_deliveries(subscription_id) where status in ('pending','sending');
create index push_packages_expiry_idx on public.client_packages(expires_on,id) where payment_status in ('pending','partial','paid');
create index service_usages_package_history_idx on public.service_usages(client_package_id,occurred_at desc,id desc);

alter table public.push_preferences enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.push_events enable row level security;
alter table public.push_deliveries enable row level security;
-- Deny direct access even to professionals: endpoints/keys are capabilities.
-- The server validates auth.uid/identity using the session client before using
-- these service-role-only entry points. No browser receives a privileged key.
revoke all on public.push_preferences,public.push_subscriptions,public.push_events,public.push_deliveries from public,anon,authenticated;
grant select,insert,update,delete on public.push_preferences,public.push_subscriptions,public.push_events,public.push_deliveries to service_role;

create or replace function public.capture_push_usage_event() returns trigger
language plpgsql security definer set search_path=public as $$
declare v_pkg public.client_packages; v_remaining bigint; v_kind text;
begin
  if TG_OP='INSERT' then
    if new.reversed_at is not null then return new; end if;
    v_kind := 'used';
  elsif old.reversed_at is null and new.reversed_at is not null then v_kind := 'reversed';
  else return new; end if;
  -- The existing consumption/reversal RPC has already locked this package.
  select cp.* into v_pkg from public.client_packages as cp where cp.id=new.client_package_id for update;
  select v_pkg.total_services - coalesce(sum(su.quantity),0) into v_remaining
    from public.service_usages as su where su.client_package_id=v_pkg.id and su.reversed_at is null;
  insert into public.push_events(organization_id,client_id,client_package_id,usage_id,kind,quantity,remaining)
    values(new.organization_id,new.client_id,v_pkg.id,new.id,v_kind,new.quantity,v_remaining) on conflict do nothing;
  if v_kind='used' and v_remaining in (1,2) and v_remaining+new.quantity > 2 then
    insert into public.push_events(organization_id,client_id,client_package_id,usage_id,kind,quantity,remaining)
      values(new.organization_id,new.client_id,v_pkg.id,new.id,'low_balance',new.quantity,v_remaining) on conflict do nothing;
  end if;
  return new;
end $$;
revoke all on function public.capture_push_usage_event() from public,anon,authenticated;
create trigger service_usage_push_outbox after insert or update of reversed_at on public.service_usages
  for each row execute function public.capture_push_usage_event();

create or replace function public.bind_push_subscription(p_identity_id uuid,p_device_hash text,p_endpoint text,p_p256dh text,p_auth text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_identity public.client_identities; v_existing public.push_subscriptions; v_token uuid := gen_random_uuid();
begin
  select ci.* into v_identity from public.client_identities as ci where ci.id=p_identity_id and ci.revoked_at is null for share;
  if not found then raise exception 'Identidade indisponível'; end if;
  insert into public.push_preferences(client_id,organization_id) values(v_identity.client_id,v_identity.organization_id) on conflict do nothing;
  perform 1 from public.push_preferences as pp where pp.client_id=v_identity.client_id for update;
  perform pg_advisory_xact_lock(hashtextextended(p_device_hash,0));
  perform pg_advisory_xact_lock(hashtextextended(p_endpoint,1));
  perform 1 from public.push_subscriptions as ps where ps.device_hash=p_device_hash or ps.endpoint=p_endpoint order by ps.id for update;
  select ps.* into v_existing from public.push_subscriptions as ps where ps.endpoint=p_endpoint for update;
  if found and v_existing.device_hash <> p_device_hash then raise exception 'Assinatura pertence a outro aparelho'; end if;
  -- Cancel old work before rebinding a shared device or renewing consent.
  update public.push_deliveries as pd set status='skipped',completed_at=now(),claim_token=null
    where pd.subscription_id in (select ps.id from public.push_subscriptions as ps where ps.device_hash=p_device_hash)
      and pd.status in ('pending','sending');
  insert into public.push_subscriptions(organization_id,client_id,identity_id,user_id,device_hash,endpoint,p256dh,auth_key,binding_token)
    values(v_identity.organization_id,v_identity.client_id,v_identity.id,v_identity.user_id,p_device_hash,p_endpoint,p_p256dh,p_auth,v_token)
    on conflict(device_hash) do update set organization_id=excluded.organization_id,client_id=excluded.client_id,
      identity_id=excluded.identity_id,user_id=excluded.user_id,endpoint=excluded.endpoint,p256dh=excluded.p256dh,
      auth_key=excluded.auth_key,binding_token=excluded.binding_token,active=true,consented_at=now(),disabled_at=null;
  return v_token;
end $$;

create or replace function public.unbind_push_device(p_device_hash text) returns void
language plpgsql security definer set search_path=public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_device_hash,0));
  update public.push_subscriptions as ps set active=false,disabled_at=now(),binding_token=gen_random_uuid() where ps.device_hash=p_device_hash;
  update public.push_deliveries as pd set status='skipped',completed_at=now(),claim_token=null
    where pd.subscription_id in (select ps.id from public.push_subscriptions as ps where ps.device_hash=p_device_hash)
      and pd.status in ('pending','sending');
end $$;

create or replace function public.set_push_preferences(p_identity_id uuid,p_preferences jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare v_identity public.client_identities;
begin
  select ci.* into v_identity from public.client_identities as ci where ci.id=p_identity_id and ci.revoked_at is null for share;
  if not found then raise exception 'Identidade indisponível'; end if;
  insert into public.push_preferences(client_id,organization_id,used,reversed,low_balance,expiring)
    values(v_identity.client_id,v_identity.organization_id,(p_preferences->>'used')::boolean,(p_preferences->>'reversed')::boolean,
      (p_preferences->>'low_balance')::boolean,(p_preferences->>'expiring')::boolean)
    on conflict(client_id) do update set used=excluded.used,reversed=excluded.reversed,low_balance=excluded.low_balance,expiring=excluded.expiring,updated_at=now();
  update public.push_deliveries as pd set status='skipped',completed_at=now(),claim_token=null
    from public.push_events as pe where pe.id=pd.event_id and pe.client_id=v_identity.client_id
      and not (p_preferences->>pe.kind)::boolean and pd.status in ('pending','sending');
end $$;

create or replace function public.queue_expiring_push_events(p_limit integer default 200) returns integer
language plpgsql security definer set search_path=public as $$
declare v_count integer; v_today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  insert into public.push_events(organization_id,client_id,client_package_id,kind,remaining,expires_on,expires_at)
    select cp.organization_id,cp.client_id,cp.id,'expiring',cp.total_services-used.quantity,cp.expires_on,
      least(now()+interval '12 hours',(v_today+1)::timestamp at time zone 'America/Sao_Paulo')
    from public.client_packages as cp
    cross join lateral (select coalesce(sum(su.quantity),0) as quantity from public.service_usages as su where su.client_package_id=cp.id and su.reversed_at is null) as used
    where cp.expires_on=v_today+3 and cp.starts_on<=v_today and cp.payment_status in ('pending','partial','paid')
      and cp.total_services>used.quantity
      and exists(select 1 from public.client_identities as ci where ci.client_id=cp.client_id and ci.revoked_at is null)
      and not exists(select 1 from public.push_events as pe where pe.client_package_id=cp.id and pe.kind='expiring' and pe.expires_on=cp.expires_on)
    order by cp.id limit greatest(1,least(coalesce(p_limit,200),200)) on conflict do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

create or replace function public.push_delivery_allowed(p_event_id uuid,p_subscription_id uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.push_events as pe
    join public.push_subscriptions as ps on ps.id=p_subscription_id and ps.client_id=pe.client_id and ps.organization_id=pe.organization_id
    join public.client_identities as ci on ci.id=ps.identity_id and ci.client_id=ps.client_id and ci.organization_id=ps.organization_id and ci.user_id=ps.user_id
    join public.push_preferences as pp on pp.client_id=pe.client_id and pp.organization_id=pe.organization_id
    where pe.id=p_event_id and pe.expires_at>now() and ps.active and ci.revoked_at is null
      and ps.consented_at <= pe.created_at
      and (pe.kind <> 'expiring' or exists (
        select 1 from public.client_packages as cp where cp.id=pe.client_package_id
          and cp.expires_on=pe.expires_on and cp.expires_on=(now() at time zone 'America/Sao_Paulo')::date+3
          and cp.payment_status in ('pending','partial','paid')
          and cp.total_services > coalesce((select sum(su.quantity) from public.service_usages as su where su.client_package_id=cp.id and su.reversed_at is null),0)
      ))
      and (case pe.kind when 'used' then pp.used when 'reversed' then pp.reversed when 'low_balance' then pp.low_balance when 'expiring' then pp.expiring else false end))
$$;

create or replace function public.claim_push_deliveries(p_limit integer default 10)
returns table(event_id uuid,subscription_id uuid,claim_token uuid)
language plpgsql security definer set search_path=public as $$
declare v_event public.push_events; v_delivery public.push_deliveries; v_token uuid;
begin
  -- Bounded cleanup prevents expired, never-expanded events growing the hot queue.
  update public.push_events as pe set fanout_at=now() where pe.id in
    (select old_event.id from public.push_events as old_event where old_event.fanout_at is null and old_event.expires_at<=now() order by old_event.expires_at limit 200 for update skip locked);
  for v_event in select pe.* from public.push_events as pe where pe.fanout_at is null and pe.expires_at>now() order by pe.created_at,pe.id limit 100 for update skip locked loop
    insert into public.push_deliveries(event_id,subscription_id)
      select v_event.id,ps.id from public.push_subscriptions as ps
      where ps.client_id=v_event.client_id and ps.active and public.push_delivery_allowed(v_event.id,ps.id) on conflict do nothing;
    update public.push_events as pe set fanout_at=now() where pe.id=v_event.id;
  end loop;
  for v_delivery in select pd.* from public.push_deliveries as pd
    where (pd.status='pending' and pd.next_attempt_at<=now()) or (pd.status='sending' and pd.reserved_until<=now())
    order by pd.next_attempt_at,pd.event_id limit greatest(1,least(coalesce(p_limit,10),50)) for update skip locked loop
    if v_delivery.attempts>=5 or not public.push_delivery_allowed(v_delivery.event_id,v_delivery.subscription_id) then
      update public.push_deliveries as pd set status=case when v_delivery.attempts>=5 then 'dead' else 'skipped' end,completed_at=now(),claim_token=null
        where pd.event_id=v_delivery.event_id and pd.subscription_id=v_delivery.subscription_id;
      continue;
    end if;
    v_token := gen_random_uuid();
    update public.push_deliveries as pd set status='sending',attempts=pd.attempts+1,claim_token=v_token,reserved_until=now()+interval '2 minutes'
      where pd.event_id=v_delivery.event_id and pd.subscription_id=v_delivery.subscription_id;
    event_id := v_delivery.event_id; subscription_id := v_delivery.subscription_id; claim_token := v_token;
    return next;
  end loop;
end $$;

create or replace function public.authorize_push_delivery(p_event_id uuid,p_subscription_id uuid,p_claim_token uuid)
returns table(endpoint text,p256dh text,auth_key text,binding_token uuid,kind text,quantity integer,remaining bigint,client_package_id uuid,expires_on date,expires_at timestamptz)
language sql stable security definer set search_path=public as $$
  select ps.endpoint,ps.p256dh,ps.auth_key,ps.binding_token,pe.kind,pe.quantity,pe.remaining,pe.client_package_id,pe.expires_on,pe.expires_at
  from public.push_deliveries as pd join public.push_events as pe on pe.id=pd.event_id join public.push_subscriptions as ps on ps.id=pd.subscription_id
  where pd.event_id=p_event_id and pd.subscription_id=p_subscription_id and pd.claim_token=p_claim_token
    and pd.status='sending' and pd.reserved_until>now() and public.push_delivery_allowed(pe.id,ps.id)
$$;

create or replace function public.finish_push_delivery(p_event_id uuid,p_subscription_id uuid,p_claim_token uuid,p_binding_token uuid,p_code integer)
returns void language plpgsql security definer set search_path=public as $$
declare v_delivery public.push_deliveries; v_delay interval;
begin
  perform 1 from public.push_subscriptions as ps where ps.id=p_subscription_id for update;
  select pd.* into v_delivery from public.push_deliveries as pd where pd.event_id=p_event_id and pd.subscription_id=p_subscription_id and pd.claim_token=p_claim_token and pd.status='sending' for update;
  if not found then return; end if;
  if p_code in (404,410) then
    update public.push_subscriptions as ps set active=false,disabled_at=now() where ps.id=p_subscription_id and ps.binding_token=p_binding_token;
  end if;
  if p_code in (0,408,425,429) or p_code>=500 then
    v_delay := case v_delivery.attempts when 1 then interval '1 minute' when 2 then interval '5 minutes' when 3 then interval '30 minutes' else interval '2 hours' end;
    update public.push_deliveries as pd set status=case when pd.attempts>=5 then 'dead' else 'pending' end,
      next_attempt_at=now()+v_delay,claim_token=null,reserved_until=null,last_code=p_code,
      completed_at=case when pd.attempts>=5 then now() else null end
      where pd.event_id=p_event_id and pd.subscription_id=p_subscription_id;
  else
    update public.push_deliveries as pd set status=case when p_code>=200 and p_code<300 then 'sent' when p_code=499 then 'skipped' else 'dead' end,
      last_code=p_code,completed_at=now(),claim_token=null,reserved_until=null where pd.event_id=p_event_id and pd.subscription_id=p_subscription_id;
  end if;
end $$;

-- Every private function must explicitly revoke the default PUBLIC execute grant.
revoke all on function public.bind_push_subscription(uuid,text,text,text,text),public.unbind_push_device(text),public.set_push_preferences(uuid,jsonb),public.queue_expiring_push_events(integer),public.push_delivery_allowed(uuid,uuid),public.claim_push_deliveries(integer),public.authorize_push_delivery(uuid,uuid,uuid),public.finish_push_delivery(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.bind_push_subscription(uuid,text,text,text,text),public.unbind_push_device(text),public.set_push_preferences(uuid,jsonb),public.queue_expiring_push_events(integer),public.push_delivery_allowed(uuid,uuid),public.claim_push_deliveries(integer),public.authorize_push_delivery(uuid,uuid,uuid),public.finish_push_delivery(uuid,uuid,uuid,uuid,integer) to service_role;

create or replace function public.portal_package_balance(p_package_id uuid)
returns table(id uuid,client_id uuid,package_name text,total_services integer,starts_on date,expires_on date,payment_status public.payment_status,remaining bigint)
language sql stable security invoker set search_path=public as $$
  select cp.id,cp.client_id,cp.package_name,cp.total_services,cp.starts_on,cp.expires_on,cp.payment_status,
    cp.total_services-coalesce((select sum(su.quantity) from public.service_usages as su where su.client_package_id=cp.id and su.reversed_at is null),0)
  from public.client_packages as cp where cp.id=p_package_id
$$;
revoke all on function public.portal_package_balance(uuid) from public,anon;
grant execute on function public.portal_package_balance(uuid) to authenticated;
