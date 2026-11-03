import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
const base=process.env.BRAND_QA_URL || 'http://127.0.0.1:3117';
const out='test-results/branding';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const [name,width,height] of [['desktop',1440,1100],['tablet',1024,900],['mobile',390,844]]){
    await page.setViewportSize({width,height});
    for(const path of ['/login','/cliente/login'])for(const theme of ['light','dark']){
      await page.goto(base+path);await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
      await page.locator('img[alt="Origine Pacotes"]:visible').first().waitFor();
      await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
      assert(await page.locator('img[alt="Origine Pacotes"]:visible').first().evaluate(i=>i.naturalWidth>0));
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Horizontal overflow');
      const apple=await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');assert(apple.includes('origine-apple-180-v1.png'));
      const icons=await page.locator('link[rel="icon"]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')));assert(icons.some(i=>i.includes('/icon.png')));assert(icons.some(i=>i.includes('/favicon.ico')));
      await page.screenshot({path:`${out}/${name}-${path==='/login'?'login':'client'}-${theme}.png`,fullPage:true});
    }
  }
  // Authenticated UI chrome is checked using the real Brand markup and compiled CSS,
  // with an inert fixture. This does not bypass app authentication or access private data.
  await page.goto(base+'/login');
  const full=await page.locator('.origineLogin_brand .wordmark').evaluate(el=>el.outerHTML);
  const compact=await page.locator('.origineLogin_ticket .wordmark').first().evaluate(el=>el.outerHTML);
  await page.setViewportSize({width:1000,height:500});
  for(const theme of ['light','dark']){
    await page.evaluate(({full,compact,theme})=>{
      document.documentElement.dataset.theme=theme;
      document.body.innerHTML=`<div class="app-shell"><aside class="sidebar"><div class="brand">${full}</div><p class="organization-label">Origine Pacotes</p><nav><span class="nav-item active">Início</span><span class="nav-item">Clientes</span><span class="nav-item">Pacotes</span></nav></aside><div class="workspace-body"><main><header style="display:flex;gap:20px;align-items:center">${compact}<span>Origine Pacotes</span></header><h1>Seus pacotes</h1></main></div></div>`;
    },{full,compact,theme});
    await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
    await page.screenshot({path:`${out}/interface-${theme}.png`,fullPage:true});
  }
  const manifest=await(await page.request.get(base+'/manifest.webmanifest')).json();
  assert.equal(manifest.id,'/cliente');assert.equal(manifest.start_url,'/cliente');assert.equal(manifest.scope,'/');assert.equal(manifest.name,'Origine Pacotes');
  for(const icon of manifest.icons)assert.equal((await page.request.get(base+icon.src)).status(),200);
  for(const path of ['/favicon.ico','/icon.png','/icons/origine-apple-180-v1.png','/icons/origine-badge-96-v1.png','/icons/push-192.png'])assert.equal((await page.request.get(base+path)).status(),200);
  const worker=await page.request.get(base+'/sw.js');assert((await worker.text()).includes('/icons/origine-badge-96-v1.png'));assert.equal(worker.headers()['service-worker-allowed'],'/');assert(worker.headers()['cache-control'].includes('no-store'));
  assert.deepEqual(errors,[]);
  console.log('Production HTTP smoke and 14 visual screenshots passed: login/client, desktop/tablet/mobile, light/dark, interface fixture; metadata/icons/manifest/SW unchanged identity.');
}finally{await browser.close();}
