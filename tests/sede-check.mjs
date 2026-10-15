// Genera una sede de prueba y verifica que no quede nada de Zona 10 ni del proyecto Firebase original.
//   node tests/sede-check.mjs           -> además deja la app generada en tests/out/sede-prueba/ para correr: APP_HTML=tests/out/sede-prueba/index.html node tests/ui-test.mjs
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {execFileSync} from 'node:child_process';
const dir=path.dirname(fileURLToPath(import.meta.url)),root=path.join(dir,'..'),out=path.join(dir,'out','sede-prueba');
let fallos=0;const ok=(n,v)=>{if(!v)fallos++;console.log((v?'OK  ':'FALLA')+' '+n)};
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(path.join(dir,'out'),{recursive:true});
const j=path.join(dir,'out','sede-prueba.json');
fs.writeFileSync(j,JSON.stringify({id:'prueba',docId:'prueba',prefijo:'lns_crm_prueba_',nombre:'Lube N Save Sede de Prueba',corto:'Sede de Prueba',shortName:'CRM Prueba',clearMechanic:'https://sedeprueba.clearmechanic.com/dashboard/orders',asesor:'Ricardo',
  firebase:{apiKey:'AIzaFAKE',authDomain:'crm-prueba.firebaseapp.com',projectId:'crm-prueba',storageBucket:'crm-prueba.firebasestorage.app',messagingSenderId:'1',appId:'1:1:web:abc'}}));
execFileSync('node',[path.join(root,'tools','generar-sede.mjs'),j,'--out',out],{stdio:'pipe'});
const html=fs.readFileSync(path.join(out,'index.html'),'utf8');
const man=JSON.parse(fs.readFileSync(path.join(out,'manifest.webmanifest'),'utf8'));
const rc=JSON.parse(fs.readFileSync(path.join(out,'.firebaserc'),'utf8'));
ok('index.html generado',html.length>100000);
for(const t of ['Zona 10','zona10','lubensavezona10','crm-lube-n-save','AIzaSyAf8qbial6VACkhtM6po9N97osPQ'])ok(`sin rastro de "${t}"`,!html.includes(t));
ok('trae el nombre y el Clear Mechanic de la sede',html.includes('Lube N Save Sede de Prueba')&&html.includes('sedeprueba.clearmechanic.com'));
ok('título y manifiesto con el nombre de la sede',html.includes('<title>CRM Lube N Save · Sede de Prueba</title>')&&man.name==='CRM Lube N Save · Sede de Prueba'&&man.short_name==='CRM Prueba');
ok('.firebaserc apunta al proyecto de la sede',rc.projects.default==='crm-prueba');
ok('íconos y reglas copiados',fs.existsSync(path.join(out,'icons','icon-512.png'))&&fs.existsSync(path.join(out,'firestore.rules')));
{const m=fs.readFileSync(path.join(root,'index.html'),'utf8');ok('el index.html de Zona 10 sigue siendo el de Zona 10 (el generador no lo toca)',m.includes('Lube N Save Zona 10')&&m.includes('crm-lube-n-save')&&!m.includes('Sede de Prueba'))}
let noZ=false;try{execFileSync('node',[path.join(root,'tools','generar-sede.mjs'),'zona10','--out',path.join(dir,'out','no-zona10')],{stdio:'pipe'})}catch(e){noZ=/no genera Zona 10/.test(String(e.stderr))}
ok('el generador se niega a generar Zona 10',noZ&&!fs.existsSync(path.join(dir,'out','no-zona10')));
// una sede con datos PENDIENTE no se genera
const jp=path.join(dir,'out','sede-pendiente.json');fs.writeFileSync(jp,JSON.stringify({...JSON.parse(fs.readFileSync(j,'utf8')),clearMechanic:'PENDIENTE'}));
let rechazo=false;try{execFileSync('node',[path.join(root,'tools','generar-sede.mjs'),jp,'--out',path.join(dir,'out','no-debe-existir')],{stdio:'pipe'})}catch(e){rechazo=/Faltan datos/.test(String(e.stderr))}
ok('sede con datos PENDIENTE: se rechaza',rechazo&&!fs.existsSync(path.join(dir,'out','no-debe-existir')));
process.exit(fallos?1:0);
