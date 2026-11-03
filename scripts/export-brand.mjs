import fs from 'node:fs/promises';
import sharp from 'sharp';

// Export only from the approved bitmap. No tracing, substituted fonts or generated artwork.
const source = 'assets/brand/origine-aprovada.png';
const cream = { r: 247, g: 244, b: 238, alpha: 1 };
const { data, info } = await sharp(source).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height } = info;
const rgba = Buffer.alloc(width * height * 4);
const core = new Uint8Array(width * height);
for (let y=1;y<height-1;y++) for (let x=1;x<width-1;x++) {
  let solid = true;
  for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++) {
    const n=((y+dy)*width+x+dx)*3;
    if (Math.min(data[n],data[n+1],data[n+2])>=160) solid=false;
  }
  core[y*width+x]=solid ? 1 : 0;
}
for (let y=0;y<height;y++) for (let x=0;x<width;x++) {
  const i=(y*width+x)*3, o=(y*width+x)*4;
  const p=[...data.subarray(i,i+3)];
  if (core[y*width+x]) { rgba.set([...p,255],o); continue; }
  // Find original interior ink to recover edge coverage without retaining a cream halo.
  let ink;
  for (let r=1;r<=6 && !ink;r++) {
    for (let dy=-r;dy<=r && !ink;dy++) for (let dx=-r;dx<=r;dx++) {
      if (Math.max(Math.abs(dx),Math.abs(dy))!==r || x+dx<0 || y+dy<0 || x+dx>=width || y+dy>=height) continue;
      if (core[(y+dy)*width+x+dx]) { const n=((y+dy)*width+x+dx)*3; ink=[...data.subarray(n,n+3)]; break; }
    }
  }
  if (!ink) continue;
  const bg=[cream.r,cream.g,cream.b], v=ink.map((c,k)=>c-bg[k]);
  const a=Math.max(0,Math.min(1,p.reduce((sum,c,k)=>sum+(c-bg[k])*v[k],0)/v.reduce((sum,c)=>sum+c*c,0)));
  if (a<.025) continue;
  rgba.set([...ink,Math.round(a*255)],o);
}
const matte = await sharp(rgba, { raw: { width, height, channels: 4 } }).png().toBuffer();
const fullRect = { left: 120, top: 205, width: 1014, height: 900 };
const symbolRect = { left: 365, top: 207, width: 524, height: 548 };
const full = await sharp(matte).extract(fullRect).png().toBuffer();
const symbol = await sharp(matte).extract(symbolRect).png().toBuffer();
await fs.mkdir('public/brand', { recursive: true });
await fs.mkdir('public/icons', { recursive: true });
await sharp(full).resize({ width: 640 }).webp({ lossless: true, effort: 6 }).toFile('public/brand/origine-logo-v1.webp');
await sharp(symbol).resize({ height: 160 }).webp({ lossless: true, effort: 6 }).toFile('public/brand/origine-symbol-v1.webp');
async function icon(size, ratio) {
  const art = await sharp(symbol).resize({ width: Math.round(size*ratio), height: Math.round(size*ratio), fit: 'inside' }).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: cream } }).composite([{ input: art, gravity: 'centre' }]).removeAlpha().png({ compressionLevel: 9 }).toBuffer();
}
for (const size of [192, 512]) {
  const normal = await icon(size, .8);
  await fs.writeFile(`public/icons/origine-${size}-v1.png`, normal);
  // Existing subscriptions / older documents may still reference these public URLs.
  await fs.writeFile(`public/icons/push-${size}.png`, normal);
  await fs.writeFile(`public/icons/origine-maskable-${size}-v1.png`, await icon(size, .56));
}
await fs.writeFile('public/icons/origine-apple-180-v1.png', await icon(180, .8));
await fs.writeFile('src/app/icon.png', await icon(32, .88));
const faviconSizes = [16, 32, 48];
const pngs = await Promise.all(faviconSizes.map(async size => sharp(await icon(size, .88)).ensureAlpha().png().toBuffer()));
const header = Buffer.alloc(6+16*pngs.length); header.writeUInt16LE(1,2); header.writeUInt16LE(pngs.length,4);
let offset = header.length;
pngs.forEach((png, i) => { const p=6+i*16; header[p]=faviconSizes[i]; header[p+1]=faviconSizes[i]; header.writeUInt16LE(1,p+4); header.writeUInt16LE(32,p+6); header.writeUInt32LE(png.length,p+8); header.writeUInt32LE(offset,p+12); offset+=png.length; });
await fs.writeFile('src/app/favicon.ico', Buffer.concat([header,...pngs]));
const { data: badge, info: bi } = await sharp(symbol).resize({ width: 80, height: 80, fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
for(let i=0;i<badge.length;i+=4) badge.fill(255,i,i+3);
await sharp({ create: { width:96, height:96, channels:4, background:'#00000000' } }).composite([{input:await sharp(badge,{raw:bi}).png().toBuffer(),gravity:'centre'}]).png({compressionLevel:9}).toFile('public/icons/origine-badge-96-v1.png');
console.log('Approved bitmap exported: full logo, symbol, favicon, PWA, maskable, Apple, push and badge.');
