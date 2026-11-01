-- Read-only diagnostics for a DBA/Supabase SQL editor. Never call usage RPCs
-- for benchmarking on real customers. Plans can include UUIDs: keep them private.
begin read only;
select s.relname, s.indexrelname, s.idx_scan, s.idx_tup_read, s.idx_tup_fetch
from pg_stat_user_indexes as s
where s.relname in ('clients', 'client_packages', 'service_usages', 'organization_members');
select a.pid, a.state, a.wait_event_type, a.wait_event,
  now() - a.query_start as duration, pg_blocking_pids(a.pid) as blockers
from pg_stat_activity as a where a.datname = current_database()
  and a.pid <> pg_backend_pid() and a.state <> 'idle';
-- Substitute an authorized organization/client UUID and use SET LOCAL ROLE
-- authenticated + request.jwt.claim.sub in an isolated/staging transaction to
-- include RLS. Do not disable RLS or publish the resulting plan.
-- explain (analyze, buffers, format json)
-- select su.id from public.service_usages as su
-- where su.organization_id = '<organization>'::uuid
-- order by su.occurred_at desc, su.id desc limit 21;
-- explain (analyze, buffers, format json)
-- select sum(su.quantity) from public.service_usages as su
-- where su.client_package_id = '<package>'::uuid and su.reversed_at is null;
rollback;
