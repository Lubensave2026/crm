// Crea los usuarios (PIN con hash SHA-256 + sal) y la configuración inicial en Firestore.
// Ejecútalo TÚ en tu terminal: los PIN no se guardan en ningún archivo.
//   node tests/seed-usuarios.mjs            (Zona 10)
//   node tests/seed-usuarios.mjs carretera  (usa sedes/carretera.json: proyecto Firebase y usuarios de esa sede)
import readline from 'node:readline';
import crypto from 'node:crypto';
import {initializeApp} from 'firebase/app';
import {getAuth,signInAnonymously} from 'firebase/auth';
import {getFirestore,doc,setDoc,getDoc} from 'firebase/firestore';
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const sede=JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)),'..','sedes',(process.argv[2]||'zona10')+'.json'),'utf8'));
if(JSON.stringify(sede).includes('PENDIENTE')){console.error('Completa primero sedes/'+sede.id+'.json (hay datos PENDIENTE).');process.exit(1)}
console.log('Sede: '+sede.nombre+' · proyecto Firebase: '+sede.firebase.projectId);
const app=initializeApp(sede.firebase);
const USERS=sede.usuarios;
const rl=readline.createInterface({input:process.stdin,output:process.stdout,terminal:true});
let muted=false;const w=rl._writeToOutput.bind(rl);rl._writeToOutput=s=>{if(!muted||/[\r\n]/.test(s))w(s)};
const ask=q=>new Promise(r=>{process.stdout.write(q);muted=true;rl.question('',a=>{muted=false;process.stdout.write('\n');r(a.trim())})});
await signInAnonymously(getAuth(app));const db=getFirestore(app);
for(const u of USERS){
  const ya=(await getDoc(doc(db,'crm_usuarios',u.id))).exists();
  let pin;for(;;){pin=await ask(`PIN de ${u.nombre} (${u.rol}), 6 dígitos${ya?' [ya existe: se reemplaza]':''}: `);if(/^\d{6}$/.test(pin))break;console.log('Deben ser exactamente 6 dígitos.')}
  const sal=crypto.randomBytes(16).toString('hex');
  const pinHash=crypto.createHash('sha256').update(sal+':'+u.id+':'+pin).digest('hex');
  await setDoc(doc(db,'crm_usuarios',u.id),{nombre:u.nombre,rol:u.rol,sal,pinHash});
  console.log('  ✓ '+u.nombre);
}
const cfg=doc(db,'crm_config',sede.docId);
if(!(await getDoc(cfg)).exists())await setDoc(cfg,{min:2,max:5,meta:60000,pct1:1,pct2:2,base:'total',asesor:sede.asesor});
console.log('Listo.');rl.close();process.exit(0);
