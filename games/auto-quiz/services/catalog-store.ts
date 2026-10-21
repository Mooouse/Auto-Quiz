import {validateCatalog} from '../data/catalog.ts';
import type {Car} from '../domain/types.ts';
interface Pack {cars:Car[];images:Record<string,Blob>}
const DB='autoquiz.catalog.v1';
async function database():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore('packs');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function readPack():Promise<Pack|null>{const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('packs','readonly');const r=tx.objectStore('packs').get('active');r.onsuccess=()=>resolve(r.result??null);r.onerror=()=>reject(r.error);tx.oncomplete=()=>db.close();});}
async function writePack(pack:Pack|null){const db=await database();return new Promise<void>((resolve,reject)=>{const tx=db.transaction('packs','readwrite');const s=tx.objectStore('packs');if(pack)s.put(pack,'active');else s.delete('active');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};tx.onabort=()=>{db.close();reject(tx.error);};});}
export class CatalogStore {
 cars:Car[]=[];source:'bundled'|'imported'='bundled';issues:string[]=[];private urls=new Map<string,string>();private decoded=new Map<string,Promise<HTMLImageElement>>();
 async load(){
  this.release();this.issues=[];
  try{const pack=await readPack();if(pack){const v=validateCatalog(pack.cars);if(v.issues.length)throw new Error(v.issues.map(x=>x.detail).join('; '));this.cars=v.cars;this.source='imported';for(const c of this.cars){const blob=pack.images[c.image];if(!blob)throw new Error(`Missing PNG: ${c.image}`);this.urls.set(c.id,URL.createObjectURL(blob));}return;}}catch{this.release();this.issues.push('importUnavailable');}
  this.source='bundled';const response=await fetch(new URL('data/cars.json',document.baseURI));if(!response.ok)throw new Error('CATALOG_UNAVAILABLE');
  const v=validateCatalog(await response.json());if(v.issues.length)throw new Error(v.issues.map(x=>`${x.code}: ${x.detail}`).join('; '));this.cars=v.cars;
  for(const c of this.cars)this.urls.set(c.id,new URL(c.image,document.baseURI).href);
 }
 url(car:Car){return this.urls.get(car.id)??new URL(car.image,document.baseURI).href;}
 async image(car:Car):Promise<HTMLImageElement>{
  let promise=this.decoded.get(car.id);if(!promise){promise=decodeImage(this.url(car));this.decoded.set(car.id,promise);promise.catch(()=>this.decoded.delete(car.id));
   // Keep at most 6 decoded images. Native browser cache still serves subsequent visits.
   if(this.decoded.size>6)this.decoded.delete(this.decoded.keys().next().value!);
  }return promise;
 }
 prefetch(car:Car|null){if(car)void this.image(car).catch(()=>{});}
 async import(files:File[],onProgress:(n:number,total:number)=>void){
  const json=files.filter(f=>f.name.toLowerCase().endsWith('.json'));if(json.length!==1)throw new Error('ONE_JSON_REQUIRED');
  const v=validateCatalog(JSON.parse(await json[0].text()));if(v.issues.length)throw new Error(v.issues.map(x=>`${x.code}: ${x.detail}`).join('\n'));if(!v.cars.length)throw new Error('EMPTY_CATALOG');
  const images:Record<string,Blob>={};
  for(let i=0;i<v.cars.length;i++){
   const c=v.cars[i];const filename=c.image.split('/').pop()!;
   const candidates=files.filter(f=>f.name===filename);
   const exact=files.filter(f=>f.webkitRelativePath===c.image||f.webkitRelativePath.endsWith('/'+c.image));
   const options=exact.length?exact:candidates;if(options.length!==1)throw new Error(`${options.length?'AMBIGUOUS_FILE':'MISSING_PNG'}: ${c.image}`);
   const file=options[0];const bytes=new Uint8Array(await file.slice(0,8).arrayBuffer());if(bytes.join(',')!=='137,80,78,71,13,10,26,10')throw new Error(`INVALID_PNG: ${c.image}`);
   const url=URL.createObjectURL(file);try{await decodeImage(url);}catch(error){throw new Error(`${c.image}: ${error instanceof Error?error.message:error}`);}finally{URL.revokeObjectURL(url);}
   images[c.image]=file;onProgress(i+1,v.cars.length);
  }
  await writePack({cars:v.cars,images});await this.load();
 }
 async clearImport(){await writePack(null);await this.load();}
 private release(){for(const url of this.urls.values())if(url.startsWith('blob:'))URL.revokeObjectURL(url);this.urls.clear();this.decoded.clear();this.cars=[];}
}
async function decodeImage(url:string):Promise<HTMLImageElement>{
 const img=new Image();img.decoding='async';img.src=url;
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{await Promise.race([img.decode(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('IMAGE_TIMEOUT')),15000);})]);}finally{clearTimeout(timer);}
 if(!img.naturalWidth||!img.naturalHeight)throw new Error('INVALID_PNG');
 const canvas=document.createElement('canvas');canvas.width=160;canvas.height=Math.max(1,Math.round(img.naturalHeight/img.naturalWidth*160));
 // Resource guard for malformed enormous aspect ratios.
 if(canvas.height>1600||img.naturalWidth>20000||img.naturalHeight>20000)throw new Error('IMAGE_TOO_LARGE');
 const ctx=canvas.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(img,0,0,canvas.width,canvas.height);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
 let transparent=false,visible=false;for(let i=3;i<pixels.length;i+=4){if(pixels[i]<16)transparent=true;if(pixels[i]>128)visible=true;}
 if(!transparent||!visible)throw new Error('TRANSPARENT_PNG_REQUIRED');return img;
}
