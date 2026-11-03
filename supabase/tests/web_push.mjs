// Isolated PostgreSQL fixture. Never connects to a push provider or remote DB.
import { createRequire } from 'node:module';import { readFileSync,readdirSync,writeFileSync } from 'node:fs';import {resolve} from 'node:path';import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);const {PGlite}=require(require.resolve('@electric-sql/pglite',{paths:[resolve('.tmp-usage-db')]}));const db=new PGlite();
const id=n=>'10000000-0000-4000-8000-'+String(n).padStart(12,'0');let checks=0;
const scalar=async sql=>Object.values((await db.query(sql)).rows[0])[0];const check=(a,b)=>{assert.deepEqual(a,b);checks++};
const deny=async(sql,pattern)=>{await assert.rejects(()=>db.exec(sql),pattern);checks++};const q=s=>"'"+s+"'";
try {
 await db.exec("create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}'::jsonb,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select '{}'::jsonb$$;grant usage on schema auth to authenticated;grant execute on all functions in schema auth to authenticated;");
 const newest='20261101120000_web_push.sql';
 for(const f of readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')&&f!==newest).sort())await db.exec(readFileSync('supabase/migrations/'+f,'utf8').replace('create extension if not exists pgcrypto;',''));
 await db.exec("insert into auth.users(id) values "+[1,2,3,4].map(n=>'('+q(id(n))+')').join(',')+";");
 // Use explicit independent tenants and two portal identities (no professional auto-provisioning).
 await db.exec("insert into organizations(id,name) values ("+q(id(10))+",'A'),("+q(id(11))+",'B');insert into organization_members values("+q(id(10))+","+q(id(1))+",'owner'),("+q(id(11))+","+q(id(4))+",'owner');insert into clients(id,organization_id,full_name) values("+q(id(20))+","+q(id(10))+",'Client A'),("+q(id(21))+","+q(id(11))+",'Client B');insert into client_identities(id,user_id,client_id,organization_id,username) values("+q(id(30))+","+q(id(2))+","+q(id(20))+","+q(id(10))+",'test.a'),("+q(id(31))+","+q(id(3))+","+q(id(21))+","+q(id(11))+",'test.b');grant select,insert,update,delete on all tables in schema public to authenticated;grant usage on all sequences in schema public to authenticated;");
 async function pkg(n,total,expiry="(now() at time zone 'America/Sao_Paulo')::date+10",status='paid') {await db.exec("insert into client_packages(id,organization_id,client_id,package_name,total_services,contracted_price,final_price,starts_on,expires_on,payment_status,idempotency_key) values("+q(id(n))+","+q(id(10))+","+q(id(20))+",'Test',"+total+",100,100,(now() at time zone 'America/Sao_Paulo')::date-10,"+expiry+","+q(status)+",gen_random_uuid())");}
 for(const [n,total]of[[40,8],[41,4],[42,6],[43,1],[44,20]])await pkg(n,total);
 await db.exec("select set_config('request.jwt.claim.sub',"+q(id(1))+",false);set role authenticated");
 const usage=(n,quantity,key)=>"select id from register_service_usage_for_client("+q(id(n))+","+q(id(20))+","+q(id(10))+","+quantity+","+q(id(key))+")";
 async function latency(){const samples=[];for(let i=0;i<8;i++){await db.exec('begin');const t=performance.now();await db.query(usage(44,1,90));if(i)samples.push(+(performance.now()-t).toFixed(3));await db.exec('rollback');}return{samples,median:samples.toSorted((a,b)=>a-b)[3]};}
 const before=await latency();await db.exec('reset role');await db.exec(readFileSync('supabase/migrations/'+newest,'utf8'));await db.exec('set role authenticated');const after=await latency();
 // Direct table access and private RPCs are denied to both professionals/clients.
 await deny('select * from push_subscriptions',/permission denied/);await deny('select * from push_events',/permission denied/);await deny('select * from claim_push_deliveries(5)',/permission denied/);
 await db.exec('reset role;set role service_role');
 const bind=(identity,device,endpoint)=>"select bind_push_subscription("+q(id(identity))+","+q(device.repeat(64))+","+q('https://push.example.invalid/'+endpoint)+",'test-key','test-auth')";
 await scalar(bind(30,'a','a'));await scalar(bind(30,'b','b'));
 await db.exec('reset role');check(await scalar('select count(*) from push_subscriptions where active'),2);
 await db.exec("set role authenticated;select set_config('request.jwt.claim.sub',"+q(id(1))+",false)");
 const usedA=await scalar(usage(40,2,100));check(await scalar(usage(40,2,100)),usedA);
 await db.exec('reset role');check(await scalar("select count(*) from push_events where kind='used'"),1);check(await scalar("select remaining from push_events where usage_id="+q(usedA)),6);
 await db.exec('set role service_role');const claimed=(await db.query('select * from claim_push_deliveries(20)')).rows;check(claimed.length,2);check((await db.query('select * from claim_push_deliveries(20)')).rows.length,0);
 for(const [i,c]of claimed.entries()){const args=[q(c.event_id),q(c.subscription_id),q(c.claim_token)].join(',');const authorized=(await db.query('select * from authorize_push_delivery('+args+')')).rows[0];check(Number(authorized.remaining),6);await db.exec('select finish_push_delivery('+args+','+q(authorized.binding_token)+','+(i===0?201:503)+')');}
 await db.exec('reset role');check(await scalar("select count(*) from push_deliveries where status='sent'"),1);check(await scalar("select count(*) from push_deliveries where status='pending' and attempts=1 and next_attempt_at>now()"),1);
 await db.exec("update push_deliveries set next_attempt_at=now()-interval '1 second' where status='pending';set role service_role");const retryClaim=(await db.query('select * from claim_push_deliveries(20)')).rows[0];check(Boolean(retryClaim),true); // successful device never retried
 await db.exec("select set_push_preferences("+q(id(30))+",'{\"used\":false,\"reversed\":true,\"low_balance\":true,\"expiring\":true}')");
 check((await db.query('select * from authorize_push_delivery('+[q(retryClaim.event_id),q(retryClaim.subscription_id),q(retryClaim.claim_token)].join(',')+')')).rows.length,0);
 for(const c of claimed)check((await db.query('select * from authorize_push_delivery('+[q(c.event_id),q(c.subscription_id),q(c.claim_token)].join(',')+')')).rows.length,0);
 await db.exec('reset role');check(await scalar("select count(*) from push_deliveries where status='skipped'"),1);
 await db.exec("set role authenticated;select reverse_service_usage("+q(usedA)+","+q(id(10))+");select reverse_service_usage("+q(usedA)+","+q(id(10))+");reset role");check(await scalar("select count(*) from push_events where kind='reversed'"),1);check(await scalar("select remaining from push_events where kind='reversed'"),8);
 await db.exec('set role authenticated');const firstLow=await scalar(usage(41,2,101));await db.exec(usage(41,1,102));await db.exec("select reverse_service_usage("+q(firstLow)+","+q(id(10))+")");await db.exec(usage(41,1,103));await db.exec(usage(43,1,104));await db.exec('reset role');
 check(await scalar("select count(*) from push_events where kind='low_balance' and client_package_id="+q(id(41))),1);check(await scalar("select count(*) from push_events where kind='low_balance' and client_package_id="+q(id(43))),0);check(await scalar("select remaining from push_events where kind='used' and client_package_id="+q(id(43))),0);
 await db.exec('set role authenticated');await db.exec(usage(42,1,105));await db.exec('reset role');check(await scalar("select remaining from push_events where kind='used' and client_package_id="+q(id(42))),5);
 // Expiry calculation is explicitly São Paulo, even with a different DB timezone.
 await pkg(45,4,"(now() at time zone 'America/Sao_Paulo')::date+3");await pkg(46,4,"(now() at time zone 'America/Sao_Paulo')::date+3",'cancelled');await pkg(47,4,"(now() at time zone 'America/Sao_Paulo')::date+3",'refunded');await pkg(48,2,"(now() at time zone 'America/Sao_Paulo')::date+3");
 await db.exec('set role authenticated');await db.exec(usage(48,2,106));await db.exec("reset role;set timezone='Pacific/Kiritimati';set role service_role");check(await scalar('select queue_expiring_push_events(200)'),1);check(await scalar('select queue_expiring_push_events(200)'),0);await db.exec('reset role');check(await scalar("select remaining from push_events where kind='expiring'"),4);
 const expiringEvent=await scalar("select id from push_events where kind='expiring'");const activeB=await scalar("select id from push_subscriptions where device_hash="+q('b'.repeat(64)));check(await scalar("select push_delivery_allowed("+q(expiringEvent)+","+q(activeB)+")"),true);
 await db.exec("update client_packages set expires_on=(now() at time zone 'America/Sao_Paulo')::date+4 where id="+q(id(45))+";insert into push_events(organization_id,client_id,client_package_id,kind,remaining,expires_on) values("+q(id(10))+","+q(id(20))+","+q(id(45))+",'expiring',4,(now() at time zone 'America/Sao_Paulo')::date+4) on conflict do nothing");check(await scalar("select count(*) from push_events where kind='expiring'"),2);check(await scalar("select push_delivery_allowed("+q(expiringEvent)+","+q(activeB)+")"),false);
 // Rebinding the shared device to B cancels A's work. B's identity is resolved by server, never a browser client_id.
 await db.exec('set role service_role');await scalar(bind(31,'a','a'));await db.exec('reset role');check(await scalar("select client_id from push_subscriptions where device_hash="+q('a'.repeat(64))),id(21));check(await scalar("select count(*) from push_subscriptions where client_id="+q(id(20))+" and active"),1);
 await db.exec('set role service_role');await db.exec("select unbind_push_device("+q('b'.repeat(64))+")");await db.exec('reset role');check(await scalar("select count(*) from push_subscriptions where client_id="+q(id(20))+" and active"),0);
 // No deliveries for a newly-consented device from before its consent (incl. stale outbox).
 await db.exec('set role service_role');await scalar(bind(30,'c','c'));await db.exec('reset role');await db.exec("update push_events set fanout_at=null");await db.exec('set role service_role');check((await db.query('select * from claim_push_deliveries(50)')).rows.length,0);
 // New event -> 410 retires only that subscription; new devices remain independent.
 await db.exec("reset role;set role authenticated");await db.exec(usage(44,1,107));await db.exec('reset role;set role service_role');await db.exec("select set_push_preferences("+q(id(30))+",'{\"used\":true,\"reversed\":true,\"low_balance\":true,\"expiring\":true}')");
 const fresh=(await db.query('select * from claim_push_deliveries(20)')).rows;check(fresh.length,1);const c=fresh[0];const args=[q(c.event_id),q(c.subscription_id),q(c.claim_token)].join(',');const payload=(await db.query('select * from authorize_push_delivery('+args+')')).rows[0];await db.exec('select finish_push_delivery('+args+','+q(payload.binding_token)+',410)');await db.exec('reset role');check(await scalar("select active from push_subscriptions where device_hash="+q('c'.repeat(64))),false);
 // Expired jobs, leases, fencing and retry exhaustion all stay per-device.
 await db.exec('set role service_role');await scalar(bind(30,'d','d'));await db.exec("reset role;set role authenticated");
 const leaseUsage=await scalar(usage(44,1,108));await db.exec('reset role;set role service_role');
 const leased=(await db.query('select * from claim_push_deliveries(20)')).rows[0];check(Boolean(leased),true);
 await db.exec('reset role');await db.exec("update push_deliveries set reserved_until=now()-interval '1 second' where event_id="+q(leased.event_id)+";set role service_role");
 const recovered=(await db.query('select * from claim_push_deliveries(20)')).rows[0];check(recovered.event_id,leased.event_id);check(recovered.claim_token===leased.claim_token,false);
 await db.exec('select finish_push_delivery('+[q(leased.event_id),q(leased.subscription_id),q(leased.claim_token),q('10000000-0000-4000-8000-000000000099'),201].join(',')+')');
 await db.exec('reset role');check(await scalar("select status from push_deliveries where event_id="+q(leased.event_id)),"sending");await db.exec('set role service_role');
 let next=recovered;
 for(let attempt=2;attempt<=5;attempt++){
   const authorized=(await db.query('select * from authorize_push_delivery('+[q(next.event_id),q(next.subscription_id),q(next.claim_token)].join(',')+')')).rows[0];
   await db.exec('select finish_push_delivery('+[q(next.event_id),q(next.subscription_id),q(next.claim_token),q(authorized.binding_token),503].join(',')+')');
   if(attempt<5){await db.exec('reset role');await db.exec("update push_deliveries set next_attempt_at=now()-interval '1 second' where event_id="+q(next.event_id)+";set role service_role");next=(await db.query('select * from claim_push_deliveries(20)')).rows[0];}
 }
 await db.exec('reset role');check(await scalar("select attempts from push_deliveries where event_id="+q(leased.event_id)),5);check(await scalar("select status from push_deliveries where event_id="+q(leased.event_id)),"dead");
 await db.exec('set role authenticated');const expiredUsage=await scalar(usage(44,1,109));await db.exec('reset role');await db.exec("update push_events set expires_at=now()-interval '1 second' where usage_id="+q(expiredUsage)+";set role service_role");check((await db.query('select * from claim_push_deliveries(20)')).rows.length,0);
 await db.exec('reset role');check(await scalar("select fanout_at is not null from push_events where usage_id="+q(expiredUsage)),true);
 await db.exec('set role authenticated');await scalar(usage(44,1,110));await db.exec('reset role;set role service_role');
 const notFound=(await db.query('select * from claim_push_deliveries(20)')).rows[0];const foundArgs=[q(notFound.event_id),q(notFound.subscription_id),q(notFound.claim_token)].join(',');const foundPayload=(await db.query('select * from authorize_push_delivery('+foundArgs+')')).rows[0];await db.exec('select finish_push_delivery('+foundArgs+','+q(foundPayload.binding_token)+',404)');await db.exec('reset role');check(await scalar("select active from push_subscriptions where device_hash="+q('d'.repeat(64))),false);
 check(await scalar("select count(*) from push_events where usage_id="+q(leaseUsage)),1);
 // Private functions remain unavailable to a portal account and a different organization.
 await db.exec("set role authenticated;select set_config('request.jwt.claim.sub',"+q(id(3))+",false)");await deny('select * from push_preferences',/permission denied/);await deny("select bind_push_subscription("+q(id(30))+",'forged','forged','forged','forged')",/permission denied/);check(await scalar("select count(*) from portal_package_balance("+q(id(40))+")"),0);
 await db.exec('reset role');check(await scalar('select count(*) from payments'),0);check(await scalar('select sum(final_price) from client_packages'),'900.00');
 writeFileSync('supabase/tests/web_push_timings.json',JSON.stringify({method:'PGlite isolated single connection, before/after outbox trigger, same package, 1 warmup + 7 rollbacks; no HTTP; not hosted latency',before,after},null,2));
 console.log(checks+' Web Push SQL checks passed. Consent, snapshots, idempotency, low balance, expiry, per-device retries, privacy and RLS.');console.log({before,after});
} finally {await db.close();}
