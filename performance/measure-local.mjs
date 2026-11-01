import { writeFileSync } from 'node:fs';
const [port, label] = process.argv.slice(2);
const result = { environment: label, method: 'HTTP fetch to loopback, no authentication, redirects manual; elapsed includes response body; first sample reported separately, route compilation state not guaranteed cold', routes: {} };
for (const path of ['/login','/clientes','/atendimentos/novo','/cliente']) {
 const samples=[];
 for(let i=0;i<6;i++){const t=performance.now();const r=await fetch('http://127.0.0.1:'+port+path,{redirect:'manual'});const body=await r.text();samples.push({ms:+(performance.now()-t).toFixed(2),status:r.status,bytes:Buffer.byteLength(body)});}
 result.routes[path]=samples;
}
writeFileSync('performance/'+label+'.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
