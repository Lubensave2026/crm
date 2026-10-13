const G=globalThis;G.__DB=G.__DB||{};G.__L=G.__L||[];
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
class Ref{constructor(c,id){this.type='doc';this.c=c;this.id=id}}
class Col{constructor(c){this.type='col';this.c=c}}
export class FieldPath{constructor(...s){this.segs=s}}
export const collection=(db,c)=>new Col(c);
export const doc=(a,c,id)=>a.type==='col'?new Ref(a.c,'auto'+Math.random().toString(36).slice(2)):new Ref(c,id);
export const arrayUnion=(...els)=>({__au:els});
export const arrayRemove=(...els)=>({__ar:els});
export const query=(col,...m)=>({type:'query',c:col.c,m});
export const orderBy=(f,d)=>({o:[f,d]});export const limit=n=>({l:n});
export const initializeFirestore=()=>({});
const tbl=c=>G.__DB[c]=G.__DB[c]||{};
const isObj=v=>v&&typeof v==='object'&&!Array.isArray(v)&&!v.__au&&!v.__ar;
function merge(t,d){for(const k in d){const v=d[k];if(v&&v.__ar){t[k]=(t[k]||[]).filter(x=>!v.__ar.some(e=>eq(e,x)))}else if(v&&v.__au){const a=t[k]||[];for(const e of v.__au)if(!a.some(x=>eq(x,e)))a.push(structuredClone(e));t[k]=a}else if(isObj(v))t[k]=merge(isObj(t[k])?t[k]:{},v);else t[k]=structuredClone(v)}return t}
function setPath(t,segs,v){let o=t;for(let i=0;i<segs.length-1;i++)o=(o[segs[i]]=isObj(o[segs[i]])?o[segs[i]]:{});const k=segs.at(-1);if(v&&v.__ar){o[k]=(o[k]||[]).filter(x=>!v.__ar.some(e=>eq(e,x)))}else if(v&&v.__au){const a=o[k]||[];for(const e of v.__au)if(!a.some(x=>eq(x,e)))a.push(structuredClone(e));o[k]=a}else o[k]=structuredClone(v)}
function snapOf(L){
  const T=tbl(L.c);let ids=Object.keys(T);
  if(L.type==='query'){const o=L.m.find(x=>x.o)?.o,lim=L.m.find(x=>x.l)?.l;if(o)ids.sort((a,b)=>String(T[b][o[0]]).localeCompare(String(T[a][o[0]])));if(lim)ids=ids.slice(0,lim)}
  return ids;}
function notify(){try{sessionStorage.setItem('__fakeDB',JSON.stringify(G.__DB))}catch(e){}for(const L of G.__L){
  if(L.type==='doc'){const d=tbl(L.c)[L.id];const j=JSON.stringify(d);if(!L.sent||j!==L.last){L.sent=true;L.last=j;L.cb({exists:()=>!!d,data:()=>structuredClone(d),metadata:{fromCache:false}})}}
  else{const T=tbl(L.c),ids=snapOf(L),cur={};ids.forEach(i=>cur[i]=JSON.stringify(T[i]));const ch=[];
    for(const i of ids)if(cur[i]!==L.prev[i])ch.push({type:L.prev[i]===undefined?'added':'modified',doc:{id:i,data:()=>structuredClone(T[i])}});
    for(const i in L.prev)if(cur[i]===undefined)ch.push({type:'removed',doc:{id:i,data:()=>({})}});
    if(ch.length||!L.sent){L.sent=true;L.prev=cur;L.cb({docChanges:()=>ch,docs:ids.map(i=>({id:i,data:()=>structuredClone(T[i])})),metadata:{fromCache:false}})}}}}
export function onSnapshot(t,a,b,c){const cb=typeof a==='function'?a:b;const L={...t,cb,prev:{},last:undefined,sent:false};G.__L.push(L);setTimeout(notify,0);return()=>{G.__L=G.__L.filter(x=>x!==L)}}
export async function setDoc(r,d,o){const T=tbl(r.c);if(o&&o.merge)T[r.id]=merge(T[r.id]||{},d);else T[r.id]=merge({},d);notify()}
export async function updateDoc(r,...args){const T=tbl(r.c);if(args.length===1&&args[0]&&typeof args[0]==='object')args=Object.entries(args[0]).flat();if(!T[r.id])throw Object.assign(new Error('not-found'),{code:'not-found'});
  for(let i=0;i<args.length;i+=2){const p=args[i],segs=p instanceof FieldPath?p.segs:String(p).split('.');setPath(T[r.id],segs,args[i+1])}notify()}
export async function getDoc(r){const d=tbl(r.c)[r.id];return {exists:()=>!!d,data:()=>structuredClone(d)}}
export async function getDocs(t){const T=tbl(t.c);return {docs:Object.keys(T).map(i=>({id:i,data:()=>structuredClone(T[i])}))}}
export function writeBatch(){const ops=[];return {set(r,d,o){ops.push(()=>setDoc(r,d,o));return this},async commit(){if(ops.length>500)throw new Error('batch>500');for(const f of ops)await f()}}}
export async function runTransaction(db,fn){const w=[];const tx={get:async r=>getDoc(r),set(r,d){w.push(()=>setDoc(r,d))}};const res=await fn(tx);for(const f of w)await f();return res}

G.__notify=()=>notify();
