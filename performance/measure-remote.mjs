// Read-only HTTP requests. No Auth session creation or customer mutations.
import nextEnv from '@next/env';const {loadEnvConfig}=nextEnv;import {createClient} from '@supabase/supabase-js';import {writeFileSync} from 'node:fs';
loadEnvConfig(process.cwd());const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const result={method:'remote Supabase read-only service role, RLS bypassed, samples interleaved; not authenticated page timing',samples:[]};
async function timed(label,query){const start=performance.now();const r=await query;result.samples.push({label,ms:+(performance.now()-start).toFixed(2),rows:Array.isArray(r.data)?r.data.length:null,error:r.error?.code||null});return r;}
const {data}=await client.from('organizations').select('id').limit(1);const org=data?.[0]?.id;
if(!org)throw new Error('No accessible organization for read-only measurements');
for(let i=0;i<6;i++){
 await timed('baseline clients',client.from('clients').select('id,full_name,phone_normalized,notes,status,created_at').eq('organization_id',org).order('created_at',{ascending:false}).limit(1000));
 await timed('bounded clients',client.from('clients').select('id,full_name,phone_normalized,notes,status,created_at').eq('organization_id',org).order('created_at',{ascending:false}).order('id',{ascending:false}).range(0,50));
 await timed('baseline history',client.from('service_usages').select('id,client_id,client_package_id,quantity,occurred_at,reversed_at,created_by').eq('organization_id',org).order('occurred_at',{ascending:false}).order('id').range(0,999));
 await timed('bounded joined history',client.from('service_usages').select('id,client_id,client_package_id,quantity,occurred_at,reversed_at,created_by,clients!service_usages_client_same_organization_fk(full_name),client_packages!service_usages_package_same_organization_fk(package_name)').eq('organization_id',org).order('occurred_at',{ascending:false}).order('id',{ascending:false}).range(0,10));
}
await timed('new read RPC availability',client.rpc('client_service_balances',{p_client_ids:[],p_organization_id:org}));
await timed('earlier professional read RPC availability',client.rpc('usage_professionals',{p_organization_id:org}));
writeFileSync('performance/remote-comparison.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
