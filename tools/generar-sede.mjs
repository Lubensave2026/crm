// Genera la carpeta lista para publicar de OTRA sede a partir de una COPIA del index.html de Zona 10.
// El index.html de Zona 10 (el que está en producción) NO se modifica nunca: aquí solo se transforma la copia.
//   node tools/generar-sede.mjs carretera            -> dist/carretera/
//   node tools/generar-sede.mjs ruta/sede.json --out ruta/salida   (para pruebas)
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'..');
const arg=process.argv[2];
if(!arg){console.error('Uso: node tools/generar-sede.mjs <id | ruta.json> [--out carpeta]');process.exit(1)}
const jsonPath=arg.endsWith('.json')?path.resolve(arg):path.join(root,'sedes',arg+'.json');
const cfg=JSON.parse(fs.readFileSync(jsonPath,'utf8'));
const oi=process.argv.indexOf('--out');
const out=oi>0?path.resolve(process.argv[oi+1]):path.join(root,'dist',cfg.id);
const fail=m=>{console.error(m);process.exit(1)};

// ---- Validación: nada pendiente ni vacío ----
const req=['id','docId','prefijo','nombre','corto','clearMechanic','asesor','shortName'];
const fbReq=['apiKey','authDomain','projectId','storageBucket','messagingSenderId','appId'];
const malos=[...req.filter(k=>!cfg[k]||/PENDIENTE/i.test(String(cfg[k]))),...fbReq.filter(k=>!cfg.firebase||!cfg.firebase[k]||/PENDIENTE/i.test(String(cfg.firebase[k]))).map(k=>'firebase.'+k)];
if(malos.length)fail('Faltan datos en '+path.relative(root,jsonPath)+': '+malos.join(', '));
if(!/^https:\/\/[^\s"'<>`$\\]+$/.test(cfg.clearMechanic))fail('clearMechanic debe ser una dirección https sin caracteres especiales');
const texto=/^[\p{L}\p{N} .,&·\-]+$/u;                       // sin comillas, backticks ni $ para no romper el código
for(const k of ['nombre','corto','shortName','asesor'])if(!texto.test(cfg[k]))fail(`"${k}" tiene caracteres no permitidos (usa letras, números, espacios y . , & · -)`);
if(!/^[a-z0-9_]+$/.test(cfg.docId)||!/^[a-z0-9_]+$/.test(cfg.prefijo))fail('docId y prefijo: solo minúsculas, números y _');
if(cfg.id==='zona10'||cfg.docId==='zona10'||cfg.firebase.projectId==='crm-lube-n-save')fail('Esta herramienta no genera Zona 10: ese archivo no se toca.');

// ---- Transformación de la copia ----
let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function sub(nombre,buscar,poner,minimo){
  const n=html.split(buscar).length-1;
  if(n<(minimo||1))fail(`Plantilla cambió: no se encontró "${nombre}" (${n} coincidencias). Hay que actualizar tools/generar-sede.mjs.`);
  html=html.split(buscar).join(poner);
}
// Firebase de la sede
{const re=/const FB_CFG=\{[^\n]*\};/;if(!re.test(html))fail('Plantilla cambió: no se encontró FB_CFG');html=html.replace(re,()=>'const FB_CFG='+JSON.stringify(cfg.firebase)+';')}
// Documentos propios de la sede
sub("crm_enlaces","'crm_enlaces','zona10'","'crm_enlaces','"+cfg.docId+"'",2);
sub("crm_config","'crm_config','zona10'","'crm_config','"+cfg.docId+"'",3);
// Claves del navegador (mismo origen en GitHub Pages: deben ser distintas por sede)
sub("prefijo","'lns_crm_'","'"+cfg.prefijo+"'",5);
// Textos y enlaces propios de la sede
sub("mensajes y respaldo","Lube N Save Zona 10",cfg.nombre,3);
sub("encabezado","'Zona 10 · '","'"+cfg.corto+" · '",1);
sub("encabezado estático",'<span id="hoyFecha">Zona 10</span>','<span id="hoyFecha">'+esc(cfg.corto)+'</span>',1);
sub("Clear Mechanic","https://lubensavezona10.clearmechanic.com/dashboard/orders",cfg.clearMechanic,1);
sub("asesor por defecto","asesor:'Ricardo'","asesor:'"+cfg.asesor+"'",1);
sub("asesor por defecto (ajustes)","||'Ricardo'","||'"+cfg.asesor+"'",1);
// Nombre de la aplicación
const nombreApp='CRM Lube N Save · '+cfg.corto;
sub("título",'<title>CRM Lube N Save</title>','<title>'+esc(nombreApp)+'</title>',1);
sub("application-name",'<meta name="application-name" content="CRM Lube N Save">','<meta name="application-name" content="'+esc(nombreApp)+'">',1);
sub("apple title",'<meta name="apple-mobile-web-app-title" content="CRM LNS">','<meta name="apple-mobile-web-app-title" content="'+esc(cfg.shortName)+'">',1);

fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'index.html'),html);
const man=JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8'));
man.name=nombreApp;man.short_name=cfg.shortName;man.description='Recuperación de presupuestos no autorizados · '+cfg.nombre;
fs.writeFileSync(path.join(out,'manifest.webmanifest'),JSON.stringify(man,null,2)+'\n');
fs.cpSync(path.join(root,'icons'),path.join(out,'icons'),{recursive:true});
fs.copyFileSync(path.join(root,'firestore.rules'),path.join(out,'firestore.rules'));
fs.writeFileSync(path.join(out,'firebase.json'),JSON.stringify({firestore:{rules:'firestore.rules'}},null,2)+'\n');
fs.writeFileSync(path.join(out,'.firebaserc'),JSON.stringify({projects:{default:cfg.firebase.projectId}},null,2)+'\n');
console.log('Sede "'+cfg.nombre+'" generada en '+out);
