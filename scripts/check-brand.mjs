import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import sharp from 'sharp';

const cream=[247,244,238];
const files=[['public/icons/origine-192-v1.png',192],['public/icons/origine-512-v1.png',512],['public/icons/origine-maskable-192-v1.png',192],['public/icons/origine-maskable-512-v1.png',512],['public/icons/origine-apple-180-v1.png',180],['src/app/icon.png',32]];
for(const [file,size] of files){
  const {data,info}=await sharp(file).raw().toBuffer({resolveWithObject:true});
  assert.equal(info.width,size);assert.equal(info.height,size);assert.equal(info.channels,3,'Installation icons must be opaque');
  assert.deepEqual([...data.subarray(0,3)],cream);
  if(file.includes('maskable')){
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const i=(y*size+x)*3;
      if(cream.some((c,k)=>Math.abs(c-data[i+k])>15))assert(Math.hypot(x+.5-size/2,y+.5-size/2)<size*.4,`${file}: artwork outside safe circle`);
    }
  }
}
const {data:badge,info}=await sharp('public/icons/origine-badge-96-v1.png').raw().toBuffer({resolveWithObject:true});
assert.equal(info.width,96);assert.equal(info.height,96);assert.equal(info.channels,4);
for(let i=0;i<badge.length;i+=4)if(badge[i+3])assert.deepEqual([...badge.subarray(i,i+3)],[255,255,255]);
for(const name of ['logo','symbol'])assert((await sharp(`public/brand/origine-${name}-v1.webp`).metadata()).hasAlpha);
const ico=await fs.readFile('src/app/favicon.ico');assert.equal(ico.readUInt16LE(2),1);assert.equal(ico.readUInt16LE(4),3);
for(let i=0;i<3;i++){
  const entry=6+i*16, offset=ico.readUInt32LE(entry+12),size=ico.readUInt32LE(entry+8);
  const meta=await sharp(ico.subarray(offset,offset+size)).metadata();assert.equal(meta.width,[16,32,48][i]);assert(meta.hasAlpha);
}
assert((await fs.readFile('public/sw.js','utf8')).includes('badge: "/icons/origine-badge-96-v1.png"'));
console.log('Brand assets: dimensions, opaque cream, maskable safe circle, monochrome alpha badge, transparent UI and RGBA favicon verified.');
