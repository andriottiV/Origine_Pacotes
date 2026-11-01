// Isolated, in-memory PostgreSQL only. Never connects to the application DB.
// npm install --prefix .tmp-usage-db --no-save --package-lock=false @electric-sql/pglite
// node supabase/tests/simple_service_usage.mjs
import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { PGlite } = require(require.resolve('@electric-sql/pglite', { paths: [resolve('.tmp-usage-db')] }));
const db = new PGlite();
let checks = 0;
const uid = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const scalar = async sql => Object.values((await db.query(sql)).rows[0])[0];
const check = (actual, expected) => { assert.equal(actual, expected); checks++; };
async function denied(sql, text) { await assert.rejects(() => db.exec(sql), text); checks++; }
try {
  await db.exec("create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb, email_confirmed_at timestamptz); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$; create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$; grant usage on schema auth to authenticated; grant execute on all functions in schema auth to authenticated;");
  for (const file of readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).sort()) {
    // PGlite does not bundle pgcrypto. UUID generation is built into PostgreSQL.
    await db.exec(readFileSync(resolve('supabase/migrations', file), 'utf8').replace('create extension if not exists pgcrypto;', ''));
  }
  await db.exec("grant usage on schema public to authenticated; grant select, insert, update, delete on all tables in schema public to authenticated; grant usage on all sequences in schema public to authenticated;");
  await db.exec("insert into auth.users(id,raw_user_meta_data,email_confirmed_at) values ('" + uid(1) + "','{\"account_type\":\"professional\",\"business_name\":\"Test A\",\"full_name\":\"Profissional A\"}', now()), ('" + uid(2) + "','{\"account_type\":\"professional\",\"business_name\":\"Test B\"}',now()), ('" + uid(3) + "','{\"portal\":\"client\"}',now()), ('" + uid(4) + "','{}',now());");
  const orgA = await scalar("select organization_id from organization_members where user_id='" + uid(1) + "'");
  const orgB = await scalar("select organization_id from organization_members where user_id='" + uid(2) + "'");
  await db.exec("insert into organization_members values ('" + orgA + "','" + uid(4) + "','staff'); insert into clients(id,organization_id,full_name) values ('" + uid(10) + "','" + orgA + "','Client A'), ('" + uid(11) + "','" + orgB + "','Client B'); insert into client_identities(user_id,client_id,organization_id,username) values('" + uid(3) + "','" + uid(10) + "','" + orgA + "','test.client');");
  async function pkg(n, total, expiry = "(now() at time zone 'America/Sao_Paulo')::date + 1") {
    await db.exec("insert into client_packages(id,organization_id,client_id,package_name,total_services,contracted_price,final_price,starts_on,expires_on,payment_status,idempotency_key) values('" + uid(n) + "','" + orgA + "','" + uid(10) + "','Test'," + total + ",100,100,(now() at time zone 'America/Sao_Paulo')::date - 10," + expiry + ",'paid',gen_random_uuid());");
  }
  for (const [n,total] of [[20,4],[21,8],[22,6],[23,1],[24,2],[25,2]]) await pkg(n,total);
  await pkg(26,4,"(now() at time zone 'America/Sao_Paulo')::date - 1");
  await db.exec("select set_config('request.jwt.claim.sub','" + uid(4) + "',false); set role authenticated;");
  const usageSql = (n, quantity, key) => "select * from register_service_usage_for_client('" + uid(n) + "','" + uid(10) + "','" + orgA + "'," + quantity + ",'" + uid(key) + "')";
  const balance = n => scalar("select cp.total_services - coalesce((select sum(su.quantity) from service_usages su where su.client_package_id=cp.id and su.reversed_at is null),0) from client_packages cp where cp.id='" + uid(n) + "'");
  for (const [n,q,key,expected] of [[20,2,100,2],[21,2,101,6],[22,1,102,5]]) { await db.exec(usageSql(n,q,key)); check(await balance(n),expected); }
  check(await scalar("select count(*) from client_packages"),7); // staff RLS
  const first = await scalar("select id from register_service_usage_for_client('" + uid(20) + "','" + uid(10) + "','" + orgA + "',2,'" + uid(100) + "')");
  check(await balance(20),2);
  await denied(usageSql(20,1,100), /Chave de uso inválida/);
  await denied(usageSql(23,2,103), /Saldo insuficiente/);
  await db.exec(usageSql(24,2,104)); await denied(usageSql(24,1,105), /Saldo insuficiente/);
  await denied(usageSql(26,1,106), /vencido/);
  for (const q of [0,3,-1,'null']) await denied(usageSql(25,q,107), /Escolha 1 ou 2/);
  await denied("select * from register_service_usage_for_client('" + uid(25) + "','" + uid(11) + "','" + orgA + "',1,'" + uid(108) + "')", /não pertence/);
  await denied("select * from register_service_usage('" + uid(25) + "',1,null)", /permission denied/);
  const reverse = "select * from reverse_service_usage('" + first + "','" + orgA + "')";
  await db.exec(reverse); await db.exec(reverse); check(await balance(20),4);
  check(await scalar("select count(*) from audit_logs where action='service.reversed'"),1);
  // A retry after reversal returns its original row; it never consumes again.
  await db.exec(usageSql(20,2,100)); check(await balance(20),4);
  // Expiring a consumed package before reversal must not extend its validity.
  await db.exec("reset role; update client_packages set expires_on=(now() at time zone 'America/Sao_Paulo')::date-1 where id='" + uid(21) + "'; set role authenticated;");
  await db.exec("select reverse_service_usage(id,'" + orgA + "') from service_usages where idempotency_key='" + uid(101) + "'");
  check(await balance(21),8); await denied(usageSql(21,1,110), /vencido/);
  await db.exec("select set_config('request.jwt.claim.sub','" + uid(2) + "',false)");
  await denied(usageSql(25,1,111), /Sem permissão/);
  await denied("select * from register_service_usage_idempotent('" + uid(20) + "',2,null,'" + uid(100) + "')", /Chave de uso inválida/);
  await denied(reverse, /Sem permissão/);
  check(await scalar("select count(*) from service_usages"),0);
  await db.exec("select set_config('request.jwt.claim.sub','" + uid(3) + "',false)");
  check(await scalar("select count(*) from service_usages"),4);
  check(await balance(20),4); check(await balance(22),5);
  check(await scalar("select count(*) from service_usages where reversed_at is not null"),2);
  await denied(usageSql(25,1,112), /Sem permissão/);
  check(await scalar("select remaining from client_package_balances('" + uid(10) + "','" + orgA + "',false,0,20) where id='" + uid(20) + "'"),4);
  check(await scalar("select remaining from client_service_balances(array['" + uid(10) + "'::uuid],'" + orgA + "')"),12);
  check(await scalar("select count(*) from client_package_balances('" + uid(11) + "','" + orgB + "',false,0,20)"),0);
  check(await scalar("select count(*) from client_service_balances(array['" + uid(11) + "'::uuid],'" + orgB + "')"),0);
  check(await scalar("select count(*) from client_package_balances('" + uid(10) + "','" + orgA + "',true,0,20)"),4);
  check(await scalar("select count(*) from client_package_balances('" + uid(10) + "','" + orgA + "',false,2,2)"),2);
  await db.exec('reset role');
  check(await scalar('select count(*) from payments'),0);
  check(await scalar('select sum(final_price) from client_packages'),'700.00');
  await pkg(30,100);
  await db.exec("insert into service_usages(organization_id,client_package_id,client_id,quantity,reversed_at) select '" + orgA + "','" + uid(30) + "','" + uid(10) + "',1,case when n%6=0 then now() else null end from generate_series(1,60)n; set role authenticated;");
  check(await scalar("select remaining from client_package_balances('" + uid(10) + "','" + orgA + "',false,0,20) where id='" + uid(30) + "'"),50);
  check(await scalar("select count(*) from (select id from service_usages order by occurred_at desc,id desc limit 20) as page"),20);
  await db.exec("select set_config('request.jwt.claim.sub','" + uid(4) + "',false)");
  check(await scalar("select remaining from client_package_balances('" + uid(10) + "','" + orgA + "',false,0,20) where id='" + uid(30) + "'"),50);
  console.log(checks + ' isolated PostgreSQL checks passed; all migrations applied.');
  console.log('Real multi-connection concurrency and hosted Supabase/browser integration still require external validation.');
} finally { await db.close(); }
