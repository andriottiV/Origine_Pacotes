-- READ ONLY. Open the SQL Editor of project xxpsqpdrsiwsujyoxocn.
-- Confirm that project reference in the dashboard URL before executing.
-- SECTION 1: run these first.
select
  to_regclass('supabase_migrations.schema_migrations') as migration_history,
  to_regclass('public.password_recovery_grants') as recovery_grants,
  to_regprocedure('public.complete_professional_signup()') as completion_rpc,
  to_regprocedure('public.provision_professional_account(uuid,text,text,text)') as provisioning_function;

-- SECTION 2: execute ONLY IF migration_history above is not null.
select version, name
from supabase_migrations.schema_migrations
order by version;

select version, name
from supabase_migrations.schema_migrations
where version = '20261028100000';

-- SECTION 3: inspect definitions even when the migration history is unavailable.
select
  p.oid::regprocedure as function_signature,
  pg_get_functiondef(p.oid) as function_definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'handle_new_user',
    'create_organization',
    'complete_professional_signup',
    'provision_professional_account'
  )
order by p.proname;

select t.tgname as trigger_name, pg_get_triggerdef(t.oid) as trigger_definition
from pg_trigger t
where t.tgrelid = 'auth.users'::regclass
  and not t.tgisinternal
  and t.tgname = 'on_auth_user_created';

select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  has_table_privilege('anon', c.oid, 'SELECT') as anon_can_select,
  has_table_privilege('authenticated', c.oid, 'SELECT') as authenticated_can_select,
  has_table_privilege('service_role', c.oid, 'SELECT') as server_can_select
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'password_recovery_grants';
